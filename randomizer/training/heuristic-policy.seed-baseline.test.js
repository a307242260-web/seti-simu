"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const baseline = require("./heuristic-policy.seed-baseline.json");
const fixedBoard = require("./heuristic-policy.fixed-board.json");
const { createHeadlessEnv } = require("../app/headless-env");

assert.deepEqual(baseline.config, fixedBoard.config, "行为基线必须复用冻结版面配置");
const env = createHeadlessEnv();
env.reset(fixedBoard.config);
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
assert.ok(actual.terminal, "真实 Heuristic Policy 必须完成整局");
assert.ok(actual.familyCounts.industry <= 16, "公司 1x 不得在同一轮重复空转");
for (const family of ["play_card", "research_tech", "scan", "analyze", "move", "orbit", "land"]) {
  assert.ok(actual.familyCounts[family] > 0, `真实 Heuristic Policy 必须执行 ${family}，不能退化为 PASS-first 路径`);
}

console.log("training/heuristic-policy.seed-baseline.test.js ok");
