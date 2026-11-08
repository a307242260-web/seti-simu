'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const [origin,reference,out]=process.argv.slice(2),checkpoint=read(origin).recovery,seat='player-white';
const {createEnvironment,FIRST_THREE_ROUNDS_ID,settled}=require(path.resolve('tools/research-human405-round1.js'));
let steps=73,roundEnd=null,rawRoundEnd=null;const accepted=[],searches=[],roundEnds=[];
const env=createEnvironment({onAgentDecision(trace){
 const a=trace.context.legalActions.find(a=>a.actionId===trace.actionId);
 if(a?.family==='pass'&&trace.context.seatId===seat){
  const round=trace.context.observation.publicState.roundNumber; assert([2,3].includes(round));
  rawRoundEnd=env.createCheckpoint();
  const s=JSON.parse(rawRoundEnd.coreState.committedState),p=s.players.players.find(p=>p.id===seat),obs=trace.context.observation;
  roundEnd={round,beforeInput:steps+1,score:p.resources.score,projectedFinalScore:obs.publicState.players.find(p=>p.playerId===seat).finalScore,
   resources:p.resources,income:p.income,technology:p.techState,hand:p.hand,computer:p.dataState,probes:s.pieces.rockets.filter(p=>p.playerId===seat),
   scan:s.data.sectorSettlements.winsByPlayerId[seat],alienPreinvestments:obs.publicState.board.aliens,marks:s.finalScoring};
  roundEnds.push({summary:roundEnd,checkpoint:rawRoundEnd});
 }
}}, {id:FIRST_THREE_ROUNDS_ID});
try{
 env.loadCheckpoint(checkpoint);
 assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,checkpoint.coreState.compositionEnvelope);
 assert.deepEqual(env.createCheckpoint().machineAI,{});
 const started=performance.now();
 while(!settled(env.observe(),{stopAfterRound:3})){
  assert(steps<400);
  const result=env.runAgentDecision();assert(result.ok);
  const t=result.agentTrace,a=t.context.legalActions.find(a=>a.actionId===t.actionId);assert(a);
  steps++;accepted.push({step:steps,action:a,seat:t.context.seatId});
  for(const s of result.searches||[]){assert(s.complete&&!s.unresolved.length&&s.diagnostics.nativeExecutions<=256&&s.rootAndSearchMilliseconds<=600);
   searches.push({step:steps,n:s.diagnostics.nativeExecutions,ms:s.rootAndSearchMilliseconds,selected:a.actionId});}
 }
 const wallMs=performance.now()-started,final=env.createCheckpoint(),prior=read(reference),actions=s=>s.replaySteps.map(e=>[e.actorPlayerId,e.action]);
 const identical=JSON.stringify(actions(final))===JSON.stringify(actions(prior));
 assert.deepEqual(roundEnds.map(e=>e.summary.round),[2,3]);
 fs.writeFileSync(out,JSON.stringify({scope:'Independent cold continuation after the last persisted decision of the interrupted V651 standard experiment. No repeated opening or originally accepted decision; not an uninterrupted standard result.',
  originalFailure:'ENOSPC',sourceSha256:sha(origin),coldRestart:true,resumeStep:73,steps,wallMs,identicalActionsToV649:identical,
  roundEnds,roundEnd,rawRoundEnd,accepted,searches,final},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({steps,coldSuffix:steps-73,wallMs,identical,roundScores:roundEnds.map(e=>e.summary.score),score:roundEnd.score,projected:roundEnd.projectedFinalScore,
  maxN:Math.max(...searches.map(s=>s.n)),maxMs:Math.max(...searches.map(s=>s.ms))}));
}finally{env.dispose();}
