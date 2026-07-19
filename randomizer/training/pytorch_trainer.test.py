import json
import tempfile
import unittest
from pathlib import Path

import torch

from pytorch_trainer import (
    DATASET_SCHEMA, CandidatePolicy, audit_dataset, canonical_json, evaluate_bc,
    evaluate_stable_acceptance, load_checkpoint, load_encoded_dataset, sanitized_action,
    save_checkpoint, sha256_text, stable_evaluation_metrics,
)


def fixture_record(split="train", seed="seed-a"):
    observation = {
        "perspectivePlayerId": "p1", "publicState": {"roundNumber": 1,
        "players": [{"playerId": "p1", "score": 0, "energy": 3, "availableData": 1}]},
        "selfState": {"playerId": "p1", "hand": []}, "terminal": False,
    }
    actions = [
        {"schemaVersion": "seti-rl-action-v2", "actionId": "launch:1", "actorPlayerId": "p1",
         "decisionType": "turn_action", "family": "launch", "maskIndex": 0,
         "stateVersion": 1, "decisionVersion": 1},
        {"schemaVersion": "seti-rl-action-v2", "actionId": "pass:1", "actorPlayerId": "p1",
         "decisionType": "turn_action", "family": "pass", "maskIndex": 1,
         "stateVersion": 1, "decisionVersion": 1},
    ]
    chosen = actions[0]
    return {"episodeId": seed, "seed": seed, "seat": 0, "step": 0,
            "teacherPolicyVersion": "existing-heuristic-laughable-v1", "observation": observation,
            "legalCandidates": actions, "chosenAction": chosen,
            "terminalScores": {"p1": 12}, "rank": 1, "split": split}


class TrainerContractTest(unittest.TestCase):
    def test_teacher_chooses_exact_raw_candidate_and_audit_passes(self):
        record = fixture_record()
        self.assertEqual(record["chosenAction"]["actionId"], "launch:1")
        self.assertEqual(audit_dataset([record])["illegalRate"], 0)

    def test_hidden_teacher_feature_is_rejected(self):
        action = fixture_record()["chosenAction"] | {"score": 99}
        with self.assertRaisesRegex(ValueError, "forbidden"):
            sanitized_action(action)

    def test_checkpoint_loads_without_adapter_and_preserves_forward(self):
        torch.manual_seed(3)
        model = CandidatePolicy()
        record = fixture_record("validation", "seed-b")
        before = evaluate_bc(model, [record])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bc.pt"
            save_checkpoint(path, model, None, {"stage": "bc"})
            restored, payload = load_checkpoint(path)
            self.assertEqual(payload["metadata"]["stage"], "bc")
            self.assertEqual(evaluate_bc(restored, [record]), before)

    def test_expanded_dataset_loader_streams_to_encoded_features(self):
        records = [fixture_record("train", "seed-a"), fixture_record("validation", "seed-b")]
        body = "".join(canonical_json(record) + "\n" for record in records)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "expanded.jsonl"
            path.write_text(body, encoding="utf-8")
            path.with_suffix(".jsonl.manifest.json").write_text(json.dumps({
                "schemaVersion": DATASET_SCHEMA,
                "datasetVersion": "expanded-v1",
                "sha256": sha256_text(body),
                "recordCount": 2,
                "episodes": [{"episodeId": "seed-a"}, {"episodeId": "seed-b"}],
            }), encoding="utf-8")
            manifest, encoded = load_encoded_dataset(path)
            self.assertEqual(manifest["datasetVersion"], "expanded-v1")
            self.assertEqual(len(encoded["train"]), 1)
            self.assertEqual(tuple(encoded["validation"][0].observation.shape), (256,))
            self.assertEqual(tuple(encoded["validation"][0].candidates.shape), (2, 256))

    def test_stable_evaluation_uses_all_seats_and_nearest_rank(self):
        scores = [180, 190, 200, 210] * 20
        metrics = stable_evaluation_metrics(scores, games=20, terminal_games=20)
        self.assertEqual(metrics["scoreCount"], 80)
        self.assertEqual(metrics["p25"], 180)
        self.assertEqual(metrics["p50"], 190)
        result = evaluate_stable_acceptance(metrics, {
            "minimumGames": 20, "meanScore": 190, "p25": 180, "p50": 190,
            "completionRate": 1, "maxIllegalActionRate": 0, "maxBlockRate": 0,
        })
        self.assertTrue(result["passed"])


if __name__ == "__main__":
    unittest.main()
