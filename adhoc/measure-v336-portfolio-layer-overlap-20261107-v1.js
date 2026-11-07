'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const names=['purposeCapital','purposeCapitalWithoutFutureProbe','purposeCapitalWithoutPublicityPreparation','purposeCapitalWithoutTools','purposeCapitalWithoutSymbols','capitalWithoutSector','capitalWithoutIncomeSwap'];
const counts=Object.fromEntries(names.map(n=>[n,{calls:0,hits:0,repeatMs:0,uniqueMs:0,memoIfAllLayersHits:0,origin:{}}])),seen=names.map(()=>new Map());
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
globalThis.__V336_STACK_PROF={counts,seen,hash,depth:0,activeHits:0};
let src=fs.readFileSync(valuePath,'utf8');
for(const [i,n] of names.entries()){
 const marker=`  function ${n}(facts, weights = DEFAULT_WEIGHTS) {`;
 const wrapper=`  function ${n}(facts, weights = DEFAULT_WEIGHTS) {
    const s=globalThis.__V336_STACK_PROF,stat=s.counts.${n},map=s.seen[${i}],key=s.hash([facts,weights]),hit=map.get(key);
    const before=performance.now(),parentDepth=s.depth++;
    if(hit){stat.hits++;if(!s.activeHits)stat.memoIfAllLayersHits++;s.activeHits++;}
    if(!parentDepth){const f=(Error().stack.split(String.fromCharCode(10))[2]||'').trim().split(' (')[0];stat.origin[f]=(stat.origin[f]||0)+1;}
    let result;try{result=original_${n}(facts,weights);}finally{s.depth--;if(hit)s.activeHits--;}
    const ms=performance.now()-before;stat.calls++;if(hit){stat.repeatMs+=ms;if(JSON.stringify(hit)!==JSON.stringify(result))throw Error('full key result changed');}else stat.uniqueMs+=ms;
    map.set(key,result);return result;
  }
  function original_${n}(facts, weights = DEFAULT_WEIGHTS) {`;
 assert.equal(src.split(marker).length,2);src=src.replace(marker,wrapper);
}
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Whole-input repeat counts; times inflated by nested hash and only comparable within the run',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
