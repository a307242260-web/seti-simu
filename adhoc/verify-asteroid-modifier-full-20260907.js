"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/asteroid-modifier-full-verification-20260907.json";
if (fs.existsSync(output)) console.log(`已有完整局核验：${output}`);
else {
  const files = fs.readdirSync("reports/research").filter(p => p.endsWith(".96e60c14.full.json"));
  assert.equal(files.length, 1, "该生产版本必须只有一份完整记录");
  const sources = ["reports/research/6eb79d83.18839186.full.json", `reports/research/${files[0]}`];
  const read = p => JSON.parse(fs.readFileSync(p));
  const records = sources.map(read), saves = records.map(r => read(r.savePath));
  const states = saves.map(s => JSON.parse(s.committedState));
  const firstDifference = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return i;
    return -1;
  };
  const nonTime = record => record.metrics.searches.map(s => {
    const diagnostics = { ...s.diagnostics }; delete diagnostics.totalMilliseconds;
    return { ...s, diagnostics };
  });
  const measurements = records.map((r, index) => {
    const searches = r.metrics.searches;
    const scores = states[index].match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
    return { commit: r.gitCommit, steps: r.steps, wallMs: r.wallMs, scores,
      mean: scores.reduce((n, s) => n + s.total, 0) / scores.length,
      searches: searches.length, nodes: searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0),
      submissions: searches.reduce((n, s) => n + s.diagnostics.successfulInputSubmissionCount, 0),
      cutoffs: searches.filter(s => s.diagnostics.executionLimitReached).map(s => ({ step: s.step, kind: s.kind, cap: s.diagnostics.maxExecutionNodes })),
      failures: searches.filter(s => Object.keys(s.diagnostics.failedNodeCountByCode).length).map(s => ({ step: s.step, codes: s.diagnostics.failedNodeCountByCode })) };
  });
  const replayDifference = firstDifference(saves[0].replaySteps, saves[1].replaySteps);
  const searchDifference = firstDifference(nonTime(records[0]), nonTime(records[1]));
  const report = { scope: "b124共享费用修复的唯一固定局核验：正式终局、动作/状态、逐搜索统计；仅排除实测总耗时，不重跑AI", sources, measurements,
    sameReplay: replayDifference < 0, sameFinalState: JSON.stringify(states[0]) === JSON.stringify(states[1]),
    sameNonTimeSearches: searchDifference < 0,
    firstReplayDifference: replayDifference < 0 ? { status: "equal" } : { step: replayDifference + 1,
      before: saves[0].replaySteps[replayDifference], after: saves[1].replaySteps[replayDifference] },
    firstSearchDifference: searchDifference < 0 ? { status: "equal" } : { index: searchDifference,
      baselineStep: records[0].metrics.searches[searchDifference]?.step,
      currentStep: records[1].metrics.searches[searchDifference]?.step },
    meanFloorPassed: measurements[1].mean >= 108.5,
    noScoreRegression: measurements[1].mean >= measurements[0].mean,
    noRuleFailures: measurements[1].failures.length === 0,
    zeroCutoffs: measurements[1].cutoffs.length === 0,
    verified: false, goalComplete: false };
  try {
    records.forEach(r => assert.equal(r.terminal, true));
    for (const s of records[1].metrics.searches) {
      const d = s.diagnostics;
      assert.deepEqual(d.failedNodeCountByCode, {});
      assert.deepEqual(d.failedNodeCountByFamily, {});
      for (const key of ["executedNodeCount", "maxExecutionNodes", "successfulInputSubmissionCount"]) {
        assert.ok(Number.isInteger(d[key]) && d[key] >= 0, `第${s.step}步必需计数字段${key}缺失或无效`);
      }
      assert.equal(typeof d.executionLimitReached, "boolean");
      assert.equal(Object.values(d.executedNodeCountByDecisionKind).reduce((n, c) => n + c, 0), d.executedNodeCount);
      assert.ok(Object.keys(d.executedNodeCountByDecisionKind).every(k => !/undefined|<none>/.test(k)));
    }
    assert.ok(report.meanFloorPassed && report.noScoreRegression);
    report.verified = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  report.sha256 = Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(p => [p,
    crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]));
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, sameReplay: report.sameReplay,
    sameFinalState: report.sameFinalState, sameNonTimeSearches: report.sameNonTimeSearches,
    firstReplayDifference: report.firstReplayDifference, firstSearchDifference: report.firstSearchDifference,
    measurements: measurements.map(m => ({ ...m, cutoffs: m.cutoffs.length })), error: report.error }, null, 2));
}
