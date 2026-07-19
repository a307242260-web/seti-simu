#!/usr/bin/env python3
"""Run SETI-95 ablations, multi-RNG PPO, frozen evaluation and deployment export."""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path
from typing import Any

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "randomizer" / "training"))

from rl_worker_client import SetiWorkerClient  # noqa: E402
from long_training import (  # noqa: E402
    POLICY_VERSION, EncodedStep, LongCandidatePolicy, TrainConfig, acceptance,
    assign_dense_returns, canonical_json, checkpoint_metric, config_payload,
    deployment_smoke, encode_decision, evaluation_metrics, export_deployment,
    load_bc_examples, load_seti39_checkpoint, load_training_checkpoint,
    ppo_update, sanitized_action, save_training_checkpoint, score_for, sha256_file,
    training_budget_reached, utc_run_timestamp,
)


def terminal_scores(observation: dict[str, Any]) -> dict[str, float]:
    result = {}
    for player in observation.get("publicState", {}).get("players", []):
        player_id = player.get("playerId", player.get("id"))
        final_score = player.get("finalScore")
        result[player_id] = float(final_score if final_score is not None else player.get("score", 0))
    return result


def ranks_from_scores(scores: dict[str, float]) -> dict[str, int]:
    return {player_id: 1 + sum(other > score for other in scores.values())
            for player_id, score in scores.items()}


def sample_action(model: LongCandidatePolicy, observation: dict[str, Any],
                  candidates: list[dict[str, Any]], stochastic: bool) -> tuple[int, float, float, list[float]]:
    with torch.no_grad():
        logits, value = model(observation, candidates)
        distribution = torch.distributions.Categorical(logits=logits)
        index = int(distribution.sample()) if stochastic else int(logits.argmax())
        log_prob = float(distribution.log_prob(torch.tensor(index)))
    return index, log_prob, float(value), [float(item) for item in logits]


def collect_episode(client: SetiWorkerClient, worker: int, model: LongCandidatePolicy,
                    seed: str, episode_id: str, stochastic: bool,
                    policy_version: str, max_decisions: int = 2000,
                    max_turn_actions: int | None = None,
                    evidence_handle=None) -> dict[str, Any]:
    state = client.worker_request(worker, "reset", {"config": {
        "seed": seed,
        "activePlayerCount": 4,
        "episodeId": episode_id,
        "policyVersion": policy_version,
        "opponentIdentity": "current+frozen-history-self-play",
        "seat": worker % 4,
        "compactReplay": True,
    }})
    steps: list[EncodedStep] = []
    before_scores: list[float] = []
    after_scores: list[float] = []
    turn_actions = 0
    for step_index in range(max_decisions):
        if state["terminal"]:
            break
        observation = state["observation"]
        candidates = [sanitized_action(item) for item in state["legalActions"]]
        if not candidates:
            raise RuntimeError(f"empty legal set: seed={seed} step={step_index}")
        index, log_prob, value, logits = sample_action(model, observation, candidates, stochastic)
        chosen = candidates[index]
        actor = chosen["actorPlayerId"]
        before_scores.append(score_for(observation, actor))
        encoded = encode_decision(observation, candidates, index, log_prob, value, actor)
        try:
            result = client.worker_request(worker, "step", {"action": chosen})
        except Exception as error:
            raise RuntimeError(
                f"illegal/blocked rollout action seed={seed} step={step_index} "
                f"action={canonical_json(chosen)}: {error}"
            ) from error
        state = {
            "observation": result["observation"],
            "legalActions": result["legalActions"],
            "terminal": result["done"],
        }
        after_scores.append(score_for(state["observation"], actor, terminal=state["terminal"]))
        steps.append(encoded)
        if chosen.get("decisionType") == "turn_action":
            turn_actions += 1
        if evidence_handle is not None:
            evidence_handle.write(canonical_json({
                "schemaVersion": "seti-ppo-rollout-v1",
                "episodeId": episode_id,
                "seed": seed,
                "step": step_index,
                "policyVersion": policy_version,
                "actorPlayerId": actor,
                "actionId": chosen["actionId"],
                "legalMask": [candidate["actionId"] for candidate in candidates],
                "logits": [round(value, 7) for value in logits],
                "logProb": log_prob,
                "value": value,
                "heuristicFallback": False,
            }) + "\n")
    if not state["terminal"]:
        raise RuntimeError(f"episode did not terminate: seed={seed} decisions={len(steps)}")
    scores = terminal_scores(state["observation"])
    assign_dense_returns(steps, before_scores, after_scores, scores)
    ranks = ranks_from_scores(scores)
    return {
        "steps": steps,
        "scores": scores,
        "ranks": ranks,
        "decisions": len(steps),
        "turnActions": turn_actions,
        "withinTurnActionLimit": max_turn_actions is None or turn_actions <= max_turn_actions,
    }


