'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const W='reports/ai-foundation-20261107/',D=W+'v332-known-alien-tail-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),values=require('../randomizer/game/ai/state-value');
const f=read(D+'v323-actual-r3-step-194-root-20261107-v1.json'),rec=read(f.source.record),saved=read(rec.savePath),seed=f.source.seed,seat=f.seatId,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const manifest=read(D+'source-manifest-20261107-v1.json');for(const [p,h]of Object.entries({...manifest.baseRuntimeHashes,...manifest.sourceHashes}))assert.equal(sha(p),h,p);
assert.equal(sha(f.source.record),f.source.recordSha256);
function variant(rotation){const e=structuredClone(f.compositionEnvelope),committed=JSON.parse(e.committedState);for(const s of [committed,e.session?.session?.baseState,e.session?.session?.workingState].filter(Boolean)){
 const a=s.aliens.amiba,remaining=a.cardDeck,index=rotation%remaining.length,known=a.initialConfiguration.cardDeck.length-remaining.length;
 a.cardDeck=[...remaining.slice(index),...remaining.slice(0,index)];a.initialConfiguration.cardDeck=[...a.initialConfiguration.cardDeck.slice(0,known),...a.cardDeck];
 const deck=s.cards.drawPileCardIds,n=rotation%deck.length;s.cards.drawPileCardIds=[...deck.slice(n),...deck.slice(0,n)];
 }e.committedState=JSON.stringify(committed);return e;}
const results=[];
try{
 for(let rotation=0;rotation<6;rotation++){
  assert(c.lifecycle.restore(variant(rotation)).ok);const origin=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   p.setResourcePlanning(true);p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
   const root=p.openRoot();assert.equal(root.observation.publicState.board.aliens.amibaTraces.displayedCardIndex,7);
   const trace=root.legalActions.find(a=>a.target.choiceId==='trace:1:blue:amiba:4'),pending=p.expand(root,trace.actionId),branches={};
   for(const name of rotation%2?['display','blind']:['blind','display']){
    const pick=pending.legalActions.find(a=>a.target?.source===name);assert(pick);const leaf=p.expand(pending,pick.actionId),obs=leaf.observation;
    assert.equal(obs.selfState.hand.filter(c=>c.cardId==='amiba_7.webp').length,name==='display'?1:0);
    assert(obs.selfState.hand.filter(c=>c.hidden).every(c=>!c.id&&!c.cardId));
    const publicTrace=obs.publicState.board.aliens.amibaTraces;
    if(name==='display'){
     assert.equal(leaf.status,'stable');assert.equal(publicTrace.displayedCardIndex,null);assert.equal(publicTrace.displayedCardHidden,true);
     let next=leaf;for(let step=195;step<=199;step++){
      const expected=saved.replaySteps[step-1].action,a=next.legalActions.find(q=>q.actionId===expected.actionId);assert(a,`missing known tail ${step}`);assert.deepEqual(a.target,expected.target);next=p.expand(next,a.actionId);
     }
     assert(['turn-boundary','information-barrier'].includes(next.status));
     const v=values.evaluateStateValue(p.valueObservation(next),seat);branches.tail={value:v.total,hand:p.valueObservation(next).selfState.hand.map(c=>c.cardId||null),ended:next.status};assert(branches.tail.hand.includes('amiba_7.webp'));
    }else{assert.equal(leaf.status,'information-barrier');assert.equal(publicTrace.displayedCardIndex,7);assert.equal(leaf.legalActions.length,0);}
    branches[name]={status:leaf.status,trace:publicTrace,hand:obs.selfState.hand,value:values.evaluateStateValue(p.valueObservation(leaf),seat).total,actions:leaf.legalActions.map(a=>a.actionId)};
   }
   assert.deepEqual(c.lifecycle.save().envelope,origin);results.push(branches);
  }finally{p.close();}
 }
 for(const row of results.slice(1))assert.deepEqual(row,results[0]);
 const first=read(F+'v332-cold-v323-actual-r3-step-194-20261107-v1.json');assert(first.decisionGatePassed);assert.equal(sha(first.rawPath),first.rawSha256);
 const graph=JSON.parse(z.gunzipSync(fs.readFileSync(first.rawPath)));assert.equal(graph.actionId,'choose_target:06ca6510');assert.equal(graph.value,146.5);
 const historic=rec.metrics.searches.find(x=>x.step===194);assert.equal(historic.actionId,'choose_target:411af34c');
 console.log(JSON.stringify({worlds:results.length,hiddenReplacementIndependent:true,blindStopped:true,sameTurnKnownTailInputs:5,selected:graph.actionId,firstColdMs:first.milliseconds,firstColdInputs:first.nativeInputs,retainsActualKnownCard:true,rootAndRngUnchanged:true}));
}finally{c.dispose();}
