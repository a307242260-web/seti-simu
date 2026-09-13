"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="adhoc/income-choice-full-comparison-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const baselinePath="reports/research/44713766.236c6969.full.json";
const candidatePath="reports/research/ac7f0082.5ef60d81.full.json";
const quickPath="reports/research/ac7f0082.5ef60d81.quick-40.json";
const read=file=>JSON.parse(fs.readFileSync(file));
const baseline=read(baselinePath),candidate=read(candidatePath),quick=read(quickPath);
assert(candidate.terminal);assert.equal(candidate.gitCommit,quick.gitCommit);
assert.deepEqual(candidate.world,baseline.world);assert.deepEqual(candidate.world,quick.world);
const saves=[baseline,candidate].map(r=>read(r.savePath));
const states=saves.map(s=>JSON.parse(s.committedState));
assert.deepEqual(saves[1].replaySteps.slice(0,40),read(quick.savePath).replaySteps);
for(let i=0;i<2;i++){
  assert(states[i].match.finalScoringSettled);
  assert.deepEqual(Object.fromEntries(states[i].match.finalScores.map(s=>[s.playerId,s.totalScore])),[baseline,candidate][i].summary.scores);
}
const identities=s=>Object.fromEntries(Object.entries(s.aliens.aliens).map(([id,slot])=>[id,slot.assignedAlienId]));
assert.deepEqual(identities(states[0]),identities(states[1]));
for(const species of ["amiba","chong"])assert.deepEqual(states[0].aliens[species].initialConfiguration,states[1].aliens[species].initialConfiguration);
const stats=r=>{
  const searches=r.metrics.searches;
  const truncated=s=>Object.values(s.diagnostics.budgetLimits||{}).some(l=>l.enabled&&l.truncated);
  return {steps:r.steps,avgScore:r.summary.avgScore,scores:r.summary.scores,wallMs:r.wallMs,
    searchCount:searches.length,strategicCount:searches.filter(s=>s.kind==="strategic").length,
    nodes:searches.reduce((n,s)=>n+s.diagnostics.executedNodeCount,0),
    strategicTruncated:searches.filter(s=>s.kind==="strategic"&&truncated(s)).length,
    controlTruncated:searches.filter(s=>s.kind==="control"&&truncated(s)).length,
    limits:Object.fromEntries(["leaves","frontier","execution"].map(k=>[k,searches.filter(s=>s.diagnostics.budgetLimits?.[k]?.enabled&&s.diagnostics.budgetLimits[k].truncated).length])),
    failures:searches.flatMap(s=>Object.entries(s.diagnostics.failedNodeCountByCode||{}).filter(([,n])=>n>0).map(([code,count])=>({step:s.step,code,count})))};
};
let firstDifference=null;
for(let i=0;i<Math.max(...saves.map(s=>s.replaySteps.length));i++){
  const [a,b]=saves.map(s=>s.replaySteps[i]);
  if(JSON.stringify(a)!==JSON.stringify(b)){
    firstDifference={step:i+1,baseline:a,candidate:b,
      lastSearches:[baseline,candidate].map(r=>r.metrics.searches.filter(s=>s.step<=i+1).slice(-3))};break;
  }
}
const result={baselinePath,candidatePath,quickPath,world:candidate.world,
  baseline:stats(baseline),candidate:stats(candidate),firstDifference,
  scoreDelta:candidate.summary.avgScore-baseline.summary.avgScore,
  finalScoring:states.map(s=>s.match.finalScores),
  combinedWallMs:{baseline:baseline.wallMs+read("reports/research/44713766.236c6969.quick-40.json").wallMs,candidate:candidate.wallMs+quick.wallMs},
  boundary:"初始世界及正式终局一致；局部贪心改变路线，整局时间与分数变化仍须逐项归因，不等同全局最优保留。"};
assert.deepEqual(result.candidate.failures,[]);
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({output,baseline:result.baseline,candidate:result.candidate,scoreDelta:result.scoreDelta,firstDifferenceStep:firstDifference?.step}));
