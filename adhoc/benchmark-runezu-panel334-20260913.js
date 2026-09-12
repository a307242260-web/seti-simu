"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `adhoc/runezu-panel334-${commit.slice(0, 8)}-20260913.json`;
if (fs.existsSync(output)) { console.log(`已有证据，不重跑：${output}`); process.exit(0); }
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "randomizer"], { encoding: "utf8" }).trim(), "");
const source = "/tmp/seti-budget334-20260913.OJif7i/adhoc/budget334-input-20260913.json";
const input = JSON.parse(fs.readFileSync(source));
const report = { commit, source, sourceHash: crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
  scope: "规则修复后的单次冷决策；不要求保留含漏奖励的旧赢家", strategicTimeLimitMs: 19872.366875 };
const env = require("../randomizer/app/simulation-env").createSimulationEnv();
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
try {
  env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[冷决策门槛] ${commit.slice(0, 8)} 第334步开始，4096节点/256队列不变`);
  const start = performance.now(), result = env.runHeuristicPolicyDecision();
  report.wallMs = performance.now() - start;
  report.searches = result.searches;
  assert.equal(result.ok, true);
  report.action = result.policyDecision.actionId;
  const strategic = result.searches.find(s => s.kind === "strategic").diagnostics;
  const chosen = result.actionOutcomes.find(o => o.actionId === report.action);
  const evaluation = evaluator.evaluateOutcome({ seatId: "player-blue", observation: chosen.rootObservation,
    actionOutcomes: result.actionOutcomes }, input.legalActions.find(a => a.actionId === report.action), {});
  report.winner = { score: evaluation.score, leafId: evaluation.selectedLeafId, chain: evaluation.actionChain };
  report.checks = { time: strategic.totalMilliseconds <= report.strategicTimeLimitMs,
    errors: result.searches.every(s => !Object.keys(s.diagnostics.failedNodeCountByCode).length),
    budget: strategic.budgetLimits.execution.limit === 4096 && strategic.budgetLimits.frontier.limit === 256 };
  report.passed = Object.values(report.checks).every(Boolean);
  if (!report.passed) process.exitCode = 1;
} catch (e) { report.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, wallMs: report.wallMs,
    checks: report.checks, winner: report.winner, error: report.error }, null, 2));
}
