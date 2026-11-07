'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [control,output]=process.argv.slice(2),q=JSON.parse(fs.readFileSync(control)),seatId='player-white',seed='seti-free-analyze-v1';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
const rows={};try{
 for(const [label,v] of Object.entries(q.rows)){
  const origin=v.analyzed.e;assert(c.lifecycle.restore(origin).ok);assert.deepEqual(save(),origin);
  let continuation=null,stop=null;
  const accepted=[];
  while(accepted.length<80){
   const envelope=save(),state=JSON.parse(envelope.committedState);
   assert.equal(state.turn.roundNumber,3);assert(state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id)));
   const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
   let result,ms,action;try{
    const at=performance.now(),root=p.openRoot();
    result=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS,planContinuation:continuation});
    ms=performance.now()-at;
    action=root.legalActions.find(a=>a.actionId===result.actionId);assert.deepEqual(save(),envelope);
   }finally{p.close();}
   // Every root, including an unsubmitted refusal, keeps the actual budget evidence.
   if(!result.complete||result.unresolved.length||result.diagnostics.nativeExecutions>256||ms>600){
    stop={reason:'native-gate',envelope,ms,native:result.diagnostics.nativeExecutions,action,search:result};break;
   }
   if(action.family==='pass'){stop={reason:'pass-before-settlement',envelope,ms,native:result.diagnostics.nativeExecutions,action};break;}
   const d=c.inspect().session?.decision,real=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===action.actionId);
   assert(real);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:real})
    :real.phase==='quick'?c.inputPort.submitQuickAction(real):c.inputPort.submitAction(real);assert(r.ok);
   accepted.push({action,ms,native:result.diagnostics.nativeExecutions,value:result.value});
   // A new cold port must recompute certificates on restore.
   continuation=null;
  }
  assert(stop);
  const s=JSON.parse(stop.envelope.committedState),p=s.players.players.find(p=>p.id===seatId);
  rows[label]={accepted,stop,score:p.resources.score,income:p.income,resources:p.resources,tech:p.techState,hand:p.hand.map(c=>c.cardId)};
  console.log(label,stop.reason,accepted.length,stop.action?.summary,stop.native,stop.ms,p.resources.score,p.income,p.techState.ownedTiles);
 }
 fs.writeFileSync(output,JSON.stringify({source:control,rows,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
