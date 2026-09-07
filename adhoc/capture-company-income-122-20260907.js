"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/company-income-122-20260907.json";
if (fs.existsSync(output)) console.log("已有122候选证据");
else {
  const record = JSON.parse(fs.readFileSync("reports/research/aed4e5db.1f55695a.full.json"));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const env = createSimulationEnv();
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    for (let i = 41; i < 121; i++) {
      const expected = save.replaySteps[i], action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action); const step = env.step(action); assert.equal(step.ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    const checkpoint = env.createCheckpoint(); delete checkpoint.replaySteps;
    const legalActions = env.legalActions(), start = performance.now();
    const result = env.runHeuristicPolicyDecision(), wallMs = performance.now() - start;
    fs.writeFileSync("reports/iteration/company-income-122-20260907.capture.json.gz", zlib.gzipSync(JSON.stringify({ checkpoint, legalActions, result })));
    assert.equal(result.ok, true);
    const diagnostics = env.getCounterfactualDiagnostics(), original = record.metrics.searches.find(s => s.step === 122 && s.kind === "strategic");
    assert.equal(diagnostics.executedNodeCount, original.diagnostics.executedNodeCount);
    assert.equal(diagnostics.successfulInputSubmissionCount, original.diagnostics.successfulInputSubmissionCount);
    assert.deepEqual(diagnostics.failedNodeCountByCode, {});
    assert.equal(diagnostics.executionLimitReached, false);
    const action = legalActions.find(a => a.actionId === result.policyDecision.actionId);
    const outcome = result.actionOutcomes.find(o => o.actionId === action.actionId);
    const context = { seatId: "player-brown", legalActions, observation: outcome.rootObservation, actionOutcomes: result.actionOutcomes };
    const evaluation = evaluator.evaluateAction(context, action);
    const leaves = outcome.leaves.map(leaf => {
      const e = evaluator.evaluateAction({ ...context, actionOutcomes: [{ ...outcome, leaves: [leaf] }] }, action);
      return { leafId: leaf.leafId, score: e.score, value: e.value, actualScoreDelta: e.actualScoreDelta,
        quickTradeCount: e.quickTradeCount, secondaryAgentDepth: e.secondaryAgentDepth,
        actions: leaf.planSteps.map(s => s.action), sortKey: e.sortKey };
    });
    const report = { scope: "真实122完整小搜索补证，当前修复代码，不重跑全局", checkpoint, wallMs, diagnostics, evaluation, leaves };
    fs.writeFileSync(output, JSON.stringify(report, null, 2)+"\n");
    console.log(JSON.stringify({ wallMs, nodes: diagnostics.executedNodeCount, inputs: diagnostics.successfulInputSubmissionCount,
      selectedLeaf: evaluation.selectedLeafId, leaves: leaves.length, best: [...leaves].sort((a,b)=>b.score-a.score).slice(0,4).map(l=>({...l,actions:l.actions.map(a=>a.summary)})) }));
  } finally { env.dispose(); }
}
