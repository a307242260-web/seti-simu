"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const sources = ["reports/research/2a4865e5.1585d689.full.json"];
const output = "reports/iteration/input-classification-full-verification-20260907.json";
if (fs.existsSync(output)) console.log(`已有完整局核验：${output}`);
else {
  const names = fs.readdirSync("reports/research").filter(name => name.endsWith(".18839186.full.json"));
  assert.equal(names.length, 1, "新生产版本必须且仅有一个已完成完整记录");
  sources.push(`reports/research/${names[0]}`);
  const read = path => JSON.parse(fs.readFileSync(path));
  const records = sources.map(read), saves = records.map(r => read(r.savePath));
  const states = saves.map(s => JSON.parse(s.committedState));
  const excluded = ["totalMilliseconds", "executedNodeCountByDecisionKind", "executedOriginCountByTargetAndDecisionKind"];
  const comparable = r => r.metrics.searches.map(s => ({ ...s, diagnostics: Object.fromEntries(
    Object.entries(s.diagnostics).filter(([key]) => !excluded.includes(key))) }));
  const measurements = records.map((r, index) => {
    const searches = r.metrics.searches, sum = key => searches.reduce((n, s) => n + s.diagnostics[key], 0);
    const scores = states[index].match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
    return { commit: r.gitCommit, steps: r.steps, wallMs: r.wallMs, scores,
      mean: scores.reduce((n, s) => n + s.total, 0) / scores.length,
      searches: searches.length, nodes: sum("executedNodeCount"), submissions: sum("successfulInputSubmissionCount"),
      cutoffs: searches.filter(s => s.diagnostics.executionLimitReached).map(s => ({ step: s.step,
        kind: s.kind, cap: s.diagnostics.maxExecutionNodes })),
      failures: searches.filter(s => Object.keys(s.diagnostics.failedNodeCountByCode).length)
        .map(s => ({ step: s.step, codes: s.diagnostics.failedNodeCountByCode })) };
  });
  const currentSearches = records[1].metrics.searches;
  const fullSearches = currentSearches.filter(s => s.kind === "strategic"
    && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes);
  const summarize = searches => {
    const counts = {}, nodes = searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0);
    for (const search of searches) for (const [key, count] of Object.entries(search.diagnostics.executedNodeCountByDecisionKind)) {
      counts[key] = (counts[key] || 0) + count;
    }
    return { searches: searches.length, nodes, classes: Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count, percent: Number((count / nodes * 100).toFixed(3)) })) };
  };
  const report = { sources, excluded, measurements, all: summarize(currentSearches), full: summarize(fullSearches),
    fullSearchDistribution: fullSearches.map(s => ({ step: s.step, seat: s.seat,
      ...summarize([s]) })), verified: false, goalComplete: false };
  try {
    records.forEach(r => assert.equal(r.terminal, true));
    assert.deepEqual(saves[1].replaySteps, saves[0].replaySteps);
    assert.deepEqual(states[1], states[0]);
    assert.deepEqual(comparable(records[1]), comparable(records[0]));
    assert.deepEqual(measurements[1].failures, []);
    assert.ok(measurements[1].mean >= 108.5 && measurements[1].mean >= measurements[0].mean);
    for (const search of currentSearches) {
      const d = search.diagnostics, counts = d.executedNodeCountByDecisionKind;
      assert.equal(Object.values(counts).reduce((n, count) => n + count, 0), d.executedNodeCount);
      for (const [key, count] of Object.entries(counts)) {
        assert.ok(count > 0 && !/undefined|<none>/.test(key), `异常分类：${key}`);
        assert.ok(!key.includes(":conditional") || /\/decision=.+\/effect=.+/.test(key));
      }
      const families = {};
      for (const [key, count] of Object.entries(counts)) {
        const family = key.split(":")[0]; families[family] = (families[family] || 0) + count;
      }
      assert.deepEqual(families, d.executedNodeCountByFamily);
    }
    report.verified = true;
    report.sameReplay = true; report.sameFinalState = true; report.sameNonClassificationNonTimeSearches = true;
  } catch (error) {
    report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  }
  report.sha256 = Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(path => [path,
    crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")]));
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, measurements, top: report.all.classes.slice(0, 10),
    fullTop: report.full.classes.slice(0, 10), error: report.error }, null, 2));
}
