"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),{spawnSync}=require("node:child_process");
const scenario=require("./research-human405-current-full"),first=require("./research-human405-round1"),frozen=require("./research-human405-full");
const runner=require("./run_research_validation"),root=path.resolve(__dirname,"..");
const options={full:true,config:{agentType:"search",scenario:scenario.ID,compactReplay:true}},identity=runner.buildIdentity(options);
assert.equal(identity.scenario.openingInputs,23);assert.equal(identity.scenario.originalOpeningInputs,23);
assert.equal(identity.scenario.stopAfterRound,null);assert.equal(identity.scenario.comparisonScope,"white-only-current-full-game");
assert.equal(identity.scenario.scoreSemantics,"terminal-score-with-passive-opponents");assert.equal(identity.scenario.baselineEligible,false);
assert.deepEqual(identity.scenario.decisionGate,{nativeInputs:256,milliseconds:600,enforcement:"reject-before-input"});
assert.equal(identity.scenario.gameMillisecondsTarget,180000);assert(!identity.scenario.continuation);
assert.throws(()=>runner.buildIdentity({...options,full:false}),/REQUIRES_FULL/);
assert.throws(()=>runner.buildIdentity({...options,config:{...options.config,activePlayerCount:3}}),/CONFIGURATION_INVALID/);
assert.throws(()=>runner.buildIdentity({...options,config:{...options.config,agentType:"completion"}}),/CONFIGURATION_INVALID/);
assert.throws(()=>runner.buildIdentity({full:true,config:{agentType:"search",scenario:first.FIRST_THREE_ROUNDS_ID}}),/REQUIRES_QUICK/);
assert(!frozen.IDS.includes(scenario.ID));assert.throws(()=>frozen.continuation(scenario.ID),/RESEARCH_SCENARIO_UNKNOWN/);
const partial=runner.buildIdentity({config:{agentType:"search",scenario:first.FIRST_THREE_ROUNDS_ID,compactReplay:true}});
assert.notEqual(runner.fingerprintOf(identity),runner.fingerprintOf(partial));assert.deepEqual(identity.world,partial.world);
assert.equal(scenario.settled({terminal:false,publicState:{roundNumber:4,terminal:false}}),false);
assert.equal(scenario.settled({terminal:true,publicState:{roundNumber:4,terminal:true}}),true);
const opening=first.opening(),source=JSON.parse(fs.readFileSync(path.join(root,"seti-saves/seti-save-537-merged.json"))),env=scenario.createEnvironment({},identity.scenario);
try{
 const entries=scenario.initialize(env,{seed:identity.seed,activePlayerCount:4,compactReplay:true},identity.scenario);
 assert.equal(entries.length,23);assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,opening.checkpoint.coreState.compositionEnvelope);
 assert.deepEqual(env.createCheckpoint().machineAI,{});assert.equal(env.createCheckpoint().config.agentType,"custom");
 for(const e of source.replaySteps.slice(23,27)){
  const a=env.legalActions().find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);assert(a);assert(env.step(a).ok);
 }
 for(let i=0;i<3;i++){
  const before=frozen.inputCount(env.createCheckpoint()),r=env.runAgentDecision();
  assert.equal(r.actorPlayerId,"player-green");assert.equal(r.policyProvenance.type,"passive-opponent");assert.equal(r.searches.length,0);
  assert.equal(frozen.inputCount(env.createCheckpoint()),before+1);
 }
}finally{env.dispose()}
assert.deepEqual(first.opening().checkpoint,opening.checkpoint);
const bad=scenario.createEnvironment({},identity.scenario);
try{assert.throws(()=>scenario.initialize(bad,{seed:identity.seed,activePlayerCount:4},{...identity.scenario,openingCheckpointSha256:"changed"}));}finally{bad.dispose()}
// Both runtime guards must reject before the first autonomous input. Their
// failed full records and unchanged opening are retained and deduplicated.
for(const [kind,expectedCode]of [["decision","WHITE_ONLY_DECISION_GATE_EXCEEDED"],["time","WHITE_ONLY_GAME_TIME_LIMIT"]]){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"seti-current-full-guard-"));
 try{
  const preload=path.join(dir,"fault.cjs"),modulePath=path.join(root,"randomizer/game/ai/search-agent.js");
  const script=kind==="decision"
   ?`const id=require.resolve(${JSON.stringify(modulePath)}),api=require(id);require.cache[id].exports={...api,createSearchAgent:()=>({getProvenance:()=>({type:"search",version:api.VERSION}),decide:c=>({actionId:c.legalActions[0].actionId,search:{complete:true,actionId:c.legalActions[0].actionId,diagnostics:{nativeExecutions:257},rootAndSearchMilliseconds:10,roots:[],lines:[],unresolved:[]}}),loadCheckpoint(){},createCheckpoint(){return null;}})};`
   :`const api=require(${JSON.stringify(path.join(root,"tools/research-human405-current-full.js"))}),initialize=api.initialize;api.initialize=(...args)=>{const result=initialize(...args),now=Date.now;Date.now=()=>now()+180001;return result;};`;
  fs.writeFileSync(preload,script);
  const args=["tools/run_research_validation.js","--name","current-full-guard-"+kind,"--full","--config",`agentType=search,scenario=${scenario.ID},compactReplay=true`,"--no-save","--records-dir",dir];
  const childEnv={...process.env,NODE_OPTIONS:`${process.env.NODE_OPTIONS||""} --require=${preload}`};
  const child=spawnSync(process.execPath,args,{cwd:root,env:childEnv,encoding:"utf8"});assert.equal(child.status,1,child.stderr);
  const file=path.join(dir,fs.readdirSync(dir).find(f=>f.endsWith(".full.json"))),bytes=fs.readFileSync(file),record=JSON.parse(bytes);
  assert.equal(record.status,"failed");assert.equal(record.steps,23);assert.equal(record.resumeStep,0);assert.equal(record.resumedFrom,null);
  assert.equal(record.failure.code,expectedCode,JSON.stringify(record.failure));assert.equal(record.failure.failedDecisionCommitted,false);
  assert.equal(record.scoreSemantics,"terminal-score-with-passive-opponents");assert.deepEqual(record.summary.scores,{});
  assert.deepEqual(record.rounds,[]);const expectedFamilies={};for(const e of opening.checkpoint.replaySteps.filter(e=>e.actorPlayerId==="player-white")){const f=e.action.family;expectedFamilies[f]=(expectedFamilies[f]||0)+1;}
  assert.deepEqual(record.metrics.famsBySeat["player-white"],expectedFamilies);
  const checkpoint=JSON.parse(fs.readFileSync(path.resolve(root,record.failure.checkpointPath)));
  assert.deepEqual(checkpoint.coreState.compositionEnvelope,opening.checkpoint.coreState.compositionEnvelope);
  if(kind==="decision"){
   assert.equal(record.metrics.searches.length,1);assert.equal(record.metrics.searches[0].committed,false);
   assert.equal(record.metrics.searches[0].diagnostics.nativeExecutions,257);
  }
  const duplicate=spawnSync(process.execPath,args,{cwd:root,env:childEnv,encoding:"utf8"});assert.equal(duplicate.status,2,duplicate.stderr);
  assert.deepEqual(fs.readFileSync(file),bytes);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
console.log(JSON.stringify({currentFullOpening:23,nativeRootAndRngPreserved:true,passiveOpponents:true,decisionAndTimeRejectedBeforeInput:true,failedFullDeduplicated:true,historicalContinuationsSeparate:true}));
