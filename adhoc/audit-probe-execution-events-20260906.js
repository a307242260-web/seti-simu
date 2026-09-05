"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/probe-execution-events-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = { createdAt: new Date().toISOString(),
    scope: "两个已有真实checkpoint的正式fork提交，核对累计journal增量；无AI搜索。", samples: [] };
  const sources = [
    { kind: "land", checkpoint: JSON.parse(fs.readFileSync("reports/iteration/r3-green-pass-choice-20260906.json")).beforePass,
      actions: JSON.parse(fs.readFileSync("reports/iteration/r3-green-land-witness-20260906.json")).steps },
    { kind: "launch", checkpoint: JSON.parse(fs.readFileSync("reports/iteration/r3-brown-before-41-20260906.json")) },
  ];
  try {
    for (const source of sources) {
      const env = createSimulationEnv();
      let fork;
      const sample = { kind: source.kind, steps: [] };
      report.samples.push(sample);
      try {
        const checkpoint = structuredClone(source.checkpoint);
        delete checkpoint.replaySteps;
        env.loadCheckpoint(checkpoint);
        fork = env.createCounterfactualFork();
        const composition = fork.composition;
        let cursor = checkpoint.coreState.compositionEnvelope.session?.session?.journal?.events?.length || 0;
        for (let index = 0; index < (source.actions?.length || 1); index += 1) {
          const inspection = composition.inspect();
          const conditional = inspection.phase === "awaiting_input";
          const legal = conditional ? inspection.session.decision.choices : composition.inputPort.enumerateActions();
          const action = source.actions
            ? legal.find((candidate) => candidate.actionId === source.actions[index].actionId)
            : legal.find((candidate) => candidate.family === "launch");
          assert.ok(action);
          if (!conditional) cursor = 0;
          const result = conditional ? composition.inputPort.submitDecision({
            decisionId: inspection.session.decision.decisionId,
            decisionVersion: inspection.session.decision.decisionVersion,
            ownerId: inspection.session.decision.ownerId, choice: action,
          }, { skipProjection: true }) : composition.inputPort.submitAction(action, { skipProjection: true });
          assert.equal(result.ok, true);
          assert.ok(Array.isArray(result.journal?.events));
          assert.ok(result.journal.events.length >= cursor);
          const events = result.journal.events.slice(cursor);
          cursor = result.journal.events.length;
          sample.steps.push({ action, events, cumulativeEvents: cursor });
        }
        if (source.kind === "land") {
          assert.ok(!sample.steps[4].events.some((event) => event.type === "land"));
          const event = sample.steps[5].events.find((event) => event.type === "land");
          assert.equal(event.planetId, "mars");
          assert.equal(event.playerId, "player-green");
          assert.equal(sample.steps.flatMap((step) => step.events).filter((event) => event.type === "land").length, 1);
        } else {
          const event = sample.steps[0].events.find((event) => event.type === "launch");
          assert.ok(event?.rocketId != null);
          const rocket = composition.projection(event.playerId).state.publicState.board.rockets
            .find((item) => item.id === event.rocketId);
          assert.equal(rocket?.playerId, event.playerId);
        }
      } finally { fork?.composition?.dispose(); env.dispose(); }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  }
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ output, passed: report.passed,
    samples: report.samples.map((sample) => ({ kind: sample.kind, events: sample.steps.flatMap((step) => step.events)
      .filter((event) => ["launch", "land"].includes(event.type)) })), error: report.error }, null, 2));
}
