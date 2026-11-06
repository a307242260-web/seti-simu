'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),crypto=require('node:crypto');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/',out=F+'v260-full-input-graph-reuse-20261106-v1.json',sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert(!fs.existsSync(out));
const unsupported=Object.freeze({}),events=[],seenValues={scalar:new Map(),base:new Map()};let keyMilliseconds=0;
// Diagnostic only: complete own-data graph, including alias topology,
// prototype, enumeration/descriptor flags and extensibility. No cross-input
// reference interning and no ignored wallet, card, board or weight fields.
function graphKey(input){
 const seen=new Map(),active=new Set(),tokens=[];
 function visit(value){
  if(value===null){tokens.push('null');return;}
  const kind=typeof value;
  if(kind==='undefined'){tokens.push('undefined');return;}
  if(kind==='string'||kind==='boolean'){tokens.push(kind,value);return;}
  if(kind==='number'){if(!Number.isFinite(value))throw unsupported;tokens.push(kind,Object.is(value,-0)?'-0':value);return;}
  if(kind!=='object'||active.has(value))throw unsupported;
  if(seen.has(value)){tokens.push('reference',seen.get(value));return;}
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),names=Reflect.ownKeys(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw unsupported;
  const id=seen.size;seen.set(value,id);active.add(value);tokens.push(array?'array':prototype===null?'null-object':'object',id,Object.isExtensible(value),names.length);
  for(const name of names){if(typeof name!=='string')throw unsupported;const descriptor=Object.getOwnPropertyDescriptor(value,name);if(!Object.hasOwn(descriptor,'value'))throw unsupported;tokens.push(name,descriptor.enumerable,descriptor.configurable,descriptor.writable);visit(descriptor.value);}
  active.delete(value);tokens.push('end');
 }
 try{visit(input);return JSON.stringify(tokens);}catch(e){if(e!==unsupported)throw e;return null;}
}
globalThis.__setiGraphReuse={quote(kind,input,compute){const at=performance.now(),key=graphKey(input);keyMilliseconds+=performance.now()-at;const result=compute(),previous=key===null?undefined:seenValues[kind].get(key);if(previous!==undefined)assert.deepEqual(result,previous,'complete graph equality must preserve every numeric result');if(key!==null)seenValues[kind].set(key,result);events.push({kind,key});return result;}};
const compile=Module.prototype._compile;Module.prototype._compile=function(content,filename){if(filename.endsWith('/randomizer/game/ai/state-value.js')){
 content=content.replace('function basePurposeCapital(facts, weights) {','function basePurposeCapital(facts,weights){return globalThis.__setiGraphReuse.quote("base",[facts,weights],()=>computeBasePurposeCapital(facts,weights));}\n  function computeBasePurposeCapital(facts, weights) {');
 content=content.replace('function purposeCapitalValue(facts,weights=DEFAULT_WEIGHTS){','function purposeCapitalValue(facts,weights=DEFAULT_WEIGHTS){return globalThis.__setiGraphReuse.quote("scalar",[facts,weights],()=>computePurposeCapitalValue(facts,weights));}\n  function computePurposeCapitalValue(facts,weights=DEFAULT_WEIGHTS){');
}return compile.call(this,content,filename);};
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),values=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent');Module.prototype._compile=compile;
const first=JSON.parse(fs.readFileSync(F+'v260-cold-actual-v256-132-20261106-v1.json'));for(const[n,h]of Object.entries(first.sourceHashes))assert.equal(sha(n),h,n);
const f=JSON.parse(fs.readFileSync(first.fixture)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evaluate=values.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.value,first.value);assert.equal(r.actionId,first.actionId);assert.equal(r.diagnostics.nativeExecutions,first.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);
 const capacity=[];for(const kind of ['scalar','base'])for(const entries of [64,256]){const cache=new Map();let hits=0,misses=0,unsupported=0,bytes=0,maxBytes=0;for(const e of events.filter(e=>e.kind===kind)){if(e.key===null){misses++;unsupported++;continue;}if(cache.has(e.key)){hits++;continue;}misses++;if(cache.size>=entries){const oldest=cache.keys().next().value;bytes-=oldest.length*2;cache.delete(oldest);}cache.set(e.key,true);bytes+=e.key.length*2;maxBytes=Math.max(maxBytes,bytes);}capacity.push({kind,entries,hits,misses,unsupported,maxKeyUtf16Bytes:maxBytes});}
 const report={scope:'One necessary full-input graph diagnostic, no live cache or candidate altered. Preserves aliases, all own-data descriptors, order, prototype and extensibility; same graph numeric results compared exactly. NOT native state equivalence, pruning, admission, cold resampling or autonomous game.',sourceVersion:search.VERSION,firstSample:F+'v260-cold-actual-v256-132-20261106-v1.json',firstSampleSha256:sha(F+'v260-cold-actual-v256-132-20261106-v1.json'),nativeInputs:r.diagnostics.nativeExecutions,value:r.value,actionId:r.actionId,rootAndRngUnchanged:true,keyMilliseconds,capacity,newAutonomousRuns:0};fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,...report}));
}finally{p.close();c.dispose();delete globalThis.__setiGraphReuse;}
