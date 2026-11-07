'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{searchDecision}=require('../randomizer/game/ai/decision-search'),{BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [source,late,early,controls,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const origin=read(source)['post-analysis-unfunded'].search,seed='seti-free-analyze-v1',seatId='player-white',evaluate=createStateValueEvaluator(seatId);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(pred){
 const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({}),a=menu.find(pred);
 assert(a,JSON.stringify(menu.map(a=>[a.family,a.summary,a.target])));
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
function view(){
 const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seatId),obs=buildRuleObservation(s,seed,seatId);
 return{e,wallet:p.resources,hand:p.hand.map(c=>[c.id,c.cardId]),income:p.income,tech:p.techState,final:obs.publicState.players.find(v=>v.playerId===seatId).finalScore,
  model:evaluate.details(obs),probes:s.pieces.rockets.filter(r=>r.playerId===seatId)};
}
try{
 const l=read(late),e=read(early),q=read(controls),f=q.analyzed.e;
 function check(start,actions,expected){
  restore(start);for(const a of actions)assert.deepEqual(act(x=>x.actionId===a.actionId),a);
  assert.deepEqual(save(),expected);return view();
 }
 const direct=check(l.origin,l.actions,l.endpoint.e);
 const prepared=check(e.origin,e.actions,e.prepared.e);
 assert.deepEqual(q.origin,e.prepared.e);
 const earlyEnd=check(e.origin,[...e.actions,...q.actions],q.endpoint.e);
 const same=d=>assert(d.income.credits===7&&d.income.energy===4&&Object.keys(d.tech.ownedTiles).length===6&&d.probes.length===1);
 same(direct);same(earlyEnd);
 function cold(envelope){
  restore(envelope);const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
   const root=p.openRoot(),r=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
   assert(r.complete&&!r.unresolved.length);assert.deepEqual(save(),envelope);
   return r;
  }finally{p.close();}
 }
 const oldSearch=origin,actual=cold(f),plan=actual.lines[0].edges.find(a=>a.resourcePlan?.goal.kind==='income');
 assert.deepEqual(plan.steps,oldSearch.lines[0].edges.find(a=>a.resourcePlan?.goal.kind==='income').steps);
 assert.equal(plan.steps.length,10);assert.equal(plan.resourcePlan.goal.incomeCardId,'card-65-0');
 const state=JSON.parse(f.committedState),pile=state.cards.drawPileCardIds;[pile[0],pile[1]]=[pile[1],pile[0]];
 const hidden={...f,committedState:JSON.stringify(state)},shuffled=cold(hidden);
 const sig=r=>JSON.stringify(r,(k,v)=>k==='milliseconds'?undefined:v);
 assert.equal(sig(actual),sig(shuffled));
 restore(f);const actions=plan.steps.map(id=>act(a=>a.actionId===id)),income=view();
 assert.equal(income.income.credits,8);assert.equal(income.income.energy,3);
 assert.equal(actions[0].target.cardInstanceId,'alien-amiba-2-14');
 assert.equal(actions.at(-1).target.cardInstanceId,'card-65-0');
 check(f,actions,income.e);restore(f);
 fs.writeFileSync(output,JSON.stringify({direct,prepared,earlyEnd,income,actions,hiddenParity:true,rootAndRngRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 for(const [k,v] of Object.entries({direct,prepared,earlyEnd,income}))console.log(k,v.wallet.score,v.income.credits,v.income.energy,v.probes.length,v.final);
}finally{c.dispose();}
