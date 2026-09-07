"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "reports/iteration/chong-blue-full-delta-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const review = JSON.parse(fs.readFileSync("reports/iteration/chong-blue-card-order-full-review-20260908.json"));
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
    players[p.id] = {scoreSources:p.scoreSources,final:p.finalScoreBreakdown,orbitCount:p.orbitCount,
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
const report={scope:"只读固定全盘，玩家/回合对齐，分数拆分不代替策略因果证明",baseline,candidate,deltas};
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({output,baselineBins:baseline.searchBins,candidateBins:candidate.searchBins,deltas},null,2));
