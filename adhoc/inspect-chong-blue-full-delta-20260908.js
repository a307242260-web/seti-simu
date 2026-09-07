"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const companyIncome = process.argv.includes("--company-income");
const output = companyIncome ? "reports/iteration/company-income-full-delta-20260908.json" : "reports/iteration/chong-blue-full-delta-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const review = JSON.parse(fs.readFileSync(companyIncome ? "reports/iteration/company-base-income-full-review-20260908.json" : "reports/iteration/chong-blue-card-order-full-review-20260908.json"));
const corrected = companyIncome ? JSON.parse(fs.readFileSync("reports/iteration/company-base-income-finals-20260908.json")) : null;
if (corrected) assert.equal(corrected.passed, true);
function inspect(summary) {
  const record = JSON.parse(fs.readFileSync(summary.file)),save = JSON.parse(fs.readFileSync(record.savePath));
  const state = JSON.parse(save.committedState);
  const searchBins = {control:{count:0,nodes:0,ms:0},capped:{count:0,nodes:0,ms:0},other:{count:0,nodes:0,ms:0}};
  for(const s of record.metrics.searches) {
    const key = s.kind === "control" ? "control" : s.diagnostics.executedNodeCount === 4096 ? "capped" : "other";
    const b = searchBins[key]; b.count++;b.nodes+=s.diagnostics.executedNodeCount;b.ms+=s.diagnostics.totalMilliseconds;
  }
  const players = {};
  for(const p of state.players.players) {
    const steps = save.replaySteps.filter(s=>s.actorPlayerId===p.id);
    const diagnostic = corrected?.records.find(r=>r.file===summary.file)?.scores.find(s=>s.playerId===p.id);
    if (companyIncome && summary.file === review.baseline.file) assert.ok(diagnostic, "前版必须使用已验证的正确规则诊断分");
    players[p.id] = {scoreSources:p.scoreSources,final:diagnostic || p.finalScoreBreakdown,originalFinal:p.finalScoreBreakdown,orbitCount:p.orbitCount,
      income:p.income,tech:p.techState,marks:steps.filter(s=>s.action.summary.startsWith("标记 ")),
      roundActions:{}};
    for(const round of [1,2,3,4]) {
      players[p.id].roundActions[round] = steps.filter(s=>s.after.r===round && s.action.phase !== "conditional")
        .map(s=>({step:s.stepIndex+1,turn:s.after.t,action:s.action,after:s.after.p[p.id]}));
    }
  }
  return {file:summary.file,searchBins,players};
}
const baseline=inspect(review.baseline),candidate=inspect(review.candidate),deltas={};
for(const id of Object.keys(baseline.players)) {
  const a=baseline.players[id],b=candidate.players[id];
  const sourceKeys=new Set([...Object.keys(a.scoreSources),...Object.keys(b.scoreSources)]);
  deltas[id]={total:b.final.totalScore-a.final.totalScore,base:b.final.baseScore-a.final.baseScore,
    tile:b.final.tileScore-a.final.tileScore,card:b.final.cardScore-a.final.cardScore,
    tiles:Object.fromEntries(Object.keys(a.final.tileScoresById).map(k=>[k,b.final.tileScoresById[k]-a.final.tileScoresById[k]])),
    sources:Object.fromEntries([...sourceKeys].map(k=>[k,(b.scoreSources[k]||0)-(a.scoreSources[k]||0)]))};
  assert.equal(deltas[id].base+deltas[id].tile+deltas[id].card,deltas[id].total);
}
const report={scope:companyIncome ? "只读既有两局；前版按已验证公司收入诊断分比较，保留原始分数；同终局重算不等于新实验，差值不代替因果证明" : "只读固定全盘，玩家/回合对齐，分数拆分不代替策略因果证明",baseline,candidate,deltas};
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({output,baselineBins:baseline.searchBins,candidateBins:candidate.searchBins,deltas},null,2));
