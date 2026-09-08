"use strict";
// 正式模型的倍数、临时奖励和终局公式审计；不执行AI，不修改生产策略。
const fs = require("node:fs"), assert = require("node:assert/strict");
const effects = require("../randomizer/game/cards/effects");
const scoring = require("../randomizer/game/end-game-scoring");
const residual = require("../randomizer/game/effects/residual-domain-session");
const inputs = require("../reports/iteration/round5-card-value-inputs-20260908.json");
const output = "reports/iteration/round5-reward-multiplicity-20260909.json";
if (fs.existsSync(output)) { console.log("已有检查点：" + output); process.exit(0); }
const sourceSave = "seti-saves/seti-save-research-counted-card-reveal-20260909-a402ca99-full-v316.json";
const envelope = JSON.parse(fs.readFileSync(sourceSave));
const root = JSON.parse(envelope.committedState), before = structuredClone(root);
const multiplicity = [], deferred = [], temporary = [], endGame = [], bonuses = [];
const conditions = {};
for (const entry of inputs.models) {
  const model = effects.getCardModel(entry.cardId);
  assert.deepEqual(JSON.parse(JSON.stringify(model)), entry.model);
  const built = effects.buildPlayEffects({ cardId: entry.cardId });
  // 序列展开和handler内重复两种形式都守恒，但不能在估值时各乘一次。
  let cursor = 0;
  for (const raw of model.playEffects || []) {
    const repeat = Math.max(1, Math.round(Number(raw.options?.repeat || 1)));
    const preserve = Boolean(raw.options?.noAutoRepeatExpansion)
      || ["card_public_scan", "card_any_sector_scan", "card_probe_sector_scan"].includes(raw.type);
    const count = preserve ? 1 : repeat;
    const nodes = built.slice(cursor, cursor + count);
    assert.equal(nodes.length, count);
    assert.ok(nodes.every(node => node.type === raw.type));
    const runtimeRepeat = nodes.reduce((n, node) => n + Math.max(1, Number(node.options?.repeat || 1)), 0);
    assert.equal(runtimeRepeat, repeat, entry.cardId + ": 重复次数应仅计一次");
    multiplicity.push({ cardId: entry.cardId, name: entry.name, effectId: raw.id,
      type: raw.type, modelRepeat: repeat, builtNodes: count, runtimeRepeat,
      repeatOwner: preserve ? "handler" : "buildPlayEffects" });
    cursor += count;
  }
  assert.equal(cursor, built.length);
  for (const task of model.tasks || []) {
    (conditions[task.condition.type] ||= []).push({ cardId: entry.cardId, taskId: task.id, condition: task.condition });
  }
  if (model.triggers?.length || model.tasks?.length) {
    const ids = [...(model.triggers || []).map(t => t.id), ...(model.tasks || []).map(t => t.id)];
    assert.equal(new Set(ids).size, ids.length);
    deferred.push({ cardId: entry.cardId, name: entry.name,
      triggers: (model.triggers || []).map(t => ({ id: t.id, event: t.event, maxClaims: 1, effect: t.effect })),
      tasks: (model.tasks || []).map(t => ({ id: t.id, condition: t.condition, maxClaims: 1, rewards: t.rewards })) });
  }
  if (model.temporaryTasks?.length) {
    const claims = [0, 1, 2, 8].map(count => ({ settlements: count,
      rewards: effects.collectTemporaryTaskRewards(model.temporaryTasks,
        { settlements: Array.from({ length: count }, () => ({})) }) }));
    assert.equal(claims[0].rewards.length, 0);
    assert.deepEqual(claims[1].rewards, claims[2].rewards);
    assert.deepEqual(claims[1].rewards, claims[3].rewards);
    temporary.push({ cardId: entry.cardId, name: entry.name, claims });
  }
  if (model.endGameScoring) {
    const values = root.players.players.map(player => {
      // 正式公式可能初始化外星人/终局切片：隔离全部输入，而非让只读估值污染观察。
      const isolated = structuredClone(root);
      const actor = isolated.players.players.find(p => p.id === player.id);
      const context = { ...isolated, cardEffects: effects,
        getCardTypeCode: card => effects.getRuntimeCardTypeCode(card, card.cardTypeCode) };
      const actual = scoring.scoreCardEndGameRule(model.endGameScoring, actor, context);
      assert.ok(Number.isFinite(actual) && actual >= 0);
      return { playerId: player.id, currentPublicFormulaScore: actual, proposedHandExpectation: actual * 0.5 };
    });
    endGame.push({ cardId: entry.cardId, name: entry.name, rule: model.endGameScoring, values });
  }
}
// 用正式只读进度函数重放资格；只在独立夹具上记录它返回的已用键/领取键。
for (const instance of inputs.effectTypes.card_register_event_bonus.instances) {
  const spec = instance.effect.options.bonus;
  const bonus = { ...structuredClone(spec), id: instance.effect.id, ownerId: "player-blue" };
  const event = { type: spec.eventType, planetId: spec.includePlanetIds?.[0] || "mars",
    nebulaId: effects.NEBULA_IDS_BY_COLOR[spec.color || "yellow"][0], sectorX: 1,
    sameRing: true, publicityReward: 1 };
  const trace = [];
  for (let i = 0; i < 4; i++) {
    const nextEvent = { ...event };
    if (spec.distinctBy && i >= 2) nextEvent[spec.distinctBy] = spec.distinctBy === "planetId" ? "saturn" : 2;
    const snapshot = structuredClone({ bonus, event: nextEvent });
    const progress = residual.describeEventBonusProgress({ bonus, event: nextEvent, ownerId: "player-blue" });
    assert.deepEqual({ bonus, event: nextEvent }, snapshot);
    if (!["inapplicable", "repeated"].includes(progress.status) && progress.usedKey) {
      (bonus.usedKeys ||= []).push(progress.usedKey);
    }
    if (progress.status === "reward" && progress.claimKey) (bonus.claimedKeys ||= []).push(progress.claimKey);
    trace.push({ event: nextEvent, progress });
  }
  const claims = trace.filter(t => t.progress.status === "reward").length;
  assert.equal(claims, spec.onceKey || spec.minCount ? 1 : spec.distinctBy ? 2 : 4);
  assert.equal(residual.describeEventBonusProgress({ bonus, event, ownerId: "player-white" }).status, "inapplicable");
  bonuses.push({ cardId: instance.cardId, effectId: instance.effect.id, spec, trace, claims,
    boundary: "资格不是奖励数：空rewards的移动修正和支付followup需按实际节省/成本估值" });
}
assert.deepEqual(root, before, "正式保存的盘面不得被审计修改");
assert.equal(endGame.length, 17);
assert.equal(new Set(endGame.map(e => e.rule.kind)).size, 10);
assert.equal(bonuses.length, 16);
assert.equal(temporary.length, 3);
const counts = { cards: inputs.models.length, immediateEffects: multiplicity.length,
  deferredCards: deferred.length, taskConditionTypes: Object.keys(conditions).length,
  triggerSlots: deferred.reduce((n, c) => n + c.triggers.length, 0),
  taskSlots: deferred.reduce((n, c) => n + c.tasks.length, 0), temporaryCards: temporary.length,
  eventBonuses: bonuses.length, endGameCards: endGame.length, endGameKinds: 10, endGameEvaluations: endGame.length * 4 };
fs.writeFileSync(output, JSON.stringify({ baseCommit: "d5687c48", sourceSave, counts,
  multiplicity, deferred, conditions, temporary, bonuses, endGame,
  boundary: "正式次数与公式证据，不是完整牌估值实现；当前数量折半仍为提案，不是未来数量预测或用户确认",
  passed: true }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, counts, passed: true }));
