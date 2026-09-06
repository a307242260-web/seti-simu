"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const deck = require("../randomizer/game/cards/deck"), rockets = require("../randomizer/game/rockets");
const solar = require("../randomizer/solar-system/core"), data = require("../randomizer/game/data");
const science = require("../randomizer/game/effects/science-session");
const output = "reports/iteration/probe-scan-production-20260907.json";
if (fs.existsSync(output)) console.log(`已有正式验证：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42盘面派生受控卡牌/棋子/信号状态，通过唯一Production正式输入验证全部扫描链和逐Decision恢复；非原固定局/非AI搜索", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const initial = fork.lifecycle.save().envelope;
    for (const [cardId, signals, setup = "empty"] of [["b_50.webp",3],["b_50.webp",0],["b_50.webp",1],
      ["b_58.webp",3],["b_88.webp",1],["b_88.webp",1,"own-signal"],["b_88.webp",1,"complete"],["b_22.webp",2],["b_96.webp",3]]) {
      const envelope = structuredClone(initial), root = JSON.parse(envelope.committedState);
      const actor = root.players.players.find(p => p.id === "player-green");
      const card = deck.createCommittedCardInstance(root, deck.getCatalogEntryForCard({ cardId }));
      actor.hand.push(card); actor.resources.handSize = actor.hand.length;
      const own = rockets.getRocketsForPlayer(root.pieces, actor.id);
      for (const rocket of own) assert.equal(rockets.placeRocketByPriority(root.pieces, rocket, 5, 1), true);
      const other = root.players.players.find(p => p.id === "player-blue");
      assert.equal(rockets.launchRocketAtSector(root.pieces, { x: 6, y: 1 }, { root, playerId: other.id, color: other.color }).ok, true);
      root.data = data.createDefaultNebulaDataState();
      data.fillAllNebulaData(root.data, { root, source: "probe-scan-proof" });
      const nebulaId = solar.getNebulaAtCoordinate(5, 5, root.solarSystem.sectorBySlot).id;
      const fills = setup === "own-signal" ? 1 : setup === "complete" ? data.getNebulaCapacity(nebulaId) - 1 : 0;
      for (let i = 0; i < fills; i++) assert.equal(data.replaceNextNebulaDataToken(root.data, nebulaId,
        setup === "own-signal" ? actor : other, { root }).ok, true);
      envelope.committedState = JSON.stringify(root);
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      const action = fork.inputPort.enumerateActions().find(a => a.family === "play_card" && a.target.cardInstanceId === card.id);
      assert.ok(action, `${cardId}正式打牌必须可用`);
      let result = fork.inputPort.submitAction(action, { skipProjection: true });
      assert.equal(result.ok, true, JSON.stringify(result.failure));
      let chosenSources = 0, restoredDecisions = 0;
      const steps = [{ action, ok: true }];
      while (fork.inspect().phase === "awaiting_input") {
        assert.ok(steps.length < 30);
        const decision = fork.inspect().session.decision, choices = decision.choices;
        let choice;
        if (choices.some(c => c.target.probeScanSource)) {
          choice = cardId === "b_50.webp" && chosenSources >= signals
            ? choices.find(c => c.target.done)
            : choices.find(c => c.target.probeScanSource && root.pieces.rockets.find(r => r.id === c.target.rocketId)?.playerId === other.id && cardId === "b_50.webp")
              || choices.find(c => c.target.probeScanSource);
          if (!choice.target.done) chosenSources++;
        } else choice = choices.find(c => c.target.rocketId === own[0].id && c.target.deltaX === 0 && c.target.deltaY === 1) || choices[0];
        assert.ok(choice);
        const submission = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice };
        const before = fork.lifecycle.save().envelope;
        result = fork.inputPort.submitDecision(submission, { skipProjection: true });
        assert.equal(result.ok, true, JSON.stringify(result.failure));
        const after = fork.lifecycle.save().envelope;
        assert.equal(fork.lifecycle.restore(before).ok, true);
        const replayed = fork.inputPort.submitDecision(submission, { skipProjection: true });
        assert.equal(replayed.ok, true, JSON.stringify(replayed.failure));
        assert.deepEqual(fork.lifecycle.save().envelope, after, "逐个Decision恢复提交必须全状态/RNG/序号相同");
        steps.push({ action: choice, ok: true }); restoredDecisions++;
      }
      const events = result.journal.events, marks = events.filter(e => e.type === "signalMarked");
      assert.equal(marks.length, signals, cardId);
      const effectTypes = result.journal.effects.map(e => e.type);
      assert.equal(effectTypes.filter(type => type === science.EFFECT_TYPES.SETTLE).length, 1);
      const finalRoot = fork.projection({ role: "simulation" }).state;
      const returned = finalRoot.players.players.find(p => p.id === actor.id).hand.some(c => c.id === card.id);
      if (cardId === "b_88.webp") assert.equal(returned, setup !== "own-signal");
      report.cases.push({ cardId, setup, marks, chosenSources, restoredDecisions, returned, steps, effectTypes });
    }
    report.productionFiles = Object.fromEntries(["randomizer/game/cards/effects.js", "randomizer/game/cards/play-domain.js", "randomizer/game/effects/science-session.js"]
      .map(path => [path, crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")]));
    report.verified = true;
  } catch (error) { report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, cases: report.cases.map(c => ({ cardId: c.cardId, setup: c.setup, signals: c.marks.length, restored: c.restoredDecisions, returned: c.returned })), error: report.error }, null, 2)); }
}
