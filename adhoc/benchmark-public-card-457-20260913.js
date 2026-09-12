"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `adhoc/public-card-457-${commit.slice(0,8)}-20260913.json`;
if (fs.existsSync(output)) { console.log(`已有证据，不重跑：${output}`); process.exit(0); }
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "randomizer"], { encoding: "utf8" }).trim(), "");
const source = "/tmp/seti-trade457-audit-20260912.smcD2g/before-step457-20260913.json";
const input = JSON.parse(fs.readFileSync(source));
const baseline = require("/tmp/seti-trade457-audit-20260912.smcD2g/trade457-output-bindings-20260913.json");
const env = require("../randomizer/app/simulation-env").createSimulationEnv();
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const report = { commit, source, baselineLeafId: baseline.winning.leafId, checks: {} };
try {
  env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[冷决策门槛] ${commit.slice(0,8)} 第457步，核对原最佳完整叶和物理节点`);
  const start = performance.now(), result = env.runHeuristicPolicyDecision();
  report.wallMs = performance.now() - start; assert.equal(result.ok, true);
  report.action = result.policyDecision.actionId; report.searches = result.searches;
  const strategic = result.searches.find(s => s.kind === "strategic").diagnostics;
  report.trades = strategic.executedNodeCountByFamily.quick_trade;
  report.oldPathLeaves = result.actionOutcomes.flatMap(o => (o.leaves || [])
    .filter(l => JSON.stringify(l.actionChain) === JSON.stringify(baseline.winning.actionChain))
    .map(l => ({ actionId: o.actionId, leafId: l.leafId, chain: l.actionChain })));
  const chosen = result.actionOutcomes.find(o => o.actionId === report.action);
  const evaluation = evaluator.evaluateOutcome({ seatId: "player-blue", observation: chosen.rootObservation,
    actionOutcomes: result.actionOutcomes }, input.legalActions.find(a => a.actionId === report.action), {});
  report.winner = { score: evaluation.score, leafId: evaluation.selectedLeafId, chain: evaluation.actionChain };
  report.checks = { time: strategic.totalMilliseconds <= 17055.695833, trades: report.trades < 681,
    errors: Object.keys(strategic.failedNodeCountByCode).length === 0,
    budget: strategic.budgetLimits.execution.limit === 4096 && strategic.budgetLimits.frontier.limit === 256,
    oldPathPresent: report.oldPathLeaves.length > 0 };
  report.passed = Object.values(report.checks).every(Boolean);
  if (!report.passed) process.exitCode = 1;
} catch (e) { report.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, action: report.action, wallMs: report.wallMs, trades: report.trades,
    checks: report.checks, winner: report.winner, oldPathLeaves: report.oldPathLeaves, error: report.error }, null, 2));
}
