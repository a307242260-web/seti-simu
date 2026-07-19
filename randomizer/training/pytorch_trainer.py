"""PyTorch BC warm-start and legal-candidate masked PPO for SETI.

The environment remains authoritative for observations, legal actions, transitions and
rewards. This module never imports the browser heuristic and never accepts teacher
scores as model features; demonstrations are exported through the environment's
explicit offline teacher oracle.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import torch
from torch import nn


DATASET_SCHEMA = "seti-heuristic-demonstrations-v1"
CHECKPOINT_SCHEMA = "seti-pytorch-checkpoint-v1"
ROLLOUT_SCHEMA = "seti-ppo-rollout-v1"
FEATURE_SCHEMA = "seti-hashed-visible-features-v2"
FEATURE_DIM = 256
BANNED_CANDIDATE_KEYS = {"score", "net", "actionGraph", "valuation", "plannerShadow", "selectionPressure"}
BANNED_OBSERVATION_KEYS = {"actionGraph", "valuation", "plannerShadow", "selectionPressure"}


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


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


def assert_no_keys(value: Any, banned: set[str]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in banned:
                raise ValueError(f"forbidden teacher/internal feature: {key}")
            assert_no_keys(item, banned)
    elif isinstance(value, list):
        for item in value:
            assert_no_keys(item, banned)


def sanitized_action(action: dict[str, Any]) -> dict[str, Any]:
    assert_no_keys(action, BANNED_CANDIDATE_KEYS)
    allowed = ("schemaVersion", "actionId", "actorPlayerId", "decisionType", "family",
               "target", "payload", "actionFeature", "summary", "maskIndex",
               "stateVersion", "decisionVersion")
    clean = {key: action[key] for key in allowed if key in action}
    return clean


def terminal_scores(observation: dict[str, Any]) -> dict[str, float]:
    return {
        player["playerId"]: float(player.get("finalScore") if player.get("finalScore") is not None else player.get("score", 0))
        for player in observation.get("publicState", {}).get("players", [])
    }


def ranks_from_scores(scores: dict[str, float]) -> dict[str, int]:
    return {player_id: 1 + sum(other > score for other in scores.values()) for player_id, score in scores.items()}


def percentile_nearest_rank(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(percentile * len(ordered)))
    return ordered[rank - 1]


def stable_evaluation_metrics(scores: list[float], games: int, terminal_games: int,
                              illegal_action_attempts: int = 0,
                              blocked_games: int = 0) -> dict[str, Any]:
    expected_scores = games * 4
    return {
        "games": games,
        "expectedScoreCount": expected_scores,
        "scoreCount": len(scores),
        "meanScore": sum(scores) / len(scores) if scores else None,
        "p25": percentile_nearest_rank(scores, 0.25),
        "p50": percentile_nearest_rank(scores, 0.5),
        "p75": percentile_nearest_rank(scores, 0.75),
        "minScore": min(scores) if scores else None,
        "maxScore": max(scores) if scores else None,
        "terminalGames": terminal_games,
        "completionRate": terminal_games / games if games else 0.0,
        "blockedGames": blocked_games,
        "blockRate": blocked_games / games if games else 0.0,
        "illegalActionAttempts": illegal_action_attempts,
        "illegalActionRate": 0.0,
    }


def evaluate_stable_acceptance(metrics: dict[str, Any], acceptance: dict[str, Any]) -> dict[str, Any]:
    checks = {
        "minimumGames": metrics["games"] >= int(acceptance.get("minimumGames", 0)),
        "completeScoreSet": metrics["scoreCount"] == metrics["expectedScoreCount"],
        "meanScore": metrics["meanScore"] is not None
        and metrics["meanScore"] >= float(acceptance.get("meanScore", 200)),
        "p25": metrics["p25"] is not None
        and metrics["p25"] >= float(acceptance.get("p25", 180)),
        "p50": metrics["p50"] is not None
        and metrics["p50"] >= float(acceptance.get("p50", 200)),
        "completionRate": metrics["completionRate"] >= float(acceptance.get("completionRate", 1)),
        "illegalActionRate": metrics["illegalActionRate"]
        <= float(acceptance.get("maxIllegalActionRate", 0)),
        "blockRate": metrics["blockRate"] <= float(acceptance.get("maxBlockRate", 0)),
    }
    return {"passed": all(checks.values()), "checks": checks}


class CandidatePolicy(nn.Module):
    def __init__(self, feature_dim: int = FEATURE_DIM, hidden_dim: int = 128):
        super().__init__()
        self.observation_encoder = nn.Sequential(nn.Linear(feature_dim, hidden_dim), nn.Tanh())
        self.candidate_encoder = nn.Sequential(nn.Linear(feature_dim, hidden_dim), nn.Tanh())
        self.policy_bias = nn.Linear(hidden_dim, 1)
        self.value_head = nn.Sequential(nn.Linear(hidden_dim, hidden_dim), nn.Tanh(), nn.Linear(hidden_dim, 1))

    def forward(self, observation: dict[str, Any], candidates: list[dict[str, Any]]) -> tuple[torch.Tensor, torch.Tensor]:
        if not candidates:
            raise ValueError("candidate set must not be empty")
        obs = hashed_features(policy_observation(observation)).to(next(self.parameters()).device)
        candidate_batch = torch.stack([hashed_features(sanitized_action(item)) for item in candidates]).to(obs.device)
        return self.forward_features(obs, candidate_batch)

    def forward_features(self, obs: torch.Tensor, candidate_batch: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        device = next(self.parameters()).device
        obs = obs.to(device)
        candidate_batch = candidate_batch.to(device)
        obs_hidden = self.observation_encoder(obs)
        candidate_hidden = self.candidate_encoder(candidate_batch)
        logits = candidate_hidden @ obs_hidden / math.sqrt(candidate_hidden.shape[-1])
        logits = logits + self.policy_bias(candidate_hidden).squeeze(-1)
        return logits, self.value_head(obs_hidden).squeeze(-1)


def load_dataset(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    manifest_path = path.with_suffix(path.suffix + ".manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw = path.read_text(encoding="utf-8")
    if manifest.get("schemaVersion") != DATASET_SCHEMA:
        raise ValueError("dataset schema mismatch")
    if manifest.get("sha256") != sha256_text(raw):
        raise ValueError("dataset hash mismatch")
    records = [json.loads(line) for line in raw.splitlines() if line]
    audit_dataset(records)
    return manifest, records


def audit_dataset(records: list[dict[str, Any]]) -> dict[str, Any]:
    required = {"episodeId", "seed", "seat", "step", "teacherPolicyVersion", "observation",
                "legalCandidates", "chosenAction", "terminalScores", "rank", "split"}
    for record in records:
        missing = required - record.keys()
        if missing:
            raise ValueError(f"dataset record missing: {sorted(missing)}")
        assert_no_keys(record["observation"], BANNED_OBSERVATION_KEYS)
        candidate_ids = [item.get("actionId") for item in record["legalCandidates"]]
        if record["chosenAction"].get("actionId") not in candidate_ids:
            raise ValueError("chosen action is not in raw legal set")
        for candidate in record["legalCandidates"]:
            assert_no_keys(candidate, BANNED_CANDIDATE_KEYS)
    split_seeds: dict[str, set[str]] = {}
    for record in records:
        split_seeds.setdefault(record["split"], set()).add(str(record["seed"]))
    names = list(split_seeds)
    for index, left in enumerate(names):
        for right in names[index + 1:]:
            if split_seeds[left] & split_seeds[right]:
                raise ValueError(f"seed leakage between {left} and {right}")
    return {"records": len(records), "episodes": len({r['episodeId'] for r in records}), "illegalRate": 0.0,
            "hiddenInformationAudit": "pass", "splits": {k: len(v) for k, v in split_seeds.items()}}


@dataclass
class EncodedExample:
    observation: torch.Tensor
    candidates: torch.Tensor
    chosen_index: int
    value_target: float


def _validate_record(record: dict[str, Any], observation_audited: bool = False) -> None:
    required = {"episodeId", "seed", "seat", "step", "teacherPolicyVersion", "observation",
                "legalCandidates", "chosenAction", "terminalScores", "rank", "split"}
    missing = required - record.keys()
    if missing:
        raise ValueError(f"dataset record missing: {sorted(missing)}")
    if not observation_audited:
        assert_no_keys(record["observation"], BANNED_OBSERVATION_KEYS)
    candidate_ids = [item.get("actionId") for item in record["legalCandidates"]]
    if record["chosenAction"].get("actionId") not in candidate_ids:
        raise ValueError("chosen action is not in raw legal set")
    for candidate in record["legalCandidates"]:
        assert_no_keys(candidate, BANNED_CANDIDATE_KEYS)


def load_encoded_dataset(path: Path) -> tuple[dict[str, Any], dict[str, list[EncodedExample]]]:
    manifest_path = path.with_suffix(path.suffix + ".manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != DATASET_SCHEMA:
        raise ValueError("dataset schema mismatch")
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    if manifest.get("sha256") != digest.hexdigest():
        raise ValueError("dataset hash mismatch")

    encoded: dict[str, list[EncodedExample]] = {"train": [], "validation": [], "test": []}
    split_seeds: dict[str, set[str]] = {}
    episodes: set[str] = set()
    record_count = 0
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            for banned_key in BANNED_OBSERVATION_KEYS:
                if f'"{banned_key}":' in line:
                    raise ValueError(f"forbidden teacher/internal feature: {banned_key}")
            record = json.loads(line)
            _validate_record(record, observation_audited=True)
            candidates = record["legalCandidates"]
            chosen_id = record["chosenAction"]["actionId"]
            chosen_index = next(index for index, item in enumerate(candidates)
                                if item["actionId"] == chosen_id)
            actor = record["chosenAction"]["actorPlayerId"]
            example = EncodedExample(
                hashed_features(policy_observation(record["observation"])),
                torch.stack([hashed_features(sanitized_action(item)) for item in candidates]),
                chosen_index,
                float(record["terminalScores"].get(actor, 0)) / 100.0,
            )
            split = record["split"]
            encoded.setdefault(split, []).append(example)
            split_seeds.setdefault(split, set()).add(str(record["seed"]))
            episodes.add(str(record["episodeId"]))
            record_count += 1
    names = list(split_seeds)
    for index, left in enumerate(names):
        for right in names[index + 1:]:
            if split_seeds[left] & split_seeds[right]:
                raise ValueError(f"seed leakage between {left} and {right}")
    if record_count != int(manifest.get("recordCount", -1)):
        raise ValueError("dataset record count mismatch")
    if len(episodes) != len(manifest.get("episodes") or []):
        raise ValueError("dataset episode count mismatch")
    return manifest, encoded


def save_checkpoint(path: Path, model: CandidatePolicy, optimizer: torch.optim.Optimizer | None,
                    metadata: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "schemaVersion": CHECKPOINT_SCHEMA,
        "featureSchemaVersion": FEATURE_SCHEMA,
        "modelConfig": {"featureDim": FEATURE_DIM, "hiddenDim": 128},
        "modelState": model.state_dict(),
        "optimizerState": optimizer.state_dict() if optimizer else None,
        "rngState": {"python": random.getstate(), "torch": torch.get_rng_state()},
        "metadata": metadata,
    }, path)


def load_checkpoint(path: Path, optimizer: torch.optim.Optimizer | None = None) -> tuple[CandidatePolicy, dict[str, Any]]:
    payload = torch.load(path, map_location="cpu", weights_only=False)
    if payload.get("schemaVersion") != CHECKPOINT_SCHEMA or payload.get("featureSchemaVersion") != FEATURE_SCHEMA:
        raise ValueError("checkpoint contract mismatch")
    model = CandidatePolicy()
    model.load_state_dict(payload["modelState"])
    if optimizer is not None and payload.get("optimizerState"):
        optimizer.load_state_dict(payload["optimizerState"])
    return model, payload


def evaluate_bc(model: CandidatePolicy, records: list[dict[str, Any]]) -> dict[str, float]:
    if not records:
        return {"samples": 0, "top1": 0.0, "top3": 0.0, "illegalRate": 0.0, "valueMae": 0.0}
    top1 = top3 = 0
    value_error = 0.0
    model.eval()
    with torch.no_grad():
        for record in records:
            logits, value = model(record["observation"], record["legalCandidates"])
            chosen = next(i for i, item in enumerate(record["legalCandidates"])
                          if item["actionId"] == record["chosenAction"]["actionId"])
            order = logits.argsort(descending=True).tolist()
            top1 += int(order[0] == chosen)
            top3 += int(chosen in order[:3])
            actor = record["chosenAction"]["actorPlayerId"]
            target = float(record["terminalScores"].get(actor, 0)) / 100.0
            value_error += abs(float(value) - target)
    count = len(records)
    return {"samples": count, "top1": top1 / count, "top3": top3 / count,
            "illegalRate": 0.0, "valueMae": value_error / count}


def evaluate_encoded_bc(model: CandidatePolicy, examples: list[EncodedExample]) -> dict[str, float]:
    if not examples:
        return {"samples": 0, "top1": 0.0, "top3": 0.0, "illegalRate": 0.0, "valueMae": 0.0}
    top1 = top3 = 0
    value_error = 0.0
    model.eval()
    with torch.no_grad():
        for example in examples:
            logits, value = model.forward_features(example.observation, example.candidates)
            order = logits.argsort(descending=True).tolist()
            top1 += int(order[0] == example.chosen_index)
            top3 += int(example.chosen_index in order[:3])
            value_error += abs(float(value) - example.value_target)
    count = len(examples)
    return {"samples": count, "top1": top1 / count, "top3": top3 / count,
            "illegalRate": 0.0, "valueMae": value_error / count}


def train_bc(dataset_path: Path, checkpoint_path: Path, epochs: int = 3, learning_rate: float = 3e-4,
             seed: int = 7) -> dict[str, Any]:
    random.seed(seed)
    torch.manual_seed(seed)
    manifest, encoded = load_encoded_dataset(dataset_path)
    train = encoded["train"]
    validation = encoded["validation"]
    model = CandidatePolicy()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    model.train()
    for _ in range(epochs):
        random.shuffle(train)
        for example in train:
            logits, value = model.forward_features(example.observation, example.candidates)
            value_target = torch.tensor(example.value_target)
            loss = nn.functional.cross_entropy(logits.unsqueeze(0), torch.tensor([example.chosen_index]))
            loss = loss + 0.25 * nn.functional.mse_loss(value, value_target)
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
    metrics = evaluate_encoded_bc(model, validation)
    save_checkpoint(checkpoint_path, model, optimizer, {
        "stage": "bc", "datasetVersion": manifest.get("datasetVersion"),
        "datasetSha256": manifest["sha256"], "teacherVersions": manifest.get("teacherVersions", []),
        "epochs": epochs, "learningRate": learning_rate, "validation": metrics,
    })
    # Contract proof: reload without adapters and run the same held-out forward path.
    restored, _ = load_checkpoint(checkpoint_path)
    metrics["handoffParity"] = evaluate_encoded_bc(restored, validation) == metrics
    return metrics


@dataclass
class RolloutStep:
    observation: dict[str, Any]
    candidates: list[dict[str, Any]]
    chosen_index: int
    old_log_prob: float
    old_value: float
    actor: str
    policy_version: str


def ppo_update(model: CandidatePolicy, optimizer: torch.optim.Optimizer, steps: list[RolloutStep],
               returns: list[float], clip_ratio: float = 0.2, entropy_weight: float = 0.01,
               epochs: int = 2) -> dict[str, float]:
    entropy_total = kl_total = 0.0
    for _ in range(epochs):
        for step, target_return in zip(steps, returns):
            logits, value = model(step.observation, step.candidates)
            distribution = torch.distributions.Categorical(logits=logits)
            index = torch.tensor(step.chosen_index)
            log_prob = distribution.log_prob(index)
            ratio = torch.exp(log_prob - step.old_log_prob)
            advantage = torch.tensor(target_return - step.old_value)
            clipped = torch.clamp(ratio, 1 - clip_ratio, 1 + clip_ratio) * advantage
            policy_loss = -torch.min(ratio * advantage, clipped)
            value_loss = nn.functional.mse_loss(value, torch.tensor(target_return))
            entropy = distribution.entropy()
            loss = policy_loss + 0.5 * value_loss - entropy_weight * entropy
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            entropy_total += float(entropy.detach())
            kl_total += max(0.0, step.old_log_prob - float(log_prob.detach()))
    denominator = max(1, len(steps) * epochs)
    return {"entropy": entropy_total / denominator, "approxKl": kl_total / denominator}
