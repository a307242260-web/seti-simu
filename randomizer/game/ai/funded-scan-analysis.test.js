'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation'),{createSeededRandom}=require('../random');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const fixture=path.resolve(__dirname,'../../../reports/ai-foundation-20261112/fixed-board-scan-analysis-v1/scan-analysis-roots-20261112-v1.json.gz');
const {roots}=JSON.parse(z.gunzipSync(fs.readFileSync(fixture))),seatId='player-white';
for(const {board,root} of roots){
  const seed=JSON.parse(root.committedState).meta.seed;
  const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
    projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId||null,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
  k.newGame({seed});const c=k.composition;
  const changed=JSON.parse(root.committedState),pile=changed.cards.drawPileCardIds;
  [pile[0],pile[5],pile[1],pile[7]]=[pile[5],pile[0],pile[7],pile[1]];
  function quote(envelope){
    assert(c.lifecycle.restore(envelope).ok);
    const publicView=c.projection({role:'player',playerId:seatId}).state,actions=c.inputPort.enumerateActions({});
    const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
    try{
      const q=createSearchAgent({seatId,analysisPort:p}).decide({seatId,legalActions:actions}).search;
      assert(q.complete&&!q.unresolved.length);
      assert(q.diagnostics.nativeExecutions<=256);
      assert.deepEqual(c.lifecycle.save().envelope,envelope);
      const family=actions.find(a=>a.actionId===q.actionId)?.family;
      const scanId=actions.find(a=>a.family==='scan')?.actionId;
      return {publicView,family,value:q.value,scan:q.roots.find(a=>a.actionId===scanId)?.value,n:q.diagnostics.nativeExecutions};
    }finally{p.close();}
  }
  try{
    const a=quote(root),b=quote({...root,committedState:JSON.stringify(changed)});
    assert.deepEqual(a,b,'changing unseen refill types cannot change the current policy');
    assert.equal(a.family,board===15?'scan':'launch');
    if(board===15)assert(a.scan>95.16666666666667,'the funded analysis continuation must outweigh trading');
    else assert(a.scan>90.83333333333333&&a.scan<a.value,'the scan continuation cannot outweigh the payable landing');
  }finally{c.dispose();}
}
