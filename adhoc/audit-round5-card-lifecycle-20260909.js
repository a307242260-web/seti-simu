"use strict";
// 只读目录及已打出牌的剩余收益义务，不是完整牌值实现或搜索性能测试。
const fs = require("node:fs"), assert = require("node:assert/strict");
const effects = require("../randomizer/game/cards/effects");
const scoring = require("../randomizer/game/end-game-scoring");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const inputs = require("../reports/iteration/round5-card-value-inputs-20260908.json");
const output = "reports/iteration/round5-card-lifecycle-20260909.json";
if (fs.existsSync(output)) { console.log("已有生命周期检查点：" + output); process.exit(0); }
function remainingSlots(card) {
  const model = effects.getCardModel(card);
  assert.ok(model);
  const consumed = new Set(card.cardEffectState?.consumedTriggerIds || []);
  const completed = new Set(card.cardEffectState?.completedTaskIds || []);
  return {
    triggers: (model.triggers || []).filter(t => !consumed.has(t.id)),
    tasks: (model.tasks || []).filter(t => !completed.has(t.id)),
  };
}
function exampleReward(effect) {
  const options = effect.options;
  switch (effect.type) {
    case "gain_resources": return Object.entries(options.gain).reduce((v, [key, count]) => v + count * evaluator.resourceUnitValue(key), 0);
    case "gain_data": return options.count * evaluator.resourceUnitValue("availableData");
    case "card_free_move": return options.movementPoints * evaluator.resourceUnitValue("movement");
    case "pick_card": return options.count * evaluator.resourceUnitValue("ordinaryCard");
    default: throw new Error("超出专项算例范围：" + effect.type);
  }
}
function pendingExampleValue(card) {
  const before = structuredClone(card);
  const slots = remainingSlots(card);
  const value = 0.5 * (slots.triggers.reduce((v, t) => v + exampleReward(t.effect), 0)
    + slots.tasks.reduce((v, t) => v + t.rewards.reduce((n, e) => n + exampleReward(e), 0), 0));
  assert.deepEqual(card, before, "估值不能调用有写操作的ensure/collect helper");
  return value;
}
const navigation = { id: "lifecycle-navigation", cardId: "b_2.webp", cardTypeCode: 1 };
const navigationValues = [pendingExampleValue(navigation)];
for (const trigger of effects.getCardModel(navigation).triggers) {
  assert.equal(effects.consumeTrigger(navigation, trigger.id), true);
  navigationValues.push(pendingExampleValue(navigation));
}
assert.deepEqual(navigationValues, [9.5, 5.5, 2.5, 0]);
const task = { id: "lifecycle-task", cardId: "b_83.webp", cardTypeCode: 2 };
const taskValues = [pendingExampleValue(task)];
assert.equal(effects.completeTask(task, effects.getCardModel(task).tasks[0].id), true);
taskValues.push(pendingExampleValue(task));
assert.deepEqual(taskValues, [3, 0], "已打出后不再预估已兑现的抽3牌");
const endGame = { id: "lifecycle-endgame", cardId: "b_33.webp", cardTypeCode: 3 };
const actor = { id: "player-blue", techState: { ownedTiles: { blue1: true, blue2: true } }, reservedCards: [endGame] };
const formal = scoring.computePlayerCardScore(actor, { cardEffects: effects });
assert.equal(formal.total, 4);
assert.deepEqual(remainingSlots(endGame), { triggers: [], tasks: [] });
const catalog = inputs.models.map(entry => {
  const model = effects.getCardModel(entry.cardId);
  return { cardId: entry.cardId, name: entry.name, cardType: model.cardType,
    placedAfterPlay: [1, 2, 3].includes(model.cardType) || Boolean(model.reserveAfterPlay),
    immediateEffects: (model.playEffects || []).map(e => e.type),
    triggerSlots: (model.triggers || []).map(t => t.id), taskSlots: (model.tasks || []).map(t => t.id),
    endGameKind: model.endGameScoring?.kind || null, persistentAbility: model.pluto ? "pluto" : null };
});
assert.equal(catalog.length, 182);
const counts = { total: catalog.length, placedAfterPlay: catalog.filter(c => c.placedAfterPlay).length,
  triggerCards: catalog.filter(c => c.triggerSlots.length).length, taskCards: catalog.filter(c => c.taskSlots.length).length,
  endGameCards: catalog.filter(c => c.endGameKind).length, persistentAbilityCards: catalog.filter(c => c.persistentAbility).length };
const report = { baseCommit: "1a069f6c", counts, navigationValues, taskValues, formalEndGameScore: formal,
  ownership: { hand: "H=max(G-C,corner)", playedTriggerTask: "仅未领取槽位的半值，不计打出费用或即时效果",
    playedEndGame: "现有securedEndGameBonus已包含正式牌分，不再加入cardValue",
    pluto: "已打出解锁能力，不是可弃或可再次打出的手牌；收益义务单列" }, catalog, passed: true };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, counts, navigationValues, taskValues, formalEndGameScore: formal.total, passed: true }));
