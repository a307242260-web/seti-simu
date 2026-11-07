'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const plans=load('randomizer/game/ai/local-decision-plans'),trades=load('randomizer/game/actions/quick-trades');
const [paths,initial,horizons,out]=process.argv.slice(2),proof=read(paths),candidate=read(initial),turns=read(horizons),root=proof.root;
const seat='player-white',seed=JSON.parse(root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const make=()=>createSearchAgent({seatId:seat,analysisPort:createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0})});
const decide=a=>{const before=save(),r=a.decide({seatId:seat,legalActions:menu()});assert.deepEqual(save(),before);
 assert(r.search.complete&&r.search.diagnostics.nativeExecutions<=256&&r.search.rootAndSearchMilliseconds<=600);
 return {...r,action:menu().find(q=>q.actionId===r.actionId)};};
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(a){
 const native=menu().find(q=>q.actionId===a.actionId&&q.actorId===seat),d=c.inspect().session?.decision;assert(native,a.summary);assert.deepEqual(native.target,a.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:native})
   :native.phase==='quick'?c.inputPort.submitQuickAction(native):c.inputPort.submitAction(native);assert(r.ok,JSON.stringify(r));return native;
}
try{
 restore(root);
 const native=act(candidate.action),pending=save();
 const cold=decide(make());
 assert.equal(cold.action.target.traceType,'blue');
 assert.equal(cold.action.target.position,1);
 const before=turns.rows['V375-legal-fixed-route'][0].envelope,blue=turns.rows['V397-actual-route'][0].envelope;
 const s=JSON.parse(before.committedState),sb=JSON.parse(blue.committedState),p=s.players.players.find(v=>v.id===seat);
 const known=new Set([...p.hand,...p.reservedCards,...s.cards.publicCards.filter(Boolean)].map(c=>c.id));
 const trade=trades.getTradeAction('cards-for-energy');
 const quote=(state,knownCards=known,knownTech=()=>true)=>plans.quoteScanTiming({state,seatId:seat,knownCards,trade,knownTech});
 const beforeHash=JSON.stringify(s),exact=quote(s),blueNone=quote(sb);
 assert.deepEqual(exact,candidate.quotes[0]);
 assert.equal(blueNone,null);
 assert.equal(JSON.stringify(s),beforeHash);
 const world=structuredClone(s);world.cards.drawPileCardIds.reverse();
 for(const stack of Object.values(world.tech.stacks)){
  const i=stack.bonusIndex;stack.bonusQueue.splice(i+1,stack.bonusQueue.length,...stack.bonusQueue.slice(i+1).reverse());
 }
 for(const v of Object.values(world.aliens))if(v?.deck&&Array.isArray(v.deck))v.deck.reverse();
 assert(world.aliens.amiba.cardDeck.length>1);world.aliens.amiba.cardDeck.reverse();
 assert.deepEqual(quote(world),exact);
 const handRemoved=new Set(known);handRemoved.delete(exact.discard[0]);assert.equal(quote(s,handRemoved),null);
 const publicRemoved=new Set(known);publicRemoved.delete(exact.publicCardId);assert.equal(quote(s,publicRemoved),null);
 assert.equal(quote(s,known,()=>false),null);
 const other=structuredClone(s);other.turn.passedPlayerIds.pop();assert.equal(quote(other),null);
 const timed=structuredClone(s);timed.turn.cardTurnEventBonuses=[{eventType:'quick_trade_payment'}];assert.equal(quote(timed),null);
 const noMoney=structuredClone(s);noMoney.players.players.find(v=>v.id===seat).resources.credits=0;assert.equal(quote(noMoney),null);
 const redRoute=proof.rows['V375-legal-fixed-route'].steps;
 assert.equal(redRoute[0].action.actionId,native.actionId);
 restore(root);
 for(const x of redRoute.filter(x=>x.index<=202))act(x.action);
 const expected=turns.rows['V375-legal-fixed-route'].find(x=>x.end===202);
 assert.deepEqual(save(),expected.envelope);assert.equal(expected.value.total,152.5+exact.value);
 assert.equal(exact.scanValue,4);assert.equal(exact.research.value,14);
 restore(root);
 const proofOut={scope:'Exact proof delta vs Native through the purple/blue funding path, no guessed deck or next tech bonus, exact Native cold-recovery target. No standard run.',
  paths,pathsSha256:sha(paths),candidateSha256:sha(initial),exact,cold,independentFinalValue:expected.value.total,
  negatives:{rotatedSectorUnavailable:true,otherActiveSeat:true,paymentObserver:true,noCredits:true,unseenPaymentCard:true,unseenPublicCard:true,unseenTechBonus:true},
  shuffledHiddenDeckAndTechQueueEqual:true,rootAndRngUnchanged:true,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(proofOut,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({native:expected.value.total,quote:exact.value,coldAction:cold.action.summary,controls:Object.keys(proofOut.negatives).length}));
}finally{c.dispose();}
