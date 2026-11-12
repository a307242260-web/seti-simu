'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const fixture=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/r3-known-blue-before-blind-income-20261113-v1.json.gz'))));
const seatId='player-white',seed=JSON.parse(fixture.root.committedState).meta.seed;
const runtime=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId,[],
    {cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true})});
runtime.newGame({seed});const c=runtime.composition,save=()=>c.lifecycle.save().envelope;
const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function decide(cp){
  const before=save(),actions=legal(),p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
    const agent=createSearchAgent({seatId,analysisPort:p});
    if(cp)agent.loadCheckpoint(cp);
    const q=agent.decide({seatId,legalActions:actions}).search;
    const a=actions.find(a=>a.actionId===q.actionId);
    assert(a&&q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256);
    assert.deepEqual(save(),before);
    return {a,q,cp:structuredClone(agent.createCheckpoint())};
  }finally{p.close();}
}
function submit(a){
  assert(legal().some(x=>x.actionId===a.actionId));
  const d=c.inspect().session?.decision;
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:seatId,choice:a})
    :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(result.ok);
}
try{
  let lowData;
  for(const warm of [false,true]){
    assert(c.lifecycle.restore(fixture.root).ok);
    let checkpoint;
    for(const [i,expected] of fixture.actions.entries()){
      const {a,q,cp}=decide(warm?checkpoint:undefined);
      assert.deepEqual(a,expected);
      if(i===0){
        assert.equal(q.value,144.33333333333334);
        const research=q.roots.find(r=>r.goal?.id==='tech:blue3:3');
        assert.equal(research.completion,'complete');
        assert(research.value<q.value);
      }
      if(i===6)lowData=structuredClone(save());
      submit(a);checkpoint=cp;
    }
    assert.deepEqual(save(),fixture.after);
  }
  const known=[];
  for(const key of ['drawPileCardIds','cardDeck']){
    const root=structuredClone(fixture.root),state=JSON.parse(root.committedState);
    const pile=key==='drawPileCardIds'?state.cards[key]:state.aliens.amiba[key];
    [pile[0],pile[1]]=[pile[1],pile[0]];
    root.committedState=JSON.stringify(state);
    assert(c.lifecycle.restore(root).ok);
    const {a,q}=decide();
    known.push([a.actionId,q.value,q.diagnostics.nativeExecutions,q.roots.map(r=>[r.actionId,r.value,r.completion])]);
  }
  assert.deepEqual(known[0],known[1]);assert.equal(known[0][0],fixture.actions[0].actionId);assert.equal(known[0][1],144.33333333333334);
  const state=JSON.parse(lowData.committedState),actor=state.players.players.find(x=>x.id===seatId);
  actor.resources.availableData--;actor.dataState.poolTokens.pop();
  lowData.committedState=JSON.stringify(state);
  assert(c.lifecycle.restore(lowData).ok);
  const {q}=decide();
  assert.equal(q.lines[0].resourcePolicy.currencyBeforeBlindIncome,undefined,'the known income must remain funded after both blue slots');
}finally{c.dispose();}
