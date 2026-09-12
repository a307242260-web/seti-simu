"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
if (fs.existsSync(output)) { console.log(`已有证据，不重跑：${output}`); process.exit(0); }
const source = "/tmp/seti-move-path-audit-20260912.lZS8sa/before-step45-20260912.json";
const bytes = fs.readFileSync(source), input = JSON.parse(bytes);
const baseline = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4])) : null;
const chain = baseline?.winner?.actionChain;
if (baseline) assert(chain?.length, "基线必须有真实最佳完整链");
assert.equal(execFileSync("git", ["diff", "HEAD", "--", "randomizer"], { cwd: root, encoding: "utf8" }).trim(), "");
const modulePath = require.resolve(path.join(root, "randomizer/game/ai/expected-score-evaluator"));
const evaluator = require(modulePath), prefixes = [];
if (chain) require.cache[modulePath].exports = Object.freeze({ ...evaluator,
  selectSecondaryAgentSuccessors(args) {
    const selected = evaluator.selectSecondaryAgentSuccessors(args);
    if (args.actionChain?.length < chain.length && args.actionChain.every((id, i) => id === chain[i])) {
      prefixes.push({ chain: args.actionChain, route: args.routePlanId,
        next: chain[args.actionChain.length], retained: selected.some(a => a.actionId === chain[args.actionChain.length]) });
    }
    return selected; // 只观察，完整返回原选择结果。
  },
});
const env = require(path.join(root, "randomizer/app/simulation-env")).createSimulationEnv();
const report = { root, commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  source, sourceHash: createHash("sha256").update(bytes).digest("hex"), prefixes };
try {
  env.loadCheckpoint(input.checkpoint); assert.deepEqual(env.legalActions(), input.legalActions);
  console.log(`[共同45路线审计] ${report.commit.slice(0, 8)}`);
  const result = env.runHeuristicPolicyDecision(); assert.equal(result.ok, true);
  report.action = result.policyDecision.actionId; report.searches = result.searches;
  report.outcomes = result.actionOutcomes.filter(o => [report.action, chain?.[0]].includes(o.actionId)).map(o => ({
    actionId: o.actionId,
    evaluation: evaluator.evaluateOutcome({ seatId: "player-blue", observation: o.rootObservation,
      actionOutcomes: result.actionOutcomes }, input.legalActions.find(a => a.actionId === o.actionId), {}),
    leaves: (o.leaves || []).map(l => ({ leafId: l.leafId, actionChain: l.actionChain,
      sameBaselineChain: !!chain && JSON.stringify(l.actionChain) === JSON.stringify(chain) })),
  }));
  report.winner = report.outcomes.find(o => o.actionId === report.action).evaluation;
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, action: report.action, score: report.winner?.score,
    oldLeaves: report.outcomes?.flatMap(o => o.leaves.filter(l => l.sameBaselineChain)), error: report.error }, null, 2));
}
