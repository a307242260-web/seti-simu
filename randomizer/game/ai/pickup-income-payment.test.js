'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation'),{createSeededRandom}=require('../random');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const demand=require('./resource-demand'),native=require('../production-kernel');
const file=path.resolve(__dirname,'../../../reports/ai-foundation-20261112/human405-pickup-income-v1/teacher-pickup-income-roots-20261112-v1.json.gz');
const {roots}=JSON.parse(zlib.gunzipSync(fs.readFileSync(file))),seatId='player-white';
for(const {step,envelope} of roots){
  const seed=JSON.parse(envelope.committedState).meta.seed;
  const host=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
    projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId||null,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
  host.newGame({seed});const c=host.composition;
  try{
    assert(c.lifecycle.restore(envelope).ok);
    const legalActions=c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
    const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
    try{
      const result=createSearchAgent({seatId,analysisPort:port}).decide({seatId,legalActions}).search;
      assert(result.complete&&!result.unresolved.length);
      assert(result.diagnostics.nativeExecutions<=256);
      assert.equal(legalActions.find(a=>a.actionId===result.actionId)?.summary,step===232?'放置数据':'收入 chong_7.webp');
      assert.equal(result.value,193.5);
      assert.deepEqual(c.lifecycle.save().envelope,envelope);
    }finally{port.close();}
    if(step===232){
      const state=JSON.parse(envelope.committedState),p=state.players.players.find(x=>x.id===seatId);
      p.resources.availableData=0;p.dataState.poolTokens=[];
      const actions=legalActions.filter(a=>a.family!=='place_data');
      const goal=demand.catalog({state,seatId,requirements:native.getResourceGoalRequirements(state,seatId),actions})
        .find(g=>g.kind==='play_card'&&g.cardId===p.hand.find(c=>c.cardId==='chong_3.webp').id);
      assert(goal&&!goal.incomeFunding);
      const first=demand.step({state,seatId,goal,actions,status:'stable'});
      assert.equal(actions.find(a=>a.actionId===first.actionId)?.target.tradeId,'cards-for-credit');
    }
  }finally{c.dispose();}
}
