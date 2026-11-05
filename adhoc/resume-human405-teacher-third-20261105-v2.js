'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const dir='reports/ai-foundation-20261105/third-round-teacher-v1',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const previousPath=dir+'/teacher-third-current-replay-20261105-v1.json',previous=read(previousPath),source='seti-saves/seti-save-537-merged.json',teacher=read(source),output=dir+'/teacher-third-current-replay-20261105-v2.json';assert(!fs.existsSync(output));assert.equal(previous.mismatch.input,185);
const env=createSimulationEnv(),rows=[];let mismatch=null,end=null;
function state(){const e=env.createCheckpoint().coreState.compositionEnvelope;return e.session?.session?.workingState||JSON.parse(e.committedState);}
function assets(){const s=state(),p=s.players.players.find(p=>p.id==='player-white');return structuredClone({player:p,aliens:s.aliens,probes:s.pieces.rockets.filter(p=>p.playerId==='player-white'),planets:s.planets,data:s.data,finalScoring:s.finalScoring});}
try{
 env.loadCheckpoint(read(previous.mismatch.checkpointPath));
 const marker=env.legalActions().find(a=>a.actionId===teacher.replaySteps[191].action.actionId);assert(marker);assert.equal(marker.target.tileId,'c');
 const before=assets();assert(before.player.resources.score>=70);assert(env.step(marker).ok);assert.deepEqual(assets().player.resources,before.player.resources);rows.push({historicalInput:192,advancedBeforeHistoricalInput:185,action:marker,before,after:assets()});
 for(let i=184;i<245;i++){
  const n=i+1;if(n===192)continue;const old=teacher.replaySteps[i],legal=env.legalActions(),a=legal.find(a=>a.actionId===old.action.actionId&&a.actorId===old.actorPlayerId);
  let different=null;if(a){const serialized=JSON.parse(JSON.stringify(a));different=['target','payload','family','phase'].find(k=>JSON.stringify(serialized[k])!==JSON.stringify(old.action[k]));}
  if(!a||different){const p=dir+'/teacher-next-mismatch-'+n+'-20261105-v2.checkpoint.json';assert(!fs.existsSync(p));fs.writeFileSync(p,JSON.stringify(env.createCheckpoint())+'\n');mismatch={input:n,expected:old.action,legalActions:legal,fieldDifference:different,checkpointPath:p};break;}
  const before=assets();if(n===245){assert.equal(a.family,'pass');const p=dir+'/teacher-round3-before-pass-current-20261105-v2.checkpoint.json';assert(!fs.existsSync(p));fs.writeFileSync(p,JSON.stringify(env.createCheckpoint())+'\n');end={beforeHistoricalInput:n,phase:'before-pass-card-and-next-income',checkpointPath:p,checkpointSha256:sha(p),assets:before};break;}
  assert(env.step(a).ok);rows.push({input:n,action:a,before,after:assets()});
 }
 const report={status:end?'complete':'stopped-at-legacy-mismatch',source,sourceSha256:sha(source),previousPath,previousSha256:sha(previousPath),resumeCheckpoint:previous.mismatch.checkpointPath,policyQueries:0,newAutonomousRuns:0,nativeInputs:rows.length,legacyFinalMarkerNormalization:{historicalInput:192,executedBeforeHistoricalInput:185,sameChosenMarker:'c',reason:'Current corrected scan rewards cross the70point threshold earlier; preserve the teacher choice at its currently required native timing, no score/resources added.'},mismatch,roundEnd:end,rows};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,status:report.status,nativeInputs:rows.length,mismatch,roundEnd:end&&{score:end.assets.player.resources.score,income:end.assets.player.income,technology:end.assets.player.techState,resources:end.assets.player.resources,hand:end.assets.player.hand.map(c=>c.cardId),probes:end.assets.probes,data:end.assets.player.dataState}}));
}finally{env.dispose();}
