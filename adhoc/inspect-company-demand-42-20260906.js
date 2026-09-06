"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/company-demand-42-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "正式42观察/合法公司动作与探测目录对照；不运行AI搜索，不修改资源" };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    const projection = fork.projection({ playerId: "player-green", role: "player" }).state;
    const observation = outcomeModel.createDecisionObservation(projection);
    const legalActions = env.legalActions();
    report.company = legalActions.find(a => a.family === "industry");
    assert.equal(report.company.target.abilityId, "huanyu_free_moves");
    report.catalog = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: observation,
      legalActions, focalSeatId: "player-green", maxProxyDepth: 15 });
    report.companyBindings = report.catalog.filter(t => t.compatibleActionIds.includes(report.company.actionId));
    report.probeCandidates = projection.probeRouteRequirements.candidates;
    assert.equal(fork.inputPort.submitAction(report.company, { skipProjection: true }).ok, true);
    report.choiceCoverage = fork.inspect().session.decision.choices.map(choice => ({ choice,
      rawProbeTargets: report.probeCandidates.filter(goal => goal.nextStep.family === "move"
        && goal.nextStep.rocketId === choice.target.rocketId
        && goal.nextStep.deltaX === choice.target.deltaX && goal.nextStep.deltaY === choice.target.deltaY)
        .map(goal => ({ targetId: goal.targetId, requirementId: goal.requirementId, required: goal.required })) }));
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, companyBindings: report.companyBindings?.length,
      coverage: report.choiceCoverage?.map(c => ({ summary: c.choice.summary, targets: c.rawProbeTargets.length })), error: report.error }));
  }
}
