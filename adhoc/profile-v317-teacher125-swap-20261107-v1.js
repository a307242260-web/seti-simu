'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const stage='/private/tmp/seti-v317-case152-static-occupancy-20261107-v1/',R='reports/ai-foundation-20261107/',D=R+'teacher125-v317-hotspots-v1/',manifest=R+'case152-static-occupancy-v317-v1/source-manifest-20261107-v1.json';
const read=p=>JSON.parse(fs.readFileSync(p)),hash=x=>crypto.createHash('sha256').update(x).digest('hex'),sha=p=>hash(fs.readFileSync(p)),m=read(manifest);
const ev='reports/ai-foundation-20261105/third-round-teacher-v1/v317-cold-actual-v256-125-20261107-v1.json',cold=read(ev),f=read(cold.fixture);
assert.equal(cold.candidateSourceManifestSha256,sha(manifest));assert.equal(cold.fixtureSha256,sha(cold.fixture));assert.equal(cold.rawSha256,sha(cold.rawPath));
for(const[p,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(stage+p),h,p);
const file=require.resolve(stage+'randomizer/game/ai/card-pick-planning'),source=fs.readFileSync(file,'utf8'),diagnostic={swap:[],prices:[]};
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
const mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;
let code=replace(source,'    function swapIntent(state,seatId,endpoints,outgoingId=null,committed=false){',`    function swapIntent(state,seatId,endpoints,outgoingId=null,committed=false){
      const start=performance.now(),result=quoteSwapIntent(state,seatId,endpoints,outgoingId,committed);
      __diagnostic.swap.push({state,seatId,outgoingId,committed,result,elapsed:performance.now()-start});
      return result;
    }
    function swapPortfolioValue(state,p,kind,cardId=null){
      const start=performance.now(),value=demand.planningCapital(state,p);
      __diagnostic.prices.push({state,playerId:p.id,kind,cardId,value,elapsed:performance.now()-start});
      return value;
    }
    function quoteSwapIntent(state,seatId,endpoints,outgoingId=null,committed=false){`);
code=replace(code,'const before=demand.planningCapital(state,p),ranked=offered.map(incoming=>{','const before=swapPortfolioValue(state,p,"before"),ranked=offered.map(incoming=>{');
code=replace(code,'return{card:incoming,gain:demand.planningCapital(preview,next)-before};','return{card:incoming,gain:swapPortfolioValue(preview,next,"offer",incoming.id)-before};');
mod.require=name=>name==='@@seti/swap-diagnostic'?diagnostic:Module.prototype.require.call(mod,name);
mod._compile("const __diagnostic=require('@@seti/swap-diagnostic');\n"+code,file);mod.loaded=true;require.cache[file]=mod;
const {createSimulationRuleComposition}=require(stage+'randomizer/training/simulation-rule-composition'),{createSeededRandom}=require(stage+'randomizer/game/random'),{buildRuleObservation}=require(stage+'randomizer/app/rule-observation'),{createAnalysisPort}=require(stage+'randomizer/game/ai/analysis-port'),search=require(stage+'randomizer/game/ai/decision-search'),values=require(stage+'randomizer/game/ai/state-value'),agent=require(stage+'randomizer/game/ai/search-agent');
const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),evaluate=values.createStateValueEvaluator(f.seatId);
try{
 const out=search.searchDecision({port:p,root:p.openRoot(),evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET}),old=JSON.parse(z.gunzipSync(fs.readFileSync(cold.rawPath)));
 assert(out.complete);assert.equal(out.diagnostics.nativeExecutions,cold.nativeInputs);
 assert.equal(JSON.stringify(out.roots),JSON.stringify(old.roots));assert.equal(JSON.stringify(out.lines),JSON.stringify(old.lines));assert.deepEqual(c.lifecycle.save().envelope,before);
 const states=new Map(),key=s=>{const json=JSON.stringify(s),id=hash(json);if(states.has(id))assert.equal(json,states.get(id));else states.set(id,json);return id;};
 const swaps=diagnostic.swap.map(({state,...row})=>({...row,stateKey:key(state)})),prices=diagnostic.prices.map(({state,...row})=>({...row,stateKey:key(state)}));
 const groups=new Map();for(const row of prices){const k=row.playerId+':'+row.stateKey;if(groups.has(k))assert.equal(groups.get(k),row.value);else groups.set(k,row.value);}
 const details={states:Object.fromEntries(states),swaps,prices};
 const checkpoint=D+'v317-teacher125-swap-quotes-20261107-v1.checkpoint.json.gz';
 fs.writeFileSync(checkpoint,z.gzipSync(JSON.stringify(details)),{flag:'wx'});
 const result={scope:'Isolated function-level swap quote attribution; output rows and all Native graph lines unchanged. No new acceptance sample.',manifest,manifestSha256:sha(manifest),fixture:cold.fixture,fixtureSha256:cold.fixtureSha256,checkpoint,checkpointSha256:sha(checkpoint),
  swaps:swaps.length,successfulSwaps:swaps.filter(x=>x.result).length,portfolioSwaps:swaps.filter(x=>x.result?.goal.kind==='known-portfolio-swap').length,
  portfolioBeforeQuotes:prices.filter(x=>x.kind==='before').length,portfolioOfferQuotes:prices.filter(x=>x.kind==='offer').length,
  distinctPricedStates:groups.size,identicalPricedStates:prices.length-groups.size,
  totalSwapMilliseconds:swaps.reduce((n,q)=>n+q.elapsed,0),totalPricingMilliseconds:prices.reduce((n,q)=>n+q.elapsed,0),nativeInputs:out.diagnostics.nativeExecutions,newAutonomousRuns:0};
 fs.writeFileSync(D+'v317-teacher125-swap-quotes-20261107-v1.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}finally{p.close();c.dispose();}
