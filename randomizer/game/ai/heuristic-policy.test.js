"use strict";

const assert = require("node:assert/strict");
const policyPort = require("./policy-port");
const heuristicPolicy = require("./heuristic-policy");

function action(actionId, family, value) {
  return {
    schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
    family,
    phase: family === "quick_trade" ? "quick" : "main",
    actionId,
    actorId: "p1",
    stateVersion: 7,
    decisionVersion: 3,
    target: { value },
    payload: { value },
    summary: `${family}:${value}`,
  };
}

function context(actions) {
  return policyPort.createDecisionContext({
    requestId: "heuristic-policy-request",
    seatId: "p1",
    stateVersion: 7,
    decisionVersion: 3,
    observation: {
      publicState: {
        roundNumber: 2,
        players: [{ id: "p1", resources: { credits: 4, energy: 3 } }],
        board: { rockets: [{ id: "r1", playerId: "p1", surface: "solar-board" }] },
      },
      selfState: { hand: [] },
    },
    legalActions: actions,
    deterministicContext: { seed: "heuristic-policy-fixed" },
  });
}

const legalActions = [
  action("pass:p1:7", "pass", 1),
  action("launch:p1:7", "launch", 9),
];
const current = context(legalActions);
const before = structuredClone(current);
const policy = heuristicPolicy.createHeuristicPolicy({
  difficulty: "contract-test",
  evaluateAction: (_decisionContext, candidate) => ({ score: candidate.payload.value }),
});

const first = policy.decide(current);
const second = policy.decide(current);
assert.deepEqual(first, second, "同一 DecisionContext 必须得到确定性 PolicyDecision");
assert.equal(first.actionId, "launch:p1:7", "Heuristic Policy 必须只从 legal set 选择最高估值 actionId");
assert.equal(legalActions.some((candidate) => candidate.actionId === first.actionId), true);
assert.deepEqual(current, before, "策略不得修改 observation 或 legal descriptor");
assert.equal(Object.isFrozen(policy.getProvenance()), true);
assert.equal(policy.getProvenance().type, heuristicPolicy.POLICY_TYPE);

const validation = policyPort.validatePolicyDecision(current, first, {
  registry: { validate: (_runtime, selected) => ({ ok: selected.actionId === first.actionId }) },
  runtimeContext: {},
});
assert.equal(validation.ok, true, "Heuristic Policy 输出必须通过公共 Policy validator");

assert.throws(
  () => heuristicPolicy.createHeuristicPolicy({ strategyWeights: { unknown_family: 1 } }),
  (error) => error.code === "HEURISTIC_POLICY_CONFIG_INVALID",
);
assert.throws(
  () => policy.decide({
    schemaVersion: policyPort.CONTEXT_SCHEMA_VERSION,
    legalActions: [],
  }),
  (error) => error.code === "HEURISTIC_POLICY_EMPTY_LEGAL_SET",
);
assert.throws(
  () => policy.decide({
    schemaVersion: policyPort.CONTEXT_SCHEMA_VERSION,
    legalActions: [{ ...legalActions[0], family: "unknown_family" }],
  }),
  (error) => error.code === "HEURISTIC_POLICY_UNSUPPORTED_FAMILY",
);

const disabled = heuristicPolicy.createHeuristicPolicy({
  strategyWeights: { pass: 0, launch: 0 },
  evaluateAction: () => ({ score: 1 }),
});
assert.throws(
  () => disabled.decide(current),
  (error) => error.code === "HEURISTIC_POLICY_NO_ENABLED_ACTION",
);

console.log("heuristic policy behavior tests passed");
