'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const [source,output]=process.argv.slice(2),q=JSON.parse(fs.readFileSync(source)),seed='seti-free-analyze-v1',seatId='player-white';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});const c=k.composition,rows={};
try{
 for(const [label,ref] of Object.entries(q.decisionRoots)){
  assert(c.lifecycle.restore(ref.envelope).ok);assert.deepEqual(c.lifecycle.save().envelope,ref.envelope);
  const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
  try{
   const t=performance.now(),root=p.openRoot(),search=searchDecision({port:p,root,evaluate,budget:BUDGET,modelKey:evaluate.modelKey,...OPTIONS}),ms=performance.now()-t;
   assert.deepEqual(c.lifecycle.save().envelope,ref.envelope);
   const d=search.diagnostics;
   rows[label]={complete:search.complete,ms,native:d.nativeExecutions,value:search.value,actionId:search.actionId,choice:root.legalActions.find(a=>a.actionId===search.actionId)?.summary,
    baseline:{ms:ref.ms,native:ref.search.diagnostics.nativeExecutions,actionId:ref.search.actionId,value:ref.search.value},search};
   console.log(label,rows[label].choice,search.value,d.nativeExecutions,ms);
  }finally{p.close();}
 }
 fs.writeFileSync(output,JSON.stringify(rows,null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
