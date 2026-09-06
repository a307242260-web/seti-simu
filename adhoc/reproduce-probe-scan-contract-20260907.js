"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const play = require("../randomizer/game/cards/play-domain"), science = require("../randomizer/game/effects/science-session");
const cards = require("../randomizer/game/cards/deck"), effects = require("../randomizer/game/cards/effects");
const rockets = require("../randomizer/game/rockets"), solar = require("../randomizer/solar-system/core");
const output = "reports/iteration/probe-scan-contract-reproduction-20260907.json";

function harness(module, factory) {
  const executors = new Map();
  module[factory]({ runtime: { registerExecutor(type, executor) {
    executors.set(type, typeof executor === "function" ? { execute: executor } : executor);
  } }, commitWorkingState(_state, context) { return { committedBy: context.source }; } });
  return executors;
}

if (fs.existsSync(output)) console.log(`已有复现：${output}`);
else {
  const report = { scope: "真实42盘面派生的Card Play→Science正式owner反例；隔离放置两艘及替换手牌，无完整session/CAS/RNG重放，不运行AI",
    cases: [], verified: false };
  try {
    const serialized = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint.coreState.committedState;
    const playExecutors = harness(play, "createExperimentalCardPlayDomain"), scienceExecutors = harness(science, "createScienceDomain");
    for (const cardId of ["b_50.webp", "b_58.webp", "b_22.webp"]) {
      const root = JSON.parse(serialized), actor = root.players.players.find(p => p.id === "player-green");
      const own = root.pieces.rockets.filter(r => r.playerId === actor.id && r.surface === "solar-board");
      assert.equal(own.length, 2);
      assert.equal(rockets.placeRocketByPriority(root.pieces, own[0], 5, 1), true);
      assert.equal(rockets.placeRocketByPriority(root.pieces, own[1], 6, 1), true);
      if (cardId === "b_50.webp") { own[1].playerId = "player-blue"; own[1].color = "blue"; }
      const card = cards.createCardInstance(cards.getCatalogEntryForCard({ cardId }), 900);
      actor.hand = [card]; actor.resources.handSize = 1;
      const result = playExecutors.get(play.EFFECT_TYPES.PLAY).execute(root, { ownerId: actor.id,
        payload: { action: { actorId: actor.id, target: { cardInstanceId: card.id }, payload: { cost: effects.getCardPlayCost(card) } } } }, { state: root });
      assert.equal(result.ok, true, JSON.stringify(result));
      const scanNodes = result.spawnedEffects.filter(entry => entry.effect.type === science.EFFECT_TYPES.SCAN_STEP).map(entry => entry.effect);
      const caseResult = { cardId, modelOptions: effects.getCardModel(cardId).playEffects.find(e => e.type === effects.EFFECT_TYPES.PROBE_SECTOR_SCAN).options,
        scanNodes, prepared: [] };
      const scanExecutor = scienceExecutors.get(science.EFFECT_TYPES.SCAN_STEP);
      for (const node of scanNodes) {
        // b58的先行移动不在此owner级反例执行；这里核对其后扫描节点的实际职责。
        const prepared = scanExecutor.execute(root, node, { state: root });
        assert.equal(prepared.ok, true);
        assert.equal(prepared.spawnedEffects.length, 1);
        const decision = prepared.spawnedEffects[0].effect;
        const choices = scanExecutor.getLegalChoices(root, decision, { state: root });
        assert.ok(choices.length > 0);
        const resolved = scanExecutor.resolveDecision(root, decision, choices[0], { state: root });
        assert.equal(resolved.ok, true, JSON.stringify(resolved));
        caseResult.prepared.push({ decision, choices, events: resolved.events, followups: resolved.spawnedEffects });
      }
      const otherNebula = solar.getNebulaAtCoordinate(6, 5, root.solarSystem.sectorBySlot).id;
      if (cardId === "b_50.webp") {
        assert.equal(scanNodes.length, 1);
        assert.ok(!caseResult.prepared[0].choices.some(c => c.target.nebulaId === otherNebula));
        assert.equal(caseResult.prepared[0].followups.length, 0);
        caseResult.confirmedMismatch = "对手探测器所在扇区不可选，选择一次后不再提供第2/3艘";
      } else if (cardId === "b_58.webp") {
        assert.equal(scanNodes.length, 1);
        assert.equal(caseResult.prepared[0].followups.length, 0);
        caseResult.confirmedMismatch = "仅一个扫描节点，结算后没有两个相邻扇区的扫描";
      } else {
        assert.equal(scanNodes.length, 2);
        assert.ok(caseResult.prepared.every(p => p.choices.some(c => c.target.nebulaId === otherNebula)));
        caseResult.observedBehavior = "两次扫描独立选择扇区，没有锁定同一探测器来源；规则语义待核准";
      }
      report.cases.push(caseResult);
    }
    report.verified = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, cases: report.cases.map(c => ({ cardId: c.cardId, finding: c.confirmedMismatch || c.observedBehavior })), error: report.error }, null, 2));
  }
}
