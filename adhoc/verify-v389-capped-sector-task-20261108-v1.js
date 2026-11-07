'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const [fixture,out]=process.argv.slice(2),seed='seti-free-analyze-v1',seat='player-white';
const captured=fs.readFileSync(fixture,'utf8').trim().split('\n').map(JSON.parse),taskId='card-15-0';
function kernel(){
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
   projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
 k.newGame({seed});return k.composition;
}
const c=kernel(),independent=kernel(),save=(k=c)=>k.lifecycle.save().envelope;
const get=e=>e.session?.session?.workingState||JSON.parse(e.committedState);
const owner=s=>s.players.players.find(p=>p.id===seat);
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=(k=c)=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(a,k=c){
 assert.deepEqual(menu(k).find(q=>q.actionId===a.actionId),a);
 const d=k.inspect().session?.decision,r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
   a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
const task=a=>a.family==='complete_task'&&a.target.cardInstanceId===taskId;
const cap=captured.find(row=>{
 if(owner(get(row.before)).resources.publicity!==10)return false;
 restore(row.before);
 const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  port.setResourcePlanning(true);port.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});port.setCardPickPlanning(true);
  return !!port.resourceSpec(port.openRoot())?.deferredCappedTask;
 }finally{port.close();}
});
const room=captured.find(row=>owner(get(row.before)).resources.publicity===7);
assert(cap&&room);
const different=structuredClone(cap.before),altered=get(different),a=altered.finalScoring.tiles.a.marks;
altered.finalScoring.tiles.c.marks.push({...a.splice(a.findIndex(x=>x.playerId===seat),1)[0],tileId:'c'});
altered.finalScoring.tileVariants.c=1;different.committedState=JSON.stringify(altered);
const policy={};
try{
 for(const [name,origin,expect] of [['capped',cap.before,true],['uncapped',room.before,false],['marked-task-score',different,false]]){
  restore(origin);
  const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),ev=createStateValueEvaluator(seat),at=performance.now();
  try{
   p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});p.setCardPickPlanning(true);
   const root=p.openRoot(),desc=p.resourceSpec(root);
   assert(root.legalActions.some(task));
   assert.equal(Boolean(desc?.deferredCappedTask),expect);
   const result=searchDecision({port:p,root,evaluate:ev,modelKey:ev.modelKey,budget:BUDGET,...OPTIONS});
   assert(result.complete&&!result.unresolved.length);assert.deepEqual(save(),origin);
   policy[name]={origin,deferred:desc?.deferredCappedTask||null,actionId:result.actionId,value:result.value,ms:performance.now()-at,
    native:result.diagnostics.nativeExecutions,originalTaskId:root.legalActions.find(task).actionId,search:result};
  }finally{p.close();}
 }
 const witness={};let sharedTech=null;
 for(const defer of [false,true]){
  restore(cap.before);const steps=[];
  const choose=test=>{
   const a=menu().find(test);assert(a,JSON.stringify(menu().map(q=>[q.family,q.target,q.summary])));
   assert(steps.length<8);steps.push(a);submit(a);return a;
  };
  if(!defer)choose(task);
  choose(a=>a.family==='end_turn');
  if(defer)choose(a=>a.family==='accept_optional_effect'&&a.target.choiceId?.startsWith('skip:task:'+taskId));
  const beforeResearch=save();
  choose(a=>a.family==='research_tech');
  const tile=choose(a=>a.family==='choose_target'&&a.target.tileId&&(sharedTech==null||a.target.tileId===sharedTech));
  sharedTech=tile.target.tileId;
  if(defer)choose(task);
  const end=save();
  restore(cap.before,independent);for(const a of steps)submit(a,independent);
  assert.deepEqual(save(independent),end);
  witness[defer?'defer':'claim-now']={steps,beforeResearch,end};
 }
 const early=get(witness['claim-now'].end),late=get(witness.defer.end),p=owner(early),q=owner(late);
 assert.deepEqual(early.meta.rngState,late.meta.rngState);
 assert.equal(q.resources.publicity-p.resources.publicity,3);
 const noPublicity=x=>({...x,resources:{...x.resources,publicity:0}});
 assert.deepEqual(noPublicity(p),noPublicity(q));
 for(const k of ['cards','tech','aliens','data','pieces','solarSystem','turn'])assert.deepEqual(early[k],late[k],k);
 restore(cap.before);
 fs.writeFileSync(out,JSON.stringify({rootRestored:true,policy,witness,sharedTech,publicitySaved:3,
   independentStateSessionRng:true,notStandardExperiment:true},null,2)+'\n',{flag:'wx'});
 console.log(sharedTech,'same state after payout except +3 publicity and bookkeeping',Object.fromEntries(Object.entries(policy).map(([k,v])=>[k,[!!v.deferred,v.native,v.value]])));
}finally{c.dispose();independent.dispose();}
