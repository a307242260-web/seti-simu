"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/r4-green-pass-search-v2-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/r4-green-pass-20260906.json"));
  const env = createSimulationEnv();
  const report = { scope: "已恢复真实PASS前状态的一次冷计划诊断；不重跑全盘，不代表历史计划缓存",
    checkpointPath: source.checkpointPath, recordedAction: source.recordedAction };
  try {
    const checkpoint = JSON.parse(fs.readFileSync(source.checkpointPath));
    // 这是已物化的中途状态；增量录制不从开局开始，不交给loadCheckpoint重放。
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const actions = env.legalActions(), observation = env.observe();
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now()-start;
    assert.equal(decision.ok, true);
    report.chosen = decision.policyDecision.actionId;
    report.matchesRecorded = report.chosen === source.recordedAction.actionId;
    report.plan = decision.plan;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const context = { seatId: source.recordedAction.actorId, observation, actionOutcomes: decision.actionOutcomes };
    report.outcomes = decision.actionOutcomes.map(outcome => {
      const action = actions.find(a=>a.actionId===outcome.actionId);
      const value = evaluator.evaluateOutcome(context,action);
      return { action, status:outcome.status, completeness:outcome.searchCompleteness,
        code:outcome.code, leafCount:outcome.leaves.length, value,
        selectedLeaf:outcome.leaves.find(l=>l.leafId===value.selectedLeafId) || null };
    });
    report.passed = true;
  } catch(error) {
    report.passed = false;
    report.error = {message:error.message,stack:error.stack};
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output,JSON.stringify(report));
    console.log(JSON.stringify({output,passed:report.passed,ms:report.wallMs,chosen:report.chosen,
      matches:report.matchesRecorded,nodes:report.diagnostics?.executedNodeCount,
      outcomes:report.outcomes?.map(o=>({action:o.action.summary,status:o.status,leaves:o.leafCount,
        score:o.value.score,code:o.code,completeness:o.completeness})),error:report.error},null,2));
  }
}
