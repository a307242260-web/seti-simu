"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "reports/iteration/company-full-verification-553e19c6-20260906.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const file = "reports/research/ffb71a57.553e19c6.full.json", r = read(file), save = read(r.savePath);
  const root = JSON.parse(save.committedState), previous = read("reports/research/220d6a11.6cd56452.full.json");
  assert.equal(r.terminal, true);
  assert.equal(root.match.finalScoringSettled, true);
  assert.equal(save.replaySteps.length, r.steps);
  const scores = Object.fromEntries(root.match.finalScores.map(p => [p.playerId, p.totalScore]));
  assert.deepEqual(scores, r.summary.scores);
  const mean = Object.values(scores).reduce((a, b) => a + b, 0) / 4;
  assert.equal(mean, r.summary.avgScore);
  assert.equal(new Set(r.metrics.searches.map(s => `${s.step}:${s.searchIndex}`)).size, r.metrics.searches.length);
  const oldSteps = read(previous.savePath).replaySteps;
  let equalPrefix = 0;
  while (equalPrefix < Math.min(save.replaySteps.length, oldSteps.length)
    && JSON.stringify(save.replaySteps[equalPrefix]) === JSON.stringify(oldSteps[equalPrefix])) equalPrefix++;
  const failedSearches = r.metrics.searches.filter(s => Object.keys(s.diagnostics.failedNodeCountByCode).length)
    .map(s => ({ step: s.step, seat: s.seat, kind: s.kind,
      failures: s.diagnostics.failedNodeCountByCode, families: s.diagnostics.failedNodeCountByFamily }));
  const report = { source: file, savePath: r.savePath, steps: r.steps, scores, mean,
    scoreGatePassed: mean >= 108.5, meanDeltaFromAcceptedBaseline: mean - 108.5,
    wallMs: r.wallMs, previousTotalMs: 559331, acceptedBaselineTotalMs: 547927,
    equalPrefix, firstDifferentStep: equalPrefix + 1,
    firstDifferentActions: { current: save.replaySteps[equalPrefix]?.action, previous: oldSteps[equalPrefix]?.action },
    failedSearches, formalFinalScores: root.match.finalScores, evidenceChecksPassed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
