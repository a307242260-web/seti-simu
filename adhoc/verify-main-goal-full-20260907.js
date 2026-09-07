"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/main-goal-movement-full-verification-20260907.json";
if (fs.existsSync(output)) console.log(`已有完整局核验：${output}`);
else {
  const names = fs.readdirSync("reports/research").filter(p => p.endsWith(".77d36854.full.json"));
  assert.equal(names.length, 1, "本生产版本必须只有一份完整记录");
  const sources = ["reports/research/7feb57c3.96e60c14.full.json", `reports/research/${names[0]}`];
  const read = p => JSON.parse(fs.readFileSync(p)), records = sources.map(read);
  const saves = records.map(r => read(r.savePath));
  function summarize(searches) {
    const counts = {}, families = {};
    for (const s of searches) {
      for (const [k, n] of Object.entries(s.diagnostics.executedNodeCountByDecisionKind)) counts[k] = (counts[k] || 0) + n;
      for (const [k, n] of Object.entries(s.diagnostics.executedNodeCountByFamily)) families[k] = (families[k] || 0) + n;
    }
    const nodes = searches.reduce((n, s) => n + s.diagnostics.executedNodeCount, 0);
    const rows = map => Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count, percent: nodes ? Number((100 * count / nodes).toFixed(3)) : 0 }));
    return { searches: searches.length, nodes, classes: rows(counts), families: rows(families) };
  }
  const measurements = records.map((r, index) => {
    const searches = r.metrics.searches, state = JSON.parse(saves[index].committedState);
    const scores = state.match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
    return { commit: r.gitCommit, steps: r.steps, terminal: r.terminal, wallMs: r.wallMs, scores,
      mean: scores.reduce((n, s) => n + s.total, 0) / scores.length,
      all: summarize(searches), full: summarize(searches.filter(s => s.kind === "strategic"
        && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes)),
      submissions: searches.reduce((n, s) => n + s.diagnostics.successfulInputSubmissionCount, 0),
      cutoffs: searches.filter(s => s.diagnostics.executionLimitReached).map(s => ({ step: s.step, kind: s.kind,
        cap: s.diagnostics.maxExecutionNodes, top: summarize([s]).classes.slice(0, 5) })),
      failures: searches.filter(s => Object.keys(s.diagnostics.failedNodeCountByCode).length)
        .map(s => ({ step: s.step, codes: s.diagnostics.failedNodeCountByCode })) };
  });
  let firstDifference = -1;
  for (let i = 0; i < Math.max(...saves.map(s => s.replaySteps.length)); i += 1) {
    if (JSON.stringify(saves[0].replaySteps[i]) !== JSON.stringify(saves[1].replaySteps[i])) { firstDifference = i; break; }
  }
  const report = { sources, scope: "已生成固定局与正式save-final只读核验；不重跑AI，动作首差不是效果因果证明",
    measurements, noScoreRegression: measurements[1].mean >= measurements[0].mean,
    noRuleFailures: measurements[1].failures.length === 0,
    zeroCutoffs: measurements[1].cutoffs.length === 0, goalComplete: false, verified: false,
    logicGatePassed: false, iterationAccepted: false,
    knownImplementationDefects: ["company-delayed-availability-repro-20260907.json：暂不可启用被误当作后续无额度"],
    firstReplayDifference: firstDifference < 0 ? { status: "equal" } : { step: firstDifference + 1,
      before: saves[0].replaySteps[firstDifference], after: saves[1].replaySteps[firstDifference] } };
  try {
    for (const r of records) assert.equal(r.terminal, true);
    for (const s of records[1].metrics.searches) {
      const d = s.diagnostics;
      assert.deepEqual(d.failedNodeCountByCode, {}); assert.deepEqual(d.failedNodeCountByFamily, {});
      for (const k of ["executedNodeCount", "maxExecutionNodes", "successfulInputSubmissionCount"]) {
        assert.ok(Number.isInteger(d[k]) && d[k] >= 0, `第${s.step}步必需字段${k}缺失/无效`);
      }
      assert.equal(typeof d.executionLimitReached, "boolean");
      if (s.kind === "strategic") assert.equal(d.maxExecutionNodes, 4096);
      assert.equal(Object.values(d.executedNodeCountByDecisionKind).reduce((n, c) => n + c, 0), d.executedNodeCount);
      assert.equal(Object.values(d.executedNodeCountByFamily).reduce((n, c) => n + c, 0), d.executedNodeCount);
      assert.ok(Object.keys(d.executedNodeCountByDecisionKind).every(k => !/undefined|<none>|unclassified/i.test(k)));
    }
    assert.ok(report.noScoreRegression, "完整终局均分不得低于当前109.5；下降需继续因果分析");
    report.verified = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  report.sha256 = Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(p => [p,
    crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]));
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, error: report.error,
    measurements: measurements.map(m => ({ commit: m.commit, steps: m.steps, scores: m.scores, mean: m.mean,
      nodes: m.all.nodes, searches: m.all.searches, submissions: m.submissions, wallMs: m.wallMs,
      fullSearches: m.full.searches, cutoffs: m.cutoffs.length, failures: m.failures })),
    firstReplayDifferenceStep: report.firstReplayDifference.step }, null, 2));
}
