"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
if (process.argv.length !== 2 && process.argv.length !== 5) throw new Error("参数须为：输出JSON 改动前记录 改动后记录；或不传参数使用原验证");
const output = process.argv[2] || "reports/iteration/policy-plan-full-verification-20260906.json";
const sources = process.argv.length === 5 ? process.argv.slice(3)
  : ["reports/research/25c65ece.795cd6eb.full.json", "reports/research/91f9a83a.73e7b2ca.full.json"];
const read = file => JSON.parse(fs.readFileSync(file));
const stripTiming = search => { const { totalMilliseconds, ...diagnostics } = search.diagnostics; return { ...search, diagnostics }; };
if (fs.existsSync(output)) console.log(`已有核验，跳过：${output}`);
else {
  const report = { scope: "只读两版本完整记录/存档；核对正式计分、全部replay、终局完整状态及逐次非时间搜索诊断", sources };
  try {
    const [before, after] = sources.map(read), saves = [before, after].map(r => read(r.savePath));
    const states = saves.map(s => typeof s.committedState === "string" ? JSON.parse(s.committedState) : s.committedState);
    assert.equal(before.terminal, true); assert.equal(after.terminal, true);
    assert.deepEqual(saves[0].replaySteps, saves[1].replaySteps);
    assert.deepEqual(states[0], states[1]);
    assert.deepEqual(before.metrics.searches.map(stripTiming), after.metrics.searches.map(stripTiming));
    const scores = states[1].match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
    report.mean = scores.reduce((n,s) => n + s.total, 0) / scores.length;
    assert.ok(report.mean >= 108.5);
    report.scores = scores; report.steps = after.steps; report.sameReplay = true;
    report.sameFinalState = true; report.sameSearchDiagnosticsExceptTime = true;
    report.measurements = [before, after].map(r => ({ commit: r.gitCommit, wallMs: r.wallMs,
      searches: r.metrics.searches.length,
      nodes: r.metrics.searches.reduce((n,s) => n + s.diagnostics.executedNodeCount, 0),
      submissions: r.metrics.searches.reduce((n,s) => n + s.diagnostics.successfulInputSubmissionCount, 0),
      searchMs: r.metrics.searches.reduce((n,s) => n + s.diagnostics.totalMilliseconds, 0),
      fullBudgetSearches: r.metrics.searches.filter(s => s.kind === "strategic"
        && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes).length,
      failedSearches: r.metrics.searches.filter(s => Object.keys(s.diagnostics.failedNodeCountByCode).length)
        .map(s => ({ step: s.step, seat: s.seat, failures: s.diagnostics.failedNodeCountByCode })),
    }));
    report.savedMs = before.wallMs - after.wallMs;
    report.wallReductionPercent = report.savedMs / before.wallMs * 100;
    report.sha256 = Object.fromEntries([...sources, before.savePath, after.savePath].map(file => [file,
      crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
