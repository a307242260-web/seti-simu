#!/usr/bin/env python3
"""CLI for demonstration export, BC warm-start and masked PPO experiments."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from pathlib import Path
from typing import Any

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "randomizer" / "training"))

from rl_worker_client import SetiWorkerClient  # noqa: E402
from pytorch_trainer import (  # noqa: E402
    DATASET_SCHEMA, ROLLOUT_SCHEMA, CandidatePolicy, RolloutStep, audit_dataset,
    canonical_json, load_checkpoint, ppo_update,
    ranks_from_scores, sanitized_action, save_checkpoint, sha256_text,
    stable_evaluation_metrics, evaluate_stable_acceptance, terminal_scores, train_bc,
)


def split_for_episode(index: int) -> str:
    return ("train", "train", "validation", "test")[index % 4]


def teacher_difficulty(version: str) -> str:
    mapping = {
        "existing-heuristic-laughable-v1": "laughable",
        "existing-heuristic-weak-start-v1": "weak_start",
    }
    if version not in mapping:
        raise ValueError(f"unsupported existing heuristic version: {version}")
    return mapping[version]


def write_dataset(output: Path, records: list[dict[str, Any]], episodes: list[dict[str, Any]],
                  tier: str, teacher_versions: list[str]) -> dict[str, Any]:
    output.parent.mkdir(parents=True, exist_ok=True)
    body = "".join(canonical_json(record) + "\n" for record in records)
    output.write_text(body, encoding="utf-8")
    audit = audit_dataset(records)
    manifest = {
        "schemaVersion": DATASET_SCHEMA, "datasetVersion": f"{tier}-v1", "tier": tier,
        "sha256": sha256_text(body), "teacherVersions": teacher_versions,
        "episodes": episodes, "recordCount": len(records), "audit": audit,
        "splitPolicy": "episode-index-mod4:train,train,validation,test",
    }
    output.with_suffix(output.suffix + ".manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def export_demonstrations(args: argparse.Namespace) -> dict[str, Any]:
    episodes: list[dict[str, Any]] = []
    split_seeds: dict[str, set[str]] = {}
    record_count = 0
    digest = hashlib.sha256()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    partial_output = args.output.with_suffix(args.output.suffix + ".partial")
    progress_path = partial_output.with_suffix(partial_output.suffix + ".manifest.json")
    start_index = 0
    output_mode = "w"
    if args.resume_partial and partial_output.exists() and progress_path.exists():
        progress = json.loads(progress_path.read_text(encoding="utf-8"))
        if (
            progress.get("tier") != args.tier
            or progress.get("targetEpisodes") != args.episodes
            or progress.get("teacherVersions") != args.teacher_versions
        ):
            raise RuntimeError("partial demonstration manifest 与当前导出参数不一致")
        episodes = list(progress.get("episodes") or [])
        record_count = int(progress.get("recordCount") or 0)
        start_index = len(episodes)
        for episode_index, episode in enumerate(episodes):
            split_seeds.setdefault(split_for_episode(episode_index), set()).add(str(episode["seed"]))
        with partial_output.open("rb") as existing:
            for chunk in iter(lambda: existing.read(1024 * 1024), b""):
                digest.update(chunk)
        output_mode = "a"
        print(f"[demo] resume {start_index}/{args.episodes} records={record_count}", file=sys.stderr)
    with partial_output.open(output_mode, encoding="utf-8") as output_handle, SetiWorkerClient(workers=2) as client:
        for episode_index in range(start_index, args.episodes):
            seed = f"seti-demo-{args.tier}-{split_for_episode(episode_index)}-{episode_index}"
            episode_id = f"{args.tier}-{episode_index:04d}"
            teacher_version = args.teacher_versions[episode_index % len(args.teacher_versions)]
            ai_difficulty = teacher_difficulty(teacher_version)
            seat = episode_index % 4
            state = client.worker_request(0, "reset", {"config": {
                "seed": seed, "activePlayerCount": 4, "episodeId": episode_id,
                "policyVersion": teacher_version, "opponentIdentity": "heuristic-demonstration",
                "seat": seat, "aiDifficulty": ai_difficulty, "offlineTeacher": True,
                "compactReplay": True,
            }})
            replay_state = client.worker_request(1, "reset", {"config": {
                "seed": seed, "activePlayerCount": 4, "episodeId": episode_id,
                "policyVersion": teacher_version, "opponentIdentity": "canonical-replay",
                "seat": seat, "aiDifficulty": ai_difficulty, "offlineTeacher": False,
                "compactReplay": True,
            }})
            episode_records: list[dict[str, Any]] = []
            replay_actions: list[dict[str, Any]] = []
            adapter_counts: dict[str, int] = {}
            legal_set_divergences = 0
            for step in range(args.max_steps):
                if state["terminal"]:
                    break
                decision = client.worker_request(0, "offline_teacher_decision")
                observation = decision["beforeObservation"]
                legal = [sanitized_action(item) for item in decision["beforeActions"]]
                chosen = sanitized_action(decision["chosenAction"])
                adapter = decision.get("teacherAdapter")
                if adapter:
                    adapter_counts[adapter] = adapter_counts.get(adapter, 0) + 1
                episode_records.append({
                    "episodeId": episode_id, "seed": seed, "seat": seat, "step": step,
                    "teacherPolicyVersion": teacher_version, "observation": observation,
                    "legalCandidates": legal, "chosenAction": chosen,
                    "terminalScores": None, "rank": None, "split": split_for_episode(episode_index),
                })
                replay_actions.append(chosen)
                state = {"observation": decision["observation"],
                         "legalActions": decision["legalActions"], "terminal": decision["done"]}
                try:
                    replay_result = client.worker_request(1, "step", {"action": chosen})
                except Exception as error:
                    raise RuntimeError(
                        f"canonical replay failed at {episode_id} step {step} "
                        f"action={chosen['actionId']}: {error}") from error
                replay_state = {"observation": replay_result["observation"],
                                "legalActions": replay_result["legalActions"],
                                "terminal": replay_result["done"]}
                teacher_legal_ids = [item["actionId"] for item in state["legalActions"]]
                replay_legal_ids = [item["actionId"] for item in replay_state["legalActions"]]
                if teacher_legal_ids != replay_legal_ids:
                    legal_set_divergences += 1
                if state["terminal"] != replay_state["terminal"]:
                    raise RuntimeError(
                        f"canonical replay terminal diverged at {episode_id} step {step}: "
                        f"action={chosen['family']}:{chosen['actionId']} "
                        f"teacher={teacher_legal_ids[:8]} replay={replay_legal_ids[:8]}")
            if not state["terminal"]:
                raise RuntimeError(f"{episode_id} did not terminate within {args.max_steps} decisions")
            scores = terminal_scores(state["observation"])
            ranks = ranks_from_scores(scores)
            for record in episode_records:
                record["terminalScores"] = scores
                record["rank"] = ranks[record["chosenAction"]["actorPlayerId"]]
            if not replay_state["terminal"] or terminal_scores(replay_state["observation"]) != scores:
                raise RuntimeError("fresh replay parity failed")
            episode_audit = audit_dataset(episode_records)
            if episode_audit["illegalRate"] != 0 or episode_audit["hiddenInformationAudit"] != "pass":
                raise RuntimeError(f"demonstration audit failed for {episode_id}: {episode_audit}")
            split = split_for_episode(episode_index)
            split_seeds.setdefault(split, set()).add(seed)
            for record in episode_records:
                line = canonical_json(record) + "\n"
                output_handle.write(line)
                digest.update(line.encode("utf-8"))
            output_handle.flush()
            record_count += len(episode_records)
            episodes.append({"episodeId": episode_id, "seed": seed, "seat": seat,
                             "teacherPolicyVersion": teacher_version, "steps": len(episode_records),
                             "terminalScores": scores, "replayParity": True,
                             "headlessAdapterCounts": adapter_counts,
                             "legalSetDivergences": legal_set_divergences})
            progress_path.write_text(json.dumps({
                "schemaVersion": DATASET_SCHEMA,
                "tier": args.tier,
                "targetEpisodes": args.episodes,
                "teacherVersions": args.teacher_versions,
                "recordCount": record_count,
                "episodes": episodes,
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"[demo] {episode_index + 1}/{args.episodes} steps={len(episode_records)}", file=sys.stderr)
    split_names = list(split_seeds)
    for index, left in enumerate(split_names):
        for right in split_names[index + 1:]:
            if split_seeds[left] & split_seeds[right]:
                raise RuntimeError(f"seed leakage between {left} and {right}")
    partial_output.replace(args.output)
    if progress_path.exists():
        progress_path.unlink()
    manifest = {
        "schemaVersion": DATASET_SCHEMA, "datasetVersion": f"{args.tier}-v1", "tier": args.tier,
        "sha256": digest.hexdigest(), "teacherVersions": args.teacher_versions,
        "episodes": episodes, "recordCount": record_count,
        "audit": {
            "records": record_count, "episodes": len(episodes), "illegalRate": 0.0,
            "hiddenInformationAudit": "pass",
            "splits": {name: len(seeds) for name, seeds in split_seeds.items()},
        },
        "splitPolicy": "episode-index-mod4:train,train,validation,test",
    }
    args.output.with_suffix(args.output.suffix + ".manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def run_policy_episodes(model: CandidatePolicy, seeds: list[str], policy_version: str,
                        train: bool, output: Path | None = None, learning_rate: float = 3e-4,
                        env_step_budget: int | None = None,
                        max_turn_actions: int | None = None,
                        show_progress: bool = False) -> dict[str, Any]:
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    all_scores: list[float] = []
    all_ranks: list[int] = []
    curve: list[dict[str, Any]] = []
    evidence_lines: list[str] = []
    env_steps = 0
    sampled_env_steps = 0
    entropy_values: list[float] = []
    kl_values: list[float] = []
    with SetiWorkerClient(workers=1) as client:
        for episode_index, seed in enumerate(seeds):
            state = client.worker_request(0, "reset", {"config": {
                "seed": seed, "activePlayerCount": 4, "episodeId": f"{policy_version}-{episode_index}",
                "policyVersion": policy_version, "opponentIdentity": "current+frozen-history-self-play",
                "seat": episode_index % 4, "compactReplay": True,
            }})
            steps: list[RolloutStep] = []
            turn_actions = 0
            turn_action_limit_exceeded = False
            for step_index in range(2000):
                if state["terminal"]:
                    break
                observation = state["observation"]
                candidates = [sanitized_action(item) for item in state["legalActions"]]
                with torch.no_grad():
                    logits, value = model(observation, candidates)
                    distribution = torch.distributions.Categorical(logits=logits)
                    chosen_index = int(distribution.sample())
                    log_prob = float(distribution.log_prob(torch.tensor(chosen_index)))
                chosen = candidates[chosen_index]
                if chosen.get("decisionType") == "turn_action":
                    turn_actions += 1
                    if max_turn_actions is not None and turn_actions > max_turn_actions:
                        turn_action_limit_exceeded = True
                steps.append(RolloutStep(observation, candidates, chosen_index, log_prob,
                                         float(value), chosen["actorPlayerId"], policy_version))
                evidence_lines.append(canonical_json({
                    "schemaVersion": ROLLOUT_SCHEMA, "episode": episode_index, "step": step_index,
                    "policyVersion": policy_version, "actorPlayerId": chosen["actorPlayerId"],
                    "actionId": chosen["actionId"], "legalMask": [c["actionId"] for c in candidates],
                    "logits": [round(float(x), 7) for x in logits], "logProb": log_prob,
                    "value": float(value), "heuristicFallback": False,
                }))
                try:
                    result = client.worker_request(0, "step", {"action": chosen})
                except Exception as error:
                    raise RuntimeError(
                        f"rollout step failed policy={policy_version} episode={episode_index} "
                        f"seed={seed} step={step_index} action={canonical_json(chosen)}: {error}"
                    ) from error
                state = {"observation": result["observation"], "legalActions": result["legalActions"],
                         "terminal": result["done"]}
            if not state["terminal"]:
                raise RuntimeError("PPO rollout did not reach terminal")
            scores = terminal_scores(state["observation"])
            ranks = ranks_from_scores(scores)
            returns = [(scores[item.actor] / 100.0) + (5 - ranks[item.actor]) * 0.1 for item in steps]
            sampled_env_steps += len(steps)
            if train:
                remaining = max(0, (env_step_budget or (env_steps + len(steps))) - env_steps)
                update_steps = steps[:remaining]
                update_returns = returns[:remaining]
                if not update_steps:
                    break
                update = ppo_update(model, optimizer, update_steps, update_returns)
                entropy_values.append(update["entropy"])
                kl_values.append(update["approxKl"])
                env_steps += len(update_steps)
            else:
                env_steps += len(steps)
            all_scores.extend(scores.values())
            all_ranks.extend(ranks.values())
            curve.append({"episode": episode_index + 1, "envSteps": env_steps,
                          "seed": seed, "turnActions": turn_actions,
                          "withinTurnActionLimit": not turn_action_limit_exceeded,
                          "scores": scores,
                          "meanScore": sum(scores.values()) / len(scores),
                          "meanRank": sum(ranks.values()) / len(ranks)})
            if show_progress:
                print(
                    f"[eval] {episode_index + 1}/{len(seeds)} seed={seed} "
                    f"turnActions={turn_actions} scores={list(scores.values())}",
                    file=sys.stderr,
                )
            if train and env_step_budget is not None and env_steps >= env_step_budget:
                break
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("\n".join(evidence_lines) + "\n", encoding="utf-8")
    if train and env_step_budget is not None and env_steps != env_step_budget:
        raise RuntimeError(f"training seed pool exhausted before env-step budget: {env_steps}/{env_step_budget}")
    return {"episodes": len(curve), "envSteps": env_steps, "sampledEnvSteps": sampled_env_steps,
            "meanScore": sum(all_scores) / max(1, len(all_scores)),
            "meanRank": sum(all_ranks) / max(1, len(all_ranks)), "illegalRate": 0.0,
            "scores": all_scores,
            "entropy": sum(entropy_values) / max(1, len(entropy_values)),
            "approxKl": sum(kl_values) / max(1, len(kl_values)), "curve": curve,
            "rolloutEvidence": str(output) if output else None}


def run_frozen_evaluation(args: argparse.Namespace) -> dict[str, Any]:
    seed_pool = json.loads(args.seed_pool.read_text(encoding="utf-8"))
    if seed_pool.get("schemaVersion") != "seti-rl-evaluation-seed-pool-v1":
        raise ValueError("unsupported frozen evaluation seed pool schema")
    if seed_pool.get("activePlayerCount") != 4:
        raise ValueError("frozen evaluation only accepts four-player games")
    seeds = [str(seed) for seed in seed_pool.get("seeds", [])]
    if not seeds or len(seeds) != len(set(seeds)):
        raise ValueError("frozen evaluation seeds must be non-empty and unique")
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    model, payload = load_checkpoint(args.checkpoint)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    result = run_policy_episodes(
        model,
        seeds,
        f"pytorch-{seed_pool['id']}",
        False,
        args.output_dir / "rollout.jsonl",
        max_turn_actions=int(seed_pool.get("maxSteps", 100)),
        show_progress=True,
    )
    eligible_games = [game for game in result["curve"] if game["withinTurnActionLimit"]]
    eligible_scores = [score for game in eligible_games for score in game["scores"].values()]
    blocked_games = len(result["curve"]) - len(eligible_games)
    metrics = stable_evaluation_metrics(
        eligible_scores,
        games=len(seeds),
        terminal_games=len(eligible_games),
        blocked_games=blocked_games,
    )
    report = {
        "schemaVersion": "seti-pytorch-evaluation-report-v1",
        "protocol": {
            "seedPoolId": seed_pool["id"],
            "seedPoolSchemaVersion": seed_pool["schemaVersion"],
            "activePlayerCount": 4,
            "maxTurnActions": int(seed_pool.get("maxSteps", 100)),
            "percentileMethod": "nearest-rank",
            "scorePopulation": "all_terminal_seats",
            "acceptance": seed_pool.get("acceptance", {}),
            "policyRngSeed": args.seed,
        },
        "checkpoint": {
            "path": str(args.checkpoint),
            "schemaVersion": payload.get("schemaVersion"),
            "featureSchemaVersion": payload.get("featureSchemaVersion"),
            "metadata": payload.get("metadata", {}),
        },
        "metrics": metrics,
        "diagnosticTerminalMetrics": stable_evaluation_metrics(
            result["scores"], games=len(seeds), terminal_games=result["episodes"]
        ),
        "acceptance": evaluate_stable_acceptance(metrics, seed_pool.get("acceptance", {})),
        "games": result["curve"],
        "rolloutEvidence": result["rolloutEvidence"],
    }
    (args.output_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


def run_experiment(args: argparse.Namespace) -> dict[str, Any]:
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    bc_model, bc_payload = load_checkpoint(args.bc_checkpoint)
    random_model = CandidatePolicy()
    bc_only_model, _ = load_checkpoint(args.bc_checkpoint)
    training_seeds = [f"seti-ppo-ab-train-{index}" for index in range(args.episodes)]
    evaluation_seeds = [f"seti-ppo-ab-eval-{index}" for index in range(args.episodes)]
    bc_training = run_policy_episodes(bc_model, training_seeds, "bc-init-ppo-train-v1", True,
                                      args.output_dir / "bc-init.train.rollout.jsonl",
                                      env_step_budget=args.env_steps)
    torch.manual_seed(args.seed)
    random_training = run_policy_episodes(random_model, training_seeds, "random-init-ppo-train-v1", True,
                                          args.output_dir / "random-init.train.rollout.jsonl",
                                          env_step_budget=args.env_steps)
    bc_result = run_policy_episodes(bc_model, evaluation_seeds, "bc-init-ppo-eval-v1", False,
                                    args.output_dir / "bc-init.eval.rollout.jsonl")
    random_result = run_policy_episodes(random_model, evaluation_seeds, "random-init-ppo-eval-v1", False,
                                        args.output_dir / "random-init.eval.rollout.jsonl")
    bc_only = run_policy_episodes(bc_only_model, evaluation_seeds, "bc-only-v1", False,
                                  args.output_dir / "bc-only.rollout.jsonl")
    def step_auc(result: dict[str, Any]) -> float:
        previous = 0
        total = 0.0
        for point in result["curve"]:
            total += (point["envSteps"] - previous) * point["meanScore"]
            previous = point["envSteps"]
        return total / max(1, result["envSteps"])
    report = {
        "schemaVersion": "seti-ppo-ab-report-v2", "budget": {"trainingEnvStepsPerArm": args.env_steps,
        "trainingSeedPool": training_seeds, "evaluationSeedPool": evaluation_seeds,
        "evaluationEpisodesPerArm": args.episodes,
        "sameComputeContract": bc_training["envSteps"] == random_training["envSteps"] == args.env_steps},
        "bcCheckpoint": str(args.bc_checkpoint),
        "bcCheckpointMetadata": bc_payload.get("metadata", {}), "bcInitPpo": bc_result,
        "randomInitPpo": random_result, "bcOnly": bc_only,
        "bcInitTraining": bc_training, "randomInitTraining": random_training,
        "earlyAuc": {"bcInit": step_auc(bc_training),
                     "randomInit": step_auc(random_training)},
        "teacherInRolloutHotPath": False,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "ab-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    save_checkpoint(args.output_dir / "bc-init-ppo.pt", bc_model, None,
                    {"stage": "ppo", "initialization": "bc", "abReport": "ab-report.json"})
    save_checkpoint(args.output_dir / "random-init-ppo.pt", random_model, None,
                    {"stage": "ppo", "initialization": "random", "abReport": "ab-report.json"})
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    export = sub.add_parser("export-demonstrations")
    export.add_argument("--tier", choices=("smoke", "expanded"), default="smoke")
    export.add_argument("--episodes", type=int)
    export.add_argument("--output", type=Path, required=True)
    export.add_argument("--max-steps", type=int, default=2000)
    export.add_argument("--resume-partial", action="store_true")
    export.add_argument("--teacher-versions", nargs="+", default=[
        "existing-heuristic-laughable-v1", "existing-heuristic-weak-start-v1"])
    bc = sub.add_parser("train-bc")
    bc.add_argument("--dataset", type=Path, required=True)
    bc.add_argument("--checkpoint", type=Path, required=True)
    bc.add_argument("--epochs", type=int, default=3)
    experiment = sub.add_parser("experiment")
    experiment.add_argument("--bc-checkpoint", type=Path, required=True)
    experiment.add_argument("--output-dir", type=Path, required=True)
    experiment.add_argument("--episodes", type=int, default=4)
    experiment.add_argument("--env-steps", type=int, default=1500)
    experiment.add_argument("--seed", type=int, default=7)
    evaluate = sub.add_parser("evaluate")
    evaluate.add_argument("--checkpoint", type=Path, required=True)
    evaluate.add_argument("--seed-pool", type=Path, default=(
        ROOT / "randomizer" / "training" / "evaluation" / "stable-200-v2.seeds.json"
    ))
    evaluate.add_argument("--output-dir", type=Path, required=True)
    evaluate.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    if args.command == "export-demonstrations":
        frozen = {"smoke": 4, "expanded": 32}
        args.episodes = args.episodes or frozen[args.tier]
        if args.episodes < frozen[args.tier]:
            raise SystemExit(f"{args.tier} tier requires at least {frozen[args.tier]} episodes")
        result = export_demonstrations(args)
    elif args.command == "train-bc":
        result = train_bc(args.dataset, args.checkpoint, epochs=args.epochs)
    elif args.command == "experiment":
        result = run_experiment(args)
    else:
        result = run_frozen_evaluation(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
