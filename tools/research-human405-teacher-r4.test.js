"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),{spawnSync}=require("node:child_process");
const scenario=require("./research-human405-teacher-r4"),runner=require("./run_research_validation");
const root=path.resolve(__dirname,".."),options={full:true,config:{agentType:"search",scenario:scenario.ID,compactReplay:true}},identity=runner.buildIdentity(options);
assert.equal(identity.scenario.openingInputs,245);assert.equal(identity.scenario.originalOpeningInputs,23);
assert.equal(identity.scenario.autonomousScope,"round4-only");assert.deepEqual(identity.scenario.controlledTeacherRounds,[1,2,3]);assert.equal(identity.scenario.baselineEligible,false);
assert.equal(identity.scenario.scoreSemantics,"terminal-score-with-teacher-controlled-first-three-rounds");assert.equal(identity.scenario.decisionGate.enforcement,"reject-before-input");
assert.throws(()=>runner.buildIdentity({...options,full:false}),/REQUIRES_FULL/);
assert.throws(()=>runner.buildIdentity({...options,config:{...options.config,activePlayerCount:3}}),/CONFIGURATION_INVALID/);
const source=scenario.source(),env=scenario.createEnvironment({},identity.scenario);let before;
try{
 const entries=scenario.initialize(env,{seed:identity.seed,activePlayerCount:4,compactReplay:true},identity.scenario,{checkpointFromSave:runner.checkpointFromSave});
 assert.deepEqual(entries,source.save.replaySteps);before=env.createCheckpoint();
 assert.equal(before.coreState.compositionEnvelope.committedState,source.save.committedState);assert.equal(before.coreState.compositionEnvelope.session,null);assert.deepEqual(before.machineAI,{});
 assert.equal(env.observe().decision.actorPlayerId,"player-white");
 const state=JSON.parse(source.save.committedState);assert.deepEqual(state.turn.passedPlayerIds,["player-brown"]);assert.equal(state.meta.rngState.algorithm,"seti-simulation-mulberry32-v1");
}finally{env.dispose()}
// Fault injection exercises the actual submit boundary; no autonomous input.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"seti-teacher-r4-gate-"));
try{
 const preload=path.join(dir,"fault.cjs"),api=path.join(root,"randomizer/game/ai/search-agent.js");
 fs.writeFileSync(preload,`const id=require.resolve(${JSON.stringify(api)}),a=require(id);require.cache[id].exports={...a,createSearchAgent:()=>({getProvenance:()=>({type:"search",version:a.VERSION}),decide:c=>({actionId:c.legalActions[0].actionId,search:{complete:true,actionId:c.legalActions[0].actionId,diagnostics:{nativeExecutions:257},rootAndSearchMilliseconds:10,roots:[],lines:[],unresolved:[]}}),loadCheckpoint(){},createCheckpoint(){return null;}})};`);
 const args=["tools/run_research_validation.js","--name","teacher-r4-gate-unit","--full","--config",`agentType=search,scenario=${scenario.ID},compactReplay=true`,"--no-save","--records-dir",dir];
 const run=()=>spawnSync(process.execPath,args,{cwd:root,env:{...process.env,NODE_OPTIONS:`${process.env.NODE_OPTIONS||""} --require=${preload}`},encoding:"utf8"});
 const first=run();assert.equal(first.status,1,first.stderr);
 const file=path.join(dir,fs.readdirSync(dir).find(p=>p.endsWith(".full.json"))),bytes=fs.readFileSync(file),record=JSON.parse(bytes);
 assert.equal(record.failure.code,"WHITE_ONLY_DECISION_GATE_EXCEEDED",JSON.stringify(record.failure));assert.equal(record.steps,245);assert.equal(record.failure.failedDecisionCommitted,false);assert.deepEqual(record.rounds,[]);
 const checkpoint=JSON.parse(fs.readFileSync(path.resolve(root,record.failure.checkpointPath)));assert.deepEqual(checkpoint.coreState.compositionEnvelope,before.coreState.compositionEnvelope);
 assert.equal(run().status,2);assert.deepEqual(fs.readFileSync(file),bytes);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
// A settled checkpoint needs no autonomous decisions; terminal finalization
// must not assume the historical AI-continuation metadata exists.
const terminalDir=fs.mkdtempSync(path.join(os.tmpdir(),"seti-teacher-r4-terminal-"));
try{
 const preload=path.join(terminalDir,"terminal.cjs"),modulePath=path.join(root,"tools/research-human405-teacher-r4.js"),savePath=path.join(root,"seti-saves/seti-save-teacher-current-legal-reference-384-20261118-v1.json");
 fs.writeFileSync(preload,`const fs=require("fs"),api=require(${JSON.stringify(modulePath)});api.initialize=(env,config,metadata,{checkpointFromSave})=>{const save=JSON.parse(fs.readFileSync(${JSON.stringify(savePath)}));env.loadCheckpoint(checkpointFromSave(save,{...config,agentType:"custom",seat:"player-white"}));return save.replaySteps;};`);
 const args=["tools/run_research_validation.js","--name","teacher-r4-terminal-unit","--full","--config",`agentType=search,scenario=${scenario.ID},compactReplay=true`,"--no-save","--records-dir",terminalDir];
 const child=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,NODE_OPTIONS:`${process.env.NODE_OPTIONS||""} --require=${preload}`},encoding:"utf8"});assert.equal(child.status,0,child.stderr);
 const file=path.join(terminalDir,fs.readdirSync(terminalDir).find(p=>p.endsWith(".full.json"))),record=JSON.parse(fs.readFileSync(file));
 assert.equal(record.terminal,true);assert.equal(record.stopReason,"terminal");assert.equal(record.summary.scores["player-white"],384);assert.equal(record.steps,474);assert.deepEqual(record.metrics.searches,[]);
}finally{fs.rmSync(terminalDir,{recursive:true,force:true})}
// A changed fixture must be refused before loading it.
const file=path.join(root,identity.scenario.controlledTeacherPrefix.savePath),bytes=fs.readFileSync(file);
try{fs.appendFileSync(file," ");assert.throws(()=>scenario.source(),/ADMISSION_DRIFT/);}finally{fs.writeFileSync(file,bytes)}
console.log(JSON.stringify({exact245InputRootAndRng:true,teacherFirst3Explicit:true,onlyBrownPassed:true,overLimitRejectedBeforeInput:true,duplicateRejected:true,fixtureDriftRejected:true}));
