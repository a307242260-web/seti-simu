"use strict";
// One fixed legal analysis/Io purpose, followed by unchanged shared AI.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const first=require("./research-human405-round1"),ROOT=path.resolve(__dirname,".."),ID="human405-white-r4-resource-io-control-v1";
const PINS={
  "reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json": "ccb043fa96b57a2f646555803571187196d0bdfe21e48c56b501639be31ad6da",
  "reports/ai-foundation-20261119/r4-resource-cycle-control-preparation-20261119-v1.json": "c3b70ec1fad8dfc27837b1eb788f9bd2a980f4443aab27253f76cb2244121829",
  "reports/ai-foundation-20261119/teacher-r4-held-pickup-io-cold-20261119-v1.json": "5e0ce204ee784142138a4b4777862adf360051f096bf9ac7c5ff0d6d443c9c36",
  "reports/ai-foundation-20261119/teacher-r4-held-pickup-io-20261119-v1.json.gz": "81ca149984f49b3d887deab81c9d447cd074e096ab62ded2c9bdd549af453340",
  "seti-saves/seti-save-r4-resource-cycle-io-control-20261119-v1.json": "f332e83ad83b419f102c961131495675c00f5e22c1e29083cdcd75e1e75375b8"
};
const [PREFLIGHT,PREPARATION,GATE,ENDPOINT,SAVE]=Object.keys(PINS);
function source(){
 const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,p))).digest("hex"),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p)));
 for(const[p,h]of Object.entries(PINS))assert.equal(sha(p),h,"RESOURCE_IO_CONTROL_INPUT_DRIFT:"+p);
 const pre=read(PREFLIGHT),proof=read(PREPARATION),gate=read(GATE),save=read(SAVE);
 for(const[p,h]of Object.entries(pre.sourceFiles))if(p.startsWith("randomizer/"))assert.equal(sha(p),h,"RESOURCE_IO_CONTROL_POLICY_DRIFT:"+p);
 assert.equal(proof.status,"verified");assert(proof.fullNativeStateSessionAndRngExact);assert.equal(proof.nativeInputs,21);assert.equal(gate.sourceSha256,PINS[ENDPOINT]);assert.equal(gate.status,"complete");assert(gate.cold.complete&&gate.cold.gatePassed&&gate.cold.rootAndRngUnchanged&&gate.cold.nativeInputs<=256&&gate.cold.milliseconds<=600);
 assert.equal(save.replaySteps.length,283);assert.deepEqual(save.machineAI,{});assert.equal(save.session,null);
 const state=JSON.parse(save.committedState);assert.equal(state.turn.roundNumber,4);assert.equal(state.turn.turnNumber,8);assert.equal(state.turn.currentPlayerId,"player-white");assert.deepEqual([...state.turn.passedPlayerIds].sort(),["player-blue","player-brown","player-green"]);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),first.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 return{save,provenance:{sourcePolicyCommit:pre.sourceCommit,savePath:SAVE,saveSha256:PINS[SAVE],preparationPath:PREPARATION,preparationSha256:PINS[PREPARATION],gatePath:GATE,gateSha256:PINS[GATE],teacherInputs:245,fixedAIPrefixInputs:17,interventionFirstInput:263,fixedPurposeInputs:21,controlledPrefixInputs:283,intervention:"analysis-then-held-card-io-landing; fixed-action-order-fossil-pick"}};
}
function describe(identity,options={}){
 assert.equal(identity.flags?.scenario,ID,"RESEARCH_SCENARIO_UNKNOWN");if(!options.full)throw Error("RESOURCE_IO_CONTROL_REQUIRES_FULL_MODE");
 if(identity.agentType!=="search"||identity.activePlayerCount!==4||identity.seed!=="seti-free-analyze-v1")throw Error("RESOURCE_IO_CONTROL_CONFIGURATION_INVALID");
 const prepared=source(),base=first.describe({...identity,flags:{...identity.flags,scenario:first.FIRST_THREE_ROUNDS_ID}});
 return{...base,id:ID,openingInputs:283,originalOpeningInputs:23,stopAfterRound:null,controlledTeacherPrefix:prepared.provenance,
 autonomousScope:"round4-after-fixed-analysis-io-purpose",controlledTeacherRounds:[1,2,3],comparisonScope:"white-only-r4-resource-route-intervention",
 scoreSemantics:"terminal-score-with-teacher-prefix-and-fixed-purpose-intervention",baselineEligible:false,decisionGate:{nativeInputs:256,milliseconds:600,enforcement:"reject-before-input"},gameMillisecondsTarget:180000};
}
function initialize(env,config,metadata,{checkpointFromSave}={}){
 const prepared=source();assert.equal(metadata.id,ID);assert.deepEqual(metadata.controlledTeacherPrefix,prepared.provenance);const save=prepared.save;
 env.loadCheckpoint(checkpointFromSave(save,{...config,agentType:"custom",seat:"player-white",opponentIdentity:metadata.opponentPolicyVersion}));
 const restored=env.saveBrowserSave();assert.equal(restored.committedState,save.committedState);assert.deepEqual(restored.session,save.session);assert.deepEqual(restored.replaySteps,save.replaySteps);assert.deepEqual(restored.machineAI,{});return restored.replaySteps;
}
module.exports={ID,source,describe,initialize};
