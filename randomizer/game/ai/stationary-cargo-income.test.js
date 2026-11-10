'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const {listComputerPlacedTokens}=require('../data');

const seat='player-white',fixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'stationary-cargo-income-20261111-v1.fixture.json.gz'))));
function run(envelope,exercise){
 const seed=JSON.parse(envelope.committedState).meta.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
 k.newGame({seed});const c=k.composition;
 try{
  assert(c.lifecycle.restore(envelope).ok);
  const save=()=>c.lifecycle.save().envelope;
  const choose=checkpoint=>{
   const legalActions=c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
   const before=save(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
   try{
    const a=createSearchAgent({seatId:seat,analysisPort:port});if(checkpoint)a.loadCheckpoint(checkpoint);
    const q=a.decide({seatId:seat,legalActions}).search;
    assert(q.complete&&!q.unresolved.length);assert.deepEqual(save(),before);
    return {q,selected:legalActions.find(x=>x.actionId===q.actionId),checkpoint:a.createCheckpoint(),diagnostics:port.getDiagnostics()};
   }finally{port.close();}
  };
  const apply=a=>{
   const d=c.inspect().session?.decision;
   const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
    :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
   assert(result.ok,JSON.stringify(result));
  };
  exercise({choose,apply,save});
 }finally{c.dispose();}
}
run(fixture.income,({choose,apply,save})=>{
 let checkpoint;
 for(const [family,summary] of [['card_corner','amiba_5.webp：弃牌角标'],['place_data','放置数据'],
  ['choose_target','第一排放置位 4'],['choose_card','收入 dlc_14.png']]){
  const decision=choose(checkpoint),a=decision.selected;
  assert.equal(a.family,family);assert.equal(a.summary,summary);checkpoint=decision.checkpoint;apply(a);
 }
 const s=JSON.parse(save().committedState),owner=s.players.players.find(x=>x.id===seat);
 assert.equal(owner.resources.score,124);assert.equal(owner.resources.energy,1);assert.equal(owner.income.energy,4);
 assert.equal(owner.hand.length,0);assert.deepEqual(listComputerPlacedTokens(owner).map(x=>x.placementSlot),[1,2,3,4]);
 assert.deepEqual(s.pieces.rockets,JSON.parse(fixture.income.committedState).pieces.rockets);
});
run(fixture.landing,({choose,apply,save})=>{
 let checkpoint;const actions=[];
 for(let i=0;i<15;i++){
  const d=choose(checkpoint),a=d.selected;if(a.family==='pass')break;
  actions.push(a);apply(a);checkpoint=d.checkpoint;
 }
 const state=JSON.parse(save().committedState),owner=state.players.players.find(x=>x.id===seat);
 assert(actions.some(a=>a.family==='complete_task'&&a.target.ruleId==='b117-orbit-land-count-task'));
 assert.equal(owner.resources.score,124);assert.equal(owner.resources.credits,1);assert.equal(owner.income.energy,4);
 assert.deepEqual(state.pieces.rockets,JSON.parse(fixture.landing.committedState).pieces.rockets);
});
run(fixture.r4,({choose})=>{
 const r=choose();assert.equal(r.selected.family,'land');assert.equal(r.q.value,219.5);
 assert(r.q.diagnostics.nativeExecutions<=256);
 assert(r.diagnostics.provedPublicScanChoices>0&&r.diagnostics.provedBluePickSettlements>0);
});
console.log('stationary cargo leaves fourth-slot income reachable and known scan/pick reuse within budget');
