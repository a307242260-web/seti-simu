"use strict";
// Fresh current-policy game from the verified23-input opening. Historical
// frozen continuations keep their own source and checkpoint contracts.
const assert = require("node:assert/strict");
const first = require("./research-human405-round1");
const ID = "human405-white-current-full-v1";
const BLUE1_ID='human405-white-blue1-slot2-control-v1',BLUE3_ID='human405-white-blue3-slot2-control-v1';
const ORIGINAL_ROUTE_ID='human405-white-r2-original-route-control-v1',RETAINED_PROBE_ID='human405-white-r2-retain-probe-control-v1';
const AMIBA0_FIRST_ID='human405-white-r2-amiba0-first-control-v1',AMIBA1_FIRST_ID='human405-white-r2-amiba1-first-control-v1';
const R4_CHONG2_BASELINE_ID='human405-white-r4-chong2-baseline-control-v1',R4_CHONG2_DEPLOYED_ID='human405-white-r4-chong2-deployed-control-v1';
const R4_SCAN_BASELINE_ID='human405-white-r4-scan-engine-baseline-control-v1',R4_SCAN_DEPLOYED_ID='human405-white-r4-scan-engine-deployed-control-v1';
const IDS = Object.freeze([ID,BLUE1_ID,BLUE3_ID,ORIGINAL_ROUTE_ID,RETAINED_PROBE_ID,AMIBA0_FIRST_ID,AMIBA1_FIRST_ID,R4_CHONG2_BASELINE_ID,R4_CHONG2_DEPLOYED_ID,R4_SCAN_BASELINE_ID,R4_SCAN_DEPLOYED_ID]);
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const CONTROL_SOURCES=Object.freeze({
  "human405-white-r4-scan-engine-baseline-control-v1": {
    "file": "reports/ai-foundation-20261119/r4-scan-engine-baseline-preparation-20261119-v1.json",
    "sha256": "640f1d30ca1c967b3d8463f95fbb6d22b48efdfcb58ada67869bebb390384661",
    "technology": "blue1",
    "round": 4,
    "route": "r4-scan-engine-baseline",
    "r4ScanEngine": true
  },
  "human405-white-r4-scan-engine-deployed-control-v1": {
    "file": "reports/ai-foundation-20261119/r4-scan-engine-deployed-preparation-20261119-v1.json",
    "sha256": "cab6b8a425d4e0c1d14f535b678b5948473c077b9469f892cea83dcece2c409c",
    "technology": "blue1",
    "round": 4,
    "route": "r4-scan-engine-deployed",
    "r4ScanEngine": true
  },
  "human405-white-r4-chong2-baseline-control-v1": {
    "file": "reports/ai-foundation-20261119/r4-chong2-baseline-preparation-20261119-v1.json",
    "sha256": "5ec0f6ffa93ac8cbf6fb6ff7f81eb0f043113bd136c353d7c782d7fcfca848ef",
    "technology": "blue1",
    "round": 4,
    "route": "r4-chong2-baseline",
    "r4ScoringPurpose": true
  },
  "human405-white-r4-chong2-deployed-control-v1": {
    "file": "reports/ai-foundation-20261119/r4-chong2-deployed-preparation-20261119-v1.json",
    "sha256": "9730ee1089cbf8ffb91a62b400c4b90923051efbd36dca1a1b1ee2f21c18ee4b",
    "technology": "blue1",
    "round": 4,
    "route": "r4-chong2-deployed",
    "r4ScoringPurpose": true
  },
  "human405-white-r2-amiba0-first-control-v1": {
    "file": "reports/ai-foundation-20261119/amiba-engine-amiba0-preparation-20261119-v1.json",
    "sha256": "3326f939d327bb70a53355d8d0aee4f00c8b4461b47abd569153fa0feda186c7",
    "technology": "blue1",
    "route": "amiba0-first",
    "engineCard": "amiba0"
  },
  "human405-white-r2-amiba1-first-control-v1": {
    "file": "reports/ai-foundation-20261119/amiba-engine-amiba1-preparation-20261119-v1.json",
    "sha256": "5b578ae35ca0fa2889a788c16d6875082c43efc67da1f9c98d35a3eceb179a01",
    "technology": "blue1",
    "route": "amiba1-first",
    "engineCard": "amiba1"
  },
  "human405-white-blue1-slot2-control-v1": {
    "file": "reports/ai-foundation-20261119/blue-tech-blue1-preparation-20261119-v1.json",
    "sha256": "59ace6cb950594d59f0fb8080b72b37395443508ed7bb438d7b5b736c3b79cc5",
    "technology": "blue1"
  },
  "human405-white-blue3-slot2-control-v1": {
    "file": "reports/ai-foundation-20261119/blue-tech-blue3-preparation-20261119-v1.json",
    "sha256": "de56e4d0eb11a04aab39994bb79f24f24a95eae0d9ff3a757796c93d1663aaec",
    "technology": "blue3"
  },
  "human405-white-r2-original-route-control-v1": {
    "file": "reports/ai-foundation-20261119/retained-probe-original-preparation-20261119-v1.json",
    "sha256": "6f23c6786995dd5d9f4eb78e40312f92e268dcf24d9fdf7fa06c50857be66595",
    "technology": "blue3",
    "route": "original"
  },
  "human405-white-r2-retain-probe-control-v1": {
    "file": "reports/ai-foundation-20261119/retained-probe-retained-preparation-20261119-v1.json",
    "sha256": "c90c55745104fca1a51c26d1c62493c258b1fee8c19df907300fd1cb64ae279a",
    "technology": "blue1",
    "route": "retained"
  }
});
function controlledBlueSource(id){
  const spec=CONTROL_SOURCES[id];assert(spec,'BLUE_TECH_CONTROL_UNKNOWN');const bytes=fs.readFileSync(path.resolve(__dirname,'..',spec.file)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha(bytes),spec.sha256,'BLUE_TECH_CONTROL_PREPARATION_DRIFT');const proof=JSON.parse(bytes);
  for(const[p,h]of Object.entries(proof.runtimeSourceHashes))assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'..',p))),h,'BLUE_TECH_CONTROL_POLICY_DRIFT:'+p);
  const saveBytes=fs.readFileSync(path.resolve(__dirname,'..',proof.savePath));assert.equal(sha(saveBytes),proof.saveSha256,'BLUE_TECH_CONTROL_SAVE_DRIFT');assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'..',proof.archivePath))),proof.archiveSha256,'BLUE_TECH_CONTROL_NATIVE_PROOF_DRIFT');
  const save=JSON.parse(saveBytes),state=save.session?.session?.workingState||JSON.parse(save.committedState),p=state.players.players.find(p=>p.id==='player-white');assert.equal(save.seed,proof.seed);assert.equal(save.seed,'seti-free-analyze-v1');assert.equal(save.replaySteps.length,proof.nativePrefixInputs);assert.deepEqual(save.machineAI,{});assert.equal(state.turn.roundNumber,spec.round||2);assert.equal(proof.roundNumber,spec.round||2);assert.equal(state.turn.currentPlayerId,'player-white');assert.equal(proof.technology,spec.technology);assert(p.techState.ownedTiles[spec.technology]&&p.techState.blueBoardSlots[spec.technology]===2);assert.equal(Boolean(save.session),proof.allowPendingSession);assert(!state.turn.gameEnded);if(spec.engineCard){assert.equal(proof.firstPlayedCard,spec.engineCard);const last=save.replaySteps.at(-1).action;assert.equal(last.family,'play_card');assert.equal(last.target.cardInstanceId,proof.firstPlayedCardInstanceId);}
  return{save,provenance:{sourcePolicyCommit:proof.sourcePolicyCommit,savePath:proof.savePath,saveSha256:proof.saveSha256,preparationPath:spec.file,preparationSha256:spec.sha256,nativeArchive:proof.archivePath,nativeArchiveSha256:proof.archiveSha256,originalInputs:proof.originalPrefixInputs,fixedPurposeInputs:proof.fixedPurposeInputs,controlledPrefixInputs:proof.nativePrefixInputs,inheritedAutonomousInputs:proof.inheritedAutonomousInputs||0,completedRoundsBeforeContinuation:proof.roundNumber-1,technology:spec.technology,blueSlot:2,pendingNativeReward:Boolean(save.session),...(spec.route?{route:spec.route}:{}),...(spec.engineCard?{engineCard:spec.engineCard}:{}),...(spec.r4ScoringPurpose?{r4ScoringPurpose:true}:{}),...(spec.r4ScanEngine?{r4ScanEngine:true}:{})}};
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
    ...(control?{openingInputs:control.provenance.controlledPrefixInputs,controlledPurposePrefix:control.provenance,autonomousScope:control.provenance.r4ScanEngine?"round4-after-scan-engine-deployment":control.provenance.r4ScoringPurpose?"round4-after-paid-scoring-card-purpose":control.provenance.engineCard?"after-single-amiba-deployment-intervention":control.provenance.route?"after-fixed-round2-route":"after-single-blue-technology-intervention",comparisonScope:control.provenance.r4ScanEngine?"white-only-r4-scan-engine-deployment":control.provenance.r4ScoringPurpose?"white-only-r4-chong2-preservation-purpose":control.provenance.engineCard?"white-only-amiba-engine-controlled-continuation":control.provenance.route?"white-only-retained-probe-route-continuation":"white-only-blue-slot2-controlled-continuation",scoreSemantics:control.provenance.r4ScanEngine?"terminal-score-with-teacher-prefix-and-fixed-scan-engine-deployment":control.provenance.r4ScoringPurpose?"terminal-score-with-teacher-prefix-and-fixed-chong2-purpose":control.provenance.engineCard?"terminal-score-with-fixed-amiba-deployment-prefix":control.provenance.route?"terminal-score-with-fixed-round2-route-prefix":"terminal-score-with-fixed-blue-technology-prefix"}:{}) };
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
module.exports = { ID, IDS, BLUE1_ID, BLUE3_ID, ORIGINAL_ROUTE_ID, RETAINED_PROBE_ID, AMIBA0_FIRST_ID, AMIBA1_FIRST_ID, R4_CHONG2_BASELINE_ID, R4_CHONG2_DEPLOYED_ID, R4_SCAN_BASELINE_ID, R4_SCAN_DEPLOYED_ID, controlledBlueSource, describe, createEnvironment, initialize, settled };
