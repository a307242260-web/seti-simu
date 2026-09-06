"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const deck = require("../randomizer/game/cards/deck"), effects = require("../randomizer/game/cards/effects");
const data = require("../randomizer/game/data"), players = require("../randomizer/game/players");
const science = require("../randomizer/game/effects/science-session");
const sequences = require("../randomizer/game/state/sequences");
const yichangdian = require("../randomizer/game/aliens/yichangdian"), banrenma = require("../randomizer/game/aliens/banrenma");
const output = process.argv[2] || "reports/iteration/any-scan-production-20260907.json";
if (fs.existsSync(output)) console.log(`已有验证：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42盘面派生受控卡牌/信号；唯一Production打牌、全部后续和逐Decision恢复；非AI/非固定整局", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const initial = fork.lifecycle.save().envelope;
    const sectors = Object.values(effects.NEBULA_IDS_BY_COLOR).flat();
    for (const [cardId, setup, expectedAny, expectedSignals] of [
      ["b_19.webp", "empty", 1, 1], ["yichangdian_0.webp", "empty", 1, 1],
      ["banrenma_8.webp", "empty", 1, 2], ["banrenma_8.webp", "complete", 1, 2],
      ["dlc_19.png", "qualified", 2, 2], ["dlc_19.png", "empty", 0, 0],
      ["b_9.webp", "empty", 1, null],
    ]) {
      if (process.argv[3] && cardId !== process.argv[3]) continue;
      const envelope = structuredClone(initial), root = JSON.parse(envelope.committedState);
      const actor = root.players.players.find(p => p.id === "player-green");
      const other = root.players.players.find(p => p.id === "player-blue");
      actor.techState = players.normalizePlayerTechState(null);
      actor.resources.availableData = 0;
      actor.dataState.poolTokens = [];
      const card = cardId === "yichangdian_0.webp"
        ? yichangdian.createAlienCard(0, sequences.take(root, "alienEntity"))
        : cardId === "banrenma_8.webp" ? banrenma.createAlienCard(8, sequences.take(root, "alienEntity"))
          : deck.createCommittedCardInstance(root, deck.getCatalogEntryForCard({ cardId }));
      actor.hand.push(card); actor.resources.handSize = actor.hand.length;
      root.data = data.createDefaultNebulaDataState();
      data.fillAllNebulaData(root.data, { root, source: "any-scan-proof" });
      if (setup === "qualified") for (const nebulaId of sectors.slice(2, 5))
        assert.equal(data.replaceNextNebulaDataToken(root.data, nebulaId, actor, { root }).ok, true);
      if (setup === "complete") for (let i = 0; i < data.getNebulaCapacity(sectors[0]) - 1; i++)
        assert.equal(data.replaceNextNebulaDataToken(root.data, sectors[0], other, { root }).ok, true);
      envelope.committedState = JSON.stringify(root);
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      const action = fork.inputPort.enumerateActions().find(a => a.family === "play_card" && a.target.cardInstanceId === card.id);
      assert.ok(action, cardId);
      let result = fork.inputPort.submitAction(action, { skipProjection: true });
      assert.equal(result.ok, true, JSON.stringify(result.failure));
      let anyDecisions = 0;
      const steps = [];
      while (fork.inspect().phase === "awaiting_input") {
        assert.ok(steps.length < 40, "有限卡牌流程应结束");
        const decision = fork.inspect().session.decision, choices = decision.choices;
        const isAny = choices.length === 8 && sectors.every(id => choices.some(c => c.target.nebulaId === id));
        const choice = isAny ? choices.find(c => c.target.nebulaId === sectors[anyDecisions]) : choices[0];
        assert.ok(choice, JSON.stringify({ cardId, setup, anyDecisions, decision, steps }));
        if (isAny) anyDecisions++;
        const input = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice };
        const before = fork.lifecycle.save().envelope;
        result = fork.inputPort.submitDecision(input, { skipProjection: true });
        assert.equal(result.ok, true, JSON.stringify(result.failure));
        const after = fork.lifecycle.save().envelope;
        assert.equal(fork.lifecycle.restore(before).ok, true);
        const replayed = fork.inputPort.submitDecision(input, { skipProjection: true });
        assert.equal(replayed.ok, true, JSON.stringify(replayed.failure));
        assert.deepEqual(fork.lifecycle.save().envelope, after);
        steps.push({ choice, isAny, restored: true });
      }
      const marks = result.journal.events.filter(e => e.type === "signalMarked");
      assert.equal(anyDecisions, expectedAny, cardId);
      if (expectedSignals !== null) assert.equal(marks.length, expectedSignals, cardId);
      else assert.ok(marks.length >= 2, "b9完整扫描行动之后还有任意扫描");
      if (cardId === "banrenma_8.webp") assert.deepEqual(marks.map(m => m.nebulaId), [sectors[0], sectors[0]]);
      if (cardId === "dlc_19.png" && setup === "qualified") assert.deepEqual(marks.map(m => m.nebulaId), sectors.slice(0, 2));
      const finalActor = fork.projection({ role: "simulation" }).state.players.players.find(p => p.id === actor.id);
      if (cardId === "dlc_19.png") assert.equal(finalActor.resources.availableData, 0);
      if (cardId === "banrenma_8.webp") assert.equal(finalActor.resources.availableData, setup === "complete" ? 1 : 2);
      const settles = result.journal.effects.filter(e => e.type === science.EFFECT_TYPES.SETTLE).length;
      assert.equal(settles, cardId === "b_9.webp" ? 2 : expectedSignals === 0 ? 0 : 1);
      report.cases.push({ cardId, setup, anyDecisions, marks, settles, data: finalActor.resources.availableData, steps });
    }
    report.productionFiles = Object.fromEntries(["randomizer/game/cards/effects.js", "randomizer/game/cards/play-domain.js", "randomizer/game/effects/science-session.js"]
      .map(path => [path, crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")]));
    report.verified = true;
  } catch (error) { report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, cases: report.cases.map(c => ({ cardId: c.cardId, setup: c.setup, marks: c.marks.length, decisions: c.steps.length, settles: c.settles })), error: report.error }, null, 2));
  }
}
