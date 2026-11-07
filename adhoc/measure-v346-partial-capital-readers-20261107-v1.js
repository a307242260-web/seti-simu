'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const target=require.resolve('../randomizer/game/ai/resource-demand'),rel=path.relative(root,target);assert.equal(sha(target),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={origins:{},publicityCanReturnWithoutFull:0,publicityNeedsFull:0};globalThis.__partialPortfolioSources=counts;
let src=fs.readFileSync(target,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
replace('    let quotes=immutable?planningCapitalQuotes.get(state):null;',`    const tag=(Error().stack.split(String.fromCharCode(10))[2]||'').trim().slice(3).split(' (')[0],
      t=globalThis.__partialPortfolioSources,bucket=t.origins[tag]??={calls:0,hits:0,ms:0};bucket.calls++;
    let quotes=immutable?planningCapitalQuotes.get(state):null;`);
replace('    if(quotes?.has(p))return quotes.get(p);','    if(quotes?.has(p)){bucket.hits++;return quotes.get(p);}');
replace('    const value=stateValue.purposeCapital(facts);','    const at=performance.now(),value=stateValue.purposeCapital(facts);bucket.ms+=performance.now()-at;');
replace('    if(!(analysis?.value>0)||!Number.isSafeInteger(endpoint?.publicity))return null;',`
    if(!(analysis?.value>0)||!Number.isSafeInteger(endpoint?.publicity)||techResolver.getResearchPublicityCost(p)<=endpoint.publicity)
      globalThis.__partialPortfolioSources.publicityCanReturnWithoutFull++;
    else globalThis.__partialPortfolioSources.publicityNeedsFull++;
    if(!(analysis?.value>0)||!Number.isSafeInteger(endpoint?.publicity))return null;`);
const m=new Module(target,module);m.filename=target;m.paths=module.paths;require.cache[target]=m;m._compile(src,target);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Measure which native planning callers request only lower portfolio fields while eagerly computing the entire value. Instrumented only.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
