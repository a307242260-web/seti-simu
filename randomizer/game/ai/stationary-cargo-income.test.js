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
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
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
  exercise({choose,apply,save,menu:()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({})});
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
const swapFixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/stationary-cargo-income-swap-20261111-v1.json.gz'))));
run(swapFixture.ready,({choose,apply})=>{
 const swap=choose();assert.equal(swap.selected.family,'industry');assert.equal(swap.q.value,200.5);
 assert(swap.q.diagnostics.nativeExecutions<=256);apply(swap.selected);
 const outgoing=choose();assert.equal(outgoing.selected.summary,'dlc_15.png');apply(outgoing.selected);
 const incoming=choose();assert.equal(incoming.selected.summary,'dlc_14.png');
});
run(swapFixture.noSwap,({choose})=>{
 assert.equal(choose().selected.family,'card_corner');
});
run(swapFixture.fromYellow,({choose,apply,save})=>{
 let checkpoint,pass=false;const actions=[];
 for(let i=0;i<30;i++){
  const decision=choose(checkpoint),a=decision.selected;
  assert(decision.q.diagnostics.nativeExecutions<=256);
  if(a.family==='pass'){pass=true;break;}
  actions.push(a);apply(a);checkpoint=decision.checkpoint;
 }
 assert(pass);
 assert.equal(actions.filter(a=>a.family==='industry').length,1);
 const state=JSON.parse(save().committedState),owner=state.players.players.find(x=>x.id===seat);
 assert.deepEqual([owner.resources.score,owner.resources.credits,owner.resources.energy,owner.income.energy],[124,1,1,4]);
 assert.deepEqual(listComputerPlacedTokens(owner).map(x=>x.placementSlot),[1,2,3,4]);
 assert(state.pieces.rockets.some(r=>r.playerId===seat&&r.fossilId==='fossil_01'));
});
console.log('stationary cargo leaves fourth-slot income reachable and known scan/pick reuse within budget');

const directShipments = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,
 "fixtures/r4-direct-earth-shipment-20261111-v1.json.gz"))));
const directCandidate = q => q.candidates?.find(c => c.plan?.goal?.directEnergy);
for (const source of directShipments) {
 run(source.entry, ({choose,apply,save})=>{
  let checkpoint;
  for (const [index, action] of source.actions.entries()) {
   const decision = choose(checkpoint);
   if (index === 0) {
    assert(directCandidate(decision.q));
    assert(decision.q.roots.some(root=>root.actionId.startsWith("play_card:") && Number.isFinite(root.value)));
   }
   assert.equal(decision.q.diagnostics.nativeExecutions<=256,true);
   assert.deepEqual(decision.selected,action);
   checkpoint=decision.checkpoint;
   apply(decision.selected);
  }
  assert.deepEqual(save(),source.delivered);
 });
 run(source.entry, ({choose,apply,menu})=>{
  const exchange=menu().find(a=>a.family==="quick_trade" && a.target?.tradeId==="energy-for-credit");
  assert(exchange);
  apply(exchange);
  assert(!directCandidate(choose().q),"insufficient energy does not create a direct shipment plan");
 });
}
