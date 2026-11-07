'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [fixtures,output]=process.argv.slice(2),q=JSON.parse(fs.readFileSync(fixtures));
const rows={};
for(const {label,fixture,round} of q){
 const f=JSON.parse(fs.readFileSync(fixture)),{seatId}=f,{seed}=f.source;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
 const save=()=>c.lifecycle.save().envelope;
 try{
  assert(c.lifecycle.restore(f.compositionEnvelope).ok);assert.deepEqual(save(),f.compositionEnvelope);
  const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
  try{
   const root=p.openRoot();assert.equal(root.observation.publicState.roundNumber,round);
   const result=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
   assert(result.complete&&!result.unresolved.length);assert.deepEqual(save(),f.compositionEnvelope);
   const key=(k,v)=>k==='milliseconds'?undefined:typeof v==='string'?v.replace(/seti-complete-decision-search-v(?:375|381|382|383|384|385|386|387|388|389|390|391|392)/g,'candidate'):v;
   const digest=crypto.createHash('sha256').update(JSON.stringify(result,key)).digest('hex');
   rows[label]={round,fixture,action:result.actionId,value:result.value,native:result.diagnostics.nativeExecutions,digest};
  }finally{p.close();}
 }finally{c.dispose();}
}
fs.writeFileSync(output,JSON.stringify({rows,standardExperiment:false},null,2)+'\n',{flag:'wx'});
console.log(Object.keys(rows).length,'paired historical cold roots');
