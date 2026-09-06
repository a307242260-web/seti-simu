"use strict";
// 只读复核已有证据，不运行 AI，也不重写研究记录。
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const output = "reports/iteration/ai-rounds-final-evidence-20260906.json";
if (fs.existsSync(output)) console.log(`已有审计记录：${output}`);
else {
  const read = file => JSON.parse(fs.readFileSync(file));
  const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  execFileSync("git", ["diff", "--exit-code", "213f34db", "--", "randomizer", "assets", "tools"]);
  const directory = "reports/iteration/";
  const before = read(directory + "observe-decision-search-before-20260906.json");
  const after = read(directory + "observe-decision-search-after-20260906.json");
  for (const key of ["inputHash", "chosen", "plan", "policyDecision", "outcomes",
    "afterStateHash", "afterObservationHash", "afterLegalHash", "diagnostics"]) {
    assert.deepEqual(after[key], before[key], key);
  }
  const terminal = read(directory + "observe-decision-full-verification-20260906.json");
  for (const save of terminal.saves) assert.equal(digest(save.path), save.sha256);
  const fullRecord = read(terminal.fullRecord), quickRecord = read(terminal.quickRecord);
  const full = read(fullRecord.savePath), quick = read(quickRecord.savePath);
  const state = JSON.parse(full.committedState);
  assert.equal(state.match.finalScoringSettled, true);
  assert.deepEqual(full.replaySteps.slice(0, quick.replaySteps.length), quick.replaySteps);
  assert.equal(fullRecord.resumedFrom, quickRecord.savePath);
  assert.equal(fullRecord.gitCommit, quickRecord.gitCommit);
  assert.equal(full.replaySteps.length, 702);
  const scores = Object.fromEntries(state.match.finalScores.map(p => [p.playerId, p.totalScore]));
  assert.deepEqual(scores, fullRecord.summary.scores);
  assert.deepEqual(scores, terminal.scores);
  const mean = Object.values(scores).reduce((sum, score) => sum + score, 0) / 4;
  assert.equal(mean, 108.5);
  assert.ok(mean > 106.75);
  const evidenceNames = [
    "plan-steps-r3-profile-20260905-d2f49e3e.json", "r3-brown-plan-realization-20260906.json",
    "r3-tile-dependency-realization-20260906.json", "r3-scan-earth-verification-20260906.json",
    "probe-source-plan-verification-20260906.json", "search-equivalence-r4-20260906-v2.json",
    "completion-state-r4-20260906.json", "score-corner-r4-real-20260906.json",
    "round-data-income-r4-real-20260906.json", "observe-decision-search-before-20260906.json",
    "observe-decision-search-after-20260906.json", "observe-decision-full-verification-20260906.json",
  ];
  const report = {
    scope: "已有证据完整性、观察优化前后等价与固定终局只读复核；不是重新运行历史行为证据，也不是完整实现证明",
    auditedHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    productionCommit: "213f34db", productionDiffEmpty: true,
    equalDecisionOutcomes: after.outcomes.length,
    equalLeaves: after.outcomes.reduce((n, outcome) => n + outcome.leaves.length, 0),
    steps: full.replaySteps.length, scores, mean, previousAcceptedMean: 106.75,
    simulationMs: fullRecord.wallMs + quickRecord.wallMs,
    evidence: evidenceNames.map(name => ({ path: directory + name, sha256: digest(directory + name) })),
    passed: true,
  };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
