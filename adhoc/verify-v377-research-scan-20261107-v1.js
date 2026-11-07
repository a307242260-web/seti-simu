'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const local=require('../randomizer/game/ai/local-decision-plans'),demand=require('../randomizer/game/ai/resource-demand');
const [source,controls,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),r=read(source).decisionRoots['before-research-income-paid'];
const v=read(controls).control.researchFirst,seed='seti-free-analyze-v1',seatId='player-white';
const composition=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,p)=>buildRuleObservation(s,seed,p?.playerId)});composition.newGame({seed});const c=composition.composition;
const save=()=>c.lifecycle.save().envelope,restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
const seat=s=>s.players.players.find(p=>p.id===seatId),b=JSON.parse(r.envelope.committedState),after=JSON.parse(v.researchBoundary.env.committedState);
const knownCards=new Set([...seat(b).hand,...b.cards.publicCards.filter(Boolean)].map(c=>c.id));
const purpose=local.researchScanPurpose({state:b,seatId,knownCards});
const quote=state=>local.quoteResearchScanPurpose({state,seatId,purpose});
const primary=quote(after);assert.equal(primary.value,v.boundary.value-v.researchBoundary.value);
assert.equal(primary.scoreGain,v.boundary.wallet.score-v.researchBoundary.wallet.score);
assert.equal(primary.dataGain,v.boundary.wallet.availableData-v.researchBoundary.wallet.availableData);
assert.equal(demand.blueFunding(after,seatId,{kind:'scan',required:purpose.cost}).blueSlot,primary.blueSlot);
const deckSwap=structuredClone(after),deck=deckSwap.cards.drawPileCardIds;
[deck[0],deck[1]]=[deck[1],deck[0]];
const amibaDeck=deckSwap.aliens.amiba.cardDeck;
if(amibaDeck.length>=2)[amibaDeck[0],amibaDeck[1]]=[amibaDeck[1],amibaDeck[0]];
assert.deepEqual(quote(deckSwap),primary);
const unknownOffer={...purpose,knownCards:new Set([...knownCards].filter(id=>id!==primary.publicCardId))};
assert.equal(local.quoteResearchScanPurpose({state:after,seatId,purpose:unknownOffer}),null);
const noData=structuredClone(after);seat(noData).resources.availableData=0;seat(noData).dataState.poolTokens=[];
assert.equal(quote(noData),null);
const rows={};
function cold(label,envelope){
 restore(envelope);const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
 try{
  const at=performance.now(),root=p.openRoot(),search=searchDecision({port:p,root,evaluate,budget:BUDGET,modelKey:evaluate.modelKey,...OPTIONS}),ms=performance.now()-at;
  assert.deepEqual(save(),envelope);const selected=root.legalActions.find(a=>a.actionId===search.actionId);
  rows[label]={envelope,ms,native:search.diagnostics.nativeExecutions,selected,search};console.log(label,selected?.summary,search.value,rows[label].native,ms);
  return selected;
 }finally{p.close();}
}
try{
 const first=cold('start',r.envelope);assert.equal(first.family,'research_tech');
 assert(c.inputPort.submitAction(first).ok);const pending=save();
 const tile=cold('coldResearchMenu',pending);assert.equal(tile.target.tileId,purpose.tileId);
 const d=c.inspect().session.decision;
 assert(c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:tile}).ok);
 assert.deepEqual(save(),v.firstAction.env);
 cold('postResearch',v.firstAction.env);
 const blueStart=cold('nextOwnMain',v.researchBoundary.env);assert.equal(blueStart.family,'place_data');
 assert(c.inputPort.submitQuickAction(blueStart).ok);
 const blueChoice=cold('coldFundingMenu',save());assert.equal(blueChoice.target.blueSlot,primary.blueSlot);
 const blueMenu=c.inspect().session.decision;
 assert(c.inputPort.submitDecision({decisionId:blueMenu.decisionId,decisionVersion:blueMenu.decisionVersion,ownerId:blueMenu.ownerId,choice:blueChoice}).ok);
 assert.deepEqual(save(),v.funded.env);
 const scan=cold('funded',v.funded.env);assert.equal(scan.family,'scan');
 assert(Object.values(rows).every(x=>x.search.complete&&!x.search.unresolved.length&&x.native<=256&&x.ms<=600));
 restore(r.envelope);
 fs.writeFileSync(output,JSON.stringify({primary,hiddenSwapsIndependent:true,publicOfferRequired:true,sourceRestored:true,rows},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
