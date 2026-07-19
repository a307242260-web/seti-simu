"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const baseline = require("./heuristic-policy.seed-baseline.json");
const { createHeadlessEnv } = require("../app/headless-env");

const env = createHeadlessEnv();
env.reset(baseline.config);
const trace = [];
const familyCounts = {};

for (let stepIndex = 0; stepIndex < 2000 && !env.isTerminal(); stepIndex += 1) {
  const result = env.runHeuristicPolicyDecision();
  trace.push(result.actionId);
  const family = result.actionId.split(":")[0];
  familyCounts[family] = (familyCounts[family] || 0) + 1;
}

const observation = env.observe();
const actual = {
  terminal: env.isTerminal(),
  steps: trace.length,
  scores: observation.publicState.players.map((player) => player.score),
  traceHash: crypto.createHash("sha256").update(trace.join("\n")).digest("hex"),
  familyCounts,
  provenance: env.getReplay().episodeMetadata.policyProvenance,
};
env.dispose();

assert.deepEqual(actual, {
  terminal: baseline.terminal,
  steps: baseline.steps,
  scores: baseline.scores,
  traceHash: baseline.traceHash,
  familyCounts: baseline.familyCounts,
  provenance: baseline.provenance,
});
assert.ok(Math.min(...actual.scores) >= 20, "冻结水平基线不能退化为仅能终局的零水平策略");

console.log("training/heuristic-policy.seed-baseline.test.js ok");
