'use strict';
// Continue the verified v123 white-only R1. No AI strategy or native state edits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const firstRound=require('./research-human405-round1'),search=require('../randomizer/game/ai/search-agent'),{createSimulationEnv}=require('../randomizer/app/simulation-env');
const ROOT=path.resolve(__dirname,'..'),ID='human405-white-full-v1',SOURCE='reports/research/19bd7474.94530144.quick-200.json',PROOF='reports/ai-foundation-20261023/human405-v123-completion-runtime-source-check-20261031-v1.json';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p))),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
function continuation(){
 const record=read(SOURCE),proof=read(PROOF),save=read(record.savePath),state=JSON.parse(save.committedState);
 assert.equal(record.gitCommit,'94530144');assert.equal(record.steps,64);assert.equal(record.scenario.id,firstRound.ID);assert(record.scenarioResult.firstRoundSettled&&!record.terminal);assert.equal(state.turn.roundNumber,2);assert.equal(save.session,null);
 assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),firstRound.opening().checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 for(const [p,h]of Object.entries(proof.runtimeSourceHashes))if(p.startsWith('randomizer/'))assert.equal(sha(p),h,'FULL_CONTINUATION_STRATEGY_DRIFT:'+p);
 return{record,save,provenance:{recordPath:SOURCE,recordSha256:sha(SOURCE),savePath:record.savePath,saveSha256:sha(record.savePath),tracePath:record.agentTracePath,traceSha256:sha(record.agentTracePath),proofPath:PROOF,proofSha256:sha(PROOF),sourceCommit:proof.sourceCommit,steps:64,sourceRoundWallMs:record.wallMs}};
}
function describe(identity,options={}){
 if(identity.flags?.scenario!==ID)throw Error('RESEARCH_SCENARIO_UNKNOWN');
 if(!options.full)throw Error('WHITE_ONLY_FULL_REQUIRES_FULL_MODE');
 if(identity.agentType!=='search'||identity.activePlayerCount!==4||identity.seed!=='seti-free-analyze-v1')throw Error('WHITE_ONLY_FULL_CONFIGURATION_INVALID');
 const source=continuation();return{id:ID,learnerSeat:'player-white',learnerAgentType:'search',hostAgentFactory:'custom-seat-roles',opponentPolicyVersion:source.record.scenario.opponentPolicyVersion,roles:source.record.scenario.roles,opponentReserveRule:source.record.scenario.opponentReserveRule,openingInputs:64,originalOpeningInputs:23,openingCheckpointSha256:firstRound.opening().sha256,continuation:source.provenance,stopAfterRound:null,comparisonScope:'white-only-full-game',scoreSemantics:'terminal-score-with-passive-opponents',decisionGate:{nativeInputs:256,milliseconds:600,enforcement:'measure-only'},gameMillisecondsTarget:180000};
}
function createEnvironment(options={}){return createSimulationEnv({...options,agentFactory:context=>context.seatId==='player-white'?search.createSearchAgent({seatId:context.seatId,analysisPort:context.analysisPort}):firstRound.passiveAgent(context.seatId)});}
function initialize(env,config,metadata,{checkpointFromSave}={}){
 const source=continuation();assert.deepEqual(metadata.continuation,source.provenance,'FULL_CONTINUATION_PROVENANCE_DRIFT');assert.equal(typeof checkpointFromSave,'function');
 env.loadCheckpoint(checkpointFromSave(source.save,{...config,agentType:'custom',seat:'player-white',opponentIdentity:metadata.opponentPolicyVersion}));
 const restored=env.saveBrowserSave();assert.equal(restored.committedState,source.save.committedState);assert.deepEqual(restored.session,source.save.session);assert.deepEqual(restored.replaySteps,source.save.replaySteps);assert.deepEqual(restored.machineAI,source.save.machineAI);assert.equal(restored.replaySteps.length,64);return restored.replaySteps;
}
function settled(observation){return observation.terminal===true||observation.publicState.terminal===true;}
function inputCount(checkpoint){return (checkpoint.browserReplaySteps||[]).length+checkpoint.replayCursor.stepIndex;}
function roundSummary(env,round,elapsedMs){
 const checkpoint=env.createCheckpoint(),envelope=checkpoint.coreState.compositionEnvelope;if(envelope.session)throw Error('ROUND_SETTLEMENT_PENDING');
 const state=JSON.parse(envelope.committedState),observation=env.observe('player-white');
 return{round,nextRound:state.turn.roundNumber,terminal:env.isTerminal(),steps:inputCount(checkpoint),elapsedMs,players:state.players.players.map(p=>{const visible=observation.publicState.players.find(x=>x.playerId===p.id);return{seat:p.id,score:p.resources.score,finalScore:visible.finalScore??null,technology:Object.keys(p.techState.ownedTiles).filter(id=>p.techState.ownedTiles[id]&&!p.techState.disabledTiles[id]),income:p.income,resources:p.resources,handCount:p.hand.length,reservedCount:p.reservedCards.length,...(p.id==='player-white'?{hand:p.hand.map(c=>c.cardId),reserved:p.reservedCards.map(c=>c.cardId)}:{})};})};
}
module.exports={ID,describe,continuation,createEnvironment,initialize,settled,roundSummary,inputCount};
