"use strict";

const assert = require("node:assert/strict");
const { createSimulationRuleComposition } = require("./simulation-rule-composition");

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

const config = {
  seed: "seti-116-standard-flow-v2",
  activePlayerCount: 4,
  aiDifficulty: "weak_start",
};
const kernel = createSimulationRuleComposition({
  ...config,
  random: createSeededRandom(config.seed),
});
assert.equal(kernel.newGame(config).ok, true);
assert.equal(kernel.composition.inputPort.beginDrain().ok, true);

const openingPlayerId = "player-white";
const before = kernel.composition.projection({ viewerId: "simulation:test", role: "simulation", playerId: null }).state;
const beforePlayer = before.players.players.find((player) => player.id === openingPlayerId);
const selectedEntity = beforePlayer.hand.find((card) => card.cardId === "b_77.webp");
assert.ok(selectedEntity, "opening 明确选择必须仍在手牌");
const originalEntityIds = new Set(beforePlayer.hand.map((card) => card.id));
const discardCount = before.cards.discardPile.length;

const inspection = kernel.composition.inspect();
assert.equal(inspection.phase, "awaiting_input");
const matches = inspection.session.decision.choices.filter((choice) => (
  choice.family === "choose_payment"
  && choice.actorId === openingPlayerId
  && choice.target?.cardIds?.includes("b_77.webp")
  && choice.target?.handIndexes?.includes(2)
));
assert.equal(matches.length, 1, "opening cardId/handIndex 必须唯一解析");

const result = kernel.composition.inputPort.submitDecision({
  decisionId: inspection.session.decision.decisionId,
  decisionVersion: inspection.session.decision.decisionVersion,
  ownerId: inspection.session.decision.ownerId,
  choice: matches[0],
});
assert.equal(result.ok, true, "Composition 必须接受 opening 明确弃牌 Decision");

const after = kernel.composition.projection({ viewerId: "simulation:test", role: "simulation", playerId: null }).state;
const afterPlayer = after.players.players.find((player) => player.id === openingPlayerId);
const remainingIds = new Set(afterPlayer.hand.map((card) => card.id));
assert.equal(remainingIds.has(selectedEntity.id), false, "已弃实体不得在 opening 链复活");
assert.equal(
  [...originalEntityIds].filter((entityId) => remainingIds.has(entityId)).length,
  originalEntityIds.size - 1,
  "明确弃牌后原始手牌实体集合必须真实减少 1",
);
assert.equal(after.cards.discardPile.length, discardCount + 1, "明确弃牌后 discard 必须增加 1");
assert.equal(
  kernel.composition.inspect().session.decision.choices.some((choice) => (
    choice.target?.cardIds?.includes("b_77.webp")
  )),
  false,
  "下一 Composition Decision 不得再次枚举已弃卡",
);

kernel.composition.dispose();
console.log("simulation rules-only composition tests passed");
