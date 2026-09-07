"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/green-company-finish-20260907.json";
if (fs.existsSync(output)) console.log("已有公司结束盘面记录");
else {
  const env = createSimulationEnv(), report = { scope: "正式重放当前固定局162/192前态，核对公司目标首步，不运行搜索", entries: [] };
  try {
    const record = JSON.parse(fs.readFileSync("reports/research/7d87ceb5.6b5381c1.full.json"));
    const save = JSON.parse(fs.readFileSync(record.savePath)); report.savePath = record.savePath;
    const oldRecord = JSON.parse(fs.readFileSync("reports/research/1066a36f.0b586daa.full.json"));
    assert.deepEqual(save.replaySteps.slice(0, 161), JSON.parse(fs.readFileSync(oldRecord.savePath)).replaySteps.slice(0, 161));
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    for (let index = 41; index <= 191; index++) {
      if ([161, 191].includes(index)) {
        const checkpoint = env.createCheckpoint(); delete checkpoint.replaySteps;
        const entry = { step: index + 1, checkpoint, legal: env.legalActions() }; report.entries.push(entry);
        if (index === 191) {
          const fork = env.createCounterfactualFork().composition;
          try {
            const observation = fork.projection({ playerId: "player-green", role: "player" }).state;
            entry.requirements = observation.probeRouteRequirements;
            entry.bound = entry.requirements.candidates.filter(g => g.rocketId === 4 && g.planetId === "venus").map(goal => ({ goal,
              selected: evaluator.selectSecondaryAgentSuccessors({ focalSeatId: "player-green", branchObservation: observation,
                legalSuccessors: entry.legal, routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}` }) }));
          } finally { fork.dispose(); }
        }
      }
      if (index === 191) break;
      const expected = save.replaySteps[index], action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      const result = env.step(action); assert.equal(result.ok, true, JSON.stringify(result.error));
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.passed = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; report.passed = false; process.exitCode = 1; }
  finally { env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); }
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, choices: report.entries.at(-1)?.legal.map(a => a.summary),
    bound: report.entries.at(-1)?.bound?.map(r => ({ goal: r.goal.requirementId, next: r.goal.movementNextSteps,
      selected: r.selected.map(a => a.summary) })) }));
}
