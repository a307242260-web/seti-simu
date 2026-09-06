"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/visit-progress-full-verification-20260907.json";
if (fs.existsSync(output)) console.log(`已有完整局核验：${output}`);
else {
  const names = fs.readdirSync("reports/research").filter(name => name.endsWith(".1585d689.full.json"));
  assert.equal(names.length, 1, "新生产版本必须且仅有一个已完成完整记录");
  const sources = ["reports/research/7f66d3e1.c555bc33.full.json", `reports/research/${names[0]}`];
  const read = path => JSON.parse(fs.readFileSync(path)), hash = path => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
  const records = sources.map(read); records.forEach(r => assert.equal(r.terminal, true));
  const saves = records.map(r => read(r.savePath)), states = saves.map(s => JSON.parse(s.committedState));
  const measurements = records.map((r, index) => {
    const searches = r.metrics.searches, sum = name => searches.reduce((n, s) => n + s.diagnostics[name], 0);
    const scores = states[index].match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
    return { commit: r.gitCommit, steps: r.steps, wallMs: r.wallMs, scores,
      mean: scores.reduce((n, s) => n + s.total, 0) / scores.length, searches: searches.length,
      nodes: sum("executedNodeCount"), submissions: sum("successfulInputSubmissionCount"),
      cutoffs: searches.filter(s => s.diagnostics.executionLimitReached).map(s => ({ step: s.step, kind: s.kind,
        cap: s.diagnostics.maxExecutionNodes })),
      failures: searches.filter(s => Object.keys(s.diagnostics.failedNodeCountByCode).length).map(s => ({
        step: s.step, codes: s.diagnostics.failedNodeCountByCode })) };
  });
  const nonTime = record => record.metrics.searches.map(search => {
    const diagnostics = { ...search.diagnostics }; delete diagnostics.totalMilliseconds;
    return { ...search, diagnostics };
  });
  const sameReplay = JSON.stringify(saves[0].replaySteps) === JSON.stringify(saves[1].replaySteps);
  const sameFinalState = JSON.stringify(states[0]) === JSON.stringify(states[1]);
  const sameNonTimeSearches = JSON.stringify(nonTime(records[0])) === JSON.stringify(nonTime(records[1]));
  const current = measurements[1], baseline = measurements[0];
  const report = { scope: "提取事件进度判定前后的完整固定局：逐步动作/摘要、完整持久终局、全部非时间搜索字段；仅排除diagnostics.totalMilliseconds，不重跑AI", sources, measurements,
    sameReplay, sameFinalState, sameNonTimeSearches,
    meanFloorPassed: current.mean >= 108.5, noScoreRegression: current.mean >= baseline.mean,
    noRuleFailures: current.failures.length === 0, zeroCutoffs: current.cutoffs.length === 0,
    sha256: Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(path => [path, hash(path)])) };
  report.extractionParityPassed = sameReplay && sameFinalState && sameNonTimeSearches && report.noRuleFailures;
  report.goalComplete = false; // 该只读提取并未实现全部移动/数据需求，不能用局部相等收口整体Goal。
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!report.extractionParityPassed) process.exitCode = 1;
}
