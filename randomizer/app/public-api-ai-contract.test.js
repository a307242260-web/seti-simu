"use strict";

const assert = require("node:assert/strict");
const { createPublicApi } = require("./public-api");

const calls = [];
const aiMethods = {
  configureAiAutoBattle: () => calls.push("configure"),
  configureAiStrategyWeights: () => calls.push("weights"),
  resetAiStrategyWeights: () => calls.push("reset-weights"),
  applyAiStrategyTuning: () => calls.push("apply-tuning"),
  getAiStrategyWeights: () => ({ scan: 1 }),
  getAiStrategyTuningHistory: () => [],
  clearAiStrategyTuningHistory: () => calls.push("clear-history"),
  getAiStrategyTuningRecommendation: () => null,
  applyAiStrategyTuningRecommendation: () => calls.push("apply-recommendation"),
  runAiAutoBattle: () => calls.push("battle"),
  runAiAutoBattleBatch: () => calls.push("batch"),
  runAiStrategyABTest: () => calls.push("ab"),
  runAiStrategyTuningCycle: () => calls.push("cycle"),
  stopAiAutoBattle: () => calls.push("stop"),
  runAiAutomationStep: () => ({ ok: true, source: "automation" }),
  runAiNonTurnAutomationStep: () => ({ ok: true, source: "pending" }),
  runAiSelectedTurnAction: () => ({ ok: true, source: "selected" }),
  buildAiTurnActionCandidates: () => ({
    ok: true,
    candidates: [{
      id: "placeData",
      kind: "quick",
      score: 8,
      blueSlot: 2,
      target: { kind: "computer", row: 1 },
    }],
  }),
  resolveAiAutomationToTurnBoundary: () => ({ ok: true, source: "boundary" }),
  getAiAutoBattleProgress: () => ({ running: false }),
  getAiAutoBattleReport: () => ({ bugs: [] }),
  getAiAutoBattleAnalysis: () => ({ samples: [] }),
  enumerateHeadlessConditionalActions: () => ({
    actorPlayer: { id: "player-green" },
    candidates: [{ family: "choose_card", target: { choiceId: "one" } }],
  }),
  getHeadlessDecisionOwnerState: () => ({
    actorPlayer: { id: "player-green" },
    actorPlayerId: "player-green",
    pendingOwnerPlayerId: "player-green",
    effectOwnerPlayerId: "player-brown",
    currentPlayerId: "player-blue",
    source: "pending_owner",
  }),
};

const api = createPublicApi({
  structuredClone: (value) => JSON.parse(JSON.stringify(value)),
  ...aiMethods,
});

assert.equal(api.runAiAutoBattleStep, aiMethods.runAiAutomationStep);
assert.equal(api.runAiPendingStep, aiMethods.runAiNonTurnAutomationStep);
assert.equal(api.resolveAiToTurnBoundary, aiMethods.resolveAiAutomationToTurnBoundary);
assert.equal(api.runAiSelectedTurnAction, aiMethods.runAiSelectedTurnAction);
assert.equal(api.startAiAutoBattle, aiMethods.runAiAutoBattle);
assert.equal(api.runAiAutoBattleBatch, aiMethods.runAiAutoBattleBatch);
assert.equal(api.getAiAutoBattleReport, aiMethods.getAiAutoBattleReport);
assert.deepEqual(api.listHeadlessConditionalActionCandidates(), {
  ok: true,
  actorPlayer: { id: "player-green" },
  decisionOwner: aiMethods.getHeadlessDecisionOwnerState(),
  candidates: [{ family: "choose_card", target: { choiceId: "one" } }],
});

assert.deepEqual(api.listAiTurnActionCandidates(), {
  ok: true,
  candidates: [{
    candidateIndex: 0,
    id: "placeData",
    kind: "quick",
    label: null,
    score: 8,
    reason: null,
    tradeId: null,
    cardId: null,
    cardInstanceId: null,
    handIndex: null,
    blueSlot: 2,
    placementSlot: null,
    rocketId: null,
    planetId: null,
    direction: null,
    deltaX: null,
    deltaY: null,
    requiredMovePoints: null,
    alienSlotId: null,
    position: null,
    symbolId: null,
    preserveHandIndex: null,
    target: { kind: "computer", row: 1 },
    available: true,
  }],
});

console.log("app/public-api-ai-contract.test.js ok");
