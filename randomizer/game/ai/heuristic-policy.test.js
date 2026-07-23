"use strict";

const assert = require("node:assert/strict");
const policyPort = require("./policy-port");
const heuristicPolicy = require("./heuristic-policy");
const outcomeModel = require("./outcome-model");
const expectedScoreEvaluator = require("./expected-score-evaluator");

function action(actionId, family) {
  return {
    schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
    family,
    phase: "main",
    actionId,
    actorId: "p1",
    stateVersion: 7,
    decisionVersion: 3,
    target: {},
    payload: {},
    summary: family,
  };
}

function observation(score, credits, probeRouteSummary = null) {
  return outcomeModel.createDecisionObservation({
    publicState: { players: [{ id: "p1", resources: { score, credits } }], board: {} },
    selfState: { id: "p1", resources: { score, credits }, hand: [] },
  }, {
    seatId: "p1",
    stateVersion: 7,
    decisionVersion: 3,
    probeRouteSummary,
  });
}

const legalActions = [action("pass:p1:7", "pass"), action("launch:p1:7", "launch")];
const current = policyPort.createDecisionContext({
  requestId: "heuristic-policy-request",
  seatId: "p1",
  stateVersion: 7,
  decisionVersion: 3,
  observation: observation(0, 0),
  legalActions,
  actionOutcomes: [
    {
      schemaVersion: "seti-action-outcome-v1",
      actionId: "pass:p1:7",
      status: "settled",
      confidence: "high",
      rootObservation: observation(0, 0),
      leaves: [{ leafId: "pass-leaf", actionChain: ["pass:p1:7"], observation: observation(0, 1) }],
    },
    {
      schemaVersion: "seti-action-outcome-v1",
      actionId: "launch:p1:7",
      status: "settled",
      confidence: "high",
      rootObservation: observation(0, 0),
      leaves: [{
        leafId: "launch-leaf",
        actionChain: ["launch:p1:7", "move:p1:8", "orbit:p1:9"],
        observation: observation(10, 0, {
          nextActionId: "launch:p1:7",
          nextActionFamily: "launch",
          currentOutcomeRef: "launch:p1:7",
          routeOutcomeRef: "launch:p1:7→move:p1:8→orbit:p1:9",
          endpointActionId: "orbit:p1:9",
          endpointKind: "orbit",
          currentDelta: { credits: 0 },
          remainingRouteDelta: { realizedScore: 10 },
          publicityAlongRoute: 0,
          publicityOutcomeRefs: [],
          endpointDelta: { realizedScore: 10 },
        }),
      }],
    },
  ],
});
const before = structuredClone(current);
const policy = heuristicPolicy.createHeuristicPolicy({ difficulty: "contract-test" });
const first = policy.decide(current);
const second = policy.decide(current);
assert.deepEqual(first, second, "同一 DecisionContext 必须得到确定性 PolicyDecision");
assert.equal(first.actionId, "launch:p1:7", "Heuristic Policy 必须真实按标准执行 leaf outcome 选择");
assert.deepEqual(current, before, "策略不得修改 observation、outcome 或 legal descriptor");
assert.equal(policy.getProvenance().version, heuristicPolicy.POLICY_VERSION);

const validation = policyPort.validatePolicyDecision(current, first, {
  registry: { validate: (_runtime, selected) => ({ ok: selected.actionId === first.actionId }) },
  runtimeContext: {},
});
assert.equal(validation.ok, true);

const thetaObservation = outcomeModel.createDecisionObservation({
  publicState: {
    players: [{
      id: "p1",
      resources: {
        score: 0,
        credits: 1,
        energy: 2,
        availableData: 3,
        publicity: 4,
      },
    }],
    board: {
      aliens: {
        slots: [{ revealed: true, traces: { p1: 4 } }],
      },
    },
  },
  selfState: {
    id: "p1",
    hand: [
      { id: "ordinary-1" },
      { id: "ordinary-2" },
      { id: "alien-in-hand", kind: "alien" },
    ],
    privateAlienCards: [{ id: "private-alien-1" }],
  },
}, { seatId: "p1", stateVersion: 7, decisionVersion: 3 });
const thetaValue = expectedScoreEvaluator.evaluateState(thetaObservation, "p1");
assert.deepEqual(expectedScoreEvaluator.DEFAULT_PARAMETERS.resourceValues, {
  credits: 5,
  energy: 5,
  availableData: 2.5,
  publicity: 2.5,
  ordinaryCard: 2.5,
  alienCard: 10 / 3,
});
assert.equal(thetaValue.assetBreakdown.credits, 5);
assert.equal(thetaValue.assetBreakdown.energy, 10);
assert.equal(thetaValue.assetBreakdown.availableData, 7.5);
assert.equal(thetaValue.assetBreakdown.publicity, 10);
assert.equal(thetaValue.assetBreakdown.ordinaryCard, 5);
assert.equal(thetaValue.assetBreakdown.alienCard, 20 / 3);
assert.equal(thetaValue.total, 265 / 6, "本阶段只保留 θ₀ 与已兑现分，不给科技/扫描等其他路径加值");
assert.equal(Object.hasOwn(thetaValue.assetBreakdown, "alien"), false);
assert.equal(thetaValue.schemaVersion, outcomeModel.VALUE_SCHEMA_VERSION);

assert.throws(
  () => policy.decide({ schemaVersion: policyPort.CONTEXT_SCHEMA_VERSION, legalActions: [] }),
  (error) => error.code === "HEURISTIC_POLICY_EMPTY_LEGAL_SET",
);
assert.throws(
  () => policy.decide({
    schemaVersion: policyPort.CONTEXT_SCHEMA_VERSION,
    legalActions: [{ ...legalActions[0], family: "unknown_family" }],
  }),
  (error) => error.code === "HEURISTIC_POLICY_UNSUPPORTED_FAMILY",
);

console.log("heuristic policy outcome behavior tests passed");
