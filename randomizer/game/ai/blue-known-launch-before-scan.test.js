'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const fixture=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/r4-blue-known-launch-before-scan-20261113-v1.json.gz'))));
const seatId='player-white',seed=JSON.parse(fixture.root.committedState).meta.seed;
const runtime=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId,[],{cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true})});
runtime.newGame({seed});
const c=runtime.composition,save=()=>c.lifecycle.save().envelope;
function decide(checkpoint){
  const before=save(),decision=c.inspect().session?.decision,legalActions=decision?.choices||c.inputPort.enumerateActions({});
  const analysisPort=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
    const agent=createSearchAgent({seatId,analysisPort});
    if(checkpoint)agent.loadCheckpoint(checkpoint);
    const q=agent.decide({seatId,legalActions}).search;
    assert(q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256);
    assert.deepEqual(save(),before);
    return {q,decision,action:legalActions.find(a=>a.actionId===q.actionId),checkpoint:structuredClone(agent.createCheckpoint())};
  }finally{analysisPort.close();}
}
function apply({action,decision}){
  const r=decision?c.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:seatId,choice:action})
    :c.inputPort.submitQuickAction(action);
  assert(r.ok);
}
try{
  for(const warm of [false,true]){
    assert(c.lifecycle.restore(fixture.root).ok);
    let checkpoint;
    for(const [i,action] of fixture.choices.entries()){
      const current=decide(checkpoint);
      assert.deepEqual(current.action,action);
      assert.equal(current.q.value,193.5);
      if(warm&&i)assert.equal(current.q.diagnostics.nativeExecutions,0);
      else assert.equal(current.q.blueLaunchContinuation?.value,193.5);
      apply(current);
      checkpoint=warm?current.checkpoint:undefined;
    }
    assert.deepEqual(save(),fixture.ready);
  }
  const variant=(mutate)=>{
    const e=structuredClone(fixture.root),s=JSON.parse(e.committedState);
    mutate(s);e.committedState=JSON.stringify(s);
    assert(c.lifecycle.restore(e).ok);return decide();
  };
  const hidden=variant(s=>{const pile=s.cards.drawPileCardIds;[pile[0],pile[1]]=[pile[1],pile[0]];});
  assert.equal(hidden.q.blueLaunchContinuation?.value,193.5);
  assert.deepEqual(hidden.action,fixture.choices[0]);
  const short=variant(s=>{s.players.players.find(p=>p.id===seatId).resources.credits=5;});
  assert.equal(short.q.blueLaunchContinuation,undefined);
  assert.equal(short.action.summary,'b_9.webp');
}finally{c.dispose();}
