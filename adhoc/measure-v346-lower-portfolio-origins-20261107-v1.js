'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const rel=path.relative(root,valuePath);assert.equal(sha(valuePath),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={lower:0,repeated:0,repeatedMs:0,origins:{},pairedOrigins:{},sameReferences:0,repeatDistances:{},swapInputs:0,swapCurrentAlreadyIncome:0,avoidedPrepMs:0,swapEligible:0};
const diag=globalThis.__lowerSourceTrace={counts,seen:new Map(),activeStack:null,swapInputMs:0};
let src=fs.readFileSync(valuePath,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
const marker='  function capitalWithoutIncomeSwap(facts, weights = DEFAULT_WEIGHTS) {';
replace(marker,`  function capitalWithoutIncomeSwap(facts,weights=DEFAULT_WEIGHTS){
  const t=globalThis.__lowerSourceTrace,c=t.counts,tag=(Error().stack.split(String.fromCharCode(10)).slice(2,13).map(s=>s.trim().slice(3).split(' (')[0]).filter(s=>!s.includes('/')&&!s.includes('unmeasured')).join(' > ')),key=JSON.stringify([facts,weights]),hit=t.seen.get(key);
  const n=++c.lower;c.origins[tag]=(c.origins[tag]||0)+1;const at=performance.now(),out=unmeasuredCapitalWithoutIncomeSwap(facts,weights),ms=performance.now()-at;
  if(hit){c.repeated++;c.repeatedMs+=ms;const pair=hit.tag+' => '+tag;c.pairedOrigins[pair]=(c.pairedOrigins[pair]||0)+1;if(hit.facts.board===facts.board&&hit.facts.hand===facts.hand&&hit.facts.player===facts.player)c.sameReferences++;const d=n-hit.last,b=d<=8?'0-8':d<=32?'9-32':d<=128?'33-128':'129+';c.repeatDistances[b]=(c.repeatDistances[b]||0)+1;if(JSON.stringify(hit.out)!==JSON.stringify(out))throw Error('same complete inputs differ');}
  t.seen.set(key,{tag,out,last:n,facts});return out;
 }
`+marker.replace('capitalWithoutIncomeSwap','unmeasuredCapitalWithoutIncomeSwap'));
replace('  function publicIncomeSwap(facts, weights, base, inputs=publicIncomeSwapInputs(facts,weights)) {',`  function publicIncomeSwap(facts, weights, base, inputs) {
    const d=globalThis.__lowerSourceTrace;
    const begin=performance.now();if(inputs===undefined){d.counts.swapInputs++;inputs=publicIncomeSwapInputs(facts,weights);if(inputs)d.counts.swapEligible++;}
    const prepMs=performance.now()-begin;
`);
replace('    if(current&&ordinaryIncomeSwapCard(current))return none;',`    if(current&&ordinaryIncomeSwapCard(current)){d.counts.swapCurrentAlreadyIncome++;d.counts.avoidedPrepMs+=prepMs;return none;}`);
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Origin of exact repeated lower portfolios and redundant ordinary-income swap preparation. Instrumentation only.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
