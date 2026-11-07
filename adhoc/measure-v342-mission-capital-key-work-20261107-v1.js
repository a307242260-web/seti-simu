'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const target=require.resolve('../randomizer/game/ai/probe-capital'),rel=path.relative(root,target);
assert.equal(sha(target),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={readOnlyQuotes:0,legs:0,unsupported:0,unusedUnsupportedCapitalMs:0,capitalCalls:0,noTrace:0,capitalHits:0,defaultHand:0,heldIncome:0,keysTotalMs:0};
globalThis.__missionCapitalCounts=counts;
let src=fs.readFileSync(target,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
replace('    const player = facts.player, seatId = player.id, planningRound = facts.round + Number(facts.passing);',
 '    const tally=globalThis.__missionCapitalCounts;if(readOnlyTraces)tally.readOnlyQuotes++;\n    const player = facts.player, seatId = player.id, planningRound = facts.round + Number(facts.passing);');
replace('      const key = JSON.stringify([wallet.credits, wallet.energy, wallet.publicity, wallet.availableData, income.credits, income.energy, hand.map(card => card.id), traceSlots?.map(s=>[s.slotId,s.revealed,...["blue","pink","yellow"].map(t=>s.traces[t].firstPlaced)])]);',
 `      const time=performance.now();
      const key = JSON.stringify([wallet.credits,wallet.energy,wallet.publicity,wallet.availableData,income.credits,income.energy,hand.map(card=>card.id),traceSlots?.map(s=>[s.slotId,s.revealed,...['blue','pink','yellow'].map(t=>s.traces[t].firstPlaced)])]);
      if(readOnlyTraces){tally.keysTotalMs+=performance.now()-time;tally.capitalCalls++;if(traceSlots===null)tally.noTrace++;if(capitalValues.has(key))tally.capitalHits++;
       if(hand.length===knownHand.length&&hand.every((c,i)=>c===knownHand[i]))tally.defaultHand++;}
 `);
replace('      const capitalDelta = arithmetic.sum([capital(hand, wallet, income, traceSlots),-initialCapital],weights);',
 `      const start=performance.now();
      const capitalDelta = arithmetic.sum([capital(hand,wallet,income,traceSlots),-initialCapital],weights);
      if(readOnlyTraces){tally.legs++;if(effects.some(e=>e.type==='income'))tally.heldIncome++;if(!supported){tally.unsupported++;tally.unusedUnsupportedCapitalMs+=performance.now()-start;}}
 `);
const m=new Module(target,module);m.filename=target;m.paths=module.paths;require.cache[target]=m;m._compile(src,target);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Read-only mission scalar work only; instrumentation not an acceptance measurement.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