def step_auc(curve: list[dict[str, Any]]) -> float:
    previous = 0
    total = 0.0
    for point in curve:
        current = int(point["envSteps"])
        total += (current - previous) * float(point["meanScore"])
        previous = current
    return total / max(1, previous)


def evaluate_model(model: LongCandidatePolicy, seeds: list[str], rng_seed: int,
                   policy_version: str, output_dir: Path,
                   max_turn_actions: int | None = None,
                   stochastic: bool = True) -> dict[str, Any]:
    random.seed(rng_seed)
    torch.manual_seed(rng_seed)
    output_dir.mkdir(parents=True, exist_ok=True)
    curves = []
    scores: list[float] = []
    started = time.monotonic()
    with (output_dir / "rollout.jsonl").open("w", encoding="utf-8") as evidence, SetiWorkerClient(workers=1) as client:
        for index, seed in enumerate(seeds):
            episode = collect_episode(
                client, 0, model, seed, f"{policy_version}-eval-{index}", stochastic,
                policy_version, max_turn_actions=max_turn_actions, evidence_handle=evidence,
            )
            game_scores = list(episode["scores"].values())
            scores.extend(game_scores)
            curves.append({
                "episode": index + 1,
                "envSteps": sum(item["decisions"] for item in curves) + episode["decisions"] if curves else episode["decisions"],
                "seed": seed,
                "scores": episode["scores"],
                "meanScore": sum(game_scores) / 4,
                "turnActions": episode["turnActions"],
                "withinTurnActionLimit": episode["withinTurnActionLimit"],
                "decisions": episode["decisions"],
            })
    eligible = [game for game in curves if game["withinTurnActionLimit"]]
    eligible_scores = [score for game in eligible for score in game["scores"].values()]
    metrics = evaluation_metrics(
        eligible_scores, games=len(seeds), terminal_games=len(eligible),
        blocked_games=len(seeds) - len(eligible),
    )
    return {
        "metrics": metrics,
        "games": curves,
        "allTerminalScores": scores,
        "wallClockSeconds": time.monotonic() - started,
        "rolloutEvidence": str(output_dir / "rollout.jsonl"),
    }


def initialize_model(initialization: str, bc_checkpoint: Path | None) -> tuple[LongCandidatePolicy, dict[str, Any]]:
    if initialization == "random":
        return LongCandidatePolicy(), {"initialization": "random"}
    if bc_checkpoint is None:
        raise ValueError("BC initialization requires --bc-checkpoint")
    try:
        model, payload = load_training_checkpoint(bc_checkpoint)
    except ValueError:
        model, payload = load_seti39_checkpoint(bc_checkpoint)
    return model, {"initialization": "bc", "sourceCheckpoint": str(bc_checkpoint),
                   "sourceMetadata": payload.get("metadata", {})}


