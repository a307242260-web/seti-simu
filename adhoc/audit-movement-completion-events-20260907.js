"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const residual = require("../randomizer/game/effects/residual-domain-session");
const input = "reports/iteration/turn-visit-routes-formal-20260907.json";
const checkpointInput = "reports/iteration/current-movement-hotspots-20260907.json";
const output = "reports/iteration/movement-completion-events-20260907.json";
if (fs.existsSync(output)) console.log(`已有移动完成事件证据：${output}`);
else {
  const routes = JSON.parse(fs.readFileSync(input));
  const checkpoints = JSON.parse(fs.readFileSync(checkpointInput));
  const report = { scope: "148/497四条既有正式路线的逐输入新事件、实际探测器、访问进度与完成时点；只重放，不运行AI，不代表全部移动消费者",
    inputs: [input, checkpointInput].map(path => ({ path,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex") })),
    rows: [], verified: false };
  try {
    for (const route of routes.rows) {
      const env = createSimulationEnv(); let fork;
      try {
        const cp = structuredClone(checkpoints.entries.find(e => e.step === route.step).checkpoint);
        delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
        const actorId = route.inputs[0].actorId;
        const row = { step: route.step, companyAllowance: route.companyAllowance, submissions: [] };
        let eventCursor = 0;
        for (const expected of route.inputs) {
          const inspection = fork.inspect(), decision = inspection.session?.decision;
          const legal = inspection.phase === "awaiting_input" ? decision.choices : fork.inputPort.enumerateActions();
          const action = legal.find(a => a.actionId === expected.actionId);
          assert.deepEqual(action, expected);
          const before = fork.projection({ role: "simulation" }).state;
          const bonusesBefore = structuredClone(before.turn.cardTurnEventBonuses);
          const scoreBefore = before.players.players.find(p => p.id === actorId).resources.score;
          if (action.phase !== "conditional") eventCursor = 0;
          const result = action.phase === "conditional"
            ? fork.inputPort.submitDecision({ decisionId: decision.decisionId,
              decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: action }, { skipProjection: true })
            : fork.inputPort.submitAction(action, { skipProjection: true });
          assert.equal(result.ok, true, JSON.stringify(result.failure));
          const journal = result.journal.events;
          assert.ok(Array.isArray(journal) && journal.length >= eventCursor);
          const events = journal.slice(eventCursor); eventCursor = journal.length;
          const movement = events.filter(e => ["move", "visitPlanet", "visitComet", "visitAsteroid"].includes(e.type));
          const after = fork.projection({ role: "simulation" }).state;
          const moves = movement.filter(e => e.type === "move");
          for (const event of movement) {
            assert.equal(event.playerId, actorId);
            assert.ok(Number.isInteger(event.rocketId), "正式移动完成事件必须有实际探测器身份");
            if (action.target.rocketId != null) assert.equal(event.rocketId, action.target.rocketId);
            if (event.type !== "move") assert.ok(moves.some(m => m.rocketId === event.rocketId), "访问证据归属同次实际移动，不串其他来源");
          }
          const progress = bonusesBefore.flatMap(bonus => movement.map(event => ({
            bonusId: bonus.id, event, result: residual.describeEventBonusProgress({ bonus, event, ownerId: actorId }),
          }))).filter(p => p.result.status !== "inapplicable");
          for (const p of progress) {
            const current = after.turn.cardTurnEventBonuses.find(b => b.id === p.bonusId);
            assert.ok(current);
            if (p.result.usedKey && ["progress", "reward"].includes(p.result.status)) {
              assert.ok(current.usedKeys.includes(p.result.usedKey));
            }
            if (p.result.status === "reward" && p.result.claimKey) assert.ok(current.claimedKeys.includes(p.result.claimKey));
          }
          row.submissions.push({ action, newJournalEventCount: events.length,
            movement, bonusProgress: progress, bonusesAfter: structuredClone(after.turn.cardTurnEventBonuses),
            scoreGain: after.players.players.find(p => p.id === actorId).resources.score - scoreBefore,
            phaseAfter: fork.inspect().phase });
        }
        assert.equal(row.submissions.reduce((sum, s) => sum + s.scoreGain, 0), route.scoreGain);
        const rewarded = row.submissions.filter(s => s.bonusProgress.some(p => p.result.status === "reward"));
        assert.equal(rewarded.length, 1);
        assert.equal(rewarded[0].scoreGain, route.scoreGain);
        if (route.step === 148) {
          assert.equal(rewarded[0].action.family, "choose_payment", "访问完成归实际事件，不按顶层动作family推断");
          assert.ok(rewarded[0].movement.some(e => e.type === "visitComet"));
        } else {
          const first = row.submissions.find(s => s.bonusProgress.some(p => p.result.status === "progress"));
          assert.ok(first); assert.equal(first.scoreGain, 0); assert.equal(first.phaseAfter, "awaiting_input");
          assert.ok(rewarded[0].movement.some(e => e.type === "visitPlanet" && e.planetId === "mars"));
        }
        report.rows.push(row);
      } finally { fork?.dispose(); env.dispose(); }
    }
    report.verified = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, error: report.error,
    rows: report.rows.map(r => ({ step: r.step, companyAllowance: r.companyAllowance,
      submissions: r.submissions.length, movementEvents: r.submissions.reduce((sum,s) => sum+s.movement.length,0),
      rewardInputs: r.submissions.filter(s => s.scoreGain).map(s => s.action.family) })) }, null, 2));
}
