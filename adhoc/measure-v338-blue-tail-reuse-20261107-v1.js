'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const target=require.resolve('../randomizer/game/ai/local-decision-plans'),rel=path.relative(root,target);
assert.equal(sha(target),manifest.sourceHashes[rel]);
const counts={calls:0,hits:0,misses:0,fallbacks:0,phase:{},materialized:0};globalThis.__blueTailReuseTrace=counts;
let src=fs.readFileSync(target,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
replace('  if(beforeCapital!==null||!Object.isFrozen(state)||!standardBlueGoal(goal)||!demand.immutableCapitalInput(state))',`  const counter=globalThis.__blueTailReuseTrace;counter.calls++;
  const why=beforeCapital!==null?'carried-capital':!Object.isFrozen(state)?'mutable-state':!standardBlueGoal(goal)?'nonstandard-goal':!demand.immutableCapitalInput(state)?'shallow-state':null;
  if(why){counter.fallbacks++;counter.phase[why]=(counter.phase[why]||0)+1;if(why==='nonstandard-goal')counter.nonstandardSample??=goal;}
  if(why)`);
replace('  if(!preview){','  if(preview)counter.hits++;else counter.misses++;\n  if(includePlayer)counter.materialized++;\n  if(!preview){');
const m=new Module(target,module);m.filename=target;m.paths=module.paths;require.cache[target]=m;m._compile(src,target);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Instrumented blue preview reuse counts, not cold acceptance; Native graph result unchanged',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
