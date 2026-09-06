"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const cards = require("../randomizer/game/cards/effects");
const residual = require("../randomizer/game/effects/residual-domain-session");
const input = "reports/iteration/company-hot-prefix-20260907.json";
const output = "reports/iteration/visit-demand-contracts-20260907.json";
const eventTypes = new Set(["visitPlanet", "visitComet", "visitAsteroid", "move"]);

function enumerate() {
  const rows = [];
  function visit(value, path, cardId) {
    if (!value || typeof value !== "object") return;
    if (value.event && [value.event.type, ...(value.event.types || [])].some(type => eventTypes.has(type))) {
      rows.push({ cardId, path, kind: "trigger", value });
    }
    if (value.type === cards.EFFECT_TYPES.REGISTER_EVENT_BONUS && eventTypes.has(value.options.bonus.eventType)) {
      rows.push({ cardId, path, kind: "bonus", value });
    }
    for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`, cardId);
  }
  for (const cardId of Object.keys(cards.MODELS)) visit(cards.getCardModel(cardId), "model", cardId);
  return rows;
}

function eventFor(spec) {
  const type = spec.eventType || spec.type;
  assert.ok(eventTypes.has(type));
  const event = { type, playerId: "player-green", rocketId: 3, source: "visit-demand-contract" };
  if (type === "visitPlanet") Object.assign(event, {
    planetId: (spec.includePlanetIds || spec.planetIds || ["mars"])[0], hasOwnOrbit: true, publicityReward: 1,
  });
  if (type === "move") event.sameRing = true;
  return event;
}

if (fs.existsSync(output)) console.log(`已有访问契约证据：${output}`);
else {
  const buffer = fs.readFileSync(input), initial = JSON.parse(JSON.parse(buffer).envelope.committedState);
  const rows = enumerate();
  const report = { scope: "242个正式模型的移动/访问消费者目录，以及正式匹配器/奖励增补owner的隔离事件序列验证；不模拟路线、不执行整局、不外推外星人非卡牌机制覆盖",
    input, inputSha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    modelCount: Object.keys(cards.MODELS).length, referenceCount: Object.keys(cards.CARD_REFERENCE_MAP).length,
    entries: [], verified: false };
  try {
    assert.equal(report.modelCount, 242);
    assert.equal(rows.length, 29);
    for (const row of rows) {
      if (row.kind === "trigger") {
        const card = { id: `contract:${row.cardId}`, cardId: row.cardId };
        const player = { id: "player-green", reservedCards: [card] };
        const event = eventFor(row.value.event);
        const before = cards.collectMatchingTriggers(player, event).map(match => match.trigger.id);
        assert.ok(before.includes(row.value.id));
        assert.equal(cards.consumeTrigger(card, row.value.id), true);
        const after = cards.collectMatchingTriggers(player, event).map(match => match.trigger.id);
        assert.ok(!after.includes(row.value.id));
        assert.equal(before.length - after.length, 1, "一次消耗只移除一个槽，不删除同事件其他选择");
        report.entries.push({ ...row, matchedBefore: before, matchedAfter: after });
        continue;
      }
      const root = structuredClone(initial), player = root.players.players.find(p => p.id === "player-green");
      player.reservedCards = [];
      const bonus = { ...structuredClone(row.value.options.bonus), id: row.value.id,
        ownerId: player.id, usedKeys: [], claimedKeys: [] };
      root.turn.cardTurnEventBonuses = [bonus];
      const first = eventFor(bonus), alternate = bonus.distinctBy === "planetId" ? { ...first, planetId: "venus" } : first;
      const sequence = [first, first, alternate, alternate];
      const steps = [];
      for (const event of sequence) {
        const before = { ...player.resources };
        const result = residual.augmentEffectResult(root, { ok: true, events: [event], spawnedEffects: [] }, { ownerId: player.id });
        assert.equal(result.ok, true);
        const gain = Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(player.resources)])]
          .map(key => [key, (Number(player.resources[key]) || 0) - (Number(before[key]) || 0)]).filter(([, amount]) => amount !== 0));
        steps.push({ event, gain, bonus: structuredClone(bonus), spawnedEffects: result.spawnedEffects });
      }
      const rewardSteps = steps.map(step => Object.keys(step.gain).length > 0);
      if (bonus.minCount) assert.deepEqual(rewardSteps, [false, false, true, false]);
      else if (bonus.onceKey) assert.deepEqual(rewardSteps, [true, false, false, false]);
      else if (bonus.distinctBy) assert.deepEqual(rewardSteps, [true, false, true, false]);
      else if (bonus.publicityToMoveFollowup) {
        assert.deepEqual(rewardSteps, [false, false, false, false]);
        assert.ok(steps.every(step => step.spawnedEffects.length === 1), "访问只提供后续付费移动，不提前发放移动结果");
      } else if (bonus.movementModifiers) {
        assert.deepEqual(rewardSteps, [false, false, false, false]);
        assert.ok(steps.every(step => step.spawnedEffects.length === 0));
      } else {
        assert.equal(row.cardId, "aomomo_5.webp", "新的重复型访问收益必须显式审查");
        assert.deepEqual(rewardSteps, [true, true, true, true]);
      }
      const wrongRoot = structuredClone(initial), wrongPlayer = wrongRoot.players.players.find(p => p.id === player.id);
      wrongPlayer.reservedCards = [];
      const wrongBonus = { ...structuredClone(row.value.options.bonus), id: row.value.id, ownerId: "player-blue", usedKeys: [], claimedKeys: [] };
      wrongRoot.turn.cardTurnEventBonuses = [wrongBonus];
      const wrongBefore = JSON.stringify({ resources: wrongPlayer.resources, bonus: wrongBonus });
      const wrong = residual.augmentEffectResult(wrongRoot, { ok: true, events: [first], spawnedEffects: [] }, { ownerId: player.id });
      assert.equal(wrong.ok, true);
      assert.equal(wrong.spawnedEffects.length, 0);
      assert.equal(JSON.stringify({ resources: wrongPlayer.resources, bonus: wrongBonus }), wrongBefore);
      report.entries.push({ ...row, steps, wrongBonusOwnerUnchanged: true });
    }
    report.counts = { triggers: rows.filter(row => row.kind === "trigger").length,
      bonuses: rows.filter(row => row.kind === "bonus").length,
      alienCardEntries: rows.filter(row => !Object.hasOwn(cards.CARD_REFERENCE_MAP, row.cardId)).length };
    report.verified = true;
  } catch (error) {
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, counts: report.counts, error: report.error }, null, 2));
  }
}
