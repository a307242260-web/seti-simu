"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const solar = require("../randomizer/solar-system/core");
const output = "reports/iteration/company-arrivals-42-v2-20260907.json";
if (fs.existsSync(output)) console.log(`已有到达证据：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42六方向的到达事件/资源与任务消费者取证，不运行搜索，不以方向无即时奖励推断全局无用", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const company = fork.inputPort.enumerateActions().find(a => a.target.abilityId === "huanyu_free_moves");
    assert.ok(company); assert.equal(fork.inputPort.submitAction(company, { skipProjection: true }).ok, true);
    const saved = fork.lifecycle.save().envelope, before = saved.session.session.workingState;
    const actor = before.players.players.find(p => p.id === company.actorId);
    report.before = { player: actor, turn: before.turn, pieces: before.pieces, aliens: before.aliens };
    const choices = fork.inspect().session.decision.choices.filter(c => c.target.rocketId != null);
    assert.equal(choices.length, 6);
    for (const choice of choices) {
      assert.equal(fork.lifecycle.restore(saved).ok, true);
      const inspection = fork.inspect(), decision = inspection.session.decision;
      const oldEvents = saved.session.session.journal.events.length;
      const submitted = fork.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice }, { skipProjection: true });
      assert.equal(submitted.ok, true, JSON.stringify(submitted));
      const current = fork.inspect(), after = fork.lifecycle.save().envelope.session.session.workingState;
      const player = after.players.players.find(p => p.id === actor.id);
      const rocket = after.pieces.rockets.find(r => r.id === choice.target.rocketId);
      const destination = solar.resolveVisibleContent(rocket.sectorX, rocket.sectorY, after.solarSystem).content;
      report.cases.push({ choice, rocket, destination,
        resourceDelta: Object.fromEntries(Object.entries(player.resources).filter(([, v]) => typeof v === "number")
          .map(([key, value]) => [key, value - actor.resources[key]])),
        events: submitted.journal.events.slice(oldEvents),
        nextDecision: current.session.decision,
      });
    }
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, cases: report.cases.map(c => ({
      choice: c.choice.target, destination: c.destination, delta: c.resourceDelta, events: c.events,
    })), error: report.error }, null, 2)); }
}
