'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const fixture=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/r3-income-payment-alternative-20261112-v1.json.gz'))));
const seat='player-white',seed=JSON.parse(fixture.prefix.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId,[],{cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true})});
k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope;
const restore=root=>{assert(c.lifecycle.restore(root).ok);assert.deepEqual(save(),root);};

function decide(checkpoint){
 const before=save(),decision=c.inspect().session?.decision;
 const legalActions=decision?.choices||c.inputPort.enumerateActions({});
 const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  const agent=createSearchAgent({seatId:seat,analysisPort:p});
  if(checkpoint)agent.loadCheckpoint(checkpoint);
  const q=agent.decide({seatId:seat,legalActions}).search;
  assert(q.complete&&!q.unresolved.length);
  assert(q.diagnostics.nativeExecutions<=256);
  assert.deepEqual(save(),before);
  return {q,legalActions,decision,checkpoint:structuredClone(agent.createCheckpoint())};
 }finally{p.close();}
}

function checkIncome({q,legalActions}){
 const electric=legalActions.find(a=>a.summary==='收入 b_14.webp');
 const cash=legalActions.find(a=>a.summary==='收入 amiba_7.webp');
 assert.equal(q.actionId,electric.actionId);
 const roots=[electric,cash].map(a=>q.roots.find(r=>r.actionId===a.actionId));
 assert(roots.every(r=>r?.completion==='complete'));
 assert.equal(roots[0].value,roots[1].value);
 assert(q.diagnostics.nativeExecutions<=3);
}

try{
 restore(fixture.income);
 checkIncome(decide());
 restore(fixture.negative);
 const control=decide();
 assert.equal(control.legalActions.find(a=>a.actionId===control.q.actionId).summary,'收入 dlc_32.png');

 // Follow the actual fixed data plan across separate Native inputs and ports.
 // The old commitment can name cash without ever pricing the payment alternative.
 restore(fixture.prefix);
 let checkpoint;
 for(const expected of fixture.actions){
  const result=decide(checkpoint),action=result.legalActions.find(a=>a.actionId===result.q.actionId);
  assert.deepEqual(action,expected);
  checkpoint=result.checkpoint;
  const d=result.decision;
  const receipt=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action})
   :c.inputPort.submitQuickAction(action);
  assert(receipt.ok);
 }
 // Session IDs are local to each host; rule state and RNG must still match.
 const warm=save();
 assert.equal(warm.committedState,fixture.income.committedState);
 assert.deepEqual(warm.session.session.workingState,fixture.income.session.session.workingState);
 checkIncome(decide(checkpoint));
}finally{c.dispose();}
