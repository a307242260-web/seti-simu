'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {searchDecision}=require('../randomizer/game/ai/decision-search'),{BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [witness,output]=process.argv.slice(2),q=JSON.parse(fs.readFileSync(witness)),s=q.source.e,steps=q.rows['a2-to-income-keep-a5'].steps;
const seed='seti-free-analyze-v1',seatId='player-white',k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope,v=createStateValueEvaluator(seatId);
try{
 assert(c.lifecycle.restore(s).ok);assert.deepEqual(save(),s);const rows=[];
 for(const x of steps){
  const e=save(),port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
   const t=performance.now(),root=port.openRoot(),search=searchDecision({port,root,evaluate:v,modelKey:v.modelKey,budget:BUDGET,...OPTIONS});
   assert.deepEqual(save(),e);
   const a=root.legalActions.find(a=>a.actionId===search.actionId),entry=search.lines[0];
   rows.push({e,search,actual:a,expected:x,ms:performance.now()-t});
   console.log(x.family,x.summary,'vs',a.summary,search.value,search.diagnostics.nativeExecutions,JSON.stringify({r:entry.resourcePolicy?.plans?.map(p=>[p.goal.id,p.goal.incomeCardId]),c:entry.resourcePolicy?.recoveredDataOrder,policy:entry.localPlan,edges:entry.edges.map(e=>[e.actionId,e.resourcePlan?.id,e.turnTailPlanValue?.kind])}));
  }finally{port.close();}
  const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(y=>y.actionId===x.actionId);assert.deepEqual(a,x);
  const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
 }
 assert.deepEqual(save(),q.rows['a2-to-income-keep-a5'].analyzed.e);
 assert(c.lifecycle.restore(s).ok);assert.deepEqual(save(),s);
 fs.writeFileSync(output,JSON.stringify({rows,rootRestored:true},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
