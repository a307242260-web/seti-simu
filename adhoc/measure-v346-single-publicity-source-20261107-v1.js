'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const target=require.resolve('../randomizer/game/ai/analysis-publicity-capital'),rel=path.relative(root,target);assert.equal(sha(target),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={steps:0,single:0,singleOuter:0,singleInner:0,singleUnskipped:0,singleOuterMs:0,singleInnerMs:0,two:0,many:0};
globalThis.__singleSourcePublicity=counts;
let src=fs.readFileSync(target,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
replace('   const choices=sources.filter(s=>current.hand.some(c=>c.id===s.card.id)).map(source=>{',`   const active=sources.filter(s=>current.hand.some(c=>c.id===s.card.id)),t=globalThis.__singleSourcePublicity;
   t.steps++;if(active.length===1){t.single++;if(portfolio.removalIsInert)t.singleInner++;else t.singleOuter++;}else if(active.length===2)t.two++;else t.many++;
   const choices=active.map(source=>{`);
replace(`    const removed={...current,hand,player},afterRemoval=portfolio.removalIsInert?.(current,source.card)
      ?currentCapital:portfolio(removed).total;`,`    const removed={...current,hand,player},inert=portfolio.removalIsInert?.(current,source.card),start=performance.now(),
      afterRemoval=inert?currentCapital:portfolio(removed).total;
    if(active.length===1&&!inert){t.singleUnskipped++;if(portfolio.removalIsInert)t.singleInnerMs+=performance.now()-start;else t.singleOuterMs+=performance.now()-start;}
`);
const m=new Module(target,module);m.filename=target;m.paths=module.paths;require.cache[target]=m;m._compile(src,target);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Measure opportunity-cost recomputation with one remaining publicity supplier. Instrumented, not cold gate.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
