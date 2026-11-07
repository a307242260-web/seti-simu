'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const target=valuePath,rel=path.relative(root,target);assert.equal(sha(target),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={base:0,unfunded:0,duplicateResearchMs:0,preparedPrepaid:0,prepaidAndPrepareMs:0,prepaidZero:0,duplicatePrepareMs:0};globalThis.__baseInvestStages=counts;
let src=fs.readFileSync(target,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
replace('    const investment=dataInvestmentFor(facts,weights),computer=readyAnalysis.prepaidCapital(facts,weights);',`
    const d=globalThis.__baseInvestStages;d.base++;
    const investment=dataInvestmentFor(facts,weights),start=performance.now(),computer=readyAnalysis.prepaidCapital(facts,weights);
    d.prepaidAndPrepareMs+=performance.now()-start;if(!computer)d.prepaidZero++;
`);
replace('    const {held,paid}=jointResearchCapital({hand:facts.hand,techState:player.techState,supply,round,publicity:player.publicity,researchCost:facts.researchCost,passed:passing,funding},weights);',`
    const t=performance.now(),{held,paid}=jointResearchCapital({hand:facts.hand,techState:player.techState,supply,round,publicity:player.publicity,researchCost:facts.researchCost,passed:passing,funding},weights);
    if(unfunded){if(held||paid)throw Error('unfunded portfolio not zero');d.unfunded++;d.duplicateResearchMs+=performance.now()-t;}
`);
replace('    let fixedPrepaid;',`    let fixedPrepaid;const prepare=()=>{
      const d=globalThis.__baseInvestStages,t=performance.now(),fn=readyAnalysis.preparePrepaidCapital(facts,weights);
      d.preparedPrepaid++;d.duplicatePrepareMs+=performance.now()-t;return fn;
    };`);
replace('fixedPrepaid??=readyAnalysis.preparePrepaidCapital(facts,weights)','fixedPrepaid??=prepare()');
const m=new Module(target,module);m.filename=target;m.paths=module.paths;require.cache[target]=m;m._compile(src,target);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Measure duplicate work in unfunded joint research and prepared prepaid computer quotes, not a timing gate.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
