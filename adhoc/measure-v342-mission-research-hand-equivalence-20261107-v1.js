'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const probePath=require.resolve('../randomizer/game/ai/probe-capital');
for(const p of [probePath,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={quote:0,keys:0,originalHits:0,projectedHits:0,newHits:0,repeatInvestmentMs:0,baselineAliases:0,noResearch:0,withResearch:0,nonExact:0,nonExactExamples:[]};
globalThis.__missionCapProjection=counts;
function load(p,modify){const m=new Module(p,module);m.filename=p;m.paths=module.paths;const src=modify(fs.readFileSync(p,'utf8'));require.cache[p]=m;m._compile(src,p);m.loaded=true;}
function replace(s,a,b){assert.equal(s.split(a).length,2);return s.replace(a,b);}
load(probePath,s=>{
 s=replace(s,'    const capitalValues = new Map();','    const capitalValues = new Map(),compact=new Map(),counts=globalThis.__missionCapProjection; if(readOnlyTraces)counts.quote++;');
 const a=s.indexOf('      const key = JSON.stringify([wallet.credits, wallet.energy');assert(a>=0);
 const b=s.indexOf('    };',a);
 return s.slice(0,a)+`      const factors=[wallet.credits,wallet.energy,wallet.publicity,wallet.availableData,income.credits,income.energy];
      const trace=traceSlots?.map(s=>[s.slotId,s.revealed,...['blue','pink','yellow'].map(t=>s.traces[t].firstPlaced)]);
      const key=JSON.stringify([...factors,hand.map(c=>c.id),trace]),hit=capitalValues.has(key),start=performance.now();
      if(!hit)capitalValues.set(key,knownCurrentValue===undefined
        ?facts.investment(hand,wallet.publicity,{resources:wallet,income,startingIncome:Number(facts.passing)},{traceSlots}):knownCurrentValue);
      const ms=performance.now()-start,current=capitalValues.get(key);
      if(readOnlyTraces&&facts.__supportedResearchCards){
        counts.keys++;if(hit)counts.originalHits++;
        const relevant=facts.__supportedResearchCards(hand);
        if(relevant.length)counts.withResearch++;else counts.noResearch++;
        const short=JSON.stringify([...factors,relevant,trace]);
        if(compact.has(short)){
          counts.projectedHits++;const old=compact.get(short);
          if(!hit){counts.newHits++;counts.repeatInvestmentMs+=ms;if(old.initial)counts.baselineAliases++;}
          if(old.current!==current){counts.nonExact++;if(counts.nonExactExamples.length<5)counts.nonExactExamples.push({initial:old.initial,before:old.current,after:current,keys:[old.key,key],score:facts.player.score,round:facts.round});}
        }else compact.set(short,{current,initial:knownCurrentValue!==undefined,key});
      }
      return current;
`+s.slice(b);
});
load(valuePath,s=>replace(s,'quoteReadOnlyPortfolio({...facts,investment,initialInvestmentCapital:','quoteReadOnlyPortfolio({...facts,investment,__supportedResearchCards:hand=>hand.filter(supportedResearch).map(c=>c.id),initialInvestmentCapital:'));
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Exact same mission key except ordinary cards do not participate in internal research/prepaid investment; compare every numeric hit, not a cold test.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
