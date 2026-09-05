"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/completion-state-r4-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = { createdAt: new Date().toISOString(),
    scope: "真实棕方状态发射后，分别正式移动三个方向；条件分支明确取合法第一项并记录，不是AI策略或完整搜索。每例最多6个条件提交。", samples: [] };
  const env = createSimulationEnv();
  try {
    const initial = JSON.parse(fs.readFileSync("reports/iteration/r3-brown-before-41-20260906.json"));
    delete initial.replaySteps;
    env.loadCheckpoint(initial);
    const launch = env.legalActions().find((action) => action.family === "launch");
    assert.ok(launch);
    assert.equal(env.step(launch).ok, true);
    const checkpoint = env.createCheckpoint();
    delete checkpoint.replaySteps;
    const moves = env.legalActions().filter((action) => action.family === "move");
    assert.equal(moves.length, 3);
    for (const move of moves) {
      env.loadCheckpoint(checkpoint);
      const sample = { direction: move.payload.direction, steps: [] };
      report.samples.push(sample);
      const step = (action) => {
        const result = env.step(action);
        sample.steps.push({ action, ok: result.ok, error: result.error });
        assert.equal(result.ok, true);
      };
      step(env.legalActions().find((action) => action.actionId === move.actionId));
      for (let index = 0; index < 6; index++) {
        const legal = env.legalActions();
        if (legal[0]?.phase !== "conditional") break;
        step(legal[0]);
      }
      assert.notEqual(env.legalActions()[0]?.phase, "conditional");
      sample.observation = env.observe();
      sample.facts = evaluator.secondaryAgentCompletionFacts(sample.observation, "player-brown");
      sample.legal = env.legalActions();
    }
    report.equalFactsPairs = [];
    for (let left = 0; left < report.samples.length; left++) {
      for (let right = left + 1; right < report.samples.length; right++) {
        if (JSON.stringify(report.samples[left].facts) === JSON.stringify(report.samples[right].facts)) {
          report.equalFactsPairs.push({ left, right,
            sameLegal: JSON.stringify(report.samples[left].legal) === JSON.stringify(report.samples[right].legal),
            sameProbeRequirements: JSON.stringify(report.samples[left].observation.probeRouteRequirements)
              === JSON.stringify(report.samples[right].observation.probeRouteRequirements) });
        }
      }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally { env.dispose(); }
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify({ output, passed: report.passed, equalFactsPairs: report.equalFactsPairs,
    samples: report.samples.map((sample) => ({ direction: sample.direction, steps: sample.steps.length })),
    error: report.error }, null, 2));
}
