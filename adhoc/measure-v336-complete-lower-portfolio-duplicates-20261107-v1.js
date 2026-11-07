'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={top:0,lower:0,lowerHits:0,localLowerHits:0,lowerRepeatedMs:0,localLowerRepeatedMs:0,analysis:0,analysisHits:0,localAnalysisHits:0,analysisRepeatedMs:0,localAnalysisRepeatedMs:0};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const S=globalThis.__V336_LAYERS__={counts,hash,lower:new Map(),analysis:new Map(),scope:0};
let src=fs.readFileSync(valuePath,'utf8');
const wrapper=(kind,args,invoke)=>`
    const {counts,hash,scope,${kind}}=globalThis.__V336_LAYERS__;
    const key=hash(${args}),hit=${kind}.get(key),start=performance.now(),result=${invoke},ms=performance.now()-start;
    counts.${kind}++;
    if(hit){
      assertSame(hit.result,result);
      counts.${kind}Hits++;counts.${kind}RepeatedMs+=ms;
      if(hit.scope===scope){counts.local${kind[0].toUpperCase()+kind.slice(1)}Hits++;counts.local${kind[0].toUpperCase()+kind.slice(1)}RepeatedMs+=ms;}
    }
    ${kind}.set(key,{scope,result});return result;
`;
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
replace('  function purposeCapital(facts, weights = DEFAULT_WEIGHTS) {','  function purposeCapital(facts, weights = DEFAULT_WEIGHTS) { globalThis.__V336_LAYERS__.scope++; globalThis.__V336_LAYERS__.counts.top++;');
replace('  function capitalWithoutIncomeSwap(facts, weights = DEFAULT_WEIGHTS) {','  function capitalWithoutIncomeSwap(facts, weights = DEFAULT_WEIGHTS) {'+wrapper('lower','[facts,weights]','computeCapitalWithoutIncomeSwap(facts,weights)')+'  }\n  function computeCapitalWithoutIncomeSwap(facts, weights = DEFAULT_WEIGHTS) {');
replace('    const analysisPortfolio=(wallet,slots,progress={})=>{','    const analysisPortfolio=(wallet,slots,progress={})=>{'+wrapper('analysis','[facts,wallet,slots,progress,weights]','computeAnalysisPortfolio(wallet,slots,progress)')+'    };\n    const computeAnalysisPortfolio=(wallet,slots,progress={})=>{');
src="const assertSame=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Unequal full-input match');};\n"+src;
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Instrumented layer counts; times inclusive and not cold acceptance; Native inputs/choice/value unchanged',fixture,acceptance,counts,uniqueLower:S.lower.size,uniqueAnalysis:S.analysis.size}));}finally{p.close();c.dispose();}
