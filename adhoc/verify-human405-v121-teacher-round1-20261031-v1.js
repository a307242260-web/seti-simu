'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env'),scenario=require('../tools/research-human405-round1'),values=require('../randomizer/game/ai/state-value');
const output='reports/ai-foundation-20261023/human405-v121-teacher-round1-native-replay-20261031-v1.json',sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert(!fs.existsSync(output),'Reuse source-bound checkpoint');
const sourcePath='seti-saves/seti-save-537-merged.json',source=JSON.parse(fs.readFileSync(sourcePath)),opening=scenario.opening(),env=createSimulationEnv(),rows=[];
const summary=o=>({r:o.publicState.roundNumber,t:o.publicState.turnNumber,c:o.publicState.currentPlayerId,p:Object.fromEntries(o.publicState.players.map(p=>[p.playerId,[p.score,p.credits,p.energy,p.publicity,p.handCount,p.reservedCount]]))});
try{
 env.loadCheckpoint(opening.checkpoint);assert.deepEqual(source.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),opening.checkpoint.replaySteps.map(e=>[e.actorPlayerId,e.action]));
 for(let i=23;i<62;i++){
  const old=source.replaySteps[i],legal=env.legalActions(),matches=legal.filter(a=>a.actionId===old.action.actionId&&a.family===old.action.family&&a.actorId===old.actorPlayerId);assert.equal(matches.length,1,'teacher native input '+(i+1));const action=matches[0];
  if(action.actorId==='player-white'){
   const fixture='adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-'+String(i+1).padStart(3,'0')+'-20261030-v1.json',expected=JSON.parse(fs.readFileSync(fixture)).compositionEnvelope,actual=env.createCheckpoint().coreState.compositionEnvelope;
   assert.deepEqual(actual.session?.session?.workingState||JSON.parse(actual.committedState),expected.session?.session?.workingState||JSON.parse(expected.committedState),'complete native teacher state '+(i+1));
   rows.push({step:i+1,fixture,fixtureSha256:sha(fixture),fullNativeStateMatched:true,nativeTeacherActionMatched:true});
  }else assert(action.family==='pass'||action.family==='choose_card'&&['pass-hand-limit','pass-reserve-card'].includes(action.target.kind));
  assert(env.step(action).ok);if(old.after)assert.deepEqual(summary(env.observe('player-white')),old.after);
 }
 const final=env.observe('player-white'),native=env.createCheckpoint().coreState.compositionEnvelope,expected=JSON.parse(fs.readFileSync('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-round1-settled-20261030-v1.checkpoint.json')).coreState.compositionEnvelope;
 assert.equal(rows.length,32);assert.equal(final.publicState.roundNumber,2);assert(!env.isTerminal());assert.deepEqual(native,expected);
 const white=final.publicState.players.find(p=>p.playerId==='player-white');assert.equal(white.score,15);
 const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
 fs.writeFileSync(output,JSON.stringify({schemaVersion:'seti-human405-teacher-round1-native-validation-v1',sourceCommit:'85e94cc4327cac0e6a103e184c4a47e13a9aa578',sourcePath,sourceSha256:sha(sourcePath),openingSha256:opening.sha256,sourceHashes,confirmedNativeInputs:62,whiteRoots:rows,allSavedSummariesMatched:true,fullEndpointEnvelopeMatched:true,passiveOpponentsOnly:true,firstRoundSettled:true,terminal:false,score:white.score,currentModelValue:values.evaluateStateValue(final,'player-white'),scope:'Replay the recorded teacher from the identical23-input opening through all39 remaining native inputs to settledR2. Every white fixture matches the complete live native state; no AI or autonomous experiment is run.'},null,2)+'\n');console.log(JSON.stringify({output,confirmedNativeInputs:62,whiteRoots:rows.length,score:white.score,fullEndpointMatched:true}));
}finally{env.dispose();}
