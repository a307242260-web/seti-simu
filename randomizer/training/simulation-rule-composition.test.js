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

function completeInitialCardSelections(composition) {
  const progressByPlayer = new Map();
  for (let guard = 0; guard < 20; guard += 1) {
    const inspection = composition.inspect();
    const choices = inspection.session?.decision?.choices || [];
    if (choices.some((choice) => choice.family === "choose_payment")) return;
    const actorId = inspection.session?.decision?.ownerId;
    const progress = progressByPlayer.get(actorId) || { industry: false, initialIds: new Set() };
    let choice = choices.find((candidate) => candidate.target?.kind === "start_initial_setup")
      || choices.find((candidate) => candidate.target?.kind === "confirm_initial_setup");
    if (!choice && !progress.industry) {
      choice = choices.find((candidate) => candidate.target?.selectionKind === "industry");
      if (choice) progress.industry = true;
    }
    if (!choice && progress.initialIds.size < 2) {
      choice = choices.find((candidate) => (
        candidate.target?.selectionKind === "initial"
        && !progress.initialIds.has(candidate.target.cardId)
      ));
      if (choice) progress.initialIds.add(choice.target.cardId);
    }
    assert.ok(choice, "初始选择必须提供下一条标准 action");
    progressByPlayer.set(actorId, progress);
    assert.equal(composition.inputPort.submitDecision({
      decisionId: inspection.session.decision.decisionId,
      decisionVersion: inspection.session.decision.decisionVersion,
      ownerId: inspection.session.decision.ownerId,
      choice,
    }).ok, true);
  }
  assert.fail("初始选择必须有限进入收入弃牌 Decision");
}

const kernel = createSimulationRuleComposition({
  ...config,
  random: createSeededRandom(config.seed),
});
assert.equal(kernel.newGame(config).ok, true);
assert.equal(kernel.composition.inputPort.beginDrain().ok, true);
completeInitialCardSelections(kernel.composition);

const openingPlayerId = "player-white";
const before = kernel.composition.projection({ viewerId: "simulation:test", role: "simulation", playerId: null }).state;
const beforePlayer = before.players.players.find((player) => player.id === openingPlayerId);
const originalEntityIds = new Set(beforePlayer.hand.map((card) => card.id));
const discardCount = before.cards.discardPile.length;

const inspection = kernel.composition.inspect();
assert.equal(inspection.phase, "awaiting_input");
const selectedChoice = inspection.session.decision.choices.find((choice) => (
  choice.family === "choose_payment" && choice.actorId === openingPlayerId
));
assert.ok(selectedChoice, "opening 必须为当前玩家枚举至少一个明确弃牌选择");
const selectedCardId = selectedChoice.target.cardIds[0];
const selectedHandIndex = selectedChoice.target.handIndexes[0];
const selectedEntity = beforePlayer.hand[selectedHandIndex];
assert.equal(selectedEntity.cardId, selectedCardId, "opening choice 必须引用当前 canonical 手牌实体");
const matches = inspection.session.decision.choices.filter((choice) => (
  choice.family === "choose_payment"
  && choice.actorId === openingPlayerId
  && choice.target?.cardIds?.includes(selectedCardId)
  && choice.target?.handIndexes?.includes(selectedHandIndex)
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
assert.equal(after.cards.discardPile.length, discardCount, "初始收入牌移出游戏，不进入弃牌堆");
assert.equal(
  (after.cards.removedFromGameCardIds || []).length,
  (before.cards.removedFromGameCardIds || []).length + 1,
  "初始收入牌必须移出游戏（removedFromGameCardIds +1）",
);
assert.equal(
  kernel.composition.inspect().session.decision.choices.some((choice) => (
    choice.target?.cardIds?.includes(selectedCardId)
  )),
  false,
  "下一 Composition Decision 不得再次枚举已弃卡",
);

kernel.composition.dispose();
console.log("simulation rules-only composition tests passed");