def train_one(args: argparse.Namespace) -> dict[str, Any]:
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    config = TrainConfig(
        env_steps=args.env_steps,
        learning_rate=args.learning_rate,
        entropy_start=args.entropy_start,
        entropy_end=args.entropy_end,
        bc_start=args.bc_start,
        bc_end=args.bc_end,
        advantage_normalization=not args.no_advantage_normalization,
        update_epochs=args.update_epochs,
        minibatch_size=args.minibatch_size,
    )
    model, initialization = initialize_model(args.initialization, args.bc_checkpoint)
    optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)
    bc_examples = None
    if config.bc_start > 0:
        if args.dataset is None:
            raise ValueError("BC auxiliary loss requires --dataset")
        bc_examples = load_bc_examples(args.dataset, limit=args.bc_sample_limit)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    train_curve = []
    update_metrics = []
    best = None
    env_steps = 0
    sampled_steps = 0
    started = time.monotonic()
    policy_version = f"{POLICY_VERSION}-rng{args.seed}-{args.initialization}"
    light_seeds = [f"seti-95-light-eval-{index}" for index in range(args.light_eval_games)]
    next_evaluation = args.eval_interval
    with (args.output_dir / "train.rollout.jsonl").open("w", encoding="utf-8") as evidence, SetiWorkerClient(workers=1) as client:
        episode_index = 0
        while not training_budget_reached(
            env_steps, config.env_steps, episode_index, args.episodes,
        ):
            seed = f"seti-95-train-rng{args.seed}-{episode_index}"
            episode = collect_episode(
                client, 0, model, seed, f"{policy_version}-train-{episode_index}", True,
                policy_version, evidence_handle=evidence,
            )
            sampled_steps += episode["decisions"]
            remaining = config.env_steps - env_steps
            update_steps = episode["steps"][:remaining]
            metrics = ppo_update(model, optimizer, update_steps, config, env_steps, bc_examples)
            env_steps += len(update_steps)
            game_scores = list(episode["scores"].values())
            point = {
                "episode": episode_index + 1,
                "envSteps": env_steps,
                "sampledEnvSteps": sampled_steps,
                "seed": seed,
                "meanScore": sum(game_scores) / 4,
                "scores": episode["scores"],
                **metrics,
            }
            train_curve.append(point)
            update_metrics.append(metrics)
            episode_index += 1
            budget_reached = training_budget_reached(
                env_steps, config.env_steps, episode_index, args.episodes,
            )
            if env_steps >= next_evaluation or budget_reached:
                evaluation = evaluate_model(
                    model, light_seeds, args.seed,
                    f"{policy_version}-step{env_steps}",
                    args.output_dir / f"eval-{env_steps}",
                )
                checkpoint_path = args.output_dir / f"checkpoint-{env_steps}.pt"
                checkpoint_metadata = {
                    "stage": "ppo",
                    "policyVersion": policy_version,
                    "trainingRng": args.seed,
                    "envSteps": env_steps,
                    "sampledEnvSteps": sampled_steps,
                    "config": config_payload(config),
                    "initialization": initialization,
                    "selectionProtocol": "safety-then-mean-p25-p50-v1",
                    "lightEvaluationSeeds": light_seeds,
                    "lightEvaluationMetrics": evaluation["metrics"],
                }
                save_training_checkpoint(checkpoint_path, model, checkpoint_metadata)
                candidate = {
                    "path": str(checkpoint_path),
                    "envSteps": env_steps,
                    "metrics": evaluation["metrics"],
                    "metric": list(checkpoint_metric(evaluation["metrics"])),
                }
                if best is None or tuple(candidate["metric"]) > tuple(best["metric"]):
                    best = candidate
                next_evaluation += args.eval_interval
    if best is None:
        raise RuntimeError("training produced no checkpoint evaluation")
    report = {
        "schemaVersion": "seti-long-training-report-v1",
        "policyVersion": policy_version,
        "trainingRng": args.seed,
        "config": config_payload(config),
        "initialization": initialization,
        "requestedEpisodes": args.episodes,
        "trainingEpisodes": episode_index,
        "envSteps": env_steps,
        "sampledEnvSteps": sampled_steps,
        "wallClockSeconds": time.monotonic() - started,
        "curve": train_curve,
        "earlyAuc": step_auc(train_curve),
        "finalMeanScore": train_curve[-1]["meanScore"],
        "meanEntropy": sum(item["entropy"] for item in update_metrics) / len(update_metrics),
        "meanApproxKl": sum(item["approxKl"] for item in update_metrics) / len(update_metrics),
        "meanValueLoss": sum(item["valueLoss"] for item in update_metrics) / len(update_metrics),
        "meanPolicyLoss": sum(item["policyLoss"] for item in update_metrics) / len(update_metrics),
        "meanBcLoss": sum(item["bcLoss"] for item in update_metrics) / len(update_metrics),
        "bestCheckpoint": best,
        "teacherInRolloutHotPath": False,
        "illegalActionRate": 0.0,
        "blockedGameRate": 0.0,
        "createdEpoch": utc_run_timestamp(),
    }
    (args.output_dir / "training-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return report


def run_evaluate(args: argparse.Namespace) -> dict[str, Any]:
    seed_pool = json.loads(args.seed_pool.read_text(encoding="utf-8"))
    if seed_pool.get("id") != "stable-200-v2":
        raise ValueError("final evaluation requires the frozen stable-200-v2 protocol")
    model, payload = load_training_checkpoint(args.checkpoint)
    result = evaluate_model(
        model, [str(seed) for seed in seed_pool["seeds"]], args.seed,
        f"{POLICY_VERSION}-stable-200-v2", args.output_dir,
        max_turn_actions=int(seed_pool["maxSteps"]),
    )
    report = {
        "schemaVersion": "seti-learned-policy-evaluation-v1",
        "protocol": seed_pool,
        "checkpoint": {
            "path": str(args.checkpoint),
            "sha256": sha256_file(args.checkpoint),
            "metadata": payload.get("metadata", {}),
        },
        **result,
        "acceptance": acceptance(result["metrics"], seed_pool["acceptance"]),
    }
    (args.output_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return report


def run_deploy(args: argparse.Namespace) -> dict[str, Any]:
    provenance = json.loads(args.provenance.read_text(encoding="utf-8"))
    manifest = export_deployment(args.checkpoint, args.output_dir, provenance)
    fixture = json.loads(args.smoke_fixture.read_text(encoding="utf-8"))
    decision = deployment_smoke(args.output_dir, fixture["observation"], fixture["legalActions"])
    smoke = {"manifest": manifest, "decision": decision, "passed": decision["legal"]}
    (args.output_dir / "smoke.json").write_text(
        json.dumps(smoke, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return smoke


def add_common_train_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--initialization", choices=("bc", "random"), required=True)
    parser.add_argument("--bc-checkpoint", type=Path)
    parser.add_argument("--dataset", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--env-steps", type=int, default=30000)
    parser.add_argument(
        "--episodes", type=int,
        help="stop after this many complete training episodes (for staged review runs)",
    )
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--entropy-start", type=float, default=0.02)
    parser.add_argument("--entropy-end", type=float, default=0.002)
    parser.add_argument("--bc-start", type=float, default=0.15)
    parser.add_argument("--bc-end", type=float, default=0.0)
    parser.add_argument("--no-advantage-normalization", action="store_true")
    parser.add_argument("--update-epochs", type=int, default=2)
    parser.add_argument("--minibatch-size", type=int, default=64)
    parser.add_argument("--bc-sample-limit", type=int, default=2048)
    parser.add_argument("--eval-interval", type=int, default=5000)
    parser.add_argument("--light-eval-games", type=int, default=4)


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    train = subparsers.add_parser("train")
    add_common_train_arguments(train)
    evaluate = subparsers.add_parser("evaluate")
    evaluate.add_argument("--checkpoint", type=Path, required=True)
    evaluate.add_argument("--seed-pool", type=Path, default=(
        ROOT / "randomizer" / "training" / "evaluation" / "stable-200-v2.seeds.json"
    ))
    evaluate.add_argument("--output-dir", type=Path, required=True)
    evaluate.add_argument("--seed", type=int, default=7)
    deploy = subparsers.add_parser("deploy")
    deploy.add_argument("--checkpoint", type=Path, required=True)
    deploy.add_argument("--provenance", type=Path, required=True)
    deploy.add_argument("--smoke-fixture", type=Path, required=True)
    deploy.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "train":
        result = train_one(args)
    elif args.command == "evaluate":
        result = run_evaluate(args)
    else:
        result = run_deploy(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
