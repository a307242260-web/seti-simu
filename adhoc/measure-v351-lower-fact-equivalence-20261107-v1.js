'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const rel=path.relative(root,valuePath);assert.equal(sha(valuePath),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const fields={top:{},board:{},player:{},publicCards:0};
const work={fullKeyMs:0,quoteMs:0,duplicateMs:0,callCount:0,duplicates:0,firstFact:{}};
const diag=globalThis.__v351Equivalence={work,fields,seen:new Map()};
let src=fs.readFileSync(valuePath,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
const marker='  function capitalWithoutIncomeSwap(facts, weights = DEFAULT_WEIGHTS) {';
replace(marker,`  function capitalWithoutIncomeSwap(facts,weights=DEFAULT_WEIGHTS){
 const d=globalThis.__v351Equivalence,w=d.work;
 if(++w.callCount===1)for(const [key,obj]of [['top',facts],['board',facts.board],['player',facts.player]])w.firstFact[key]=Object.entries(obj).map(([k,v])=>[k,typeof v,JSON.stringify(v)?.length||0]);
 let at=performance.now();const key=JSON.stringify([facts,weights]);w.fullKeyMs+=performance.now()-at;
 const hit=d.seen.get(key);
 at=performance.now();const out=unmeasuredCapitalWithoutIncomeSwap(facts,weights);const ms=performance.now()-at;w.quoteMs+=ms;
 if(hit){
  w.duplicates++;w.duplicateMs+=ms;
  for(const [tag,a,b]of [['top',hit.facts,facts],['board',hit.facts.board,facts.board],['player',hit.facts.player,facts.player]])for(const k of Object.keys(b)){
   const q=d.fields[tag][k]??={same:0,different:0};q[a[k]===b[k]?'same':'different']++;
  }
  if(JSON.stringify(hit.out)!==JSON.stringify(out))throw Error('same full key had a changed result');
 }
 d.seen.set(key,{facts,out});return out;
 }
`+marker.replace('capitalWithoutIncomeSwap','unmeasuredCapitalWithoutIncomeSwap'));
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Full equality reference/serialization audit on one frozen complete root. Instrumentation only.',fixture,acceptance,work,fields}));}finally{p.close();c.dispose();}
