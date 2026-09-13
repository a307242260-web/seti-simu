"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const candidatePath=process.argv[2];
assert(candidatePath,"需要候选full记录路径");
const output="adhoc/scan-free-cost-full-comparison-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const baselinePath="reports/research/0bce679f.c47eaa17.full.json";
const quickPath="reports/research/874d71c3.de73734c.quick-40.json";
const baseline=JSON.parse(fs.readFileSync(baselinePath)),candidate=JSON.parse(fs.readFileSync(candidatePath));
const quick=JSON.parse(fs.readFileSync(quickPath));
assert.equal(candidate.terminal,true);
assert.equal(candidate.world.fingerprint,baseline.world.fingerprint);
assert.equal(candidate.gitCommit,quick.gitCommit);
const saves=[baseline,candidate].map(r=>JSON.parse(fs.readFileSync(r.savePath)));
const states=saves.map(s=>JSON.parse(s.committedState));
assert.deepEqual(saves[1].replaySteps.slice(0,40),JSON.parse(fs.readFileSync(quick.savePath)).replaySteps);
for(let i=0;i<2;i++){
  assert.equal(states[i].match.finalScoringSettled,true);
  assert.deepEqual(Object.fromEntries(states[i].match.finalScores.map(s=>[s.playerId,s.totalScore])),[baseline,candidate][i].summary.scores);
}
const identities = state => Object.fromEntries(Object.entries(state.aliens.aliens).map(([id,slot])=>[id,slot.assignedAlienId]));
assert.deepEqual(identities(states[1]),identities(states[0]),"预定两物种身份须一致；不要求痕迹或揭示时机相同");
for(const species of ["amiba","chong"]) assert.deepEqual(states[1].aliens[species].initialConfiguration,states[0].aliens[species].initialConfiguration);
let firstDifference=null;
for(let i=0;i<Math.max(...saves.map(s=>s.replaySteps.length));i++){
  const [a,b]=saves.map(s=>s.replaySteps[i]);
  if(JSON.stringify(a)!==JSON.stringify(b)){
    firstDifference={step:i+1,baseline:a||null,candidate:b||null,
      lastStrategicSearch:[baseline,candidate].map(r=>r.metrics.searches.filter(s=>s.kind==="strategic"&&s.step<=i+1).at(-1))};
    break;
  }
}
const statistics = r => {
  const all=r.metrics.searches,strategic=all.filter(s=>s.kind==="strategic");
  const truncated=s=>Object.values(s.diagnostics.budgetLimits||{}).some(limit=>limit.enabled&&limit.truncated);
  return {steps:r.steps,scores:r.summary.scores,avgScore:r.summary.avgScore,recordWallMs:r.wallMs,
    strategicSearches:strategic.length,nodes:all.reduce((n,s)=>n+s.diagnostics.executedNodeCount,0),
    strategicTruncated:strategic.filter(truncated).length,controlTruncated:all.filter(s=>s.kind==="control"&&truncated(s)).length,
    executionTruncated:all.filter(s=>s.diagnostics.budgetLimits?.execution?.truncated).length,
    frontierTruncated:all.filter(s=>s.diagnostics.budgetLimits?.frontier?.truncated).length,
    failures:all.flatMap(s=>Object.entries(s.diagnostics.failedNodeCountByCode||{}).filter(([,n])=>n>0).map(([code,count])=>({step:s.step,code,count})))};
};
const result={baselinePath,candidatePath,quickPath,world:candidate.world,baseline:statistics(baseline),candidate:statistics(candidate),
  combinedWallMs:{baseline:928501,candidate:candidate.wallMs+quick.wallMs},scoreDelta:candidate.summary.avgScore-baseline.summary.avgScore,
  firstDifference,scope:"同初始世界、同正式终局口径；整局路线改变后的时间差不能全部归于本项局部优化。"};
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({output,baseline:result.baseline,candidate:result.candidate,combinedWallMs:result.combinedWallMs,scoreDelta:result.scoreDelta,firstDifferenceStep:firstDifference?.step}));
