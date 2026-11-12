'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');

const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-141-20261105-v1.checkpoint.json')));
const origin=fixture.coreState.compositionEnvelope,seatId='player-white',seed=JSON.parse(origin.committedState).meta.seed;
const runtime=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId,[],
    {cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true})});
runtime.newGame({seed});
const c=runtime.composition,save=()=>c.lifecycle.save().envelope;
function decide(checkpoint){
 const before=save(),decision=c.inspect().session.decision,legalActions=decision.choices;
 const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const ai=createSearchAgent({seatId,analysisPort:port});
  if(checkpoint)ai.loadCheckpoint(checkpoint);
  const result=ai.decide({seatId,legalActions}).search,choice=legalActions.find(a=>a.actionId===result.actionId);
  assert(choice&&result.complete&&!result.unresolved.length&&result.diagnostics.nativeExecutions<=256);
  assert.deepEqual(save(),before);
  return {choice,result,checkpoint:structuredClone(ai.createCheckpoint())};
 }finally{port.close();}
}
try{
 assert(c.lifecycle.restore(origin).ok);
 const scan=c.inputPort.enumerateActions({}).find(a=>a.family==='scan');
 assert(c.inputPort.submitAction(scan).ok);
 const earth=decide(),menu=c.inspect().session.decision;
 assert.equal(earth.choice.target.nebulaId,'sector-1-a');
 assert(c.inputPort.submitDecision({decisionId:menu.decisionId,decisionVersion:menu.decisionVersion,ownerId:seatId,choice:earth.choice}).ok);

 const cold=decide(),reused=decide(earth.checkpoint);
 const targets=c.inspect().session.decision.choices.filter(a=>a.target.cardInstanceId===cold.choice.target.cardInstanceId);
 assert.equal(targets.length,2);
 const quotes=targets.map(a=>cold.result.roots.find(r=>r.actionId===a.actionId));
 assert(quotes.every(r=>r.completion==='complete'));
 assert.equal(quotes[0].value,quotes[1].value,'both placements can take the same independent funded follow-up');
 assert.equal(cold.choice.target.nebulaId,'sector-1-a');
 assert.deepEqual(reused.choice,cold.choice,'the certified plan must preserve the same public-card choice as a cold restore');
 assert.equal(reused.result.diagnostics.nativeExecutions,0);
}finally{c.dispose();}
