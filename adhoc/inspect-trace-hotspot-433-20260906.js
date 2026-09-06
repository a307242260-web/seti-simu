"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const read = path => JSON.parse(fs.readFileSync(path));
const output = "reports/iteration/trace-hotspot-433-input-20260906.json";
const checkpointPath = "reports/iteration/amiba-overflow-before-step-433-20260906.json";
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "复用404检查点重放至433，读取正式观察和目标目录，不运行AI搜索", checkpointPath };
  try {
    const record = read("reports/research/25c65ece.795cd6eb.full.json"), save = read(record.savePath);
    const cp = read(fs.existsSync(checkpointPath) ? checkpointPath : "reports/iteration/company-before-step-404-20260906.json");
    delete cp.replaySteps; env.loadCheckpoint(cp);
    if (!fs.existsSync(checkpointPath)) {
      for (let i = 403; i < 432; i++) {
        const a = env.legalActions().find(a => a.actionId === save.replaySteps[i].action.actionId);
        assert.ok(a); assert.deepEqual(JSON.parse(JSON.stringify(a)), save.replaySteps[i].action);
        assert.equal(env.step(a).ok, true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, save.replaySteps[i].after);
      }
      fs.writeFileSync(checkpointPath, JSON.stringify(env.createCheckpoint()));
    }
    const fork = env.createCounterfactualFork().composition;
    try {
      const actions = env.legalActions();
      const observation = outcomeModel.createDecisionObservation(fork.projection({playerId:"player-white",role:"player"}).state);
      report.observation = observation;
      report.targets = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: "player-white",
        rootObservation: observation, legalActions: actions, maxProxyDepth: 15 });
      report.passed = true;
    } finally { fork.dispose(); }
  } catch (error) {
    report.passed = false; report.error = {message:error.message,stack:error.stack}; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({output,passed:report.passed,observationKeys:Object.keys(report.observation||{}),
      targets:report.targets?.filter(t=>t.targetId==='data:analyze'),error:report.error},null,2));
  }
}
