"use strict";
const fs = require("node:fs"), v8 = require("node:v8"), zlib = require("node:zlib");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/policy-plan-view-decision-42-20260906.json";
if (fs.existsSync(output)) console.log(`已有验证，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42改动后单决策；与改动前保存输入逐动作估值、完整计划及搜索数量对照" };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const started = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    // 读取大图和估值对照放在计时之后，不污染被测决策耗时。
    const input = v8.deserialize(zlib.gunzipSync(fs.readFileSync("reports/iteration/policy-input-42-20260906.v8.gz")));
    const before = JSON.parse(fs.readFileSync("reports/iteration/policy-input-capture-42-20260906.json"));
    assert.equal(result.policyDecision.actionId, before.actionId);
    const diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(diagnostics.executedNodeCount, before.nodes);
    assert.equal(diagnostics.successfulInputSubmissionCount, before.submissions);
    const actual = { ...input, actionOutcomes: result.actionOutcomes };
    assert.deepEqual(input.legalActions.map(a => evaluator.evaluateAction(actual, a)),
      input.legalActions.map(a => evaluator.evaluateAction(input, a)));
    const expectedPlan = plans.buildPlanFromSnapshot(plans.extractPlanSnapshot({ seatId: input.seatId,
      chosenAction: input.legalActions.find(a => a.actionId === before.actionId), legalActions: input.legalActions,
      actionOutcomes: input.actionOutcomes, rootObservation: input.observation }, { light: true }));
    assert.deepEqual(result.plan, expectedPlan);
    report.actionId = before.actionId; report.nodes = before.nodes; report.submissions = before.submissions;
    report.sameEvaluations = true; report.samePlan = true;
    report.planSteps = result.plan?.steps?.length || 0;
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  }
}
