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

  // The late scan/research root can acquire a publicly displayed alien
  // card before it is offered a private planet peek. The peek does not
  // claim a reward; the decision still closes under the input gate.
  const {root:late}=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,
    'paid-landing-from-hand-20261110-v1.fixture.json.gz'))));
  restore(late);
  const lateSearch=search();
  assert.equal(menu().find(a=>a.actionId===lateSearch.actionId).family,'analyze');
  assert.equal(lateSearch.value,266);
  assert.deepEqual(save(),late);

  // Only the exposed, payable reward has a fully witnessed next-turn quote.
  const {exposed,withoutCash}=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,
    'fixtures/visible-fossil-transport-r3-20261112-v1.json.gz'))));
  restore(exposed);
  const reward=search(),first=menu().find(a=>a.actionId===reward.actionId);
  assert.equal(first.target.fossilId,'fossil_07');
  assert.equal(reward.value,190.5);
  assert.equal(reward.visibleFossilTransport.nativeInputs,8);
  assert.equal(reward.visibleFossilTransport.previousValue,176.5);
  assert.equal(reward.diagnostics.nativeExecutions,11);
  assert.equal(reward.planEvidence,null);
  const budgeted=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
    budgeted.openRoot();
    const source=budgeted.visibleFossilTransportSource();
    assert(source);
    assert.equal(budgeted.quoteVisibleFossilTransport(source,()=>assert.fail('partial witness'),count=>count<1),null);
    assert.equal(budgeted.getDiagnostics().submissionCount,1);
    assert.deepEqual(save(),exposed);
  }finally{budgeted.close();}
  restore(withoutCash);
  const energy=search();
  assert.equal(menu().find(a=>a.actionId===energy.actionId).target.fossilId,'fossil_06');
  assert.equal(energy.diagnostics.nativeExecutions,3);
  assert.equal(energy.visibleFossilTransport,undefined);

  // Real landing and scan menus: the paid reward is already displayed;
  // any replacements stay masked even though the rules fork advances both decks.
  const picks=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,
    'fixtures/display-reward-proofs-20261110-v1.fixture.json.gz'))));
  for(const {root,action,end,barrier} of picks){
    restore(root);
    const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
    try{
      port.setResourcePlanning(true);port.setCardPickPlanning(true);
      const n=port.openRoot(),next=port.expand(n,action.actionId);
      assert.equal(port.getDiagnostics().submissionCount,0);
      assert.equal(port.getDiagnostics().provedAlienDisplays,1);
      assert.equal(next.boundary,barrier);
      const facts=port.valueObservation(next),recorded=JSON.parse(end.committedState);
      const species=action.target.choiceId.split(':')[0];
      const cardId=`${species}_${action.target.cardIndex}.webp`;
      assert(facts.selfState.hand.some(card=>card.cardId===cardId&&!card.hidden));
      const shown=species==='chong'?facts.publicState.board.aliens.chongOffer:facts.publicState.board.aliens.amibaTraces;
      assert.notEqual(shown.displayedCardIndex,recorded.aliens[species].displayedCardIndex);
      assert.deepEqual(save(),root);
    }finally{port.close();}
  }

  // Both displayed-card and plain-trace rewards finish their deterministic
  // region and symbol movements before a possible ordinary refill.
  const regions=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,
    'fixtures/amiba-region-proofs-20261110-v1.fixture.json.gz'))));
  for(const {root,action,end,barrier} of regions){
    restore(root);
    const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
    try{
      port.setResourcePlanning(true);port.setCardPickPlanning(true);
      const n=port.openRoot(),next=port.expand(n,action.actionId);
      assert.equal(port.getDiagnostics().submissionCount,0);
      // A previously revealed card is known when this menu is opened as a
      // fresh root. Only a new display/refill can add an information boundary.
      const newBarrier=action.family==='choose_target'&&barrier==='hidden_alien_card'?null:barrier;
      assert.equal(next.boundary,newBarrier);
      const facts=port.valueObservation(next),recorded=JSON.parse(end.committedState);
      const source=root.session.session.workingState.aliens.amiba.symbolSlots;
      const finished=recorded.aliens.amiba.symbolSlots;
      assert.notDeepEqual(source,finished,'the production region must actually move the symbols');
      assert.deepEqual(facts.publicState.board.aliens.amiba.symbolSlots,finished);
      assert.equal(facts.publicState.players.find(p=>p.playerId===seatId).score,
        recorded.players.players.find(p=>p.id===seatId).resources.score);
      assert.deepEqual(save(),root);
    }finally{port.close();}
  }

  // Recreating the paid trace menu must keep all real choices and must
  // leave the card in the deck until a later legal input selects it.
  const pinkMenus=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,
    'fixtures/pink-card-menu-proofs-20261110-v1.fixture.json.gz'))));
  for(const {root,action,menu:expected} of pinkMenus){
    restore(root);
    const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
    try{
      port.setResourcePlanning(true);port.setCardPickPlanning(true);
      const n=port.openRoot(),next=port.expand(n,action.actionId);
      assert.equal(port.getDiagnostics().submissionCount,0);
      assert.equal(port.getDiagnostics().provedPinkCardMenus,1);
      assert.equal(next.status,'decision');
      assert.deepEqual(next.legalActions,expected);
      assert.deepEqual(port.valueObservation(next).selfState.hand,n.observation.selfState.hand);
      assert.deepEqual(save(),root);
    }finally{port.close();}
  }

  // A fixed scan may settle the sector and enqueue a trace or a later
  // scan. The next real menu must be recoverable without redoing the input.
  const scans=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,
    'fixtures/quiet-scan-proofs-20261110-v1.fixture.json.gz'))));
  for(const {root,action,menu:expected} of scans){
    restore(root);
    const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
    try{
      port.setResourcePlanning(true);port.setCardPickPlanning(true);port.setDecisionPlanning({scanPlanning:true});
      const n=port.openRoot(),next=port.expand(n,action.actionId);
      assert.equal(port.getDiagnostics().submissionCount,0);
      assert.equal(port.getDiagnostics().provedQuietSpecifiedScans,1);
      assert.equal(next.status,'decision');
      assert.deepEqual(next.legalActions,expected);
      assert.deepEqual(save(),root);
    }finally{port.close();}
  }
}finally{c.dispose();}
