"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const output = "reports/iteration/search-deadline-r4-verification-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const read = (p) => JSON.parse(fs.readFileSync(p));
  const quick = read("reports/research/76d49ed1.8a6ef25e.quick-200.json");
  const full = read("reports/research/76d49ed1.8a6ef25e.full.json");
  const qsave = read(quick.savePath), fsave = read(full.savePath);
  const state = typeof fsave.committedState === "string" ? JSON.parse(fsave.committedState) : fsave.committedState;
  assert.equal(state.match.finalScoringSettled, true);
  assert.deepEqual(fsave.replaySteps.slice(0, quick.steps), qsave.replaySteps);
  assert.equal(full.resumedFrom, quick.savePath);
  assert.equal(full.gitCommit, quick.gitCommit);
  const scores = Object.fromEntries(state.match.finalScores.map((p) => [p.playerId, p.totalScore]));
  assert.deepEqual(scores, full.summary.scores);
  const report = { scope: "读取已有快速/全盘记录和正式存档，不重跑AI；不证明全部搜索与计划行为正确",
    gitCommit: full.gitCommit, steps: full.steps, resumedPrefixIdentical: true, scores,
    mean: Object.values(scores).reduce((a,b) => a+b,0)/4,
    acceptedBaseline: 106.75, quickMs: quick.wallMs, resumedMs: full.wallMs,
    totalSimulationMs: quick.wallMs + full.wallMs,
    saves: [quick.savePath, full.savePath].map((path) => ({ path,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex") })) };
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
