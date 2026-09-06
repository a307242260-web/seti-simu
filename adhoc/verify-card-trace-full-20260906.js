"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "reports/iteration/card-trace-full-verification-6cd56452-20260906.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const quickPath = "reports/research/220d6a11.6cd56452.quick-200.json";
  const fullPath = "reports/research/220d6a11.6cd56452.full.json";
  const baselinePath = "reports/research/4e84be21.06738145.full.json";
  const previousPath = "reports/research/857426ea.be6bd7b6.full.json";
  const q = read(quickPath), f = read(fullPath), b = read(baselinePath), p = read(previousPath);
  const quick = read(q.savePath), full = read(f.savePath), baseline = read(b.savePath), previous = read(p.savePath);
  assert.equal(f.terminal, true);
  assert.equal(f.gitCommit, q.gitCommit);
  assert.equal(f.resumedFrom, q.savePath);
  assert.deepEqual(full.replaySteps.slice(0, q.steps), quick.replaySteps);
  assert.deepEqual(f.metrics.searches.slice(0, q.metrics.searches.length), q.metrics.searches);
  assert.ok(f.metrics.searches.slice(q.metrics.searches.length).every(s => s.step > q.steps));
  assert.equal(new Set(f.metrics.searches.map(s => `${s.step}:${s.searchIndex}`)).size, f.metrics.searches.length);
  const state = JSON.parse(full.committedState);
  assert.equal(state.match.finalScoringSettled, true);
  const scores = Object.fromEntries(state.match.finalScores.map(player => [player.playerId, player.totalScore]));
  assert.deepEqual(scores, f.summary.scores);
  const mean = Object.values(scores).reduce((a, v) => a + v, 0) / 4;
  assert.equal(mean, f.summary.avgScore);
  function comparePrefix(other) {
    let length = 0;
    while (length < full.replaySteps.length && length < other.replaySteps.length
      && JSON.stringify(full.replaySteps[length]) === JSON.stringify(other.replaySteps[length])) length++;
    return { length, firstDifferentStep: { current: full.replaySteps[length], previous: other.replaySteps[length] } };
  }
  const failures = {};
  for (const search of f.metrics.searches) {
    for (const [code, count] of Object.entries(search.diagnostics.failedNodeCountByCode)) failures[code] = (failures[code] || 0) + count;
  }
  const report = { scope: "只读核对正式终局、quick续接与统计去重；分数通过不等于规则与性能全部通过",
    quickPath, fullPath, baselinePath, previousPath, steps: f.steps, scores, mean,
    scoreGatePassed: mean >= 108.5, meanDelta: mean - 108.5,
    quickMs: q.wallMs, resumeMs: f.wallMs, totalSimulationMs: q.wallMs + f.wallMs,
    baselineTotalMs: 547927, previousTotalMs: 668031,
    baselinePrefix: comparePrefix(baseline), previousPrefix: comparePrefix(previous),
    statisticsPrefixIdentical: true, searchCount: f.metrics.searches.length,
    failures, finalScores: state.match.finalScores, evidenceChecksPassed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
