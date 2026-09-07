"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), zlib = require("node:zlib"), path = require("node:path");
const { Readable } = require("node:stream"), { pipeline } = require("node:stream/promises");
const base = "reports/iteration/white-ranking-184-20260907";
async function main() {
  if (fs.existsSync(`${base}.json`)) return console.log("已有184完整候选，不重跑");
  const tree = process.argv[2]; assert.ok(tree && path.isAbsolute(tree));
  const env = require(path.join(tree, "randomizer/app/simulation-env")).createSimulationEnv();
  const evaluator = require(path.join(tree, "randomizer/game/ai/expected-score-evaluator"));
  try {
    const source = JSON.parse(fs.readFileSync("reports/iteration/white-movement-205-20260907.json"));
    env.loadCheckpoint(source.entries.find(e => e.step === 184).checkpoint);
    const legalActions = env.legalActions(), start = performance.now();
    const result = env.runHeuristicPolicyDecision(), wallMs = performance.now() - start;
    assert.equal(result.ok, true, JSON.stringify(result.error));
    const record = JSON.parse(fs.readFileSync("reports/research/14114d45.77d36854.full.json"));
    const previous = record.metrics.searches.find(s => s.step === 184 && s.kind === "strategic");
    assert.equal(result.policyDecision.actionId, previous.action);
    const diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(diagnostics.executedNodeCount, previous.diagnostics.executedNodeCount);
    assert.equal(diagnostics.successfulInputSubmissionCount, previous.diagnostics.successfulInputSubmissionCount);
    assert.deepEqual(diagnostics.failedNodeCountByCode, {});
    async function* lines() {
      const { actionOutcomes, ...decision } = result;
      yield JSON.stringify({ type: "header", codeCommit: "77d36854", wallMs, legalActions, result: decision, diagnostics }) + "\n";
      for (const outcome of actionOutcomes) {
        const { leaves, ...metadata } = outcome;
        yield JSON.stringify({ type: "outcome", outcome: metadata }) + "\n";
        for (const leaf of leaves || []) yield JSON.stringify({ type: "leaf", actionId: outcome.actionId, leaf }) + "\n";
      }
    }
    await pipeline(Readable.from(lines()), zlib.createGzip(), fs.createWriteStream(`${base}.capture.jsonl.gz`));
    const context = { seatId: "player-white", legalActions, actionOutcomes: result.actionOutcomes,
      observation: result.actionOutcomes.find(o => o.rootObservation)?.rootObservation };
    const evaluations = legalActions.map(action => ({ action, evaluation: evaluator.evaluateAction(context, action) }));
    fs.writeFileSync(`${base}.json`, JSON.stringify({ scope: "77d真实184缺失候选补证，不重跑全盘", wallMs,
      plan: result.plan, evaluations, matchesRecordedActionAndCounts: true }, null, 2) + "\n");
    console.log(JSON.stringify({ wallMs, action: result.policyDecision.actionId, nodes: diagnostics.executedNodeCount,
      evaluations: evaluations.map(r => ({ action: r.action.actionId, score: r.evaluation.score, leaf: r.evaluation.selectedLeafId })) }));
  } finally { env.dispose(); }
}
main().catch(error => { fs.writeFileSync(`${base}.failure.json`, JSON.stringify({ message: error.message, stack: error.stack }, null, 2)); console.error(error); process.exitCode = 1; });
