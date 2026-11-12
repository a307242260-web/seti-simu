'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const fixture=i=>JSON.parse(fs.readFileSync(path.resolve(__dirname,`../../../reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-${i}-20261105-v1.checkpoint.json`)));
const first=fixture(136),next=fixture(141),origin=first.coreState.compositionEnvelope,seatId='player-white';
const seed=JSON.parse(origin.committedState).meta.seed,simulation=createSimulationRuleComposition({
  seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId,[],
    {cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true})});
simulation.newGame({seed});
const c=simulation.composition,save=()=>c.lifecycle.save().envelope;
function legal(){return c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});}
function submit(actionId){
 const d=c.inspect().session?.decision,action=legal().find(a=>a.actionId===actionId);
 assert(action);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action})
  :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
 assert(r.ok,JSON.stringify(r));
}
function decide(checkpoint){
 const before=save(),p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const agent=createSearchAgent({seatId,analysisPort:p});if(checkpoint)agent.loadCheckpoint(checkpoint);
  const q=agent.decide({seatId,legalActions:legal()}).search,action=legal().find(a=>a.actionId===q.actionId);
  assert(action&&q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256);
  assert.deepEqual(save(),before);
  return{q,action,checkpoint:structuredClone(agent.createCheckpoint())};
 }finally{p.close();}
}
try{
 assert(c.lifecycle.restore(origin).ok);
 for(const x of next.replaySteps.slice(first.replaySteps.length,-1))submit(x.action.actionId);
 const atEnd=save(),q=decide(),swap=q.q.lines[0].cardPickPolicy.companySwap;
 const company=q.q.roots.find(r=>r.actionId===q.q.lines[0].cardPickPolicy.selectedActionId);
 const ending=q.q.roots.find(r=>r.actionId===q.action.actionId);
 assert.equal(q.action.family,'end_turn');
 assert.equal(company.completion,'complete');assert.equal(ending.completion,'proved-plan-value');
 assert.equal(company.value,ending.value,'keep the closed comparison of the optional swap and the quiet handoff');
 submit(q.action.actionId);
 assert.deepEqual(save(),next.coreState.compositionEnvelope,'the preserved swap must reach the original scan decision with exact RNG');
 let checkpoint;
 for(let i=0;i<6;i++){
  const q=decide(checkpoint);
  if(q.action.phase==='main'){assert.equal(q.action.family,'scan');break;}
  assert(i<5);submit(q.action.actionId);checkpoint=q.checkpoint;
 }
 const short=structuredClone(atEnd),state=JSON.parse(short.committedState);
 state.players.players.find(p=>p.id===seatId).resources.energy=2;
 short.committedState=JSON.stringify(state);
 assert(c.lifecycle.restore(short).ok);
 const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{assert.equal(p.canDeferCompanyIncomeForScan(p.openRoot(),swap),false,'defer only if scan and launch are already funded');}
 finally{p.close();}
}finally{c.dispose();}
