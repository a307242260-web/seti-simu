'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),directory=path.join(repo,'reports/ai-foundation-20261119');
const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name)));
const m=read('blue-income-forecast-prototype-preflight-20261119-v1.json');
const source=m.sourceRuntime,candidate=m.runtime;
const oldValue=require(path.join(source,'randomizer/game/ai/state-value'));
const newValue=require(path.join(candidate,'randomizer/game/ai/state-value'));
const probe=require(path.join(source,'randomizer/game/ai/probe-capital'));
const arithmetic=require(path.join(source,'randomizer/game/ai/value-arithmetic'));
const ready=require(path.join(candidate,'randomizer/game/ai/ready-analysis-capital'));
const {createSeededRandom}=require(path.join(source,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(source,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(source,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(source,'randomizer/game/ai/analysis-port'));
const seed='seti-free-analyze-v1',seatId='player-white',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const kernel=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)}),c=kernel.composition;
const report={sourceCommit:m.sourceCommit,candidateChangedFiles:m.candidateChangedFiles,newNativeInputs:0,newAISearches:0,newAutonomousGames:0,productionChanged:false,stages:[],counterexamples:[]};
const observations=new Map();
function facts(observation){
 const player=observation.publicState.players.find(p=>p.playerId===seatId);
 return{...probe.factsFromObservation(observation,seatId),supply:observation.publicState.board.techSupply,researchCost:player.researchPublicityCost,
  computerSlots:player.dataProgress.computerSlots,analyzeEnergyCost:ready.energyCost(player.industryAbilityId),reservedCards:observation.selfState.reservedCards};
}
function values(o){const before=oldValue.evaluateStateValue(o,seatId),after=newValue.evaluateStateValue(o,seatId);return{before,after,delta:arithmetic.sum([after.total,-before.total])};}
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});
 for(const [label,name]of [
  ['blue1-after-tech','r2-blue-cash-blue1-checkpoint-20261119-v1.json.gz'],
  ['blue1-after-dlc37','r2-blue-cash-continued-blue1-after-dlc37-checkpoint-20261119-v1.json.gz'],
  ['blue1-after-continuation','r2-blue-cash-continued-blue1-checkpoint-20261119-v1.json.gz'],
  ['blue3-after-tech','r2-blue-cash-blue3-checkpoint-20261119-v1.json.gz'],
  ['blue3-after-dlc37','r2-blue-cash-continued-blue3-after-dlc37-checkpoint-20261119-v1.json.gz'],
  ['blue3-after-continuation','r2-blue-cash-continued-blue3-checkpoint-20261119-v1.json.gz']]){
  const env=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(directory,name)))).envelope;
  assert(c.lifecycle.restore(env).ok);assert.deepEqual(c.lifecycle.save().envelope,env);
  const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{const o=port.openRoot().observation;observations.set(label,o);report.stages.push({label,...values(o)});assert.equal(port.getDiagnostics().submissionCount,0);}
  finally{port.close();}
  assert.deepEqual(c.lifecycle.save().envelope,env);
 }
 const target=observations.get('blue1-after-dlc37'),targetFacts=facts(target);
 report.targetFacts={computerSlots:targetFacts.computerSlots,nextFinalMark:targetFacts.nextFinalMark,pendingNativeEffects:targetFacts.pendingNativeEffects,
  publicCards:targetFacts.board.publicCards,extraUnknownCount:targetFacts.extraUnknownCount,ordinaryDrawCount:targetFacts.board.ordinaryDrawCount};
 // The real base portfolio is used; an identity portfolio would hide double counting.
 report.targetPurpose=newValue.purposeCapital(targetFacts);
 for(const [name,mutate]of [
  ['publicity-below-cost',o=>{o.publicState.players.find(p=>p.playerId===seatId).publicity=2;}],
  ['no-known-offers',o=>{o.publicState.board.publicCards=[];}],
  ['insufficient-data',o=>{o.publicState.players.find(p=>p.playerId===seatId).availableData=2;}],
 ]){const o=structuredClone(target);mutate(o);report.counterexamples.push({name,...values(o)});}
 for(const [name,mutate]of [
  ['held-card',f=>{f.hand=[observations.get('blue3-after-dlc37').selfState.hand[0]];f.player.handSize=1;}],
  ['pending-native',f=>{f.pendingNativeEffects=true;}],
  ['revealed-species',f=>{f.board.aliens.slots[0].revealed=true;}],
  ['noncontiguous-computer',f=>{f.computerSlots=[1,2,4];}],
 ]){
  const f=structuredClone(targetFacts);mutate(f);
  const quote=ready.quote(f,arithmetic.DEFAULT_WEIGHTS,()=>0,0);
  report.counterexamples.push({name,quote});
 }
 const sourceHashesUnchanged=Object.entries(m.sourceFiles).every(([name,digest])=>crypto.createHash('sha256').update(fs.readFileSync(path.join(source,name))).digest('hex')===digest);
 assert(sourceHashesUnchanged);report.sourceHashesUnchanged=true;
 report.targetsMatched=report.stages.filter(s=>s.label.startsWith('blue1')).every(s=>s.after.total===99.5);
 report.blue3Unchanged=report.stages.filter(s=>s.label.startsWith('blue3')).every(s=>s.delta===0);
 report.counterexamplesUnchanged=report.counterexamples.every(t=>t.delta===undefined?t.quote.value===0:t.delta===0);
}catch(error){report.error={name:error.name,message:error.message,stack:error.stack};}
finally{c.dispose();}
const suffix=process.argv[2]||'v1';assert(/^v\d+$/.test(suffix));
const output=path.join(directory,`blue-income-forecast-prototype-diagnostics-20261119-${suffix}.json`);
assert(!fs.existsSync(output));fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({error:report.error,stages:report.stages.map(s=>({label:s.label,before:s.before.total,after:s.after.total,analysis:s.after.components.analysisPotential})),targetFacts:report.targetFacts,targetPurpose:report.targetPurpose,
 counterexamples:report.counterexamples.map(t=>({name:t.name,delta:t.delta,reason:t.quote?.reason})),targetsMatched:report.targetsMatched,blue3Unchanged:report.blue3Unchanged,counterexamplesUnchanged:report.counterexamplesUnchanged}));
