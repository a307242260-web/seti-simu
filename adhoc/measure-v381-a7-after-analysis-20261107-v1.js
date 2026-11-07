'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [origins,path,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const seatId='player-white',seed='seti-free-analyze-v1',start=read(origins).rows['amiba0-computer-only'].analyzed.e;
const q=read(path).rows,trace=Object.keys(q).find(k=>k.startsWith('amiba0-computer-only')&&k.includes('蓝4')&&!k.includes('keep-A7'));
const steps=q[trace].analyzed.actions,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
try{
 assert(c.lifecycle.restore(start).ok);assert.deepEqual(save(),start);
 const rows=[];
 for(let i=0;i<steps.length;i++){
  const expected=steps[i],envelope=save(),d=c.inspect().session?.decision;
  if(i>=5&&!d){
   const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
   try{
    const at=performance.now(),root=port.openRoot(),search=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
    const ms=performance.now()-at,model=evaluate.details(root.observation),natives=search.diagnostics.nativeExecutions;
    assert.deepEqual(save(),envelope);
    rows.push({i,envelope,natives,ms,model,actions:root.legalActions,search});
    console.log(i,ms,natives,search.roots.filter(r=>r.value!=null).map(r=>[r.goal?.id,root.legalActions.find(a=>a.actionId===r.actionId)?.summary,r.value,r.realization]));
   }finally{port.close();}
  }
  const a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===expected.actionId);
  assert.deepEqual(a,expected);
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(result.ok);
 }
 assert.deepEqual(save(),q[trace].analyzed.e);
 fs.writeFileSync(output,JSON.stringify({rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
