"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/company-finish-full-verification-20260907.json";
if (fs.existsSync(output)) console.log("已有完整局核验，不重跑");
else {
  const read = p => JSON.parse(fs.readFileSync(p));
  const names = fs.readdirSync("reports/research").filter(p => p.endsWith(".4b246dca.full.json"));
  assert.equal(names.length, 1, "新版本唯一完整局完成后才能核验");
  const sources = ["reports/research/7feb57c3.96e60c14.full.json", "reports/research/7d87ceb5.6b5381c1.full.json", `reports/research/${names[0]}`];
  const records = sources.map(read), saves = records.map(r => read(r.savePath));
  const measurements = records.map((r, index) => {
    assert.equal(r.terminal, true);
    const state = JSON.parse(saves[index].committedState), scores = state.match.finalScores.map(s => ({ playerId: s.playerId, score: s.totalScore }));
    assert.equal(scores.length, 4); for (const s of scores) assert.equal(s.score, r.summary.scores[s.playerId]);
    const classes = {}, cutoffs = [], failures = []; let nodes = 0, submissions = 0;
    for (const search of r.metrics.searches) {
      const d = search.diagnostics;
      for (const key of ["executedNodeCount", "maxExecutionNodes", "successfulInputSubmissionCount"])
        assert.ok(Number.isInteger(d[key]) && d[key] >= 0, `${search.step}:${key}`);
      assert.equal(typeof d.executionLimitReached, "boolean");
      if (search.kind === "strategic") assert.equal(d.maxExecutionNodes, 4096);
      for (const key of ["executedNodeCountByFamily", "executedNodeCountByDecisionKind"])
        assert.equal(Object.values(d[key]).reduce((a, b) => a + b, 0), d.executedNodeCount);
      assert.ok(Object.keys(d.executedNodeCountByDecisionKind).every(k => !/undefined|<none>|unclassified/i.test(k)));
      nodes += d.executedNodeCount; submissions += d.successfulInputSubmissionCount;
      for (const [key, n] of Object.entries(d.executedNodeCountByDecisionKind)) classes[key] = (classes[key] || 0) + n;
      if (d.executionLimitReached) cutoffs.push({ step: search.step, kind: search.kind, cap: d.maxExecutionNodes });
      if (Object.keys(d.failedNodeCountByCode).length) failures.push({ step: search.step, codes: d.failedNodeCountByCode });
    }
    return { commit: r.gitCommit, steps: r.steps, scores, mean: scores.reduce((n, s) => n + s.score, 0) / 4,
      wallMs: r.wallMs, searches: r.metrics.searches.length, nodes, submissions, cutoffs, failures,
      classes: Object.entries(classes).sort((a, b) => b[1] - a[1]) };
  });
  const old = saves[1].replaySteps, current = saves[2].replaySteps;
  let prefix = 0; while (prefix < Math.min(old.length, current.length) && JSON.stringify(old[prefix]) === JSON.stringify(current[prefix])) prefix++;
  const firstDifference = { commonSteps: prefix, before: old[prefix], after: current[prefix] };
  for (const p of ["company-finish-contract-fixed-20260907.json", "company-finish-decision-162-20260907.json"])
    assert.equal(read(`reports/iteration/${p}`).passed, true);
  const latest = measurements[2];
  const report = { scope: "只核验已有正式终局与搜索记录，不以均分替代实现正确性", sources, measurements, firstDifference,
    effectGatePassed: latest.mean >= measurements[0].mean, noRuleFailures: latest.failures.length === 0,
    zeroExecutionCutoffs: latest.cutoffs.length === 0, checksPassed: true, goalComplete: false,
    sha256: Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(p => [p, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")])) };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, effectGatePassed: report.effectGatePassed, firstDifference: prefix + 1,
    measurements: measurements.map(({ classes, cutoffs, ...r }) => ({ ...r, cutoffs: cutoffs.length })) }));
}
