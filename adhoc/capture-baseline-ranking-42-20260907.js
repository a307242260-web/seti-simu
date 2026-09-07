"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const path = require("node:path");
const { Readable } = require("node:stream"), { pipeline } = require("node:stream/promises");
const base = "reports/iteration/baseline-ranking-42-20260907";
const tree = process.argv[2];
async function main() {
if (fs.existsSync(`${base}.json`)) console.log("已有基线完整候选证据，不重跑");
else {
  assert.ok(tree && path.isAbsolute(tree), "必须指定96e60c14的独立git archive目录");
  const { createSimulationEnv } = require(path.join(tree, "randomizer/app/simulation-env"));
  const evaluator = require(path.join(tree, "randomizer/game/ai/expected-score-evaluator"));
  const env = createSimulationEnv();
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const legalActions = env.legalActions(), start = performance.now();
    const result = env.runHeuristicPolicyDecision(), wallMs = performance.now() - start;
    assert.equal(result.ok, true, JSON.stringify(result.error));
    const previous = JSON.parse(fs.readFileSync("reports/iteration/asteroid-modifier-decision-42-20260907.json"));
    assert.equal(result.policyDecision.actionId, previous.actionId);
    assert.deepEqual(result.plan, previous.plan);
    const diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(diagnostics.executedNodeCount, previous.diagnostics.executedNodeCount);
    assert.equal(diagnostics.successfulInputSubmissionCount, previous.diagnostics.successfulInputSubmissionCount);
    assert.deepEqual(diagnostics.failedNodeCountByCode, {});
    // 历史候选总量超过单个JS字符串上限；按叶保存同一结果，不能丢弃观察来缩小证据。
    async function* lines() {
      const { actionOutcomes, ...decision } = result;
      yield JSON.stringify({ type: "header", codeCommit: "96e60c14", tree, wallMs,
        legalActions, result: decision, diagnostics }) + "\n";
      for (const outcome of actionOutcomes) {
        const { leaves, ...metadata } = outcome;
        yield JSON.stringify({ type: "outcome", outcome: metadata }) + "\n";
        for (const leaf of leaves || []) yield JSON.stringify({ type: "leaf", actionId: outcome.actionId, leaf }) + "\n";
      }
    }
    await pipeline(Readable.from(lines()), zlib.createGzip(), fs.createWriteStream(`${base}.capture.jsonl.gz`));
    const context = { seatId: result.policyDecision.seatId, legalActions, actionOutcomes: result.actionOutcomes,
      observation: result.actionOutcomes.find(o => o.rootObservation)?.rootObservation };
    const evaluations = legalActions.map(action => ({ action, evaluation: evaluator.evaluateAction(context, action),
      leafCount: result.actionOutcomes.find(o => o.actionId === action.actionId)?.leaves?.length || 0 }));
    fs.writeFileSync(`${base}.json`, JSON.stringify({ codeCommit: "96e60c14", wallMs, evaluations,
      matchesPreviousDecisionAndPlan: true }, null, 2) + "\n");
    console.log(JSON.stringify({ wallMs, selected: result.policyDecision.actionId,
      candidates: evaluations.filter(r => ["industry", "place_data"].includes(r.action.family))
        .map(r => ({ action: r.action.actionId, score: r.evaluation.score,
          leafId: r.evaluation.selectedLeafId, leafCount: r.leafCount })) }));
  } finally { env.dispose(); }
}
}
main().catch(error => {
  fs.writeFileSync(`${base}.failure.json`, JSON.stringify({ message: error.message, stack: error.stack }, null, 2) + "\n");
  console.error(error); process.exitCode = 1;
});
