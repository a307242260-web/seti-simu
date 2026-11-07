'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const portPath=require.resolve('../randomizer/game/ai/analysis-port'),demandPath=require.resolve('../randomizer/game/ai/resource-demand'),pickPath=require.resolve('../randomizer/game/ai/card-pick-planning');
for(const p of [portPath,demandPath,pickPath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={guardCalls:0,paidAlreadyPositive:0,offerBatches:0,offerQuotes:0,wouldSkip:0,wouldSkipMs:0,knownPositiveBatches:0,otherOfferQuotes:0};
const shared=globalThis.__guardOnlyOfferTest={counts,active:false,paid:false,seen:false,wrap(fn){counts.guardCalls++;this.active=true;this.paid=this.seen=false;try{return fn();}finally{this.active=false;}}};
function load(p,modify){const m=new Module(p,module);m.filename=p;m.paths=module.paths;const src=modify(fs.readFileSync(p,'utf8'));require.cache[p]=m;m._compile(src,p);m.loaded=true;}
function replace(s,a,b){assert.equal(s.split(a).length,2);return s.replace(a,b);}
load(demandPath,s=>{
 s=replace(s,'    if(!offered.length)return[];','    if(!offered.length)return[]; const tap=globalThis.__guardOnlyOfferTest;if(tap.active)tap.counts.offerBatches++;');
 return replace(s,'      return{card:incoming,gain:stateValue.purposeCapital(preview).total-before};',`
      const start=performance.now(),gain=stateValue.purposeCapital(preview).total-before,ms=performance.now()-start;
      if(tap.active){tap.counts.offerQuotes++;if(tap.paid||tap.seen){tap.counts.wouldSkip++;tap.counts.wouldSkipMs+=ms;}
       if(gain>0&&!tap.seen){tap.seen=true;tap.counts.knownPositiveBatches++;}}
      else tap.counts.otherOfferQuotes++;
      return{card:incoming,gain};`);
});
load(pickPath,s=>replace(s,'        let chosen=paid(state,seatId,actions,endpoints);','        let chosen=paid(state,seatId,actions,endpoints); const tap=globalThis.__guardOnlyOfferTest;if(tap.active&&chosen){tap.paid=true;tap.counts.paidAlreadyPositive++;}'));
load(portPath,s=>{
 const a='cardPickPlanner.plan({state:preview,seatId,status:"stable",actions:node.legalActions})',b='cardPickPlanner.plan({state:preview,seatId,status:"stable",actions})';
 return replace(replace(s,a,'globalThis.__guardOnlyOfferTest.wrap(()=>'+a+')'),b,'globalThis.__guardOnlyOfferTest.wrap(()=>'+b+')');
});
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Which fixed-data continuation guards only need to know whether a positive acquisition exists. Timing is instrumented, not a cold test.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
