"use strict";

const assert = require("node:assert/strict");
const standardAction = require("../game/actions/standard-action");
const { createSimulationRuleComposition } = require("./simulation-rule-composition");

function createSeededRandom(seed) {
  let state = [...String(seed)].reduce(
    (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  ) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

const config = {
  seed: "seti-140-production-standard-action",
  activePlayerCount: 4,
  aiDifficulty: "weak_start",
};
const kernel = createSimulationRuleComposition({
  ...config,
  random: createSeededRandom(config.seed),
});

assert.deepEqual(
  kernel.actionContract.coverage().map(({ family, registered }) => ({ family, registered })),
  standardAction.ALL_FAMILIES.map((family) => ({ family, registered: true })),
  "生产 Simulation composition 必须唯一注册全部 22 个 Standard Action family",
);
for (const entry of kernel.actionContract.coverage()) {
  assert.equal(entry.phase, standardAction.PHASE_BY_FAMILY[entry.family]);
  assert.match(entry.obligation, /\S/, `${entry.family} 必须声明生产 obligation`);
  if (entry.status === "unavailable") {
    assert.match(entry.unavailableReason, /\S/, `${entry.family} 不可合法时必须声明原因`);
  } else {
    assert.equal(entry.status, "supported");
    assert.equal(entry.unavailableReason, null);
  }
}

assert.equal(kernel.newGame(config).ok, true);
assert.equal(kernel.composition.inputPort.beginDrain().ok, true);
const inspection = kernel.composition.inspect();
const openingAction = inspection.session.decision.choices.find(
  (choice) => choice.family === "choose_payment",
);
assert.ok(openingAction, "生产 opening 状态必须产生真实 choose_payment Standard Action");
const before = kernel.composition.stateSourcePort.read().state;
const submitted = kernel.composition.inputPort.submitDecision({
  decisionId: inspection.session.decision.decisionId,
  decisionVersion: inspection.session.decision.decisionVersion,
  choice: openingAction,
});
assert.equal(submitted.ok, true, "生产 composition 必须正式执行已注册 Standard Action");
const after = kernel.composition.stateSourcePort.read().state;
assert.notDeepEqual(after.match.initialIncomeQueue, before.match.initialIncomeQueue);

const stale = kernel.composition.inputPort.submitDecision({
  decisionId: inspection.session.decision.decisionId,
  decisionVersion: inspection.session.decision.decisionVersion,
  choice: openingAction,
});
assert.equal(stale.ok, false, "过期 Decision 必须在 handler 前拒绝");

kernel.composition.dispose();
console.log("simulation production Standard Action composition tests passed");
