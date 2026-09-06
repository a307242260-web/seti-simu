"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const source = process.argv[2];
assert.ok(source?.startsWith("reports/research/") && source.endsWith(".795cd6eb.full.json"));
const output = "reports/iteration/amiba-overflow-full-verification-795cd6eb-20260906.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const r = read(source), save = read(r.savePath), root = JSON.parse(save.committedState);
  const previous = read("reports/research/ffb71a57.553e19c6.full.json"), old = read(previous.savePath);
  assert.equal(r.terminal, true); assert.equal(root.match.finalScoringSettled, true);
  assert.equal(r.steps, save.replaySteps.length);
  const scores = Object.fromEntries(root.match.finalScores.map(p=>[p.playerId,p.totalScore]));
  assert.deepEqual(scores,r.summary.scores);
  const mean = Object.values(scores).reduce((a,b)=>a+b,0)/4;
  assert.equal(mean,r.summary.avgScore);
  assert.equal(new Set(r.metrics.searches.map(s=>`${s.step}:${s.searchIndex}`)).size,r.metrics.searches.length);
  let equalPrefix = 0;
  while(equalPrefix<Math.min(save.replaySteps.length,old.replaySteps.length)
    && JSON.stringify(save.replaySteps[equalPrefix])===JSON.stringify(old.replaySteps[equalPrefix])) equalPrefix++;
  const failedSearches = r.metrics.searches.filter(s=>Object.keys(s.diagnostics.failedNodeCountByCode).length)
    .map(s=>({step:s.step,seat:s.seat,failures:s.diagnostics.failedNodeCountByCode,families:s.diagnostics.failedNodeCountByFamily}));
  const report = {source,savePath:r.savePath,steps:r.steps,scores,mean,scoreGatePassed:mean>=108.5,
    meanDeltaFromPrevious:mean-previous.summary.avgScore,wallMs:r.wallMs,previousMs:previous.wallMs,
    equalPrefix,firstDifferentActions:{current:save.replaySteps[equalPrefix]?.action,previous:old.replaySteps[equalPrefix]?.action},
    failedSearches,formalFinalScores:root.match.finalScores,evidenceChecksPassed:true};
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({...report,formalFinalScores:undefined},null,2));
}
