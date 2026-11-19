"use strict";
// Exact teacher R4 control. Only the fourth round is autonomous.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const first=require("./research-human405-round1");
const ID="human405-white-teacher-r4-v1",IDS=Object.freeze([ID]),ROOT=path.resolve(__dirname,"..");
const PINS={
  "reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.json": "9ba1ecef66185351b6cbb0e462d640ca2000f231fe86fb54c11c8451f29c3bac",
  "reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.checkpoint.json": "ab9a0dbbb3c35c453604addd668bd2625a4580c0577924d87c6cb8eff9c01b9c",
  "reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json": "ccb043fa96b57a2f646555803571187196d0bdfe21e48c56b501639be31ad6da",
  "reports/ai-foundation-20261119/teacher-r4-same-start-preparation-20261119-v1.json": "b5b293e5e35b70901fdf1a1d4a0f5ff5908ad8c02254dbd7f656268342b773bc",
  "reports/ai-foundation-20261119/teacher-r4-same-start-cold-search-20261119-v1.json": "3363c35192066a8e3d3b65fc28eaeb67b401c10a28cf2968a82113e923d03bab",
  "seti-saves/seti-save-teacher-r4-same-start-before246-20261119-v1.json": "65ef9c2e7de685c4faf76a1343c363364ea5f006cec434d108d15cba6a826a2d"
};
const PREFLIGHT="reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json";
const PREPARATION="reports/ai-foundation-20261119/teacher-r4-same-start-preparation-20261119-v1.json";
const GATE="reports/ai-foundation-20261119/teacher-r4-same-start-cold-search-20261119-v1.json";
const SAVE="seti-saves/seti-save-teacher-r4-same-start-before246-20261119-v1.json";
function source(){
 const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p))),sha=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,p))).digest("hex");
 for(const [p,h]of Object.entries(PINS))assert.equal(sha(p),h,"TEACHER_R4_ADMISSION_DRIFT:"+p);
 const pre=read(PREFLIGHT),proof=read(PREPARATION),gate=read(GATE),save=read(SAVE);
 for(const [p,h]of Object.entries(pre.sourceFiles))if(p.startsWith("randomizer/"))assert.equal(sha(p),h,"TEACHER_R4_POLICY_DRIFT:"+p);
 assert.equal(proof.status,"verified");assert(proof.fullTeacher474InputsVerified&&proof.fresh245PrefixNativeAndRngExact);
 assert.equal(gate.sourceCommit,pre.sourceCommit);assert.equal(gate.status,"complete");
 assert(gate.cold.complete&&gate.cold.gatePassed&&gate.cold.rootAndRngUnchanged&&gate.cold.nativeInputs<=256&&gate.cold.milliseconds<=600);
 assert.equal(save.replaySteps.length,245);assert.equal(save.session,null);assert.deepEqual(save.machineAI,{});
 const state=JSON.parse(save.committedState);
 assert.equal(state.turn.roundNumber,4);assert.equal(state.turn.currentPlayerId,"player-white");assert.deepEqual(state.turn.passedPlayerIds,["player-brown"]);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),first.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 return{save,provenance:{sourcePolicyCommit:pre.sourceCommit,savePath:SAVE,saveSha256:PINS[SAVE],preparationPath:PREPARATION,preparationSha256:PINS[PREPARATION],gatePath:GATE,gateSha256:PINS[GATE],controlledPrefixInputs:245}};
}
function describe(identity,options={}){
 assert.equal(identity.flags?.scenario,ID,"RESEARCH_SCENARIO_UNKNOWN");
 if(!options.full)throw Error("TEACHER_R4_REQUIRES_FULL_MODE");
 if(identity.agentType!=="search"||identity.activePlayerCount!==4||identity.seed!=="seti-free-analyze-v1")throw Error("TEACHER_R4_CONFIGURATION_INVALID");
 const prepared=source(),base=first.describe({...identity,flags:{...identity.flags,scenario:first.FIRST_THREE_ROUNDS_ID}});
 return{...base,id:ID,openingInputs:245,originalOpeningInputs:23,stopAfterRound:null,controlledTeacherPrefix:prepared.provenance,
  autonomousScope:"round4-only",controlledTeacherRounds:[1,2,3],comparisonScope:"white-only-fourth-round-from-exact-teacher-start",
  scoreSemantics:"terminal-score-with-teacher-controlled-first-three-rounds",baselineEligible:false,
  decisionGate:{nativeInputs:256,milliseconds:600,enforcement:"reject-before-input"},gameMillisecondsTarget:180000};
}
function initialize(env,config,metadata,{checkpointFromSave}={}){
 assert.equal(metadata.id,ID);const prepared=source();assert.deepEqual(metadata.controlledTeacherPrefix,prepared.provenance);
 const save=prepared.save;env.loadCheckpoint(checkpointFromSave(save,{...config,agentType:"custom",seat:"player-white",opponentIdentity:metadata.opponentPolicyVersion}));
 const restored=env.saveBrowserSave();assert.equal(restored.committedState,save.committedState);assert.deepEqual(restored.session,save.session);assert.deepEqual(restored.replaySteps,save.replaySteps);assert.deepEqual(restored.machineAI,{});
 return restored.replaySteps;
}
function settled(observation){return observation.terminal===true||observation.publicState.terminal===true;}
module.exports={ID,IDS,source,describe,initialize,createEnvironment:first.createEnvironment,settled};
