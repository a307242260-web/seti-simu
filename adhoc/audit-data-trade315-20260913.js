"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const mode = process.argv[2]; assert(["baseline", "candidate"].includes(mode));
const root = mode === "baseline" ? "/Users/bilibili/code/seti-simu" : path.resolve(__dirname, "..");
const output = `adhoc/data-trade315-${mode}-20260913.json`;
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const source = "adhoc/data-trade315-input-20260913.json", bytes = fs.readFileSync(source), input = JSON.parse(bytes);
const commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const evaluatorFile = path.join(root, "randomizer/game/ai/expected-score-evaluator.js");
const evaluator = require(evaluatorFile), env = require(path.join(root, "randomizer/app/simulation-env")).createSimulationEnv();
const report = { mode, root, commit, sourceHash: crypto.createHash("sha256").update(bytes).digest("hex"),
  evaluatorHash: crypto.createHash("sha256").update(fs.readFileSync(evaluatorFile)).digest("hex") };
try {
  env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[315共同输入] ${mode} 单决策开始，不变更预算`);
  const result = env.runHeuristicPolicyDecision(); assert.equal(result.ok, true);
  report.action = result.policyDecision.actionId; report.searches = result.searches;
  report.plan = result.plan;
  for (const s of result.searches) assert.deepEqual(s.diagnostics.failedNodeCountByCode, {});
  const outcome = result.actionOutcomes.find(o => o.actionId === report.action);
  report.winner = evaluator.evaluateOutcome({ seatId: "player-brown", observation: outcome.rootObservation,
    actionOutcomes: result.actionOutcomes }, input.legalActions.find(a => a.actionId === report.action), {});
  if (mode === "candidate") {
    const old = JSON.parse(fs.readFileSync("adhoc/data-trade315-baseline-20260913.json"));
    assert.equal(report.sourceHash, old.sourceHash);
    report.oldPathLeaves = result.actionOutcomes.flatMap(o => (o.leaves || [])
      .filter(l => JSON.stringify(l.actionChain) === JSON.stringify(old.winner.actionChain))
      .map(l => ({ actionId: o.actionId, leafId: l.leafId, chain: l.actionChain })));
  }
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, action: report.action, score: report.winner?.score,
    chain: report.winner?.actionChain, oldPathLeaves: report.oldPathLeaves, error: report.error }, null, 2));
}
