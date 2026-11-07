'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),gzip=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const value=require('../randomizer/game/ai/state-value'),probe=require('../randomizer/game/ai/probe-capital'),ready=require('../randomizer/game/ai/ready-analysis-capital');
const [rootFile,routeFile,coldFile,out]=process.argv.slice(2),read=f=>JSON.parse(fs.readFileSync(f)),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const f=read(rootFile),route=read(routeFile),cold=read(coldFile),seat=f.seatId,seed=f.source.seed;
assert.equal(sha(rootFile),cold.fixtureSha256);assert.equal(sha(rootFile),route.amiba3FixtureSha256);assert.equal(sha(cold.rawPath),cold.rawSha256);
const r=JSON.parse(gzip.gunzipSync(fs.readFileSync(cold.rawPath))),source=cold.rootActions.filter(a=>['amiba_0.webp','amiba_3.webp'].includes(a.summary));
assert.equal(cold.nativeInputs,92);assert(cold.complete&&cold.decisionGatePassed&&cold.rootAndRngUnchanged);
const candidates=source.map(a=>{const root=r.roots.find(x=>x.actionId===a.actionId);const line=r.lines[root.target];return {name:a.summary,action:a.actionId,value:root.value,steps:line.edges.map(e=>({action:e.actionId,status:r.lines[e.target].status,value:r.lines[e.target].value,plans:r.lines[e.target].resourcePolicy?.plans??[],tails:r.lines[e.target].edges.map(x=>x.actionId)}))};});
assert.deepEqual(candidates.map(c=>c.value),[153.5,160.5]);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const save=()=>c.lifecycle.save().envelope, restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
const submit=id=>{const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(x=>x.actionId===id&&x.actorId===seat);assert(a,id);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);};
function capture(label){const p=createAnalysisPort({composition:c,seatId:seat}),state=save();try{
 const o=p.openRoot().observation,pl=o.publicState.players.find(a=>a.playerId===seat),facts={...probe.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,
  researchCost:pl.researchPublicityCost,computerSlots:pl.dataProgress.computerSlots,analyzeEnergyCost:ready.energyCost(pl.industryAbilityId),reservedCards:o.selfState.reservedCards};
 const v=value.evaluateStateValue(o,seat),portfolio=value.purposeCapital(facts);assert.deepEqual(save(),state);
 return {label,value:v.total,components:v.components,analysis:portfolio.analysisPlan,computerSlots:facts.computerSlots,pool:pl.availableData,credits:pl.credits,energy:pl.energy,
  publicity:pl.publicity,knownHand:o.selfState.hand.map(c=>[c.id,c.cardId])};
 }finally{p.close();}}
const rows=[];
try{
 const path=route.rows.find(q=>q.name==='amiba0-r179-money-preserve').path;restore(f.compositionEnvelope);rows.push(capture('root'));
 for(const [n,s] of path.slice(0,14).entries()){
  submit(s.id);if([1,5,6,9,12,13].includes(n))rows.push(capture(`input-${n+1}:${s.summary}`));
 }
 restore(f.compositionEnvelope);const before=route.rows.find(q=>q.name==='amiba0-r179-money-reverse').path;
 for(const s of before.slice(0,3))submit(s.id);rows.push(capture('yellow-Amiba3-before-Amiba0'));
 restore(f.compositionEnvelope);
 const actual=read('reports/research/13798912.de90ae74.quick-400.json');const saveActual=read(actual.savePath);for(const e of saveActual.replaySteps.slice(178,181))submit(e.action.actionId);
 rows.push(capture('actual-blue-Amiba3'));restore(f.compositionEnvelope);
 if(out)fs.writeFileSync(out,JSON.stringify({rootFile,rootSha256:sha(rootFile),routeFile,routeSha256:sha(routeFile),coldFile,coldSha256:sha(coldFile),rows,candidates,rootAndRngRestored:true,policyQueries:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({candidates,rows:rows.map(x=>[x.label,x.value,x.components.analysisPotential,x.analysis?.reason,x.pool,x.computerSlots,x.knownHand])}));
}finally{c.dispose();}
