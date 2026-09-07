"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { Readable } = require("node:stream"), { pipeline } = require("node:stream/promises");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const index = Number(process.argv[2]);
assert.ok(index === 0 || index === 1, "指定根0或1");
const base = `reports/iteration/brown-ranking-${index}-20260907`;
async function main() {
  if (fs.existsSync(`${base}.json`) || fs.existsSync(`${base}.capture.jsonl.gz`)) return console.log("已有候选checkpoint，不重跑");
  const row = JSON.parse(fs.readFileSync("reports/iteration/brown-income-roots-20260907.json")).rows[index];
  const env = createSimulationEnv();
  try {
    env.loadCheckpoint(row.checkpoint);
    const legalActions = env.legalActions(), start = performance.now();
    const result = env.runHeuristicPolicyDecision(), wallMs = performance.now() - start;
    const diagnostics = env.getCounterfactualDiagnostics();
    async function* lines() {
      const { actionOutcomes, ...decision } = result;
      yield JSON.stringify({ type: "header", codeCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        sourceRecord: row.recordId, sourceStep: row.step, wallMs, legalActions, result: decision, diagnostics }) + "\n";
      for (const outcome of actionOutcomes || []) {
        const { leaves, ...metadata } = outcome;
        yield JSON.stringify({ type: "outcome", outcome: metadata }) + "\n";
        for (const leaf of leaves || []) yield JSON.stringify({ type: "leaf", actionId: outcome.actionId, leaf }) + "\n";
      }
    }
    await pipeline(Readable.from(lines()), zlib.createGzip(), fs.createWriteStream(`${base}.capture.jsonl.gz`));
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.ok(wallMs < 30000);
    assert.deepEqual(diagnostics.failedNodeCountByCode, {});
    const previous = JSON.parse(fs.readFileSync(`reports/research/${row.recordId}.full.json`)).metrics.searches.find(s => s.step === row.step && s.kind === "strategic");
    const context = { seatId: "player-brown", legalActions, actionOutcomes: result.actionOutcomes,
      observation: result.actionOutcomes.find(o => o.rootObservation)?.rootObservation };
    const evaluations = legalActions.map(action => ({ action, evaluation: evaluator.evaluateAction(context, action) }));
    const comparison = { actionEqual: result.policyDecision.actionId === previous.action,
      nodesEqual: diagnostics.executedNodeCount === previous.diagnostics.executedNodeCount,
      submissionsEqual: diagnostics.successfulInputSubmissionCount === previous.diagnostics.successfulInputSubmissionCount };
    fs.writeFileSync(`${base}.json`, JSON.stringify({ scope: "当前同一生产实现对两个真实棕方根补取缺失候选；不是历史代码全盘重跑",
      wallMs, diagnostics, comparison, plan: result.plan, evaluations }, null, 2) + "\n");
    console.log(JSON.stringify({ index, wallMs, comparison, evaluations: evaluations.map(r => ({ action: r.action.actionId,
      score: r.evaluation.score, leaf: r.evaluation.selectedLeafId })) }));
  } finally { env.dispose(); }
}
main().catch(error => { fs.writeFileSync(`${base}.failure.json`, JSON.stringify({ message: error.message, stack: error.stack }, null, 2)); console.error(error); process.exitCode = 1; });
