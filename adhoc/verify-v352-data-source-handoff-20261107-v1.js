'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/resource-demand');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const rel=path.relative(root,valuePath);assert.equal(sha(valuePath),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={swap:0,income:0,avoidedMs:0};
globalThis.__v352Handoff=counts;
let src=fs.readFileSync(valuePath,'utf8');
function insertBefore(marker,body){assert.equal(src.split(marker).length,2);src=src.replace(marker,body+marker);}
insertBefore('    const p=owner(state,seatId),source=valueFacts(state,p),before=knownSourceCapital??planningCapital(state,p);',`    if(knownSourceCapital!==null){
      const c=globalThis.__v352Handoff,at=performance.now(),fresh=planningCapital(state,owner(state,seatId));c.swap++;c.avoidedMs+=performance.now()-at;
      if(!Object.is(fresh,knownSourceCapital))throw Error('DATA_TAIL_SWAP_SOURCE_MISMATCH '+fresh+' != '+knownSourceCapital);
    }
`);
insertBefore('    return Object.freeze({available,netGain,beforeCapital:knownSourceCapital??planningCapital(state,owner(state,seatId)),afterCapital,preparedCapital});',`    if(knownSourceCapital!==null){
      const c=globalThis.__v352Handoff,at=performance.now(),fresh=planningCapital(state,owner(state,seatId));c.income++;c.avoidedMs+=performance.now()-at;
      if(!Object.is(fresh,knownSourceCapital))throw Error('DATA_TAIL_INCOME_SOURCE_MISMATCH '+fresh+' != '+knownSourceCapital);
    }
`);
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require('../randomizer/game/ai/state-value'),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Verify every carried data source scalar against a fresh quote on the same preview. Instrumentation only.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
