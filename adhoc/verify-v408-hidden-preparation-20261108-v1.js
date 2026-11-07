'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=load('randomizer/game/ai/state-value'),search=load('randomizer/game/ai/decision-search'),agent=load('randomizer/game/ai/search-agent');
const [source,out]=process.argv.slice(2),d=read(source),f=d.fixtures['1'],original=f.compositionEnvelope,seed=f.source.seed,seatId=f.seatId;
const swapped=JSON.parse(original.committedState),ordinary=swapped.cards.drawPileCardIds,alien=swapped.aliens.amiba.cardDeck;
assert(ordinary.length>1&&alien.length>1);const swappedIds={ordinary:ordinary.slice(0,2),alien:alien.slice(0,2)};
for(const deck of [ordinary,alien])[deck[0],deck[1]]=[deck[1],deck[0]];
const altered={...original,committedState:JSON.stringify(swapped)};
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
function compact(r){return {action:r.actionId,value:r.value,native:r.diagnostics.nativeExecutions,ranks:r.roots.map(x=>[x.actionId,x.value,x.realization,x.preparationDebt]),
 quotes:r.lines.filter(x=>x.knownAnalysisFunding).map(x=>x.knownAnalysisFunding)};}
try{
 assert(c.lifecycle.restore(altered).ok);assert.deepEqual(save(),altered);
 const t=performance.now(),evaluate=createStateValueEvaluator(seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET}),ms=performance.now()-t;
 assert.deepEqual(save(),altered);assert(r.complete&&!r.unresolved.length&&r.diagnostics.nativeExecutions<=256&&ms<=600);
 const actual=compact(r),expected=compact(d.rows['1'].r);assert.deepEqual(actual,expected);assert(actual.quotes.length);
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(save(),original);
 fs.writeFileSync(out,JSON.stringify({scope:'Only swap next two ordinary and next two Amiba draws while keeping the currently displayed offers. Cold post-launch preparation.',swappedIds,actual,expected,ms,rootAndRngUnchanged:true},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({ms,actual}));
}finally{p.close();c.dispose();}
