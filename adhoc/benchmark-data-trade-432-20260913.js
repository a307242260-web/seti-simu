"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `adhoc/data-trade-432-${commit.slice(0, 8)}-20260913.json`;
if (fs.existsSync(output)) { console.log(`已有证据，不重跑：${output}`); process.exit(0); }
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "randomizer"], { encoding: "utf8" }).trim(), "");
const source = "/tmp/seti-trace432-20260913.MuND9M/adhoc/trace432-input-20260913.json";
const baselineFile = "/tmp/seti-trace432-20260913.MuND9M/adhoc/trace432-distribution-20260913.json";
const input = JSON.parse(fs.readFileSync(source)), baseline = JSON.parse(fs.readFileSync(baselineFile));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const report = { commit, sources: [source, baselineFile].map(file => ({ file, sha256: hash(file) })) };
const env = require("../randomizer/app/simulation-env").createSimulationEnv();
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
try {
  env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[冷决策门槛] ${commit.slice(0, 8)} 第432步开始，4096节点/256队列不变`);
  const start = performance.now(), result = env.runHeuristicPolicyDecision();
  report.wallMs = performance.now() - start; assert.equal(result.ok, true);
  report.action = result.policyDecision.actionId; report.searches = result.searches;
  const strategic = result.searches.find(s => s.kind === "strategic").diagnostics;
  report.trades = strategic.executedNodeCountByFamily.quick_trade || 0;
  report.oldPathLeaves = result.actionOutcomes.flatMap(o => (o.leaves || [])
    .filter(l => JSON.stringify(l.actionChain) === JSON.stringify(baseline.winner.actionChain))
    .map(l => ({ actionId: o.actionId, leafId: l.leafId, chain: l.actionChain })));
  const chosen = result.actionOutcomes.find(o => o.actionId === report.action);
  const evaluation = evaluator.evaluateOutcome({ seatId: "player-green", observation: chosen.rootObservation,
    actionOutcomes: result.actionOutcomes }, input.legalActions.find(a => a.actionId === report.action), {});
  report.winner = { score: evaluation.score, leafId: evaluation.selectedLeafId, chain: evaluation.actionChain };
  report.checks = { time: strategic.totalMilliseconds <= 18745.181583, trades: report.trades < 499,
    errors: result.searches.every(s => !Object.keys(s.diagnostics.failedNodeCountByCode).length),
    budget: strategic.budgetLimits.execution.limit === 4096 && strategic.budgetLimits.frontier.limit === 256,
    oldPathPresent: report.oldPathLeaves.length > 0 };
  report.passed = Object.values(report.checks).every(Boolean);
  if (!report.passed) process.exitCode = 1;
} catch (e) { report.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, wallMs: report.wallMs, trades: report.trades,
    checks: report.checks, winner: report.winner, error: report.error }, null, 2));
}
