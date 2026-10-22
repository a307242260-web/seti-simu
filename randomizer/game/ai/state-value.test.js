"use strict";
const assert = require("node:assert/strict");
const { evaluateStateValue, MODEL_VERSION } = require("./state-value");

function observation(round = 1) {
  return { terminal: false, publicState: { roundNumber: round, players: [{
    playerId: "p1", score: 10, finalScore: 14, credits: 2, energy: 3,
    publicity: 4, availableData: 2, additionalPublicScan: 0,
    income: { credits: 1, energy: 0, publicity: 0, availableData: 0, handSize: 0, additionalPublicScan: 0 },
  }] }, selfState: { playerId: "p1", hand: [{ id: "known" }, { hidden: true }] } };
}

const start = observation();
const value = evaluateStateValue(start, "p1");
assert.equal(value.modelVersion, MODEL_VERSION);
assert.equal(value.components.realizedScore, 10);
assert.equal(value.components.currentEndGameBonus, 4);
assert.equal(value.components.income, 3, "第2/3/4轮各有一次未来收入");
assert.equal(value.components.hand, 2, "未知牌只按数量，不读身份");
assert.equal(evaluateStateValue(observation(4), "p1").components.income, 0);
const end = { ...start, terminal: true };
assert.equal(evaluateStateValue(end, "p1").total, 14, "正式最终分不叠资源或未来收入");
assert.deepEqual(start, observation(), "估值不得修改来源");

assert.throws(() => evaluateStateValue(start, "other"), /VALUE_PLAYER_MISSING/);
assert.throws(() => evaluateStateValue({ ...start, selfState: { playerId: "other", hand: [] } }, "p1"), /VALUE_VIEWER_MISMATCH/);
assert.throws(() => evaluateStateValue({ ...start, selfState: { playerId: "p1" } }, "p1"), /VALUE_HAND_MISSING/);
const broken = observation();
broken.publicState.players[0].energy = NaN;
assert.throws(() => evaluateStateValue(broken, "p1"), /VALUE_NUMBER_INVALID/);
delete broken.publicState.players[0].energy;
assert.throws(() => evaluateStateValue(broken, "p1"), /VALUE_NUMBER_INVALID/);
assert.throws(() => evaluateStateValue(start, "p1", { weights: { credits: Infinity } }), /VALUE_NUMBER_INVALID/);
assert.throws(() => evaluateStateValue(observation(5), "p1"), /VALUE_ROUND_INVALID/);

const decision = { publicState: start.publicState, selfState: start.selfState,
  outcomeProjection: { terminal: false } };
assert.equal(evaluateStateValue(decision, "p1").total, value.total,
  "决策观察与分析观察共用同一估值输入事实");
const { createSimulationEnv } = require("../../app/simulation-env");
const env = createSimulationEnv();
env.reset({ seed: "state-value-input-v1", agentType: "completion" });
const real = env.runAgentDecision().agentTrace.context;
assert(Number.isFinite(evaluateStateValue(real.observation, real.seatId).total));
env.dispose();
console.log("independent state value accounting and strict inputs passed");
