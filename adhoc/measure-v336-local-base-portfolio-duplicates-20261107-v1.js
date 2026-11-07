'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={calls:0,repeats:0,repeatMs:0,firstMs:0,bytes:0,fields:{},localDuplicates:0,lowerDuplicates:0,localMs:0,lowerMs:0,topScopes:0,lowerScopes:0},seen=new Map();
globalThis.__V336_BASE_QUOTE_WORK__={counts,seen,top:new Set(),lower:new Set(),hash:bytes=>crypto.createHash('sha256').update(bytes).digest('hex')};
let src=fs.readFileSync(valuePath,'utf8');
const start='  function basePurposeCapital(facts, weights) {';
const replacement=`  function basePurposeCapital(facts,weights){
    const {counts,seen,hash,top,lower}=globalThis.__V336_BASE_QUOTE_WORK__,encoded=JSON.stringify([facts,weights]);
    const key=hash(encoded),old=seen.get(key);counts.calls++;counts.bytes+=encoded.length;
    const at=performance.now(),answer=computeBasePurposeCapital(facts,weights),ms=performance.now()-at;
    if(top.has(key)){counts.localDuplicates++;counts.localMs+=ms;}top.add(key);if(lower.has(key)){counts.lowerDuplicates++;counts.lowerMs+=ms;}lower.add(key);
    if(old){counts.repeats++;counts.repeatMs+=ms;if(JSON.stringify(old)!==JSON.stringify(answer))throw Error('Full quote JSON key disagrees');}
    else{counts.firstMs+=ms;seen.set(key,answer);for(const f of Object.keys(facts))counts.fields[f]=(counts.fields[f]||0)+1;}
    return answer;
  }
  function computeBasePurposeCapital(facts, weights) {`;
assert.equal(src.split(start).length,2);src=src.replace(start,replacement);
for(const [name,key,count] of [['purposeCapital','top','topScopes'],['capitalWithoutIncomeSwap','lower','lowerScopes']]){
 const marker=`  function ${name}(facts, weights = DEFAULT_WEIGHTS) {`;
 assert.equal(src.split(marker).length,2);src=src.replace(marker,marker+`\n    globalThis.__V336_BASE_QUOTE_WORK__.${key}=new Set();globalThis.__V336_BASE_QUOTE_WORK__.counts.${count}++;`);
}
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Instrumented arithmetic counts, not cold acceptance; Native inputs/choice/value unchanged',fixture,acceptance,counts,uniqueFullBaseQuotes:seen.size}));}finally{p.close();c.dispose();}
