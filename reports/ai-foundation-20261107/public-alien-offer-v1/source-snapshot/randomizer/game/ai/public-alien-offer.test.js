'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),rules=require('../rule-composition'),amiba=require('../aliens/amiba'),{createAnalysisPort}=require('./analysis-port'),values=require('./state-value');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261107/anonymous-data-continuation-v1/actual156-blue4-known-data-native-20261107-v1.json'))),seat='player-white',seed=JSON.parse(f.root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,worlds=[];
function state(e){return e.session?.session?.workingState||JSON.parse(e.committedState);}
function variant(rotation){const e=structuredClone(f.root),committed=JSON.parse(e.committedState);for(const s of [committed,e.session?.session?.baseState,e.session?.session?.workingState].filter(Boolean)){
 const deck=s.cards.drawPileCardIds;s.cards.drawPileCardIds=[...deck.slice(rotation),...deck.slice(0,rotation)];
 const a=s.aliens.amiba,remaining=a.cardDeck,known=a.initialConfiguration.cardDeck.length-remaining.length;a.cardDeck=[...remaining.slice(rotation%remaining.length),...remaining.slice(0,rotation%remaining.length)];a.initialConfiguration.cardDeck=[...a.initialConfiguration.cardDeck.slice(0,known),...a.cardDeck];
 }e.committedState=JSON.stringify(committed);return e;}
try{
 for(let rotation=0;rotation<6;rotation++){
  const source=variant(rotation);assert(c.lifecycle.restore(source).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   p.setResourcePlanning(true);p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
   const root=p.openRoot(),trace=root.observation.publicState.board.aliens.amibaTraces;
   assert.equal(trace.displayedCardIndex,9,'public Native display9 must be visible before choosing a trace');assert(!Object.hasOwn(trace,'cardDeck'));assert(!Object.hasOwn(trace,'initialConfiguration'));
   const pending=p.expand(root,f.sequence[0]);assert.equal(pending.status,'decision');
   const display=pending.legalActions.find(a=>a.target.choiceId==='amiba:display:9'),blind=pending.legalActions.find(a=>a.target.choiceId==='amiba:blind');assert(display&&blind);
   const children={};for(const name of rotation%2?['blind','display']:['display','blind']){
    const child=p.expand(pending,(name==='display'?display:blind).actionId),full=child.observation,compact=p.valueObservation(child),known=full.selfState.hand.filter(c=>c.cardId==='amiba_9.webp'),opaque=full.selfState.hand.filter(c=>c.hidden),traces=full.publicState.board.aliens.amibaTraces;
    assert.equal(known.length,name==='display'?1:0,'only a Native root-known display acquisition may promote its real instance ID');assert.equal(opaque.length,name==='display'?1:2);assert(opaque.every(c=>!c.id&&!c.cardId));
    if(name==='display'){assert.equal(known[0].id,'alien-amiba-9-5');assert.equal(traces.displayedCardIndex,null,'new refill identity stays unknown');assert.equal(traces.displayedCardHidden,true);}else{assert.equal(traces.displayedCardIndex,9);assert(!traces.displayedCardHidden);}
    assert.deepEqual(values.evaluateStateValue(full,seat),values.evaluateStateValue(compact,seat),'full and value-only projections retain identical known knowledge');
    const formal=require('./outcome-model').createDecisionObservation(full,{seatId:seat,stateVersion:0,decisionVersion:0});assert.deepEqual(values.evaluateStateValue(full,seat),values.evaluateStateValue(formal,seat),'formal and full inputs retain public knowledge and the same value');
    const again=p.expand(pending,(name==='display'?display:blind).actionId);assert.deepEqual(again.observation,full,'sibling expansion and cache restore cannot alter knowledge');
    if(name==='display'){
     assert(child.legalActions.some(a=>a.family==='card_corner'&&a.target.cardInstanceId===known[0].id),'an actually acquired public card has real Native corner choices');
     const expected=rules.sanitizeHiddenInformationObservation(root.observation,buildRuleObservation(state(f.prefixes[1].envelope),seed,seat),{code:'hidden_card_draw'},[known[0].id]);
     assert.deepEqual(values.evaluateStateValue(full,seat),values.evaluateStateValue(expected,seat),'current public-identity value equals the independently accepted Native control');
     const policy=p.resourceSpec(child),plan=policy.plans.find(p=>p.goal.kind==='blue-data');assert(plan);
     const completed=p.expandResourcePlan(child,plan,()=>null);assert(completed.complete);assert.equal(completed.submissions,4);
     const after=p.valueObservation(completed.node);assert(after.selfState.hand.some(c=>c.id===known[0].id&&c.cardId==='amiba_9.webp'),'resource views and every Native data prefix preserve acquired knowledge');
     const native=rules.sanitizeHiddenInformationObservation(root.observation,buildRuleObservation(state(f.prefixes.at(-2).envelope),seed,seat),{code:'hidden_card_draw'},[known[0].id]);
     assert.deepEqual(values.evaluateStateValue(after,seat),values.evaluateStateValue(native,seat));
    }
    children[name]={full,value:values.evaluateStateValue(full,seat)};
   }
   worlds.push(children);assert.deepEqual(c.lifecycle.save().envelope,before,'search leaves the real root and RNG untouched');
  }finally{p.close();}
 }
 for(const world of worlds.slice(1))assert.deepEqual(world,worlds[0],'permuted hidden ordinary/alien decks and opposite sibling order do not change public knowledge or masked value');
 assert(c.lifecycle.restore(f.root).ok);const original=c.lifecycle.save().envelope,visible=c.projection({role:'player',playerId:seat}).state;
 const hidden=structuredClone(state(f.root).aliens);hidden.aliens['1'].revealed=false;assert.equal(amiba.getPublicTraceState(hidden),null);
 const unknownRoot=structuredClone(visible);unknownRoot.publicState.board.aliens.slots[0].revealed=false;unknownRoot.publicState.board.aliens.slots[0].alienId=null;unknownRoot.publicState.board.aliens.amiba=null;unknownRoot.publicState.board.aliens.amibaTraces=null;
 const masked=rules.sanitizeHiddenInformationObservation(unknownRoot,visible,{code:'alien_reveal'});assert.equal(masked.publicState.board.aliens.amibaTraces,null,'a newly revealed species must not leak its display through a public alias');assert.equal(masked.publicState.board.aliens.amiba,null);
 assert.deepEqual(c.lifecycle.save().envelope,original);
 console.log(JSON.stringify({publicAlienOffer:'passed',hiddenWorlds:6,reverseSiblingOrder:true,publicDisplay9Retained:true,blindAndRefillOpaque:true,fullAndCompactAgree:true,rootAndRngUnchanged:true,newAutonomousRuns:0}));
}finally{c.dispose();}
