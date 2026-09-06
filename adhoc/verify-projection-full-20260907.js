"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/projection-full-verification-20260907.json";
const sources = ["reports/research/e81fab58.61cc94af.full.json", "reports/research/0eee8b82.744c5cf9.full.json"];
if (fs.existsSync(output)) console.log(`已有核验：${output}`);
else {
  const read = file => JSON.parse(fs.readFileSync(file));
  const report = { scope: "只读既有完整局；投影隔离行为等价与整体Goal门禁分开核验", sources };
  try {
    const records = sources.map(read), saves = records.map(r => read(r.savePath));
    const states = saves.map(s => JSON.parse(s.committedState));
    const stripTime = s => { const { totalMilliseconds, ...diagnostics } = s.diagnostics; return { ...s, diagnostics }; };
    records.forEach(r => assert.equal(r.terminal, true));
    assert.deepEqual(saves[0].replaySteps, saves[1].replaySteps);
    assert.deepEqual(states[0], states[1]);
    assert.deepEqual(records[0].metrics.searches.map(stripTime), records[1].metrics.searches.map(stripTime));
    report.sameReplay = report.sameFinalState = report.sameNonTimeDiagnostics = true;
    report.scores = states[1].match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
    report.mean = report.scores.reduce((n, s) => n + s.total, 0) / report.scores.length;
    report.scoreGatePassed = report.mean >= 108.5;
    report.measurements = records.map(r => ({ commit: r.gitCommit, steps: r.steps, wallMs: r.wallMs,
      searches: r.metrics.searches.length,
      nodes: r.metrics.searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0),
      submissions: r.metrics.searches.reduce((n, s) => n + s.diagnostics.successfulInputSubmissionCount, 0),
      fullBudgetSearches: r.metrics.searches.filter(s => s.kind === "strategic" && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes).length,
      failures: r.metrics.searches.filter(s => Object.keys(s.diagnostics.failedNodeCountByCode).length).map(s => ({ step: s.step, failures: s.diagnostics.failedNodeCountByCode })),
    }));
    report.sha256 = Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(file => [file,
      crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
    report.behaviorParityPassed = true;
    report.goalPassed = false;
  } catch (error) {
    report.behaviorParityPassed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
