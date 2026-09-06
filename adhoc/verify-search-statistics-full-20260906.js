"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/search-statistics-full-verification-20260906.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const qPath = "reports/research/4e84be21.06738145.quick-200.json";
  const fPath = "reports/research/4e84be21.06738145.full.json";
  const q = read(qPath), f = read(fPath), b = read("reports/research/2848eba2.213f34db.full.json");
  const quick = read(q.savePath), full = read(f.savePath), baseline = read(b.savePath);
  assert.deepEqual(full.replaySteps, baseline.replaySteps);
  assert.deepEqual(full.replaySteps.slice(0, q.steps), quick.replaySteps);
  assert.deepEqual(f.metrics.searches.slice(0, q.metrics.searches.length), q.metrics.searches);
  assert.ok(f.metrics.searches.slice(q.metrics.searches.length).every(s => s.step > q.steps));
  assert.equal(new Set(f.metrics.searches.map(s => `${s.step}:${s.searchIndex}`)).size, f.metrics.searches.length);
  assert.equal(f.resumedFrom, q.savePath);
  assert.equal(f.gitCommit, q.gitCommit);
  const state = JSON.parse(full.committedState);
  assert.equal(state.match.finalScoringSettled, true);
  const scores = Object.fromEntries(state.match.finalScores.map(p => [p.playerId, p.totalScore]));
  assert.deepEqual(scores, f.summary.scores);
  assert.deepEqual(scores, b.summary.scores);
  assert.ok(f.summary.avgScore >= 108.5);
  const report = { scope: "只读核对完整逐步动作、状态摘要、正式终局和逐次搜索统计续接；不重跑AI",
    quickRecord: qPath, fullRecord: fPath, steps: f.steps, scores, mean: f.summary.avgScore,
    quickMs: q.wallMs, resumeMs: f.wallMs, totalSimulationMs: q.wallMs + f.wallMs,
    baselineTotalMs: 527450, fullTraceIdentical: true, statisticsPrefixIdentical: true,
    searchCount: f.metrics.searches.length,
    saveSha256: crypto.createHash("sha256").update(fs.readFileSync(f.savePath)).digest("hex"), passed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
