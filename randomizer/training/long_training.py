"""Long-budget PPO and deployment contracts for the SETI learned policy.

This module deliberately owns a versioned feature/model contract instead of reading
teacher scores or calling the heuristic during rollout.  It can migrate the SETI-39
BC checkpoint because the v2 network topology is frozen here explicitly.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

import torch
from torch import nn


MODEL_SCHEMA = "seti-learned-policy-model-v1"
FEATURE_SCHEMA = "seti-hashed-visible-features-v2"
ACTION_ENCODING_SCHEMA = "seti-standard-action-hash-v1"
DEPLOYMENT_SCHEMA = "seti-learned-policy-deployment-v1"
POLICY_VERSION = "seti-learned-policy-v1"
FEATURE_DIM = 256
HIDDEN_DIM = 128
CAPABILITIES = (
    "seti-policy-context-v1",
    "seti-policy-decision-v1",
    "seti-standard-action-v1",
)
BANNED_KEYS = {
    "score", "net", "actionGraph", "valuation", "plannerShadow", "selectionPressure",
}


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def training_budget_reached(env_steps: int, env_step_budget: int,
                            completed_episodes: int,
                            episode_budget: int | None = None) -> bool:
    """Stop on the first explicit budget while preserving complete episode counts."""
    if episode_budget is not None and episode_budget <= 0:
        raise ValueError("episode budget must be positive")
    return env_steps >= env_step_budget or (
        episode_budget is not None and completed_episodes >= episode_budget
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _visible_tokens(value: Any, prefix: str = "") -> Iterable[tuple[str, float]]:
    if isinstance(value, dict):
        for key in sorted(value):
            yield from _visible_tokens(value[key], f"{prefix}.{key}" if prefix else key)
    elif isinstance(value, list):
        yield (f"{prefix}.__len__", float(len(value)))
        for index, item in enumerate(value):
            yield from _visible_tokens(item, f"{prefix}[{index}]")
    elif isinstance(value, bool):
        yield (prefix, float(value))
    elif isinstance(value, (int, float)) and math.isfinite(float(value)):
        yield (prefix, float(value))
    elif value is not None:
        yield (f"{prefix}={value}", 1.0)


def hashed_features(value: Any, dim: int = FEATURE_DIM) -> torch.Tensor:
    result = torch.zeros(dim, dtype=torch.float32)
    for token, number in _visible_tokens(value):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dim
        sign = 1.0 if digest[4] & 1 else -1.0
        result[index] += sign * max(-10.0, min(10.0, number))
    norm = result.norm()
    return result / norm if norm > 0 else result


def policy_observation(observation: dict[str, Any]) -> dict[str, Any]:
    public = observation.get("publicState", {})
    board = public.get("board", {})
    solar = board.get("solarSystem", {})
    compact_solar = {key: solar.get(key) for key in (
        "rotation", "sectorBySlot", "aomomoActive", "sectorAssignment",
        "planetLocations", "nebulaLocations", "nebulaRelations", "statistics",
    ) if key in solar}
    compact_board = {key: board.get(key) for key in (
        "rockets", "planets", "publicCards", "discardCount", "techSupply", "aliens", "finalScoring",
    ) if key in board}
    compact_board["solarSystem"] = compact_solar
    compact_public = {key: public.get(key) for key in (
        "roundNumber", "turnNumber", "actionCycleNumber", "currentPlayerId",
        "passedPlayerIds", "completedTurnPlayerIds", "activePlayerIds", "players", "pending",
    ) if key in public}
    compact_public["board"] = compact_board
    return {
        "perspectivePlayerId": observation.get("perspectivePlayerId"),
        "publicState": compact_public,
        "selfState": observation.get("selfState", {}),
        "decision": observation.get("decision"),
        "terminal": observation.get("terminal", False),
    }


def sanitized_action(action: dict[str, Any]) -> dict[str, Any]:
    def reject(value: Any) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                if key in BANNED_KEYS:
                    raise ValueError(f"forbidden teacher/internal feature: {key}")
                reject(item)
        elif isinstance(value, list):
            for item in value:
                reject(item)
    reject(action)
    allowed = (
        "schemaVersion", "actionId", "actorPlayerId", "decisionType", "family",
        "target", "payload", "actionFeature", "summary", "maskIndex",
        "stateVersion", "decisionVersion",
    )
    return {key: action[key] for key in allowed if key in action}


class LongCandidatePolicy(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.observation_encoder = nn.Sequential(nn.Linear(FEATURE_DIM, HIDDEN_DIM), nn.Tanh())
        self.candidate_encoder = nn.Sequential(nn.Linear(FEATURE_DIM, HIDDEN_DIM), nn.Tanh())
        self.policy_bias = nn.Linear(HIDDEN_DIM, 1)
        self.value_head = nn.Sequential(nn.Linear(HIDDEN_DIM, HIDDEN_DIM), nn.Tanh(), nn.Linear(HIDDEN_DIM, 1))

    def forward_features(self, observation: torch.Tensor,
                         candidates: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        device = next(self.parameters()).device
        obs_hidden = self.observation_encoder(observation.to(device))
        candidate_hidden = self.candidate_encoder(candidates.to(device))
        logits = candidate_hidden @ obs_hidden / math.sqrt(candidate_hidden.shape[-1])
        logits = logits + self.policy_bias(candidate_hidden).squeeze(-1)
        return logits, self.value_head(obs_hidden).squeeze(-1)

    def forward(self, observation: dict[str, Any],
                candidates: list[dict[str, Any]]) -> tuple[torch.Tensor, torch.Tensor]:
        if not candidates:
            raise ValueError("candidate set must not be empty")
        return self.forward_features(
            hashed_features(policy_observation(observation)),
            torch.stack([hashed_features(sanitized_action(item)) for item in candidates]),
        )


def load_seti39_checkpoint(path: Path) -> tuple[LongCandidatePolicy, dict[str, Any]]:
    payload = torch.load(path, map_location="cpu", weights_only=False)
    if payload.get("schemaVersion") != "seti-pytorch-checkpoint-v1":
        raise ValueError("SETI-39 checkpoint schema mismatch")
    if payload.get("featureSchemaVersion") != FEATURE_SCHEMA:
        raise ValueError("SETI-39 feature schema mismatch; explicit migration required")
    model = LongCandidatePolicy()
    model.load_state_dict(payload["modelState"])
    return model, payload


def save_training_checkpoint(path: Path, model: LongCandidatePolicy, metadata: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "schemaVersion": MODEL_SCHEMA,
        "featureSchemaVersion": FEATURE_SCHEMA,
        "actionEncodingSchemaVersion": ACTION_ENCODING_SCHEMA,
        "modelConfig": {"featureDim": FEATURE_DIM, "hiddenDim": HIDDEN_DIM},
        "modelState": model.state_dict(),
        "metadata": metadata,
    }, path)


def load_training_checkpoint(path: Path) -> tuple[LongCandidatePolicy, dict[str, Any]]:
    payload = torch.load(path, map_location="cpu", weights_only=False)
    if (
        payload.get("schemaVersion") != MODEL_SCHEMA
        or payload.get("featureSchemaVersion") != FEATURE_SCHEMA
        or payload.get("actionEncodingSchemaVersion") != ACTION_ENCODING_SCHEMA
    ):
        raise ValueError("learned policy checkpoint contract mismatch")
    model = LongCandidatePolicy()
    model.load_state_dict(payload["modelState"])
    return model, payload


@dataclass(frozen=True)
class TrainConfig:
    env_steps: int = 30000
    learning_rate: float = 1e-4
    clip_ratio: float = 0.2
    value_weight: float = 0.5
    entropy_start: float = 0.02
    entropy_end: float = 0.002
    bc_start: float = 0.15
    bc_end: float = 0.0
    gae_lambda: float = 0.95
    update_epochs: int = 2
    minibatch_size: int = 64
    advantage_normalization: bool = True

    def scheduled(self, start: float, end: float, completed_steps: int) -> float:
        progress = min(1.0, completed_steps / max(1, self.env_steps))
        return start + (end - start) * progress


@dataclass
class EncodedStep:
    observation: torch.Tensor
    candidates: torch.Tensor
    chosen_index: int
    old_log_prob: float
    old_value: float
    actor: str
    reward: float = 0.0
    advantage: float = 0.0
    value_target: float = 0.0


@dataclass(frozen=True)
class BcExample:
    observation: torch.Tensor
    candidates: torch.Tensor
    chosen_index: int


def encode_decision(observation: dict[str, Any], candidates: list[dict[str, Any]],
                    chosen_index: int, old_log_prob: float, old_value: float,
                    actor: str) -> EncodedStep:
    return EncodedStep(
        observation=hashed_features(policy_observation(observation)),
        candidates=torch.stack([hashed_features(sanitized_action(item)) for item in candidates]),
        chosen_index=chosen_index,
        old_log_prob=old_log_prob,
        old_value=old_value,
        actor=actor,
    )


def score_for(observation: dict[str, Any], actor: str, terminal: bool = False) -> float:
    for player in observation.get("publicState", {}).get("players", []):
        player_id = player.get("playerId", player.get("id"))
        if player_id == actor:
            value = player.get("finalScore") if terminal else None
            return float(value if value is not None else player.get("score", 0))
    return 0.0


def assign_dense_returns(steps: list[EncodedStep], before_scores: list[float],
                         after_scores: list[float], terminal_scores: dict[str, float],
                         gae_lambda: float = 0.95) -> None:
    attributed: dict[str, float] = {}
    last_index: dict[str, int] = {}
    for index, step in enumerate(steps):
        step.reward = (after_scores[index] - before_scores[index]) / 100.0
        attributed[step.actor] = attributed.get(step.actor, 0.0) + step.reward
        last_index[step.actor] = index
    for actor, final_score in terminal_scores.items():
        if actor in last_index:
            steps[last_index[actor]].reward += final_score / 100.0 - attributed.get(actor, 0.0)
    per_actor: dict[str, list[int]] = {}
    for index, step in enumerate(steps):
        per_actor.setdefault(step.actor, []).append(index)
    for indexes in per_actor.values():
        next_value = 0.0
        next_advantage = 0.0
        for index in reversed(indexes):
            step = steps[index]
            delta = step.reward + next_value - step.old_value
            step.advantage = delta + gae_lambda * next_advantage
            step.value_target = step.advantage + step.old_value
            next_value = step.old_value
            next_advantage = step.advantage


def normalize_advantages(steps: list[EncodedStep]) -> None:
    if len(steps) < 2:
        return
    values = torch.tensor([step.advantage for step in steps], dtype=torch.float32)
    mean = float(values.mean())
    std = float(values.std(unbiased=False))
    for step in steps:
        step.advantage = (step.advantage - mean) / max(std, 1e-8)


def load_bc_examples(path: Path, limit: int | None = None) -> list[BcExample]:
    manifest_path = path.with_suffix(path.suffix + ".manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("sha256") != sha256_file(path):
        raise ValueError("dataset hash mismatch")
    examples: list[BcExample] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("split") != "train":
                continue
            candidates = [sanitized_action(item) for item in record["legalCandidates"]]
            chosen_id = record["chosenAction"]["actionId"]
            chosen_index = next(index for index, item in enumerate(candidates) if item["actionId"] == chosen_id)
            examples.append(BcExample(
                hashed_features(policy_observation(record["observation"])),
                torch.stack([hashed_features(item) for item in candidates]),
                chosen_index,
            ))
            if limit is not None and len(examples) >= limit:
                break
    if not examples:
        raise ValueError("BC auxiliary dataset has no train examples")
    return examples


def ppo_update(model: LongCandidatePolicy, optimizer: torch.optim.Optimizer,
               steps: list[EncodedStep], config: TrainConfig, completed_steps: int,
               bc_examples: list[BcExample] | None = None) -> dict[str, float]:
    if config.advantage_normalization:
        normalize_advantages(steps)
    entropy_weight = config.scheduled(config.entropy_start, config.entropy_end, completed_steps)
    bc_weight = config.scheduled(config.bc_start, config.bc_end, completed_steps)
    totals = {"policyLoss": 0.0, "valueLoss": 0.0, "entropy": 0.0, "approxKl": 0.0, "bcLoss": 0.0}
    updates = 0
    for _ in range(config.update_epochs):
        order = list(range(len(steps)))
        random.shuffle(order)
        for offset in range(0, len(order), config.minibatch_size):
            batch = [steps[index] for index in order[offset:offset + config.minibatch_size]]
            losses: list[torch.Tensor] = []
            batch_metrics = {key: 0.0 for key in totals}
            for step in batch:
                logits, value = model.forward_features(step.observation, step.candidates)
                distribution = torch.distributions.Categorical(logits=logits)
                log_prob = distribution.log_prob(torch.tensor(step.chosen_index))
                ratio = torch.exp(log_prob - step.old_log_prob)
                advantage = torch.tensor(step.advantage)
                clipped = torch.clamp(ratio, 1 - config.clip_ratio, 1 + config.clip_ratio) * advantage
                policy_loss = -torch.min(ratio * advantage, clipped)
                value_loss = nn.functional.mse_loss(value, torch.tensor(step.value_target))
                entropy = distribution.entropy()
                losses.append(policy_loss + config.value_weight * value_loss - entropy_weight * entropy)
                batch_metrics["policyLoss"] += float(policy_loss.detach())
                batch_metrics["valueLoss"] += float(value_loss.detach())
                batch_metrics["entropy"] += float(entropy.detach())
                batch_metrics["approxKl"] += max(0.0, step.old_log_prob - float(log_prob.detach()))
            if bc_examples and bc_weight > 0:
                example = random.choice(bc_examples)
                bc_logits, _ = model.forward_features(example.observation, example.candidates)
                bc_loss = nn.functional.cross_entropy(
                    bc_logits.unsqueeze(0), torch.tensor([example.chosen_index]),
                )
                losses.append(bc_weight * bc_loss)
                batch_metrics["bcLoss"] = float(bc_loss.detach())
            optimizer.zero_grad()
            torch.stack(losses).mean().backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            divisor = max(1, len(batch))
            for key in ("policyLoss", "valueLoss", "entropy", "approxKl"):
                totals[key] += batch_metrics[key] / divisor
            totals["bcLoss"] += batch_metrics["bcLoss"]
            updates += 1
    result = {key: value / max(1, updates) for key, value in totals.items()}
    result.update({"entropyWeight": entropy_weight, "bcWeight": bc_weight})
    return result


def percentile_nearest_rank(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(percentile * len(ordered)) - 1)]


def evaluation_metrics(scores: list[float], games: int, terminal_games: int,
                       blocked_games: int = 0, illegal_actions: int = 0) -> dict[str, Any]:
    return {
        "games": games,
        "scoreCount": len(scores),
        "expectedScoreCount": games * 4,
        "meanScore": sum(scores) / len(scores) if scores else None,
        "p25": percentile_nearest_rank(scores, 0.25),
        "p50": percentile_nearest_rank(scores, 0.50),
        "p75": percentile_nearest_rank(scores, 0.75),
        "terminalGames": terminal_games,
        "completionRate": terminal_games / games if games else 0.0,
        "blockedGames": blocked_games,
        "blockRate": blocked_games / games if games else 0.0,
        "illegalActionAttempts": illegal_actions,
        "illegalActionRate": 0.0 if illegal_actions == 0 else illegal_actions / max(1, len(scores)),
    }


def acceptance(metrics: dict[str, Any], thresholds: dict[str, Any]) -> dict[str, Any]:
    checks = {
        "minimumGames": metrics["games"] >= int(thresholds.get("minimumGames", 0)),
        "completeScoreSet": metrics["scoreCount"] == metrics["expectedScoreCount"],
        "meanScore": metrics["meanScore"] is not None and metrics["meanScore"] >= float(thresholds["meanScore"]),
        "p25": metrics["p25"] is not None and metrics["p25"] >= float(thresholds["p25"]),
        "p50": metrics["p50"] is not None and metrics["p50"] >= float(thresholds["p50"]),
        "completionRate": metrics["completionRate"] >= float(thresholds.get("completionRate", 1)),
        "illegalActionRate": metrics["illegalActionRate"] <= float(thresholds.get("maxIllegalActionRate", 0)),
        "blockRate": metrics["blockRate"] <= float(thresholds.get("maxBlockRate", 0)),
    }
    return {"passed": all(checks.values()), "checks": checks}


def checkpoint_metric(metrics: dict[str, Any]) -> tuple[float, ...]:
    """Pre-frozen best-checkpoint ordering; safety gates precede score statistics."""
    return (
        float(metrics.get("completionRate", 0)),
        -float(metrics.get("illegalActionRate", 1)),
        -float(metrics.get("blockRate", 1)),
        float(metrics.get("meanScore") or -math.inf),
        float(metrics.get("p25") or -math.inf),
        float(metrics.get("p50") or -math.inf),
    )


def export_deployment(checkpoint: Path, output_dir: Path,
                      provenance: dict[str, Any]) -> dict[str, Any]:
    model, payload = load_training_checkpoint(checkpoint)
    output_dir.mkdir(parents=True, exist_ok=True)
    weights = {
        key: {"shape": list(value.shape), "values": value.detach().cpu().reshape(-1).tolist()}
        for key, value in model.state_dict().items()
    }
    model_path = output_dir / "model.json"
    model_path.write_text(canonical_json({
        "schemaVersion": MODEL_SCHEMA,
        "featureSchemaVersion": FEATURE_SCHEMA,
        "actionEncodingSchemaVersion": ACTION_ENCODING_SCHEMA,
        "modelConfig": {"featureDim": FEATURE_DIM, "hiddenDim": HIDDEN_DIM},
        "weights": weights,
    }) + "\n", encoding="utf-8")
    checksum = f"sha256:{sha256_file(model_path)}"
    manifest = {
        "schemaVersion": DEPLOYMENT_SCHEMA,
        "policyType": "learned",
        "policyVersion": POLICY_VERSION,
        "modelChecksum": checksum,
        "modelFile": model_path.name,
        "modelSchemaVersion": MODEL_SCHEMA,
        "featureSchemaVersion": FEATURE_SCHEMA,
        "featureNormalization": "signed-sha256-hash-clamp10-l2",
        "actionEncodingSchemaVersion": ACTION_ENCODING_SCHEMA,
        "capabilities": list(CAPABILITIES),
        "checkpointMetadata": payload.get("metadata", {}),
        "trainingProvenance": provenance,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def deployment_smoke(output_dir: Path, observation: dict[str, Any],
                     legal_actions: list[dict[str, Any]]) -> dict[str, Any]:
    manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
    model_path = output_dir / manifest["modelFile"]
    if f"sha256:{sha256_file(model_path)}" != manifest["modelChecksum"]:
        raise ValueError("deployment model checksum mismatch")
    model_payload = json.loads(model_path.read_text(encoding="utf-8"))
    model = LongCandidatePolicy()
    state = {}
    for key, encoded in model_payload["weights"].items():
        state[key] = torch.tensor(encoded["values"], dtype=torch.float32).reshape(encoded["shape"])
    model.load_state_dict(state)
    with torch.no_grad():
        logits, _ = model(observation, legal_actions)
    index = int(logits.argmax())
    action = legal_actions[index]
    return {
        "schemaVersion": "seti-policy-decision-v1",
        "actionId": action["actionId"],
        "policy": {
            "type": "learned",
            "version": manifest["policyVersion"],
            "modelChecksum": manifest["modelChecksum"],
        },
        "legal": action["actionId"] in {item["actionId"] for item in legal_actions},
    }


def config_payload(config: TrainConfig) -> dict[str, Any]:
    return asdict(config)


def utc_run_timestamp() -> int:
    return int(time.time())
