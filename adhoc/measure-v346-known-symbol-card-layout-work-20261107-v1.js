'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const target=require.resolve('../randomizer/game/ai/known-symbol-capital'),rel=path.relative(root,target);assert.equal(sha(target),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={cards:0,frozenLayouts:0,repeatRegions:0,repeatMoves:0,copyAndRankMs:0,resolveMs:0,copyAndRankRepeatMs:0,resolveRepeatMs:0};
globalThis.__knownSymbolWork={counts,regions:new Set(),moves:new Set()};
let src=fs.readFileSync(target,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
replace('   const alien={amiba:amiba.copyPublicSymbolState(facts.researchSymbols)};',`   const {counts,regions,moves}=globalThis.__knownSymbolWork,
    k=JSON.stringify([facts.researchSymbols,body.region]),reused=regions.has(k),start=performance.now();
   counts.cards++;regions.add(k);if(reused)counts.repeatRegions++;if(Object.isFrozen(facts.researchSymbols.symbolSlots)&&Object.isFrozen(facts.researchSymbols.symbolsById))counts.frozenLayouts++;
   const alien={amiba:amiba.copyPublicSymbolState(facts.researchSymbols)};`);
replace('   if(!choices.length)continue;',`   const rankMs=performance.now()-start;counts.copyAndRankMs+=rankMs;if(reused)counts.copyAndRankRepeatMs+=rankMs;
   if(!choices.length)continue;`);
replace("   const resolved=amiba.resolveSymbolAtSlot(alien,choices[0].entry.slotId,readOnlyRewards);if(!resolved.ok)throw Error('KNOWN_SYMBOL_CARD_NATIVE_QUERY_FAILED');",`   const choiceKey=k+':'+choices[0].entry.slotId,begin=performance.now();
   const resolved=amiba.resolveSymbolAtSlot(alien,choices[0].entry.slotId,readOnlyRewards);if(!resolved.ok)throw Error('KNOWN_SYMBOL_CARD_NATIVE_QUERY_FAILED');
   const ms=performance.now()-begin;counts.resolveMs+=ms;if(moves.has(choiceKey)){counts.repeatMoves++;counts.resolveRepeatMs+=ms;}moves.add(choiceKey);`);
const m=new Module(target,module);m.filename=target;m.paths=module.paths;require.cache[target]=m;m._compile(src,target);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Measure fixed Native symbol-card reward selection and repeated public symbol layouts. Instrumented only.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
