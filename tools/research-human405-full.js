'use strict';
// Continue the verified v123 white-only R1. No AI strategy or native state edits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const firstRound=require('./research-human405-round1'),search=require('../randomizer/game/ai/search-agent'),{createSimulationEnv}=require('../randomizer/app/simulation-env');
const ROOT=path.resolve(__dirname,'..'),ID='human405-white-full-v1',SOURCE='reports/research/19bd7474.94530144.quick-200.json',PROOF='reports/ai-foundation-20261023/human405-v123-completion-runtime-source-check-20261031-v1.json';
const V189_ID='human405-white-v189-full-v1',V189_SOURCE='reports/research/e01243ba.93989585.quick-400.json',V189_PROOF='reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json';
const V661_ID='human405-white-v661-full-v1',V661_DIR='reports/ai-foundation-20261109/v661-early-transport-boundary-v1/';
const V661_SOURCE='reports/research/815da7fc.de3eb34e.quick-400.json',V661_PROOF=V661_DIR+'v661-first3-native-development-20261109-v1.json';
const R4_ID='human405-white-v661-r4-candidate-v1';
const R4_ADMISSION='reports/ai-foundation-20261110/v661-r4-amiba1-v1/r4-resume-admission-20261110-v1.json';
const STAGED_LANDING_ID='human405-white-staged-landing-full-v1';
const STAGED_LANDING_RECORD='reports/research/11ef28bc.5135a5a0.quick-400.json';
const STAGED_LANDING_ADMISSIONS=['v2','v1'].map(v=>'reports/ai-foundation-20261113/prepass-funded-landing/r4-staged-landing-admission-20261113-'+v+'.json');
const IDS=Object.freeze([ID,V189_ID,V661_ID,R4_ID,STAGED_LANDING_ID]);
const isGuarded=id=>id===R4_ID||id===STAGED_LANDING_ID;
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
function v661Source(){
 const record=read(V661_SOURCE),proof=read(V661_PROOF),save=read(record.savePath),state=JSON.parse(save.committedState);
 const admission=read(V661_DIR+'v661-source-admission-proof-20261109-v1.json'),manifest=read(admission.manifest);
 assert.equal(proof.sourceCommit,'de3eb34e28aae4f87a891419b1f3a7b607534434');
 assert(record.gitCommit.length>=8&&proof.sourceCommit.startsWith(record.gitCommit));assert.equal(record.steps,259);
 assert.equal(record.scenario.id,firstRound.FIRST_THREE_ROUNDS_ID);assert(!record.terminal);
 assert(proof.completed&&proof.nativeRoundAndFinalStateSessionRngExact&&admission.sourceAdmitted);
 assert.equal(state.turn.roundNumber,4);assert.equal(save.session,null);
 assert.deepEqual(record.roundEnds.map(r=>[r.round,r.score]),[[1,15],[2,48],[3,118]]);
 for(const [p,h] of [[V661_SOURCE,proof.recordSha256],[record.savePath,proof.saveSha256],[record.agentTracePath,proof.traceSha256],[proof.checkpoint,proof.checkpointSha256],[admission.manifest,admission.manifestSha256],...record.roundEnds.map(r=>[r.checkpointPath,r.checkpointSha256])])
  assert.equal(sha(p),h,'V661_CONTINUATION_SOURCE_DRIFT:'+p);
 const native=read(proof.checkpoint).envelope;
 assert.equal(native.committedState,save.committedState);assert.deepEqual(native.session,save.session);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),firstRound.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 return{record,save,originalRuntimeHashes:manifest.runtimeHashes,provenance:{recordPath:V661_SOURCE,recordSha256:proof.recordSha256,savePath:record.savePath,saveSha256:proof.saveSha256,
  tracePath:record.agentTracePath,traceSha256:proof.traceSha256,proofPath:V661_PROOF,proofSha256:sha(V661_PROOF),
  sourceCommit:proof.sourceCommit,steps:259,sourceCompletedRounds:3,sourceGameWallMs:record.wallMs,sourceRoundWallMs:record.wallMs}};
}
function v661Continuation(){
 const {originalRuntimeHashes,...source}=v661Source();
 for(const [p,h] of Object.entries(originalRuntimeHashes))assert.equal(sha(p),h,'V661_CONTINUATION_SOURCE_DRIFT:'+p);
 return source;
}
function r4Continuation(){
 const {originalRuntimeHashes,...source}=v661Source(),admission=read(R4_ADMISSION);
 assert.equal(admission.schemaVersion,'seti-r4-continuation-admission-v1');
 assert.equal(admission.scenario,R4_ID);
 assert.equal(admission.prefixSourceCommit,source.provenance.sourceCommit);
 assert.equal(sha(admission.gateEvidence.path),admission.gateEvidence.sha256,'R4_GATE_EVIDENCE_DRIFT');
 const evidence=read(admission.gateEvidence.path);
 assert.deepEqual(evidence.limits,{native:256,ms:600});
 assert.deepEqual(Object.keys(evidence.gates).sort(),['root-249','root-255','root-259','root-265','root-314','root-317','root-318','root-351','root-354','root-355','root-359','root-official']);
 assert(Object.values(evidence.gates).every(({candidate:c})=>c.passed===3&&c.native<=256&&c.rangeMs[1]<=600),'R4_COLD_GATE_NOT_ADMITTED');
 assert(Object.keys(originalRuntimeHashes).every(p=>Object.hasOwn(admission.runtimeHashes,p)),'R4_ADMISSION_RUNTIME_MISSING');
 for(const [p,h] of Object.entries(admission.runtimeHashes))assert.equal(sha(p),h,'R4_CANDIDATE_SOURCE_DRIFT:'+p);
 return {...source,provenance:{...source.provenance,candidateAdmissionPath:R4_ADMISSION,
  candidateAdmissionSha256:sha(R4_ADMISSION),policyContinuation:'restart-white-plan-at-verified-round4-boundary'}};
}
function stagedLandingContinuation(){
 const runtime='randomizer/game/ai/analysis-port.js';
 const admissionPath=STAGED_LANDING_ADMISSIONS.find(file=>read(file).runtimeHashes[runtime]===sha(runtime));
 assert(admissionPath,'STAGED_LANDING_RUNTIME_DRIFT:'+runtime);
 const admission=read(admissionPath),record=read(STAGED_LANDING_RECORD),save=read(record.savePath);
 assert.equal(admission.schemaVersion,'seti-staged-landing-continuation-v1');
 assert.equal(admission.scenario,STAGED_LANDING_ID);
 assert.equal(record.gitCommit,'5135a5a0e');
 assert.equal(record.scenario.id,firstRound.FIRST_THREE_ROUNDS_ID);
 assert.equal(record.stopReason,'first-three-rounds-settled');
 assert.equal(record.steps,261);assert(!record.terminal);assert.equal(save.session,null);
 assert.equal(JSON.parse(save.committedState).turn.roundNumber,4);
 assert.equal(save.replaySteps.length,record.steps);
 assert.deepEqual(record.roundEnds.map(r=>[r.round,r.score]),[[1,15],[2,48],[3,118]]);
 for(const [file,hash] of [[STAGED_LANDING_RECORD,admission.recordSha256],[record.savePath,admission.saveSha256],
  [record.agentTracePath,admission.traceSha256],...record.roundEnds.map(r=>[r.checkpointPath,r.checkpointSha256])])
  assert.equal(sha(file),hash,'STAGED_LANDING_PREFIX_DRIFT:'+file);
 const evidence=admission.admission;
 assert.equal(evidence.originalReserve,'b_111.webp');
 assert.equal(evidence.coldRoots,20);
 assert(evidence.complete&&evidence.unchangedRoots&&evidence.agreesWithNativeReplay&&evidence.native<=256&&evidence.ms<=600);
 for(const file of Object.keys(read(R4_ADMISSION).runtimeHashes))
  assert(Object.hasOwn(admission.runtimeHashes,file),'STAGED_LANDING_RUNTIME_MISSING:'+file);
 for(const [file,hash] of Object.entries(admission.runtimeHashes))
  assert.equal(sha(file),hash,'STAGED_LANDING_RUNTIME_DRIFT:'+file);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),
  firstRound.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 return {record,save,provenance:{recordPath:STAGED_LANDING_RECORD,recordSha256:admission.recordSha256,
  savePath:record.savePath,saveSha256:admission.saveSha256,tracePath:record.agentTracePath,traceSha256:admission.traceSha256,
  sourceCommit:record.gitCommit,steps:record.steps,sourceCompletedRounds:3,sourceGameWallMs:record.wallMs,sourceRoundWallMs:record.wallMs,
  candidateAdmissionPath:admissionPath,candidateAdmissionSha256:sha(admissionPath),
  policyContinuation:'restart-white-plan-at-verified-round4-boundary'}};
}
function continuation(id=ID){
 if(id===STAGED_LANDING_ID)return stagedLandingContinuation();
 if(id===R4_ID)return r4Continuation();
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
 const source=continuation(identity.flags.scenario);return{id:identity.flags.scenario,learnerSeat:'player-white',learnerAgentType:'search',hostAgentFactory:'custom-seat-roles',opponentPolicyVersion:source.record.scenario.opponentPolicyVersion,roles:source.record.scenario.roles,opponentReserveRule:source.record.scenario.opponentReserveRule,openingInputs:source.provenance.steps,originalOpeningInputs:23,openingCheckpointSha256:firstRound.opening().sha256,continuation:source.provenance,stopAfterRound:null,comparisonScope:'white-only-full-game',scoreSemantics:'terminal-score-with-passive-opponents',...(identity.flags.scenario!==ID?{roundEndPhase:'before-pass-card-and-income'}:{}),decisionGate:{nativeInputs:256,milliseconds:600,enforcement:isGuarded(identity.flags.scenario)?'reject-before-input':'measure-only'},gameMillisecondsTarget:180000};
}
function createEnvironment(options={},metadata={}){
 if(isGuarded(metadata.id))return firstRound.createEnvironment(options,metadata);
 return createSimulationEnv({...options,agentFactory:context=>context.seatId==='player-white'?search.createSearchAgent({seatId:context.seatId,analysisPort:context.analysisPort}):firstRound.passiveAgent(context.seatId)});}
