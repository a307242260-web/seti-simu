"use strict";
const assert = require("node:assert/strict");
const cards = require("../randomizer/game/cards/effects");
const rockets = require("../randomizer/game/rockets");

// 接入前的卡牌需求目录原型：只建立真实实例/正式模型节点的身份和阶段。
// 不执行移动、不估分、不以本目录替代包含基础宣传/运输/扫描的完整移动目录。
const visitTypes = new Set(["visitPlanet", "visitComet", "visitAsteroid", "move"]);
const ownConditions = new Set(["probeLocation", "probeAdjacentEarthAsteroid",
  "probeDistanceFromEarth", "probeAdjacentEarth", "probesOnDifferentPlanets"]);

function enumerateModelPurposes(model) {
  const entries = [];
  function walk(value, path) {
    if (!value || typeof value !== "object") return;
    if (value.condition && /probe/i.test(value.condition.type)) {
      assert.ok(ownConditions.has(value.condition.type) || value.condition.type === "otherProbeAtPlanet",
        `未知位置条件：${path}/${value.condition.type}`);
      entries.push({ kind: "position", path: `${path}.condition`, ownerNode: value, condition: value.condition });
    }
    if (value.event && [value.event.type, ...(value.event.types || [])].some(t => visitTypes.has(t))) {
      entries.push({ kind: "trigger", path, ownerNode: value });
    }
    if (value.type === cards.EFFECT_TYPES.REGISTER_EVENT_BONUS && visitTypes.has(value.options.bonus.eventType)) {
      const bonus = value.options.bonus;
      assert.ok(bonus.rewards?.length || bonus.movementModifiers || bonus.publicityToMoveFollowup,
        `未归类的移动/访问注册效果：${path}`);
      entries.push({ kind: bonus.rewards?.length ? "bonus" : "movement-means", path, ownerNode: value });
    }
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
  }
  walk(model, "model");
  return entries;
}

function cardMovementPurposes(root, actorId) {
  const actor = root.players.players.find(p => p.id === actorId);
  assert.ok(actor, "移动需求必须有真实owner");
  const location = rockets.buildProbeLocationData(root);
  const entries = [], excluded = [];
  for (const [zone, instances] of [["hand", actor.hand], ["reserved", actor.reservedCards]]) {
    assert.ok(Array.isArray(instances));
    for (const card of instances) {
      assert.ok(card.id != null, "卡牌移动需求缺少实例来源");
      const model = cards.getCardModel(card);
      // 未建模牌是显式目录缺口，不能被当作没有移动需求。
      assert.ok(model, `卡牌正式模型缺失：${card.cardId}`);
      for (const entry of enumerateModelPurposes(model)) {
        const source = { kind: "card-instance", cardInstanceId: card.id, cardId: card.cardId,
          ownerId: actorId, zone, modelPath: entry.path };
        const row = { id: JSON.stringify([card.id, entry.path]), kind: entry.kind, source };
        if (entry.kind === "movement-means") {
          excluded.push({ ...row, reason: "means-not-purpose" }); continue;
        }
        if (entry.kind === "bonus") {
          // 保留区中旧牌的playEffects不再可执行，不能再次制造待注册奖励。
          if (zone !== "hand") { excluded.push({ ...row, reason: "play-effect-already-left-hand" }); continue; }
          entries.push({ ...row, phase: "requires-play", registrationEffectId: entry.ownerNode.id,
            effectPath: entry.path, bonus: structuredClone(entry.ownerNode.options.bonus) });
          continue;
        }
        if (entry.kind === "trigger") {
          if (card.cardEffectState?.consumedTriggerIds?.includes(entry.ownerNode.id)) {
            excluded.push({ ...row, reason: "trigger-consumed" }); continue;
          }
          entries.push({ ...row, phase: zone === "hand" ? "requires-play" : "awaits-event-and-choice",
            triggerId: entry.ownerNode.id, event: structuredClone(entry.ownerNode.event) });
          continue;
        }
        if (entry.condition.type === "otherProbeAtPlanet") {
          excluded.push({ ...row, reason: "opponent-position-not-controlled" }); continue;
        }
        const task = entry.path.startsWith("model.tasks.");
        if (!task && zone !== "hand") {
          excluded.push({ ...row, reason: "play-condition-already-left-hand" }); continue;
        }
        if (task && card.cardEffectState?.completedTaskIds?.includes(entry.ownerNode.id)) {
          excluded.push({ ...row, reason: "task-completed" }); continue;
        }
        const satisfied = cards.taskConditionMet({ condition: entry.condition }, actor, {
          probeLocations: location.index, probeLocationDetails: location.details,
        });
        entries.push({ ...row, phase: satisfied ? "position-satisfied" : "needs-position",
          requiresPlay: zone === "hand", condition: structuredClone(entry.condition),
          completion: task ? "formal-task-claim" : "formal-play-condition",
          sourceArity: entry.condition.type === "probesOnDifferentPlanets" ? "joint" : "single" });
      }
    }
  }
  // 这是本次读取根已存在的公开奖励身份；不跨根/回合复用序位，也不反查同模型新牌。
  for (const [ordinal, bonus] of root.turn.cardTurnEventBonuses.entries()) {
    if ((bonus.ownerId || bonus.playerId) !== actorId || !visitTypes.has(bonus.eventType)) continue;
    assert.ok(bonus.id, "已注册移动奖励缺少正式effect身份");
    if (!bonus.rewards?.length) continue;
    entries.push({ id: JSON.stringify(["registered", actorId, ordinal, bonus.id]), kind: "bonus",
      phase: "registered", source: { kind: "registered-public-bonus", ownerId: actorId,
        rootRecordOrdinal: ordinal, effectId: bonus.id }, bonus: structuredClone(bonus) });
  }
  return { entries, excluded };
}
module.exports = { enumerateModelPurposes, cardMovementPurposes };
