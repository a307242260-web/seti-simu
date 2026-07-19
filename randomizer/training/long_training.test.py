import json
import tempfile
import unittest
from pathlib import Path

import torch

from long_training import (
    ACTION_ENCODING_SCHEMA, DEPLOYMENT_SCHEMA, FEATURE_SCHEMA, MODEL_SCHEMA,
    EncodedStep, LongCandidatePolicy, acceptance, assign_dense_returns,
    checkpoint_metric, deployment_smoke, export_deployment, hashed_features,
    load_seti39_checkpoint, policy_observation, save_training_checkpoint,
    training_budget_reached,
)


def observation(score=0, final_score=None):
    player = {"playerId": "blue", "score": score}
    if final_score is not None:
        player["finalScore"] = final_score
    return {
        "perspectivePlayerId": "blue",
        "publicState": {"players": [player], "board": {}},
        "selfState": {},
        "decision": {"actorPlayerId": "blue"},
        "terminal": final_score is not None,
    }


def action(action_id="scan:a"):
    return {
        "schemaVersion": "seti-rl-action-v2", "actionId": action_id,
        "actorPlayerId": "blue", "decisionType": "turn_action", "family": "scan",
        "stateVersion": 1, "decisionVersion": 1,
    }


class LongTrainingContractTest(unittest.TestCase):
    def test_episode_budget_stops_after_exact_completed_episode_count(self):
        self.assertFalse(training_budget_reached(4999, 30000, 9, 10))
        self.assertTrue(training_budget_reached(5001, 30000, 10, 10))
        self.assertTrue(training_budget_reached(30000, 30000, 9, 10))
        with self.assertRaisesRegex(ValueError, "episode budget must be positive"):
            training_budget_reached(0, 30000, 0, 0)

    def test_feature_contract_is_stable_and_compacts_observation(self):
        left = hashed_features(policy_observation(observation(3)))
        right = hashed_features(policy_observation(observation(3)))
        self.assertTrue(torch.equal(left, right))
        self.assertAlmostEqual(float(left.norm()), 1.0, places=6)

    def test_dense_rewards_telescope_to_terminal_score(self):
        features = torch.zeros(256)
        candidates = torch.zeros((1, 256))
        steps = [
            EncodedStep(features, candidates, 0, 0.0, 0.0, "blue"),
            EncodedStep(features, candidates, 0, 0.0, 0.0, "blue"),
        ]
        assign_dense_returns(steps, [0, 10], [10, 20], {"blue": 55}, gae_lambda=1.0)
        self.assertAlmostEqual(sum(step.reward for step in steps), 0.55)
        self.assertAlmostEqual(steps[0].value_target, 0.55)

    def test_checkpoint_selection_prioritizes_safety_then_frozen_score(self):
        safe = {"completionRate": 1, "illegalActionRate": 0, "blockRate": 0,
                "meanScore": 190, "p25": 180, "p50": 190}
        unsafe = {**safe, "meanScore": 999, "illegalActionRate": 0.01}
        self.assertGreater(checkpoint_metric(safe), checkpoint_metric(unsafe))

    def test_acceptance_requires_all_frozen_checks(self):
        metrics = {"games": 20, "scoreCount": 80, "expectedScoreCount": 80,
                   "meanScore": 205, "p25": 181, "p50": 201,
                   "completionRate": 1, "illegalActionRate": 0, "blockRate": 0}
        thresholds = {"minimumGames": 20, "meanScore": 200, "p25": 180,
                      "p50": 200, "completionRate": 1,
                      "maxIllegalActionRate": 0, "maxBlockRate": 0}
        self.assertTrue(acceptance(metrics, thresholds)["passed"])
        self.assertFalse(acceptance({**metrics, "p25": 179}, thresholds)["passed"])

    def test_deployment_roundtrip_checksum_and_legal_decision(self):
        model = LongCandidatePolicy()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            checkpoint = root / "model.pt"
            save_training_checkpoint(checkpoint, model, {"stage": "test"})
            manifest = export_deployment(checkpoint, root / "deploy", {"dataset": "fixture"})
            self.assertEqual(manifest["schemaVersion"], DEPLOYMENT_SCHEMA)
            self.assertEqual(manifest["modelSchemaVersion"], MODEL_SCHEMA)
            self.assertEqual(manifest["featureSchemaVersion"], FEATURE_SCHEMA)
            self.assertEqual(manifest["actionEncodingSchemaVersion"], ACTION_ENCODING_SCHEMA)
            decision = deployment_smoke(root / "deploy", observation(), [action()])
            self.assertTrue(decision["legal"])
            self.assertEqual(decision["actionId"], "scan:a")

    def test_seti39_migration_rejects_feature_schema_drift(self):
        model = LongCandidatePolicy()
        with tempfile.TemporaryDirectory() as directory:
            checkpoint = Path(directory) / "legacy.pt"
            torch.save({
                "schemaVersion": "seti-pytorch-checkpoint-v1",
                "featureSchemaVersion": "seti-hashed-visible-features-v1",
                "modelState": model.state_dict(),
            }, checkpoint)
            with self.assertRaisesRegex(ValueError, "feature schema mismatch"):
                load_seti39_checkpoint(checkpoint)


if __name__ == "__main__":
    unittest.main()
