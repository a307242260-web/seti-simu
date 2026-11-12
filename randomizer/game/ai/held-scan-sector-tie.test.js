'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const fixture=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/r3-held-scan-sector-tie-20261113-v1.json.gz'))));
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
  const result=decision?c.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:seatId,choice:action})
    :c.inputPort.submitAction(action);
  assert(result.ok);
}
try{
  assert(c.lifecycle.restore(fixture.root).ok);
  let checkpoint;
  for(const expected of fixture.actions){
    const current=decide(checkpoint);
    assert.deepEqual(current.action,expected);
    if(expected.family==='scan'){
      apply(current);
      const cold=decide();
      assert.equal(cold.action.target.nebulaId,'sector-4-b');
      assert.equal(cold.q.heldScanSectorChoice?.sectorId,'sector-4-b');
      assert.equal(cold.q.roots.find(r=>r.actionId===cold.action.actionId).value,
        cold.q.roots.find(r=>r.actionId===cold.q.heldScanSectorChoice.from).value);
    }else apply(current);
    checkpoint=current.checkpoint;
  }
  assert.equal(c.inspect().session,null);
  const negative=structuredClone(fixture.root),state=JSON.parse(negative.committedState);
  state.players.players.find(p=>p.id===seatId).income.credits=2;
  negative.committedState=JSON.stringify(state);
  assert(c.lifecycle.restore(negative).ok);
  apply({action:fixture.actions[0]});
  const cold=decide();
  assert.equal(cold.q.heldScanSectorChoice,undefined);
  assert.equal(cold.action.target.nebulaId,'sector-1-a');
}finally{c.dispose();}
