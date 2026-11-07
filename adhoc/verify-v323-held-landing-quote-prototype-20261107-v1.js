'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const w=process.cwd(),resolve=n=>require.resolve(path.join(w,n)),load=n=>require(resolve(n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',outDir='reports/ai-foundation-20261107/v323-known-landing-quote-prototype-v1/',file=resolve('randomizer/game/ai/probe-capital'),
 prototype=outDir+'probe-capital-held-landing-prototype-20261107-v1.js',nativeFile=D+'v323-known-free-landing-native-20261107-v1.json',native=read(nativeFile),f=read(native.fixture);
const manifest=read(D+'source-manifest-20261107-v1.json');
for(const[n,h]of Object.entries({...manifest.baseRuntimeHashes,...manifest.sourceHashes}))assert.equal(sha(n),h,n);
assert.equal(sha(native.fixture),native.fixtureSha256);assert.equal(sha(native.cold),native.coldSha256);
const reference=load('randomizer/game/ai/probe-capital'),m=new Module(file,module);
m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(prototype,'utf8'),file);m.loaded=true;require.cache[file]=m;
const candidate=m.exports,{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port'),search=load('randomizer/game/ai/decision-search'),values=load('randomizer/game/ai/state-value'),agent=load('randomizer/game/ai/search-agent');
const seat=f.seatId,s=JSON.parse(native.launched.envelope.committedState),owner=s.players.players.find(p=>p.id===seat),weights=values.DEFAULT_WEIGHTS;
const facts={...reference.factsFromState(s,owner),investment:()=>0},q0=reference.quote(facts,weights),q1=candidate.quote(facts,weights);
const alt=q1.candidates.find(q=>q.knownLandingCardId&&q.planet==='jupiter');assert(alt&&alt.funded&&alt.supported);assert.equal(alt.value,7.5);
assert.equal(q1.value,candidate.quoteValue(facts,weights));
assert.deepEqual(q0.candidates,q1.candidates.filter(q=>!q.knownLandingCardId));
let controls=0;
for(const hand of [facts.hand.filter(c=>c.cardId!=='dlc_31.png'),facts.hand.map(c=>c.cardId==='dlc_31.png'?{...c,hidden:true}:c),facts.hand.map(c=>c.cardId==='dlc_31.png'?{...c,banrenmaCard:true}:c)]){
 const next={...facts,hand};assert.deepEqual(reference.quote(next,weights),candidate.quote(next,weights));assert.equal(reference.quoteValue(next,weights),candidate.quoteValue(next,weights));controls++;
}
for(const next of [{...facts,round:4},{...facts,passing:true},{...facts,pendingNativeEffects:true}]){
 assert.deepEqual(reference.quote(next,weights),candidate.quote(next,weights));controls++;
}
const late=JSON.parse(native.landed.envelope.committedState),lateOwner=late.players.players.find(p=>p.id===seat),lateFacts={...reference.factsFromState(late,lateOwner),investment:()=>0};assert.equal(candidate.quoteValue(lateFacts,weights),0);
const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const before=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
try{
 const start=performance.now(),root=port.openRoot(),evaluate=values.createStateValueEvaluator(seat);
 const result=search.searchDecision({port,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET}),ms=performance.now()-start;
 assert(result.complete);assert(result.diagnostics.nativeExecutions<=256&&ms<=600);assert.deepEqual(c.lifecycle.save().envelope,before);
 const launch=result.roots.find(x=>x.actionId==='launch:c94cda79');assert(launch);
 const out=outDir+'held-landing-prototype-first-r3-20261107-v1.json',r={scope:'One distinct code prototype in-memory diagnostic; not a frozen-source admission or a game. Six boundary controls, scalar/full parity and Native-derived funding witness. Does not forecast Type3 scoring, new cards or arrival events.',prototype,prototypeSha256:sha(prototype),native:nativeFile,nativeSha256:sha(nativeFile),
  originalQuotedValue:q0.value,candidateQuotedValue:q1.value,exactJupiterAlternative:alt,controls,selected:result.actionId,value:result.value,launch,nativeInputs:result.diagnostics.nativeExecutions,ms,rootAndRngExact:true,sourceReleased:false,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,originalQuotedValue:q0.value,candidateQuotedValue:q1.value,exactJupiterValue:alt.value,action:r.selected,value:r.value,launch,inputs:r.nativeInputs,ms}));
}finally{port.close();c.dispose();}
