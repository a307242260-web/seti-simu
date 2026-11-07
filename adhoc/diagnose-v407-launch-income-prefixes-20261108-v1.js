'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=load('randomizer/game/ai/state-value'),search=load('randomizer/game/ai/decision-search'),agent=load('randomizer/game/ai/search-agent');
const [source,out]=process.argv.slice(2),ref=read(source),base=ref.base,seat='player-white',seed=JSON.parse(base.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
try{
 restore(base);const fixtures={},rows={};
 for(let i=0;i<ref.fixed.length;i++){
  const wanted=ref.fixed[i].action;
  if([0,1,2,3,5,6,7,8,9,10,11,15,19].includes(i)){
   const e=save(),p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seat);
   try{
    const t=performance.now(),root=p.openRoot(),r=search.searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET}),ms=performance.now()-t;
    assert.deepEqual(save(),e);
    const chosen=menu().find(a=>a.actionId===r.actionId);assert(chosen);
    const offer=r.actionOutcomes?.find?.(x=>x.actionId===wanted.actionId);
    const shown=r.rootAlternatives?.find?.(x=>x.actionId===wanted.actionId);
    rows[i]={chosen,wanted,ms,offer,shown,r,legal:menu()};
    fixtures[i]={seatId:seat,source:{seed},compositionEnvelope:e};
   }finally{p.close();}
  }
  act(wanted);
 }
 assert.deepEqual(save(),ref.incomeAt);restore(base);
 const summary=Object.fromEntries(Object.entries(rows).map(([i,x])=>[i,{chosen:x.chosen.summary,wanted:x.wanted.summary,
  same:x.chosen.actionId===x.wanted.actionId,value:x.r.value,native:x.r.diagnostics.nativeExecutions,ms:x.ms,complete:x.r.complete,unresolved:x.r.unresolved.length}]));
 fs.writeFileSync(out,JSON.stringify({scope:'Exact existing Orange1 launch continuation checkpoints, V406 single-root choices only. Fixed reference played with Production Native, not a new game.',summary,rows,fixtures,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
