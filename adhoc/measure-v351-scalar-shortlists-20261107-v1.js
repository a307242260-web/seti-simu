'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const rel=path.relative(root,valuePath);assert.equal(sha(valuePath),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const work={cost:{},scopeHits:{},refHits:{},callCount:0,duplicates:0,duplicateMs:0,inside:0};
const diag=globalThis.__v351Equivalence={work,seen:new Map(),scope:null,refs:new WeakMap(),next:0};
let src=fs.readFileSync(valuePath,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
const top='  function purposeCapital(facts, weights = DEFAULT_WEIGHTS) {';
replace(top,`  function purposeCapital(facts,weights=DEFAULT_WEIGHTS){
 const d=globalThis.__v351Equivalence,old=d.scope;d.scope=new Map();
 try{return instrumentedPurpose(facts,weights);}finally{d.scope=old;}
 }
`+top.replace('purposeCapital','instrumentedPurpose'));
const marker='  function capitalWithoutIncomeSwap(facts, weights = DEFAULT_WEIGHTS) {';
replace(marker,`  function capitalWithoutIncomeSwap(facts,weights=DEFAULT_WEIGHTS){
 const d=globalThis.__v351Equivalence,w=d.work;w.callCount++;if(d.scope)w.inside++;
 const full=JSON.stringify([facts,weights]),orig=d.seen.get(full);
 const ref=x=>{
  if(x===null||typeof x!=='object')return x;
  let v=d.refs.get(x);if(v===undefined)d.refs.set(x,v=++d.next);return v;
 };
 const {board,player,hand,supply,reservedCards,...top}=facts;
 const {data,rockets,planets,solarSystem,finalScoring,publicCards,aliens,ordinaryDrawCount,...unknown}=board;
 const compactCards=cards=>cards?.map(c=>c?[c.id,c.cardId,c.hidden,c.faceUp,ref(c.effectState)]:null);
 const variants={
  largeByReference:()=>JSON.stringify([top,player,hand,reservedCards,ref(supply),ref(data),ref(rockets),ref(planets),ref(solarSystem),ref(finalScoring),publicCards,aliens,ordinaryDrawCount,unknown,weights]),
  compactShortlist:()=>JSON.stringify([ref(data),ref(supply),player.credits,player.energy,player.publicity,player.availableData,player.score,player.handSize,player.income?.credits,player.income?.energy,hand.map(c=>c.id),top.round,top.passing,top.companyState?.roundMarkRound,top.computerSlots,top.extraUnknownCount]),
  compactCardsAndLargeRefs:()=>JSON.stringify([top,player,compactCards(hand),compactCards(reservedCards),ref(supply),ref(data),ref(rockets),ref(planets),ref(solarSystem),ref(finalScoring),compactCards(publicCards),aliens,ordinaryDrawCount,unknown,weights]),
 };
 if(d.scope)for(const [name,build]of Object.entries(variants)){
  let at=performance.now(),k=build();w.cost[name]=(w.cost[name]||0)+performance.now()-at;
  let seen=d.scope.get(name);if(!seen){seen=new Map();d.scope.set(name,seen);}
  const candidates=seen.get(k)||[],hit=candidates.some(x=>x===full),stats=w.scopeHits[name]??={hit:0,new:0,collision:0,maxBucket:0};
  if(hit)stats.hit++;else {if(candidates.length)stats.collision++;else stats.new++;candidates.push(full);seen.set(k,candidates);stats.maxBucket=Math.max(stats.maxBucket,candidates.length);}
 }
 const at=performance.now(),out=unmeasuredCapitalWithoutIncomeSwap(facts,weights),ms=performance.now()-at;
 if(orig){w.duplicates++;w.duplicateMs+=ms;if(JSON.stringify(orig)!==JSON.stringify(out))throw Error('changed exact quote');}
 d.seen.set(full,out);return out;
 }
`+marker.replace('capitalWithoutIncomeSwap','unmeasuredCapitalWithoutIncomeSwap'));
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Compare keyed shortlist and exact equality within a single valuation. Instrumentation only.',fixture,acceptance,work}));}finally{p.close();c.dispose();}
