'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/resource-demand');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const rel=path.relative(root,valuePath);assert.equal(sha(valuePath),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={calls:0,repeat:0,repeatMs:0,pairs:{},scope:{}};
const diag=globalThis.__v351Caller={counts,seen:new Map()};
let src=fs.readFileSync(valuePath,'utf8');
const marker='  function planningCapital(state,p){';assert.equal(src.split(marker).length,2);
src=src.replace(marker,`  function planningCapital(state,p){
 const d=globalThis.__v351Caller,c=d.counts,tag=(Error().stack.split(String.fromCharCode(10)).slice(2,7).map(s=>s.trim().slice(3).split(' (')[0].replace('Object.','')).filter(s=>!s.includes('/')).join(' > ')),facts=valueFacts(state,p),key=JSON.stringify(facts),hit=d.seen.get(key);
 c.calls++;
 const at=performance.now(),out=unmeasuredPlanningCapital(state,p),ms=performance.now()-at;
 if(hit){
  c.repeat++;c.repeatMs+=ms;const pair=hit.tag+' => '+tag;const q=c.pairs[pair]??={count:0,ms:0,sameState:0,samePlayer:0,sameOwners:0,stableStatic:0,frozenStatic:0};q.count++;q.ms+=ms;
  if(state===hit.state)q.sameState++;if(p===hit.p)q.samePlayer++;if(state.players.players===hit.state.players.players)q.sameOwners++;
  const same=['aliens','cards','tech','data','solarSystem','pieces','planets','finalScoring','turn'].every(k=>state[k]===hit.state[k]);
  if(same){q.stableStatic++;if(['aliens','cards','tech','data','solarSystem','pieces','planets','finalScoring','turn'].every(k=>Object.isFrozen(state[k])))q.frozenStatic++;}
  if(out!==hit.out)throw Error('same exact input had changed result');
 }
 d.seen.set(key,{tag,out,state,p});return out;
 }
`+marker.replace('planningCapital','unmeasuredPlanningCapital'));
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require('../randomizer/game/ai/state-value'),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Planning preview quote input sharing audit. Instrumentation only.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
