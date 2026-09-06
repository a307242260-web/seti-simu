"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const alien = require("../randomizer/game/aliens/yichangdian"), seq = require("../randomizer/game/state/sequences");
const solar = require("../randomizer/solar-system/core"), rockets = require("../randomizer/game/rockets");
const data = require("../randomizer/game/data"), deck = require("../randomizer/game/cards/deck");
const effects = require("../randomizer/game/cards/effects"), science = require("../randomizer/game/effects/science-session");
const output = process.argv[2] || "reports/iteration/yichangdian-flow-20260907.json";
if (fs.existsSync(output)) console.log(`已有验证：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42派生受控卡牌及异常位置；唯一Production执行与逐Decision恢复，不执行AI", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const initial = fork.lifecycle.save().envelope;
    const cases = process.argv[3] === "edges"
      ? [[0,"complete"], ...Object.keys(alien.ANOMALY_REWARDS).map(face => [1, face]), [8,"movement"]]
      : [[8,"draw"],[9,"full"],[9,"anomaly"],[9,"ordinary"],[4,"public"],[5,"scan"]];
    for (const [index, setup] of cases) {
      const envelope = structuredClone(initial), root = JSON.parse(envelope.committedState);
      const actor = root.players.players.find(p => p.id === "player-green");
      const card = alien.createAlienCard(index, seq.take(root, "alienEntity"));
      actor.hand.push(card); actor.resources.handSize = actor.hand.length;
      actor.resources.credits = 10; actor.resources.energy = 10;
      const originalHand = actor.hand.filter(c => c.id !== card.id).map(c => c.id);
      const originalIncome = structuredClone(actor.income);
      const earth = solar.collectPlanetLocations(root.solarSystem).find(p => p.planetId === "earth");
      root.aliens.yichangdian = { anomalies: [{ sectorX: setup === "ordinary" ? solar.mod8(earth.x + 2) : earth.x, markerId: "c_2" }] };
      if (index === 1) root.aliens.yichangdian.anomalies = [{ sectorX: solar.mod8(earth.x - 1), markerId: setup }];
      if (index === 0) {
        const nebulaId = Object.values(effects.NEBULA_IDS_BY_COLOR).flat()[0];
        const x = Array.from({ length: 8 }, (_, x) => x).find(x => solar.getNebulaAtCoordinate(x, 5, root.solarSystem.sectorBySlot).id === nebulaId);
        root.aliens.yichangdian.anomalies = [{ sectorX: x, markerId: "c_2" }];
        root.data = data.createDefaultNebulaDataState(); data.fillAllNebulaData(root.data, { root, source: "anomaly-score-proof" });
        for (let i = 0; i < data.getNebulaCapacity(nebulaId) - 1; i++)
          assert.equal(data.replaceNextNebulaDataToken(root.data, nebulaId, actor, { root }).ok, true);
      }
      if (setup === "movement") {
        root.cards.drawPileCardIds = deck.getAvailablePool(root.cards, root.players)
          .filter(entry => deck.getDiscardActionMoveRewardForCard({ cardId: entry.card_id })?.movementPoints > 0)
          .map(entry => entry.card_id);
        assert(root.cards.drawPileCardIds.length >= 4, "嵌套移动测试需要足够真实移动角牌");
      }
      if (index === 9 && setup !== "full") for (const rocket of [...root.pieces.rockets]) {
        if (rocket.playerId === actor.id) rockets.removeRocket(root.pieces, rocket.id);
      }
      const originalPublic = root.cards.publicCards.filter(Boolean).map(c => c.id);
      envelope.committedState = JSON.stringify(root);
      const restored = fork.lifecycle.restore(envelope);
      assert.equal(restored.ok, true, JSON.stringify(restored));
      const action = fork.inputPort.enumerateActions().find(a => a.family === "play_card" && a.target.cardInstanceId === card.id);
      assert.ok(action);
      let result = fork.inputPort.submitAction(action, { skipProjection: true });
      assert.equal(result.ok, true, JSON.stringify(result.failure));
      const steps = []; let drawnIds = [], discardedIds = [];
      while (fork.inspect().phase === "awaiting_input") {
        assert.ok(steps.length < 40);
        const decision = fork.inspect().session.decision, choices = decision.choices;
        assert.ok(choices.length > 0);
        if (index === 8 && steps.length === 0) {
          drawnIds = choices.map(c => c.target.cardInstanceId);
          assert.equal(drawnIds.length, 3);
          assert(drawnIds.every(id => id && !originalHand.includes(id)));
        }
        const isDrawDiscard = index === 8 && choices.every(c => drawnIds.includes(c.target.cardInstanceId));
        if (isDrawDiscard) assert.equal(choices.length, 3 - discardedIds.length);
        const choice = choices[0];
        if (isDrawDiscard) discardedIds.push(choice.target.cardInstanceId);
        const input = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice };
        const before = fork.lifecycle.save().envelope;
        const wrong = fork.inputPort.submitDecision({ ...input, ownerId: "player-blue" }, { skipProjection: true });
        assert.equal(wrong.ok, false, "错误owner必须拒绝");
        assert.deepEqual(fork.lifecycle.save().envelope, before, "拒绝错误owner不应改变状态");
        result = fork.inputPort.submitDecision(input, { skipProjection: true });
        assert.equal(result.ok, true, JSON.stringify(result.failure));
        const after = fork.lifecycle.save().envelope;
        assert.equal(fork.lifecycle.restore(before).ok, true);
        assert.equal(fork.inputPort.submitDecision(input, { skipProjection: true }).ok, true);
        assert.deepEqual(fork.lifecycle.save().envelope, after);
        steps.push({ choice, restored: true, wrongOwnerRejected: true });
      }
      const finalRoot = fork.projection({ role: "simulation" }).state;
      const finalActor = finalRoot.players.players.find(p => p.id === actor.id);
      if (index === 8) {
        assert.equal(discardedIds.length, 2);
        assert.equal(new Set(discardedIds).size, 2);
        assert(discardedIds.every(id => finalRoot.cards.discardPile.some(c => c.id === id)));
        assert.equal(finalActor.hand.filter(c => drawnIds.includes(c.id)).length, 1);
        assert(originalHand.every(id => finalActor.hand.some(c => c.id === id)));
        assert.deepEqual(finalActor.income, originalIncome, "一次性收入角不得增加永久收入");
      }
      const events = result.journal.events;
      if (index === 0) {
        const scored = events.find(e => e.type === "yichangdian_anomaly_signal_score");
        assert.equal(scored.score, data.getNebulaCapacity(Object.values(effects.NEBULA_IDS_BY_COLOR).flat()[0]));
        const executed = result.journal.effects.map(e => e.type);
        assert(executed.findIndex(t => t.endsWith(effects.EFFECT_TYPES.YICHANGDIAN_ANOMALY_SIGNAL_SCORE))
          < executed.indexOf(science.EFFECT_TYPES.SETTLE), "必须先记分后结算");
      }
      if (index === 1) {
        const reward = alien.getAnomalyReward(setup);
        if (Object.keys(reward.gain).length) assert(events.some(e => e.type === "yichangdian_anomaly_reward" && e.markerId === setup));
        assert(events.some(e => e.type === "alienTrace" && e.playerId === actor.id && e.traceType === reward.traceType), JSON.stringify({ setup, events }));
      }
      if (setup === "movement") assert(steps.some(s => s.choice.family === "choose_target"), "行动角移动后续必须实际执行");
      if (index === 9) {
        const fact = finalRoot.match.cardPlayContext.cardLaunch;
        assert.equal(fact.cardInstanceId, card.id);
        assert.equal(fact.skipped, setup === "full");
        assert.equal(events.filter(e => e.type === "yichangdian_launch_anomaly_move").length, setup === "anomaly" ? 1 : 0);
      }
      if (index === 4) assert(originalPublic.every(id => finalActor.hand.some(c => c.id === id)));
      if (index === 5) assert(events.filter(e => e.type === "signalMarked").length >= 2);
      report.cases.push({ index, setup, drawnIds, discardedIds, steps, events });
    }
    report.codeSha256 = crypto.createHash("sha256").update(fs.readFileSync("randomizer/game/cards/play-domain.js")).digest("hex");
    report.verified = true;
  } catch (error) { report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, cases: report.cases.map(c => ({ index: c.index, setup: c.setup, decisions: c.steps.length })), error: report.error }, null, 2)); }
}
