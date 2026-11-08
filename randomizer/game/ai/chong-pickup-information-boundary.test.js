'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const {beforeLandingTrace}=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/chong-pickup-fossil-r3-20261109-v1.json.gz'))));
const seatId='player-white',seed=JSON.parse(beforeLandingTrace.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});
k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope;
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function restore(e){
  assert(c.lifecycle.restore(e).ok);
  assert.deepEqual(save(),e);
}
function choose(predicate){
  const d=c.inspect().session.decision,choice=menu().find(predicate);
  assert(choice);
  assert(c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice}).ok);
}
function search(){
  const before=save(),port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try {
    const q=createSearchAgent({seatId,analysisPort:port}).decide({seatId,legalActions:menu()}).search;
    assert(q.complete&&!q.unresolved.length&&q.diagnostics.nativeExecutions<=256);
    assert.deepEqual(save(),before);
    return q;
  }finally{port.close();}
}
function alternateFossils(e){
  const copy=structuredClone(e),committed=JSON.parse(copy.committedState);
  function swap(state){
    if(!state)return;
    const {planetFossilIds,fossilsById}=state.aliens.chong;
    const j=planetFossilIds.jupiter[0],s=planetFossilIds.saturn[2];
    assert.deepEqual([j,s],['fossil_02','fossil_07']);
    assert(!fossilsById[j].visibleToPlayerIds.length&&!fossilsById[s].visibleToPlayerIds.length);
    [planetFossilIds.jupiter[0],planetFossilIds.saturn[2]]=[s,j];
    [fossilsById[j].planetId,fossilsById[s].planetId]=['saturn','jupiter'];
  }
  swap(committed);
  copy.committedState=JSON.stringify(committed);
  swap(copy.session.session.baseState);
  swap(copy.session.session.workingState);
  return copy;
}
function beforeFossil(){
  choose(a=>a.target.choiceId==='trace:2:yellow:chong:4');
  choose(a=>a.target.source==='display'&&a.target.cardIndex===3);
  choose(a=>a.target.ruleId==='amiba0-yellow-data');
}
try {
  restore(beforeLandingTrace);
  const observation=c.projection({role:'player',playerId:seatId}).state,traceMenu=menu();
  assert(!JSON.stringify(observation.publicState.board.aliens).includes('fossil_'));
  const normal=search();
  assert.equal(traceMenu.find(a=>a.actionId===normal.actionId).target.choiceId,'trace:2:yellow:chong:4');
  assert(normal.lines.some(x=>x.boundary==='hidden_chong_fossil_offer'));
  assert(!JSON.stringify(normal.lines).includes('fossil_07'));
  beforeFossil();
  assert(menu().some(a=>a.target.fossilId==='fossil_07'));
  const publicChoice=search(),pick=menu().find(a=>a.actionId===publicChoice.actionId);
  assert(pick.target.fossilId);
  choose(a=>a.actionId===pick.actionId);
  const state=JSON.parse(save().committedState);
  assert(state.pieces.rockets.some(p=>p.playerId===seatId&&p.fossilId===pick.target.fossilId));

  restore(alternateFossils(beforeLandingTrace));
  assert.deepEqual(c.projection({role:'player',playerId:seatId}).state,observation);
  assert.deepEqual(menu(),traceMenu);
  const hidden=search();
  assert.deepEqual([hidden.actionId,hidden.roots,hidden.lines],[normal.actionId,normal.roots,normal.lines]);
  beforeFossil();
  assert(menu().some(a=>a.target.fossilId==='fossil_02'));
  assert(!menu().some(a=>a.target.fossilId==='fossil_07'));
  assert(menu().find(a=>a.actionId===search().actionId).target.fossilId);
}finally{c.dispose();}
