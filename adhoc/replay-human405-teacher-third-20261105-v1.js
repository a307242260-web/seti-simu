'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env'),amiba=require('../randomizer/game/aliens/amiba');
const dir='reports/ai-foundation-20261105/third-round-teacher-v1',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const output=dir+'/teacher-third-current-replay-20261105-v1.json';assert(!fs.existsSync(output));
const source='seti-saves/seti-save-537-merged.json',teacher=read(source),initial=read(dir+'/initial-native-audit-20261105-v1.json');
const checkpoint=initial.teacher.before160.path,env=createSimulationEnv(),rows=[];let mismatch=null,end=null;
function state(){const e=env.createCheckpoint().coreState.compositionEnvelope;return e.session?.session?.workingState||JSON.parse(e.committedState);}
function assets(){const s=state(),p=s.players.players.find(p=>p.id==='player-white');return structuredClone({player:p,aliens:s.aliens,probes:s.pieces.rockets.filter(p=>p.playerId==='player-white'),planets:s.planets,data:s.data,finalScoring:s.finalScoring});}
try{
 env.loadCheckpoint(read(checkpoint));let regionBefore=null,automatic=null;
 for(let i=159;i<245;i++){
  const n=i+1,old=teacher.replaySteps[i];
  if(n===163){
   const historical=teacher.replaySteps.slice(162,165).map(x=>x.action.target);
   const expected=amiba.listSymbolsInRegion(regionBefore,'blue');
   assert.deepEqual(historical.map(x=>x.symbolId).sort(),expected.map(x=>x.symbolId).sort());
   for(const t of historical)assert.equal(regionBefore.amiba.symbolSlots[t.slotId],t.symbolId);
   const pure=structuredClone(regionBefore),resolved=amiba.resolveRegionReward(pure,'blue');assert(resolved.ok);
   assert.deepEqual(state().aliens.amiba.symbolSlots,pure.amiba.symbolSlots);
   const b=rows.find(x=>x.input===162).before.player,a=state().players.players.find(p=>p.id==='player-white');
   assert.equal(a.resources.score-b.resources.score,4);assert.equal(a.resources.publicity-b.resources.publicity,1);assert.equal(a.hand.length-b.hand.length,2);
   assert.equal(new Set(resolved.results.map(x=>x.symbolId)).size,3);
   automatic={historicalInputs:[163,164,165],resolvedDuringCurrentInput:162,lockedSymbols:expected.map(x=>({symbolId:x.symbolId,slotId:x.slotId})),delta:{score:4,publicity:1,ordinaryCards:1,alienCards:1},currentSymbolPositionsMatchFormalRegionResolver:true,noExtraNativeInputs:true};i=164;continue;
  }
  const legal=env.legalActions(),a=legal.find(a=>a.actionId===old.action.actionId&&a.actorId===old.actorPlayerId);
  if(!a){const p=dir+'/teacher-next-mismatch-'+n+'-20261105-v1.checkpoint.json';assert(!fs.existsSync(p));fs.writeFileSync(p,JSON.stringify(env.createCheckpoint())+'\n');mismatch={input:n,expected:old.action,legalActions:legal,checkpointPath:p};break;}
  const serialized=JSON.parse(JSON.stringify(a));for(const k of ['target','payload','family','phase'])assert.deepEqual(serialized[k],old.action[k],`input ${n} ${k}`);
  const before=assets();if(n===162)regionBefore=structuredClone(state().aliens);
  if(n===245){assert.equal(a.family,'pass');const p=dir+'/teacher-round3-before-pass-current-20261105-v1.checkpoint.json';assert(!fs.existsSync(p));fs.writeFileSync(p,JSON.stringify(env.createCheckpoint())+'\n');end={beforeHistoricalInput:n,phase:'before-pass-card-and-next-income',checkpointPath:p,checkpointSha256:sha(p),assets:before};break;}
  assert(env.step(a).ok);rows.push({input:n,action:a,before,after:assets()});
 }
 const report={status:end?'complete':'stopped-at-legacy-mismatch',source,sourceSha256:sha(source),resumeCheckpoint:checkpoint,resumeCheckpointSha256:sha(checkpoint),policyQueries:0,newAutonomousRuns:0,nativeInputs:rows.length,earlierNativeInputs:initial.teacher.rows.length,legacyRegionNormalization:automatic,mismatch,roundEnd:end,rows};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,status:report.status,nativeInputs:rows.length,normalization:automatic,mismatch,roundEnd:end&&{score:end.assets.player.resources.score,income:end.assets.player.income,technology:end.assets.player.techState,resources:end.assets.player.resources,hand:end.assets.player.hand.map(c=>c.cardId),probes:end.assets.probes,data:end.assets.player.dataState}}));
}finally{env.dispose();}
