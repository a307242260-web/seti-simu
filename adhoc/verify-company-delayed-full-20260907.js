"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const output = "reports/iteration/company-delayed-allowance-full-verification-20260907.json";
if (fs.existsSync(output)) console.log(`已有核验：${output}`);
else {
  const read = path => JSON.parse(fs.readFileSync(path));
  const names = fs.readdirSync("reports/research").filter(path => path.endsWith(".9968644b.full.json"));
  assert.equal(names.length, 1, "9968644b必须有且仅有一份完整局");
  const sources = ["reports/research/7feb57c3.96e60c14.full.json",
    "reports/research/14114d45.77d36854.full.json", `reports/research/${names[0]}`];
  const records = sources.map(read), saves = records.map(r => read(r.savePath));
  const report = { scope: "公司未来额度独立修复的固定局只读核验；不重跑AI，不以均分证明实现正确",
    sources, measurements: [], checksPassed: false, goalComplete: false };
  try {
    report.measurements = records.map((record, i) => {
      assert.equal(record.terminal, true);
      const state = JSON.parse(saves[i].committedState);
      const scores = state.match.finalScores.map(row => ({ playerId: row.playerId, total: row.totalScore }));
      assert.equal(scores.length, 4);
      scores.forEach(row => assert.ok(Number.isFinite(row.total)));
      const counts = {}, fullCounts = {}, cutoffs = [], failures = [];
      let nodes = 0, submissions = 0, fullNodes = 0, fullSearches = 0;
      for (const search of record.metrics.searches) {
        const d = search.diagnostics;
        for (const key of ["executedNodeCount", "maxExecutionNodes", "successfulInputSubmissionCount"]) {
          assert.ok(Number.isInteger(d[key]) && d[key] >= 0, `${search.step}:${key}`);
        }
        assert.equal(typeof d.executionLimitReached, "boolean");
        if (search.kind === "strategic") assert.equal(d.maxExecutionNodes, 4096);
        assert.equal(Object.values(d.executedNodeCountByDecisionKind).reduce((a, b) => a + b, 0), d.executedNodeCount);
        assert.equal(Object.values(d.executedNodeCountByFamily).reduce((a, b) => a + b, 0), d.executedNodeCount);
        assert.ok(Object.keys(d.executedNodeCountByDecisionKind).every(key => !/undefined|<none>|unclassified/i.test(key)));
        nodes += d.executedNodeCount; submissions += d.successfulInputSubmissionCount;
        const full = search.kind === "strategic" && d.executedNodeCount >= d.maxExecutionNodes;
        if (full) { fullNodes += d.executedNodeCount; fullSearches += 1; }
        for (const [key, n] of Object.entries(d.executedNodeCountByDecisionKind)) {
          counts[key] = (counts[key] || 0) + n;
          if (full) fullCounts[key] = (fullCounts[key] || 0) + n;
        }
        if (d.executionLimitReached) cutoffs.push({ step: search.step, kind: search.kind, cap: d.maxExecutionNodes });
        if (Object.keys(d.failedNodeCountByCode).length || Object.keys(d.failedNodeCountByFamily).length) {
          failures.push({ step: search.step, codes: d.failedNodeCountByCode, families: d.failedNodeCountByFamily });
        }
      }
      const rank = counts => Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return { commit: record.gitCommit, steps: record.steps, wallMs: record.wallMs, scores,
        mean: scores.reduce((n, row) => n + row.total, 0) / 4, nodes, submissions,
        searches: record.metrics.searches.length, fullSearches, fullNodes,
        classes: rank(counts), fullClasses: rank(fullCounts), cutoffs, failures };
    });
    const current = report.measurements[2];
    report.effectGatePassed = current.mean >= report.measurements[0].mean;
    report.noRuleFailures = current.failures.length === 0;
    report.zeroExecutionCutoffs = current.cutoffs.length === 0;
    report.replayEqualToPrevious = JSON.stringify(saves[1].replaySteps) === JSON.stringify(saves[2].replaySteps);
    report.finalStateEqualToPrevious = saves[1].committedState === saves[2].committedState;
    report.localEvidence = ["company-delayed-availability-fixed-cache-20260907.json",
      "company-delayed-allowance-stage-regression-20260907.json", "company-delayed-allowance-decision-42-20260907.json"];
    assert.equal(read(`reports/iteration/${report.localEvidence[0]}`).fixedVerified, true);
    for (const path of report.localEvidence.slice(1)) assert.equal(read(`reports/iteration/${path}`).passed, true, path);
    report.checksPassed = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  report.sha256 = Object.fromEntries([...sources, ...records.map(r => r.savePath)].map(path => [path,
    crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")]));
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, checksPassed: report.checksPassed, effectGatePassed: report.effectGatePassed,
    noRuleFailures: report.noRuleFailures, zeroExecutionCutoffs: report.zeroExecutionCutoffs,
    replayEqualToPrevious: report.replayEqualToPrevious, finalStateEqualToPrevious: report.finalStateEqualToPrevious,
    measurements: report.measurements.map(({ classes, fullClasses, ...rest }) => rest), error: report.error }, null, 2));
}
