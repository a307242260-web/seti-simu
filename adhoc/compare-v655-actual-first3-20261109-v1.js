'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const read = p => JSON.parse(fs.readFileSync(p));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const [, , priorPath, suffix] = process.argv;
const D = 'reports/ai-foundation-20261109/v655-blue-column-timing-v1/';
const currentPath = D + 'v655-first3-native-development-20261109-v1.json';
const priorProofBlob = cp.execFileSync('git',['show','HEAD:'+priorPath],{maxBuffer:16*1024*1024});
const prior = JSON.parse(priorProofBlob), current = read(currentPath);
assert.equal(sha(prior.save),prior.saveSha256);
assert.equal(sha(current.save),current.saveSha256);
const old = read(prior.save).replaySteps, next = read(current.save).replaySteps;
let common = 0;
while (old[common] && next[common] && old[common].actorPlayerId === next[common].actorPlayerId
  && JSON.stringify(old[common].action) === JSON.stringify(next[common].action)) common++;
const detail = (steps,from) => steps.slice(from-1).map((r,i)=>({input:from+i,actor:r.actorPlayerId,family:r.action.family,target:r.action.target,summary:r.action.summary}));
const changed = (a,b) => Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
const comparisons = current.compare.map(row => {
  const priorRound = prior.compare.find(x=>x.round===row.round);
  assert.equal(row.teacher.checkpointSha256,priorRound.teacher.checkpointSha256);
  return {round:row.round,changedFields:changed(priorRound.ai.assets,row.ai.assets),teacherChangedFields:changed(priorRound.teacher.assets,row.teacher.assets),
    oldScore:priorRound.ai.assets.boardScore,newScore:row.ai.assets.boardScore,oldIncome:priorRound.ai.assets.income,newIncome:row.ai.assets.income};
});
const earlyAssetParity = comparisons.length>=2 && comparisons.slice(0,2).every(x=>x.changedFields.every(k=>k==='projectedFinalScore'));
const result={scope:'Actual standard runs with identical Native opening, early asset parity separated from change to scoring rules and estimated terminal points.',
  priorProof:priorPath,priorProofSha256:crypto.createHash('sha256').update(priorProofBlob).digest('hex'),currentProof:currentPath,currentProofSha256:sha(currentPath),
  equalInitialActions:common,earlyAssetParity,comparisons,oldFromFirstDifference:detail(old,common+1),newFromFirstDifference:detail(next,common+1),newAutonomousRuns:0};
const out=D+'v655-'+suffix+'-actual-first3-comparison-20261109-v1.json';
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,common,earlyAssetParity,comparisons}));
