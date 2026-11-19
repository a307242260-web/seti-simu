"use strict";
// One controlled free-card choice; all subsequent policy decisions are unchanged.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const first=require("./research-human405-round1"),ROOT=path.resolve(__dirname,".."),ID="human405-white-r4-free-blind-control-v1";
const PINS={
  "reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json": "ccb043fa96b57a2f646555803571187196d0bdfe21e48c56b501639be31ad6da",
  "reports/ai-foundation-20261119/teacher-r4-free-pick-preparation-20261119-v1.json": "263870156fb92dcd79809b3da42dd66a570d7af59127f0ea38a43ba8c7550302",
  "reports/ai-foundation-20261119/teacher-r4-blind-after287-cold-20261119-v1.json": "6892df999ffedfc655167d988194e9cedc95892bb3089feb5e72aaa22213999e",
  "seti-saves/seti-save-teacher-r4-blind-after287-20261119-v1.json": "a51b0b3f3414caf222b5eef5eb50be36bb159d1f94936dc491e87b5031ffb407"
};
const [PREFLIGHT,PREPARATION,GATE,SAVE]=Object.keys(PINS);
function source(){
 const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,p))).digest("hex"),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p)));
 for(const[p,h]of Object.entries(PINS))assert.equal(sha(p),h,"FREE_PICK_CONTROL_INPUT_DRIFT:"+p);
 const pre=read(PREFLIGHT),proof=read(PREPARATION),gate=read(GATE),save=read(SAVE);
 for(const[p,h]of Object.entries(pre.sourceFiles))if(p.startsWith("randomizer/"))assert.equal(sha(p),h,"FREE_PICK_CONTROL_POLICY_DRIFT:"+p);
 assert.equal(proof.status,"verified");assert(proof.exactActualInput287Observation);assert.equal(gate.status,"complete");assert(gate.cold.complete&&gate.cold.gatePassed&&gate.cold.rootAndRngUnchanged&&gate.cold.nativeInputs<=256&&gate.cold.milliseconds<=600);
 assert.equal(save.replaySteps.length,287);assert.equal(save.replaySteps[286].action.target.source,"blind");assert.deepEqual(save.machineAI,{});
 const state=JSON.parse(save.committedState);assert.equal(state.turn.roundNumber,4);assert.equal(state.turn.currentPlayerId,"player-white");assert.deepEqual([...state.turn.passedPlayerIds].sort(),["player-blue","player-brown","player-green"]);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),first.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 return{save,provenance:{sourcePolicyCommit:pre.sourceCommit,savePath:SAVE,saveSha256:PINS[SAVE],preparationPath:PREPARATION,preparationSha256:PINS[PREPARATION],gatePath:GATE,gateSha256:PINS[GATE],teacherInputs:245,fixedAIPrefixInputs:41,interventionInput:287,intervention:"one-legal-free-blind-chong-choice",controlledPrefixInputs:287}};
}
function describe(identity,options={}){
 assert.equal(identity.flags?.scenario,ID,"RESEARCH_SCENARIO_UNKNOWN");if(!options.full)throw Error("FREE_PICK_CONTROL_REQUIRES_FULL_MODE");
 if(identity.agentType!=="search"||identity.activePlayerCount!==4||identity.seed!=="seti-free-analyze-v1")throw Error("FREE_PICK_CONTROL_CONFIGURATION_INVALID");
 const prepared=source(),base=first.describe({...identity,flags:{...identity.flags,scenario:first.FIRST_THREE_ROUNDS_ID}});
 return{...base,id:ID,openingInputs:287,originalOpeningInputs:23,stopAfterRound:null,controlledTeacherPrefix:prepared.provenance,
 autonomousScope:"round4-after-single-free-pick-intervention",controlledTeacherRounds:[1,2,3],comparisonScope:"white-only-r4-single-free-card-intervention",
 scoreSemantics:"terminal-score-with-teacher-prefix-and-one-free-card-intervention",baselineEligible:false,decisionGate:{nativeInputs:256,milliseconds:600,enforcement:"reject-before-input"},gameMillisecondsTarget:180000};
}
function initialize(env,config,metadata,{checkpointFromSave}={}){
 const prepared=source();assert.equal(metadata.id,ID);assert.deepEqual(metadata.controlledTeacherPrefix,prepared.provenance);const save=prepared.save;
 env.loadCheckpoint(checkpointFromSave(save,{...config,agentType:"custom",seat:"player-white",opponentIdentity:metadata.opponentPolicyVersion}));
 const restored=env.saveBrowserSave();assert.equal(restored.committedState,save.committedState);assert.deepEqual(restored.session,save.session);assert.deepEqual(restored.replaySteps,save.replaySteps);assert.deepEqual(restored.machineAI,{});return restored.replaySteps;
}
module.exports={ID,source,describe,initialize};
