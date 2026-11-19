"use strict";
// Fresh current-policy game from the verified23-input opening. Historical
// frozen continuations keep their own source and checkpoint contracts.
const assert = require("node:assert/strict");
const first = require("./research-human405-round1");
const ID = "human405-white-current-full-v1";
const BLUE1_ID='human405-white-blue1-slot2-control-v1',BLUE3_ID='human405-white-blue3-slot2-control-v1';
const IDS = Object.freeze([ID,BLUE1_ID,BLUE3_ID]);
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const CONTROL_SOURCES=Object.freeze({
  "human405-white-blue1-slot2-control-v1": {
    "file": "reports/ai-foundation-20261119/blue-tech-blue1-preparation-20261119-v1.json",
    "sha256": "59ace6cb950594d59f0fb8080b72b37395443508ed7bb438d7b5b736c3b79cc5",
    "technology": "blue1"
  },
  "human405-white-blue3-slot2-control-v1": {
    "file": "reports/ai-foundation-20261119/blue-tech-blue3-preparation-20261119-v1.json",
    "sha256": "de56e4d0eb11a04aab39994bb79f24f24a95eae0d9ff3a757796c93d1663aaec",
    "technology": "blue3"
  }
});
function controlledBlueSource(id){
  const spec=CONTROL_SOURCES[id];assert(spec,'BLUE_TECH_CONTROL_UNKNOWN');const bytes=fs.readFileSync(path.resolve(__dirname,'..',spec.file)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha(bytes),spec.sha256,'BLUE_TECH_CONTROL_PREPARATION_DRIFT');const proof=JSON.parse(bytes);
  for(const[p,h]of Object.entries(proof.runtimeSourceHashes))assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'..',p))),h,'BLUE_TECH_CONTROL_POLICY_DRIFT:'+p);
  const saveBytes=fs.readFileSync(path.resolve(__dirname,'..',proof.savePath));assert.equal(sha(saveBytes),proof.saveSha256,'BLUE_TECH_CONTROL_SAVE_DRIFT');assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'..',proof.archivePath))),proof.archiveSha256,'BLUE_TECH_CONTROL_NATIVE_PROOF_DRIFT');
  const save=JSON.parse(saveBytes),state=save.session?.session?.workingState||JSON.parse(save.committedState),p=state.players.players.find(p=>p.id==='player-white');assert.equal(save.seed,proof.seed);assert.equal(save.seed,'seti-free-analyze-v1');assert.equal(save.replaySteps.length,105);assert.deepEqual(save.machineAI,{});assert.equal(state.turn.roundNumber,2);assert.equal(state.turn.currentPlayerId,'player-white');assert.equal(proof.technology,spec.technology);assert(p.techState.ownedTiles[spec.technology]&&p.techState.blueBoardSlots[spec.technology]===2);assert.equal(Boolean(save.session),proof.allowPendingSession);assert(!state.turn.gameEnded);
  return{save,provenance:{sourcePolicyCommit:proof.sourcePolicyCommit,savePath:proof.savePath,saveSha256:proof.saveSha256,preparationPath:spec.file,preparationSha256:spec.sha256,nativeArchive:proof.archivePath,nativeArchiveSha256:proof.archiveSha256,originalInputs:103,fixedPurposeInputs:2,controlledPrefixInputs:105,inheritedAutonomousInputs:0,completedRoundsBeforeContinuation:1,technology:spec.technology,blueSlot:2,pendingNativeReward:Boolean(save.session)}};
}

function describe(identity, options = {}) {
  if (!IDS.includes(identity.flags?.scenario)) throw Error("RESEARCH_SCENARIO_UNKNOWN");
  if (!options.full) throw Error("WHITE_CURRENT_FULL_REQUIRES_FULL_MODE");
  const base = first.describe({ ...identity, flags: { ...identity.flags, scenario: first.FIRST_THREE_ROUNDS_ID } });
  const id=identity.flags.scenario,control=CONTROL_SOURCES[id]?controlledBlueSource(id):null;
  return { ...base, id, originalOpeningInputs: 23, stopAfterRound: null,
    autonomousScope: "rounds1-4", comparisonScope: "white-only-current-full-game",
    scoreSemantics: "terminal-score-with-passive-opponents", baselineEligible: false,
    decisionGate: { ...base.decisionGate, enforcement: "reject-before-input" }, gameMillisecondsTarget: 180000,
    ...(control?{openingInputs:105,controlledPurposePrefix:control.provenance,autonomousScope:"after-single-blue-technology-intervention",comparisonScope:"white-only-blue-slot2-controlled-continuation",scoreSemantics:"terminal-score-with-fixed-blue-technology-prefix"}:{}) };
}
function createEnvironment(options = {}, metadata = {}) { return first.createEnvironment(options, metadata); }
function initialize(env, config, metadata, {checkpointFromSave}={}) {
  if(CONTROL_SOURCES[metadata.id]){
    const prepared=controlledBlueSource(metadata.id);assert.deepEqual(metadata.controlledPurposePrefix,prepared.provenance);assert.equal(config.seed,prepared.save.seed);
    env.loadCheckpoint(checkpointFromSave(prepared.save,{...config,agentType:'custom',seat:'player-white',opponentIdentity:metadata.opponentPolicyVersion}));
    const restored=env.saveBrowserSave();assert.equal(restored.committedState,prepared.save.committedState);assert.deepEqual(restored.session,prepared.save.session);assert.deepEqual(restored.replaySteps,prepared.save.replaySteps);assert.deepEqual(restored.machineAI,{});return restored.replaySteps;
  }
  assert.equal(metadata.id, ID, "RESEARCH_SCENARIO_UNKNOWN");
  assert.equal(metadata.openingInputs, 23, "WHITE_CURRENT_FULL_OPENING_COUNT_DRIFT");
  return first.initialize(env, config, { ...metadata, id: first.FIRST_THREE_ROUNDS_ID });
}
function settled(observation) { return observation.terminal === true || observation.publicState.terminal === true; }
module.exports = { ID, IDS, BLUE1_ID, BLUE3_ID, controlledBlueSource, describe, createEnvironment, initialize, settled };
