'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const opening=require('../tools/research-human405-round1');
const recordPath='reports/research/e01243ba.93989585.quick-400.json';
const record=JSON.parse(fs.readFileSync(recordPath)),save=JSON.parse(fs.readFileSync(record.savePath));
const env=createSimulationEnv();
function state(){const e=env.createCheckpoint().coreState.compositionEnvelope;return e.session?.session?.workingState||JSON.parse(e.committedState);}
function snap(){const s=state(),p=s.players.players.find(x=>x.id==='player-white');return structuredClone({round:s.turn.roundNumber,player:p,probes:s.pieces.rockets.filter(x=>x.playerId===p.id),aliens:s.aliens.aliens,publicCards:s.cards.publicCards,turn:s.turn});}
try{
 env.loadCheckpoint(opening.opening().checkpoint);const initial=snap(),rows=[];
 for(let i=23;i<save.replaySteps.length;i++){
  const e=save.replaySteps[i],a=env.legalActions().find(x=>x.actionId===e.action.actionId&&x.actorId===e.actorPlayerId);assert(a,`input ${i+1}`);for(const k of ['family','target','payload','phase'])assert.deepEqual(a[k],e.action[k]);
  const before=snap(),end=record.roundEnds.find(x=>x.beforeInput===i+1);if(end)assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,JSON.parse(fs.readFileSync(end.checkpointPath)).coreState.compositionEnvelope);
  const result=env.step(a);assert(result.ok);rows.push({input:i+1,action:a,before,after:snap()});
 }
 assert.equal(env.saveBrowserSave().committedState,save.committedState);assert.deepEqual(env.saveBrowserSave().session,save.session);
 const teacher=JSON.parse(fs.readFileSync('reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-teacher-round2-before-pass-current-20261105-v1.checkpoint.json'));
 const teacherEnvelope=teacher.coreState.compositionEnvelope,teacherState=teacherEnvelope.session?.session?.workingState||JSON.parse(teacherEnvelope.committedState);
 assert.deepEqual(rows.find(r=>r.input===104).after.player,teacherState.players.players.find(p=>p.id==='player-white'));
 const data={recordPath,savePath:record.savePath,recordSha256:crypto.createHash('sha256').update(fs.readFileSync(recordPath)).digest('hex'),saveSha256:crypto.createHash('sha256').update(fs.readFileSync(record.savePath)).digest('hex'),policyQueries:0,all102ActionsLegalAndFinalStateSessionExact:true,whitePlayerExactlyEqualsTeacherAfter104:true,setup:save.replaySteps.slice(0,23),initial,rows};
 fs.mkdirSync('reports/review',{recursive:true});fs.writeFileSync('reports/review/v189-first2-every-input-20261105-v1.json',JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({nativeInputs:rows.length,policyQueries:0,finalStateSessionExact:true,teacherWhitePlayerExactAfter104:true}));
}finally{env.dispose();}
