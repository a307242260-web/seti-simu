"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const planetStats = require("../randomizer/game/planet-stats"), cardEffects = require("../randomizer/game/cards/effects");
const verifyFix = process.argv.includes("--verify-fix");
const output = verifyFix ? "reports/iteration/orbit-visit-trigger-verification-20260907.json"
  : "reports/iteration/orbit-visit-trigger-reproduction-v3-20260907.json";
if (fs.existsSync(output)) console.log(`已有复现：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42派生受控规则反例：把实际公共dlc21移至保留区并设置火星标记；正式公司移动到火星，不复制卡牌、不运行AI、不冒充原固定局实际发生", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const initial = fork.lifecycle.save().envelope;
    for (const markerOwner of ["absent", "player-blue", "player-green"]) {
      const envelope = structuredClone(initial), root = JSON.parse(envelope.committedState);
      const player = root.players.players.find(p => p.id === "player-green");
      const publicIndex = root.cards.publicCards.findIndex(c => c?.cardId === "dlc_21.png");
      assert.ok(publicIndex >= 0);
      const card = root.cards.publicCards[publicIndex];
      root.cards.publicCards[publicIndex] = null;
      cardEffects.ensureCardEffectState(card); player.reservedCards.push(card);
      root.planets.planets.mars.orbitMarkers = [];
      if (markerOwner !== "absent") {
        assert.equal(planetStats.addPlanetOrbitMarker(root.planets, "mars",
          root.players.players.find(p => p.id === markerOwner)).ok, true);
      }
      envelope.committedState = JSON.stringify(root);
      const restored = fork.lifecycle.restore(envelope);
      assert.equal(restored.ok, true, JSON.stringify(restored));
      const company = fork.inputPort.enumerateActions().find(a => a.family === "industry" && a.target.abilityId === "huanyu_free_moves");
      assert.ok(company); assert.equal(fork.inputPort.submitAction(company, { skipProjection: true }).ok, true);
      let inspection = fork.inspect(), decision = inspection.session.decision;
      const first = decision.choices.find(a => a.target.rocketId === 1 && a.payload.direction === "out");
      assert.ok(first);
      const result = fork.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId, choice: first }, { skipProjection: true });
      assert.equal(result.ok, true);
      const visit = result.journal.events.find(e => e.type === "visitPlanet" && e.planetId === "mars");
      assert.ok(visit);
      inspection = fork.inspect();
      if (inspection.phase === "awaiting_input" && inspection.session.currentEffect.payload.abilityId === "huanyu_free_moves") {
        decision = inspection.session.decision;
        const skip = decision.choices.find(a => a.target.skip === true);
        assert.ok(skip);
        assert.equal(fork.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: skip }, { skipProjection: true }).ok, true);
        inspection = fork.inspect();
      }
      const confirmations = inspection.phase === "awaiting_input"
        ? inspection.session.decision.choices.filter(a => String(a.target.choiceId).startsWith("confirm:")) : [];
      const expected = markerOwner === "player-green" ? 2 : 0;
      let restoredChoiceStateEqual = null;
      if (verifyFix) {
        assert.equal(visit.hasOwnOrbit, markerOwner === "player-green");
        assert.equal(confirmations.length, expected);
        if (expected) {
          const saved = fork.lifecycle.save().envelope;
          decision = inspection.session.decision;
          const submission = { decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
            ownerId: decision.ownerId, choice: confirmations[0] };
          assert.equal(fork.inputPort.submitDecision(submission, { skipProjection: true }).ok, true);
          const after = fork.lifecycle.save().envelope;
          assert.equal(fork.lifecycle.restore(saved).ok, true);
          assert.equal(fork.inputPort.submitDecision(submission, { skipProjection: true }).ok, true);
          assert.deepEqual(fork.lifecycle.save().envelope, after, "正式选槽保存恢复后全状态与实体序号一致");
          restoredChoiceStateEqual = true;
        }
      }
      report.cases.push({ markerOwner, visit, hasOwnOrbitFieldPresent: Object.hasOwn(visit, "hasOwnOrbit"), expectedTriggerChoices: expected,
        actualTriggerChoices: confirmations.length, finalPhase: inspection.phase,
        restoredChoiceStateEqual,
        conditionMatchesWhenFactSupplied: cardEffects.collectMatchingTriggers(structuredClone(player), { ...visit, hasOwnOrbit: markerOwner === "player-green" }).length });
    }
    if (!verifyFix) assert.ok(report.cases.every(c => c.actualTriggerChoices === 0));
    assert.equal(report.cases[2].conditionMatchesWhenFactSupplied, 2);
    report.ruleBugConfirmed = !verifyFix;
    report.rulesGatePassed = verifyFix;
  } catch (error) { report.ruleBugConfirmed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report, null, 2)); }
}
