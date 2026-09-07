"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "reports/iteration/resource-cache-full-verification-20260907.json";
if (fs.existsSync(output)) console.log("已有完整局核验");
else {
  const read = p => JSON.parse(fs.readFileSync(p));
  const names = fs.readdirSync("reports/research").filter(f => f.endsWith(".1f55695a.full.json"));
  assert.equal(names.length, 1);
  const sources = ["reports/research/7feb57c3.96e60c14.full.json", "reports/research/f237707b.4b246dca.full.json", `reports/research/${names[0]}`];
  const records = sources.map(read), saves = records.map(r => read(r.savePath));
  const measurements = records.map((r, i) => {
    assert.equal(r.terminal, true);
    const scores = JSON.parse(saves[i].committedState).match.finalScores.map(s => ({ playerId: s.playerId, total: s.totalScore }));
    assert.equal(scores.length, 4); scores.forEach(s => assert.equal(s.total, r.summary.scores[s.playerId]));
    let nodes = 0, inputs = 0; const cutoffs = [], failures = [];
    for (const s of r.metrics.searches) {
      const d = s.diagnostics;
      assert.ok(Number.isInteger(d.executedNodeCount));
      assert.ok(d.executedNodeCount <= d.maxExecutionNodes);
      if (s.kind === "strategic") assert.equal(d.maxExecutionNodes, 4096);
      assert.equal(Object.values(d.executedNodeCountByDecisionKind).reduce((a,b)=>a+b,0), d.executedNodeCount);
      assert.ok(Object.keys(d.executedNodeCountByDecisionKind).every(k => !/undefined|<none>|unclassified/i.test(k)));
      nodes += d.executedNodeCount; inputs += d.successfulInputSubmissionCount;
      if (d.executionLimitReached) cutoffs.push({ step: s.step, kind: s.kind });
      if (Object.keys(d.failedNodeCountByCode).length) failures.push({ step: s.step, codes: d.failedNodeCountByCode });
    }
    return { commit: r.gitCommit, steps: r.steps, scores, mean: scores.reduce((a,s)=>a+s.total,0)/4,
      wallMs: r.wallMs, searches: r.metrics.searches.length, nodes, inputs, cutoffs, failures };
  });
  let common = 0; const old = saves[1].replaySteps, current = saves[2].replaySteps;
  while (common < Math.min(old.length,current.length) && JSON.stringify(old[common]) === JSON.stringify(current[common])) common++;
  assert.equal(read("reports/iteration/resource-cache-decision-171-20260907.json").passed, true);
  assert.equal(read("reports/iteration/resource-cache-seat-order-fixed-20260907.json").differences.length, 0);
  const report = { scope: "已有唯一完整局离线核验；缓存一致性修复不自动证明全部历史降分因果", sources, measurements,
    commonSteps: common, firstDifference: { before: old[common], after: current[common] },
    brownIncomeChoices: saves.map(s => s.replaySteps.flatMap((step,index)=>step.action.actorId === "player-brown" && step.action.target?.choiceId?.startsWith("income:") ? [{ step: index+1, action: step.action }] : [])),
    effectGatePassed: measurements[2].mean >= measurements[0].mean, checksPassed: true, goalComplete: false };
  fs.writeFileSync(output, JSON.stringify(report, null, 2)+"\n");
  console.log(JSON.stringify({ commonSteps: common, measurements: measurements.map(({cutoffs,failures,...r})=>({...r,cutoffs:cutoffs.length,failures})), effectGatePassed: report.effectGatePassed }));
}