function initialize(env,config,metadata,{checkpointFromSave}={}){
 const source=continuation(metadata.id);assert.deepEqual(metadata.continuation,source.provenance,'FULL_CONTINUATION_PROVENANCE_DRIFT');assert.equal(typeof checkpointFromSave,'function');
 let save=source.save;
 if(isGuarded(metadata.id)){
  // The native state and accepted prefix are exact. A plan from a different
  // policy identity must not select the new candidate's first action.
  const machineAI={...save.machineAI};
  delete machineAI[metadata.learnerSeat];
  save={...save,machineAI};
 }
 env.loadCheckpoint(checkpointFromSave(save,{...config,agentType:'custom',seat:'player-white',opponentIdentity:metadata.opponentPolicyVersion}));
 const restored=env.saveBrowserSave();assert.equal(restored.committedState,save.committedState);assert.deepEqual(restored.session,save.session);assert.deepEqual(restored.replaySteps,save.replaySteps);assert.deepEqual(restored.machineAI,save.machineAI);assert.equal(restored.replaySteps.length,source.provenance.steps);return restored.replaySteps;
}
function settled(observation){return observation.terminal===true||observation.publicState.terminal===true;}
function inputCount(checkpoint){return (checkpoint.browserReplaySteps||[]).length+checkpoint.replayCursor.stepIndex;}
function roundSummary(env,round,elapsedMs){
 const checkpoint=env.createCheckpoint(),envelope=checkpoint.coreState.compositionEnvelope;if(envelope.session)throw Error('ROUND_SETTLEMENT_PENDING');
 const state=JSON.parse(envelope.committedState),observation=env.observe('player-white');
 return{round,nextRound:state.turn.roundNumber,terminal:env.isTerminal(),steps:inputCount(checkpoint),elapsedMs,players:state.players.players.map(p=>{const visible=observation.publicState.players.find(x=>x.playerId===p.id);return{seat:p.id,score:p.resources.score,finalScore:visible.finalScore??null,technology:Object.keys(p.techState.ownedTiles).filter(id=>p.techState.ownedTiles[id]&&!p.techState.disabledTiles[id]),income:p.income,resources:p.resources,handCount:p.hand.length,reservedCount:p.reservedCards.length,...(p.id==='player-white'?{hand:p.hand.map(c=>c.cardId),reserved:p.reservedCards.map(c=>c.cardId)}:{})};})};
}
module.exports={ID,V189_ID,V661_ID,R4_ID,STAGED_LANDING_ID,isGuarded,IDS,describe,continuation,createEnvironment,initialize,settled,roundSummary,inputCount};
