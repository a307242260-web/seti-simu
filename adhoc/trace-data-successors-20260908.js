"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), inspector = require("node:inspector");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/data-successors.js");
const { createSimulationEnv } = req("../randomizer/app/simulation-env");
const output = "/Users/bilibili/code/seti-simu/reports/iteration/data-successors-483fc706-20260908.json";
if (fs.existsSync(output)) { console.log(`已有取证：${output}`); process.exit(0); }
const report = { scope: "当前规则保留基线，第53根只读后继取证，不是性能成绩", rows: [], errors: [] };
const debug = new inspector.Session(); debug.connect();
const post = (method, params = {}) => {
  let done = false, error, result;
  debug.post(method, params, (e, r) => { error = e; result = r; done = true; });
  assert.ok(done); if (error) throw error; return result;
};
const env = createSimulationEnv();
debug.on("Debugger.paused", ({ params }) => {
  try {
    const result = post("Debugger.evaluateOnCallFrame", { callFrameId: params.callFrames[0].callFrameId,
      expression: `JSON.stringify({nodeKey:key,originKey:originKey(origin),beforeTarget:origin.routeTargetId,beforePlan:origin.routePlanId,completedGoal,goalCompletionPending,nextProxyDepth,masked:execution.informationMasked,hiddenBarrier:execution.hiddenBarrier,phase:execution.nextInspection.phase,inputs:execution.planSteps.map(s=>s.action),inputCount:execution.executionStepCount,childKey:envelopeHash(execution.childEnvelope),selected:selectedRoutes.map(r=>({action:r.action,routeTargetId:r.routeTargetId,routePlanId:r.routePlanId,routeResultTargetIds:r.routeResultTargetIds}))})`,
      returnByValue: true });
    assert.equal(result.exceptionDetails, undefined);
    report.rows.push(JSON.parse(result.result.value));
    if (report.rows.length % 200 === 0) console.log(`[放数据后继取证] ${report.rows.length}条来源结果`);
  } catch (error) { report.errors.push(error.stack); }
  finally { post("Debugger.resume"); }
});
try {
  const source = fs.readFileSync(req.resolve("../randomizer/game/rule-composition"), "utf8").split("\n");
  const lines = source.flatMap((line, index) => line.includes("if (!selectedRoutes.length) {") ? [index] : []);
  assert.equal(lines.length, 1);
  post("Debugger.enable");
  post("Debugger.setBreakpointByUrl", { urlRegex: "rule-composition\\.js$", lineNumber: lines[0], condition: 'current.family === "place_data"' });
  env.loadCheckpoint(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root);
  const result = env.runHeuristicPolicyDecision();
  report.diagnostics = env.getCounterfactualDiagnostics();
  report.action = result.policyDecision?.actionId;
  assert.equal(result.ok, true);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  const baseline = JSON.parse(fs.readFileSync("reports/iteration/rules-baseline-full-review-20260908.json"))
    .candidate.cappedSearches.find(s => s.step === 53);
  assert.equal(report.action, baseline.action);
  assert.equal(report.diagnostics.executedNodeCount, baseline.nodes);
  assert.equal(report.diagnostics.successfulInputSubmissionCount, baseline.inputs);
  assert.deepEqual(report.diagnostics.executedNodeCountByDecisionKind, baseline.decisions);
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack; process.exitCode = 1; }
finally {
  post("Debugger.disable"); debug.disconnect(); env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, rows: report.rows.length, error: report.error }));
}
