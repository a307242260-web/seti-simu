"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const base = "reports/iteration/movement-ranking-42-20260907";
if (fs.existsSync(`${base}.capture.json.gz`)) console.log(`已有完整候选快照：${base}.capture.json.gz；不重跑`);
else {
  const env = createSimulationEnv();
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const legalActions = env.legalActions();
    const start = performance.now(), result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - start;
    assert.equal(result.ok, true, JSON.stringify(result.error));
    const baseline = JSON.parse(fs.readFileSync("reports/iteration/ordinary-movement-demand-decision-42-20260907.json"));
    assert.equal(result.policyDecision.actionId, baseline.actionId);
    assert.deepEqual(result.plan, baseline.plan, "补证不能改变既有冷决策优胜计划");
    const diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(diagnostics.executedNodeCount, baseline.diagnostics.executedNodeCount);
    assert.equal(diagnostics.successfulInputSubmissionCount, baseline.diagnostics.successfulInputSubmissionCount);
    assert.deepEqual(diagnostics.failedNodeCountByCode, {});
    const context = { seatId: result.policyDecision.seatId, legalActions, actionOutcomes: result.actionOutcomes,
      observation: result.actionOutcomes.find(o => o.rootObservation)?.rootObservation };
    const capture = { scope: "0b586daa生产行为的真实42原生结果补证；完整outcome含原遮蔽观察和计划，不修改回调或候选",
      wallMs, legalActions, result, diagnostics };
    fs.writeFileSync(`${base}.capture.json.gz`, zlib.gzipSync(JSON.stringify(capture)));
    const evaluations = legalActions.map(action => ({ action,
      evaluation: evaluator.evaluateAction(context, action),
      leafCount: result.actionOutcomes.find(o => o.actionId === action.actionId)?.leaves?.length || 0 }));
    const report = { capture: `${base}.capture.json.gz`, matchesPreviousDecision: true, wallMs,
      actionId: result.policyDecision.actionId, evaluations };
    fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ capture: report.capture, wallMs, actionId: report.actionId,
      evaluations: evaluations.filter(r => ["place_data", "industry"].includes(r.action.family)) }, null, 2));
  } finally { env.dispose(); }
}
