"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/card-launch-full-verification-20260907.json";
const sources = ["reports/research/0eee8b82.744c5cf9.full.json", "reports/research/39fc344f.b10ae543.full.json"];
if (fs.existsSync(output)) console.log(`已有核验：${output}`);
else {
  const report = { scope: "只读完整存档核验动作/终局等价、搜索失败归零及独立Goal门槛", sources };
  try {
    const read = p => JSON.parse(fs.readFileSync(p));
    const records = sources.map(read), saves = records.map(r => read(r.savePath));
    records.forEach(r => assert.equal(r.terminal, true));
    assert.deepEqual(saves[0].replaySteps, saves[1].replaySteps);
    const states = saves.map(s => JSON.parse(s.committedState));
    assert.deepEqual(states[0], states[1]);
    report.sameReplay = report.sameFinalState = true;
    report.scores = states[1].match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
    report.mean = report.scores.reduce((n, s) => n + s.total, 0) / report.scores.length;
    report.measurements = records.map(r => ({ commit: r.gitCommit, steps: r.steps, wallMs: r.wallMs,
      searches: r.metrics.searches.length,
      nodes: r.metrics.searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0),
      submissions: r.metrics.searches.reduce((n, s) => n + s.diagnostics.successfulInputSubmissionCount, 0),
      fullBudgetSearches: r.metrics.searches.filter(s => s.kind === "strategic" && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes).length,
      cutOffSteps: r.metrics.searches.filter(s => s.diagnostics.executionLimitReached).map(s => s.step),
      failedNodes: r.metrics.searches.reduce((n, s) => n + Object.values(s.diagnostics.failedNodeCountByCode).reduce((m, v) => m + v, 0), 0),
    }));
    assert.equal(report.measurements[1].failedNodes, 0);
    report.scoreGatePassed = report.mean >= 108.5;
    report.ruleFixVerified = true;
    report.goalPassed = report.scoreGatePassed && report.measurements[1].cutOffSteps.length === 0;
    report.sha256 = Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(file => [file,
      crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
  } catch (error) { report.ruleFixVerified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report, null, 2)); }
}
