"use strict";
const fs = require("node:fs"), v8 = require("node:v8"), zlib = require("node:zlib"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const model = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/cancel-ranking-471-20260907.json";
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const env = createSimulationEnv(), report = { scope: "真实471三候选Policy输入与评分专项取证；不作为性能重测或完整局重跑" };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/before-choice-471-20260907.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const legalActions = env.legalActions(), first = legalActions[0], seatId = first.actorId;
    const fork = env.createCounterfactualFork().composition;
    let observation;
    try { observation = model.createDecisionObservation(fork.projection({ playerId: seatId, role: "player" }).state); }
    finally { fork.dispose(); }
    const result = env.runHeuristicPolicyDecision();
    assert.equal(result.ok, true);
    const input = { seatId, observation, legalActions, actionOutcomes: result.actionOutcomes,
      stateVersion: first.stateVersion, decisionVersion: first.decisionVersion };
    report.inputPath = "reports/iteration/cancel-ranking-input-471-20260907.v8.gz";
    fs.writeFileSync(report.inputPath, zlib.gzipSync(v8.serialize(input)));
    report.selected = result.policyDecision.actionId;
    report.evaluations = legalActions.map(action => ({ summary: action.summary,
      evaluation: evaluator.evaluateAction(input, action) }));
    report.captured = true;
  } catch (error) {
    report.captured = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
