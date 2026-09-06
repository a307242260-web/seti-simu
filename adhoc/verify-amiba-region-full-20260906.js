"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "reports/iteration/amiba-region-full-verification-20260906.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const quickPath = "reports/research/857426ea.be6bd7b6.quick-200.json";
  const fullPath = "reports/research/857426ea.be6bd7b6.full.json";
  const baselinePath = "reports/research/4e84be21.06738145.full.json";
  const q = read(quickPath), f = read(fullPath), b = read(baselinePath);
  const quick = read(q.savePath), full = read(f.savePath), baseline = read(b.savePath);
  assert.equal(f.terminal, true);
  assert.equal(f.gitCommit, q.gitCommit);
  assert.equal(f.resumedFrom, q.savePath);
  assert.deepEqual(full.replaySteps.slice(0, q.steps), quick.replaySteps);
  assert.deepEqual(f.metrics.searches.slice(0, q.metrics.searches.length), q.metrics.searches);
  assert.ok(f.metrics.searches.slice(q.metrics.searches.length).every(s => s.step > q.steps));
  assert.equal(new Set(f.metrics.searches.map(s => `${s.step}:${s.searchIndex}`)).size, f.metrics.searches.length);
  const state = JSON.parse(full.committedState);
  assert.equal(state.match.finalScoringSettled, true);
  const scores = Object.fromEntries(state.match.finalScores.map(p => [p.playerId, p.totalScore]));
  assert.deepEqual(scores, f.summary.scores);
  const mean = Object.values(scores).reduce((a, v) => a + v, 0) / 4;
  assert.equal(mean, f.summary.avgScore);
  let samePrefix = 0;
  while (samePrefix < full.replaySteps.length && samePrefix < baseline.replaySteps.length
    && JSON.stringify(full.replaySteps[samePrefix]) === JSON.stringify(baseline.replaySteps[samePrefix])) samePrefix++;
  const report = { scope: "只读核对正式终局、quick续接与统计去重；不重跑AI，不以成绩替代正确性",
    quickPath, fullPath, baselinePath, steps: f.steps, scores, mean,
    effectGatePassed: mean >= 108.5, meanDelta: mean - 108.5,
    quickMs: q.wallMs, resumeMs: f.wallMs, totalSimulationMs: q.wallMs + f.wallMs,
    baselineTotalMs: 547927, identicalPrefixSteps: samePrefix,
    firstDifferentStep: { current: full.replaySteps[samePrefix], baseline: baseline.replaySteps[samePrefix] },
    statisticsPrefixIdentical: true, searchCount: f.metrics.searches.length,
    finalScores: state.match.finalScores, passed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
