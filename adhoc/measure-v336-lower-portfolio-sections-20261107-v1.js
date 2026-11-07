'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const seen=new Map(),ids=new WeakMap(),con=new Map();
const stats={count:0,hit:0,coldKeyMs:0,chars:{},refs:{},frozenRefs:{},sameBoardFixedRefs:0,immutableBoardFixed:0,hitByStage:{},reuseDistanceBuckets:{},differentExactKeys:0}, recent=new Map(); let seq=0;
const storage=new Map(),safeRef=new WeakMap();let nextRef=0;
function compact(section,x){
  if(x!==null&&typeof x==='object'&&Object.isFrozen(x)){
    const hit=safeRef.get(x);if(hit!==undefined){stats.frozenRefs[section]=(stats.frozenRefs[section]||0)+1;return hit;}
    if(!deepFrozenData(x))return plain(section,x);
    const key=plain(section,x);safeRef.set(x,key);return key;
  }
  return plain(section,x);
}
function deepFrozenData(x){
  if(!x||typeof x!=='object')return true;
  if(!Object.isFrozen(x))return false;
  return Object.values(x).every(deepFrozenData);
}
function plain(section,x){
  const t=JSON.stringify(x);stats.chars[section]=(stats.chars[section]||0)+(t?.length||0);
  if(storage.has(t))return storage.get(t);const key=++nextRef;storage.set(t,key);return key;
}
function tap(f,w){
  stats.count++;const a=performance.now(),{board,player,supply,...rest}=f,{planets,data,solarSystem,rockets,techSupply,finalScoring,...b}=board;
  const key=compact('weights',w)+'|'+compact('player',player)+'|'+compact('rest',rest)+'|'+compact('planets',planets)+'|'+compact('data',data)+'|'+compact('solar',solarSystem)+'|'+compact('rockets',rockets)+'|'+compact('tech',techSupply)+'|'+compact('supply',supply)+'|'+compact('marks',finalScoring)+'|'+compact('boardRest',b);
  stats.coldKeyMs+=performance.now()-a;
  const baseline=hash([f,w]);if(seen.has(key)){stats.hit++;if(seen.get(key)!==baseline)stats.differentExactKeys++;}
  seen.set(key,baseline);
  const token=[planets,data,solarSystem,rockets,techSupply,finalScoring].map(x=>{if(!x||typeof x!=='object')return x;if(!ids.has(x))ids.set(x,++seq);return ids.get(x);}).join('|');
  if(con.has(token))stats.sameBoardFixedRefs++;con.set(token,true);
  if([planets,data,solarSystem,rockets,techSupply,finalScoring].every(x=>x==null||safeRef.has(x)))stats.immutableBoardFixed++;
  if(recent.has(baseline)){
    const d=stats.count-recent.get(baseline),buckets=stats.reuseDistanceBuckets,b=d<=32?'0-32':d<=128?'33-128':d<=512?'129-512':d<=1024?'513-1024':'1025+';
    buckets[b]=(buckets[b]||0)+1;
    const stage=[f.round,f.passing,f.researchSymbols?.revealInitialized,f.companyState?.abilityId??null].join('|');stats.hitByStage[stage]=(stats.hitByStage[stage]||0)+1;
  }
  recent.set(baseline,stats.count);
}
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
globalThis.__V336_SEGMENT_TAP__=tap;
let src=fs.readFileSync(valuePath,'utf8');
const marker='  function capitalWithoutIncomeSwap(facts, weights = DEFAULT_WEIGHTS) {';
assert.equal(src.split(marker).length,2);src=src.replace(marker,marker+' globalThis.__V336_SEGMENT_TAP__(facts,weights);');
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Compare exact whole-input hashes against sectioned prototype; prototype is diagnostic only, equality not a general proof',fixture,acceptance,stats,uniqueSections:storage.size}));}finally{p.close();c.dispose();}
