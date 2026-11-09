'use strict';
// Continue the verified v123 white-only R1. No AI strategy or native state edits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const firstRound=require('./research-human405-round1'),search=require('../randomizer/game/ai/search-agent'),{createSimulationEnv}=require('../randomizer/app/simulation-env');
const ROOT=path.resolve(__dirname,'..'),ID='human405-white-full-v1',SOURCE='reports/research/19bd7474.94530144.quick-200.json',PROOF='reports/ai-foundation-20261023/human405-v123-completion-runtime-source-check-20261031-v1.json';
const V189_ID='human405-white-v189-full-v1',V189_SOURCE='reports/research/e01243ba.93989585.quick-400.json',V189_PROOF='reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json';
const V661_ID='human405-white-v661-full-v1',V661_DIR='reports/ai-foundation-20261109/v661-early-transport-boundary-v1/';
const V661_SOURCE='reports/research/815da7fc.de3eb34e.quick-400.json',V661_PROOF=V661_DIR+'v661-first3-native-development-20261109-v1.json';
const IDS=Object.freeze([ID,V189_ID,V661_ID]);
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p))),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
function v189Continuation(){
 const record=read(V189_SOURCE),proof=read(V189_PROOF),save=read(record.savePath),state=JSON.parse(save.committedState);
 assert.equal(record.gitCommit,'93989585');assert.equal(record.steps,125);assert.equal(record.scenario.id,firstRound.TWO_ROUND_ID);assert(!record.terminal);assert.equal(state.turn.roundNumber,3);assert.equal(save.session,null);
 assert.deepEqual(record.roundEnds.map(r=>[r.round,r.score]),[[1,15],[2,50]]);assert(proof.firstTwoRoundLearningRequirementsProven);
 const verification=read('reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-native-verification-20261105-v1.json');
 for(const [p,h]of [[V189_SOURCE,verification.recordSha256],[record.savePath,verification.saveSha256],[record.agentTracePath,verification.traceSha256]])assert.equal(sha(p),h,'V189_CONTINUATION_SOURCE_DRIFT:'+p);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),firstRound.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 for(const [p,h]of Object.entries(proof.runtimeSourceHashes))if(p.startsWith('randomizer/'))assert.equal(sha(p),h,'FULL_CONTINUATION_STRATEGY_DRIFT:'+p);
 return{record,save,provenance:{recordPath:V189_SOURCE,recordSha256:sha(V189_SOURCE),savePath:record.savePath,saveSha256:sha(record.savePath),tracePath:record.agentTracePath,traceSha256:sha(record.agentTracePath),proofPath:V189_PROOF,proofSha256:sha(V189_PROOF),sourceCommit:proof.sourceCommit,steps:125,sourceCompletedRounds:2,sourceGameWallMs:record.wallMs,sourceRoundWallMs:record.wallMs}};
}
function v661Continuation(){
 const record=read(V661_SOURCE),proof=read(V661_PROOF),save=read(record.savePath),state=JSON.parse(save.committedState);
 const admission=read(V661_DIR+'v661-source-admission-proof-20261109-v1.json'),manifest=read(admission.manifest);
 assert.equal(proof.sourceCommit,'de3eb34e28aae4f87a891419b1f3a7b607534434');
 assert(record.gitCommit.length>=8&&proof.sourceCommit.startsWith(record.gitCommit));assert.equal(record.steps,259);
 assert.equal(record.scenario.id,firstRound.FIRST_THREE_ROUNDS_ID);assert(!record.terminal);
 assert(proof.completed&&proof.nativeRoundAndFinalStateSessionRngExact&&admission.sourceAdmitted);
 assert.equal(state.turn.roundNumber,4);assert.equal(save.session,null);
 assert.deepEqual(record.roundEnds.map(r=>[r.round,r.score]),[[1,15],[2,48],[3,118]]);
 for(const [p,h] of [[V661_SOURCE,proof.recordSha256],[record.savePath,proof.saveSha256],[record.agentTracePath,proof.traceSha256],[proof.checkpoint,proof.checkpointSha256],[admission.manifest,admission.manifestSha256],...Object.entries(manifest.runtimeHashes),...record.roundEnds.map(r=>[r.checkpointPath,r.checkpointSha256])])
  assert.equal(sha(p),h,'V661_CONTINUATION_SOURCE_DRIFT:'+p);
 const native=read(proof.checkpoint).envelope;
 assert.equal(native.committedState,save.committedState);assert.deepEqual(native.session,save.session);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),firstRound.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 return{record,save,provenance:{recordPath:V661_SOURCE,recordSha256:proof.recordSha256,savePath:record.savePath,saveSha256:proof.saveSha256,
  tracePath:record.agentTracePath,traceSha256:proof.traceSha256,proofPath:V661_PROOF,proofSha256:sha(V661_PROOF),
  sourceCommit:proof.sourceCommit,steps:259,sourceCompletedRounds:3,sourceGameWallMs:record.wallMs,sourceRoundWallMs:record.wallMs}};
}
function continuation(id=ID){
 if(id===V661_ID)return v661Continuation();
 if(id===V189_ID)return v189Continuation();
 assert.equal(id,ID,'RESEARCH_SCENARIO_UNKNOWN');
 const record=read(SOURCE),proof=read(PROOF),save=read(record.savePath),state=JSON.parse(save.committedState);
 assert.equal(record.gitCommit,'94530144');assert.equal(record.steps,64);assert.equal(record.scenario.id,firstRound.ID);assert(record.scenarioResult.firstRoundSettled&&!record.terminal);assert.equal(state.turn.roundNumber,2);assert.equal(save.session,null);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),firstRound.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 for(const [p,h]of Object.entries(proof.runtimeSourceHashes))if(p.startsWith('randomizer/'))assert.equal(sha(p),h,'FULL_CONTINUATION_STRATEGY_DRIFT:'+p);
 return{record,save,provenance:{recordPath:SOURCE,recordSha256:sha(SOURCE),savePath:record.savePath,saveSha256:sha(record.savePath),tracePath:record.agentTracePath,traceSha256:sha(record.agentTracePath),proofPath:PROOF,proofSha256:sha(PROOF),sourceCommit:proof.sourceCommit,steps:64,sourceRoundWallMs:record.wallMs}};
}
function describe(identity,options={}){
 if(!IDS.includes(identity.flags?.scenario))throw Error('RESEARCH_SCENARIO_UNKNOWN');
 if(!options.full)throw Error('WHITE_ONLY_FULL_REQUIRES_FULL_MODE');
 if(identity.agentType!=='search'||identity.activePlayerCount!==4||identity.seed!=='seti-free-analyze-v1')throw Error('WHITE_ONLY_FULL_CONFIGURATION_INVALID');
 const source=continuation(identity.flags.scenario);return{id:identity.flags.scenario,learnerSeat:'player-white',learnerAgentType:'search',hostAgentFactory:'custom-seat-roles',opponentPolicyVersion:source.record.scenario.opponentPolicyVersion,roles:source.record.scenario.roles,opponentReserveRule:source.record.scenario.opponentReserveRule,openingInputs:source.provenance.steps,originalOpeningInputs:23,openingCheckpointSha256:firstRound.opening().sha256,continuation:source.provenance,stopAfterRound:null,comparisonScope:'white-only-full-game',scoreSemantics:'terminal-score-with-passive-opponents',...(identity.flags.scenario!==ID?{roundEndPhase:'before-pass-card-and-income'}:{}),decisionGate:{nativeInputs:256,milliseconds:600,enforcement:'measure-only'},gameMillisecondsTarget:180000};
}
function createEnvironment(options={}){return createSimulationEnv({...options,agentFactory:context=>context.seatId==='player-white'?search.createSearchAgent({seatId:context.seatId,analysisPort:context.analysisPort}):firstRound.passiveAgent(context.seatId)});}
function initialize(env,config,metadata,{checkpointFromSave}={}){
 const source=continuation(metadata.id);assert.deepEqual(metadata.continuation,source.provenance,'FULL_CONTINUATION_PROVENANCE_DRIFT');assert.equal(typeof checkpointFromSave,'function');
 env.loadCheckpoint(checkpointFromSave(source.save,{...config,agentType:'custom',seat:'player-white',opponentIdentity:metadata.opponentPolicyVersion}));
 const restored=env.saveBrowserSave();assert.equal(restored.committedState,source.save.committedState);assert.deepEqual(restored.session,source.save.session);assert.deepEqual(restored.replaySteps,source.save.replaySteps);assert.deepEqual(restored.machineAI,source.save.machineAI);assert.equal(restored.replaySteps.length,source.provenance.steps);return restored.replaySteps;
}
function settled(observation){return observation.terminal===true||observation.publicState.terminal===true;}
function inputCount(checkpoint){return (checkpoint.browserReplaySteps||[]).length+checkpoint.replayCursor.stepIndex;}
function roundSummary(env,round,elapsedMs){
 const checkpoint=env.createCheckpoint(),envelope=checkpoint.coreState.compositionEnvelope;if(envelope.session)throw Error('ROUND_SETTLEMENT_PENDING');
 const state=JSON.parse(envelope.committedState),observation=env.observe('player-white');
 return{round,nextRound:state.turn.roundNumber,terminal:env.isTerminal(),steps:inputCount(checkpoint),elapsedMs,players:state.players.players.map(p=>{const visible=observation.publicState.players.find(x=>x.playerId===p.id);return{seat:p.id,score:p.resources.score,finalScore:visible.finalScore??null,technology:Object.keys(p.techState.ownedTiles).filter(id=>p.techState.ownedTiles[id]&&!p.techState.disabledTiles[id]),income:p.income,resources:p.resources,handCount:p.hand.length,reservedCount:p.reservedCards.length,...(p.id==='player-white'?{hand:p.hand.map(c=>c.cardId),reserved:p.reservedCards.map(c=>c.cardId)}:{})};})};
}
module.exports={ID,V189_ID,V661_ID,IDS,describe,continuation,createEnvironment,initialize,settled,roundSummary,inputCount};
