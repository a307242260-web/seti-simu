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
          endpointPlanetId: "earth",
          goalScoreGain: 10,
          routeCost: { credits: 2, energy: 1, movementSteps: 1 },
          resourceGap: { credits: 0, energy: 0, movementSteps: 1 },
          remainingResources: { credits: 0, energy: 0 },
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

function setupAction(actionId, target) {
  return {
    ...action(actionId, "choose_card"),
    phase: "conditional",
    target,
  };
}

const setupLegalActions = [
  setupAction("setup:industry", {
    kind: "select_initial_card",
    selectionKind: "industry",
    cardId: "industry:a",
  }),
  setupAction("setup:initial-a", {
    kind: "select_initial_card",
    selectionKind: "initial",
    cardId: "initial:a",
  }),
  setupAction("setup:initial-b", {
    kind: "select_initial_card",
    selectionKind: "initial",
    cardId: "initial:b",
  }),
];
const setupContext = policyPort.createDecisionContext({
  requestId: "heuristic-policy-initial-setup",
  seatId: "p1",
  stateVersion: 7,
  decisionVersion: 3,
  observation: outcomeModel.createDecisionObservation({
    publicState: {
      players: [{ id: "p1", resources: {} }],
      resident: {
        initialSetup: {
          active: true,
          offer: {
            selectedIndustryId: null,
            selectedInitialIds: [],
          },
        },
      },
    },
    selfState: { id: "p1", hand: [] },
  }, { seatId: "p1", stateVersion: 7, decisionVersion: 3 }),
  legalActions: setupLegalActions,
  actionOutcomes: [],
});
const setupPolicy = heuristicPolicy.createHeuristicPolicy({ difficulty: "contract-test" });
assert.equal(setupPolicy.decide(setupContext).actionId, "setup:industry");
assert.equal(
  setupPolicy.decide(structuredClone(setupContext)).actionId,
  "setup:industry",
  "initial_setup Policy 选择必须只由 viewer-safe observation 决定，不得依赖宿主闭包进度",
);

const inventoryObservation = outcomeModel.createDecisionObservation({
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
const inventoryValue = expectedScoreEvaluator.evaluateState(inventoryObservation, "p1");
assert.equal(inventoryValue.total, 0, "信用、能源、宣传和卡牌只作为路线事实，不得形成统一库存 V");
assert.deepEqual(inventoryValue.resourceFacts, {
  credits: 1,
  energy: 2,
  publicity: 4,
  ordinaryCards: 2,
  alienCards: 2,
});
assert.equal(inventoryValue.schemaVersion, outcomeModel.VALUE_SCHEMA_VERSION);

function setupObservation(targetBenefitScore, gap) {
  return outcomeModel.createDecisionObservation({
    publicState: {
      players: [{ id: "p1", resources: { score: 0, credits: 0, energy: 0 } }],
      board: {},
    },
    selfState: { id: "p1", hand: [] },
    probeRouteRequirements: {
      playerId: "p1",
      candidates: [{
        targetId: "land:target:planet:",
        targetBenefit: { score: targetBenefitScore },
        gap,
      }],
    },
  }, { seatId: "p1", stateVersion: 0, decisionVersion: 0 });
}

const higherBenefit = expectedScoreEvaluator.evaluateSetupProbeGoals(
  setupObservation(12, { credits: 1, energy: 2, movementSteps: 2 }),
  "p1",
);
const lowerBenefit = expectedScoreEvaluator.evaluateSetupProbeGoals(
  setupObservation(8, { credits: 0, energy: 0, movementSteps: 0 }),
  "p1",
);
assert.ok(expectedScoreEvaluator.compareSetupProbeGoals(higherBenefit, lowerBenefit) < 0,
  "setup 必须先按真实叶的正分探测器目标收益排序");
const lowerGap = expectedScoreEvaluator.evaluateSetupProbeGoals(
  setupObservation(12, { credits: 0, energy: 1, movementSteps: 1 }),
  "p1",
);
assert.ok(expectedScoreEvaluator.compareSetupProbeGoals(lowerGap, higherBenefit) < 0,
  "同目标收益的 setup 叶必须按 credits/energy/movement 缺口排序");

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
