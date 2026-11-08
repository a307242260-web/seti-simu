'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [recordStem,priorSave,out]=process.argv.slice(2);
const read=p=>JSON.parse(fs.readFileSync(p)),bytes=p=>fs.readFileSync(p),sha=p=>crypto.createHash('sha256').update(bytes(p)).digest('hex');
const { createEnvironment, FIRST_THREE_ROUNDS_ID, settled }=require(path.resolve('tools/research-human405-round1.js'));
const r1=recordStem+'.round-end-1.checkpoint.json',r2=recordStem+'.round-end-2.checkpoint.json',trace=recordStem+'.decisions.jsonl',roundPath=recordStem+'.round-ends.jsonl';
const cp=read(r2),earlier=read(r1),endRows=bytes(roundPath).toString().trim().split('\n').map(JSON.parse),partial=bytes(trace).toString().trim().split('\n').map(JSON.parse);
assert.equal(cp.replayCursor.stepIndex,127);assert.equal(earlier.replayCursor.stepIndex,60);
assert.deepEqual(endRows.map(x=>[x.round,x.score]),[[1,15],[2,48]]);
assert.deepEqual(endRows.map(x=>x.checkpointSha256),[sha(r1),sha(r2)]);
assert.deepEqual(earlier.replaySteps,cp.replaySteps.slice(0,60));
const prior=read(priorSave).replaySteps;
const actionKey=x=>JSON.parse(JSON.stringify([x.actorId,x.family,x.phase,x.actionId,x.target,x.payload]));
const ids=partial.map(t=>t.context.legalActions.find(a=>a.actionId===t.actionId&&a.actorId===t.context.seatId));assert(ids.every(Boolean));
assert.equal(ids.length,124);
assert.deepEqual(ids.map(actionKey),prior.slice(23,147).map(x=>actionKey(x.action)));
assert.deepEqual(ids.slice(0,104).map(actionKey),cp.replaySteps.slice(23).map(x=>actionKey(x.action)));
const admitted=partial.map((t,i)=>({i:24+i,diag:t.search?.diagnostics,ms:t.search?.rootAndSearchMilliseconds,complete:t.search?.complete})).filter(x=>x.diag&&typeof x.ms==='number');
assert(admitted.every(x=>x.complete&&x.diag.nativeExecutions<=256&&x.ms<=600));
const env=createEnvironment({}, {id:FIRST_THREE_ROUNDS_ID});
try{
 env.loadCheckpoint(cp);
 assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,cp.coreState.compositionEnvelope);
 const replay=[];
 for(let i=cp.replayCursor.stepIndex;i<147;i++){
  const expected=ids[i-23],legal=env.legalActions(),a=legal.find(x=>x.actionId===expected.actionId&&x.actorId===expected.actorId);
  assert(a);assert.deepEqual(actionKey(a),actionKey(expected));const result=env.step(a);assert(result.ok,JSON.stringify(result.error));replay.push(actionKey(a));
 }
 const endpoint=env.createCheckpoint();
 assert.equal(endpoint.replayCursor.stepIndex,147);
 assert(!settled(env.observe(),{stopAfterRound:3}));
 assert.deepEqual(endpoint.replaySteps.map(e=>actionKey(e.action)),prior.slice(0,147).map(e=>actionKey(e.action)));
 const recovery={...endpoint,machineAI:{}};
 fs.writeFileSync(out,JSON.stringify({scope:'Native restoration of the 147 accepted inputs before the V634 artifact write failure. Later unpersisted action and machine proof are unknown; cold continuation is a separate control, not the official run.',
  originalStatus:'artifact-write-enospc',confirmedInputs:147,replayedAfterCheckpoint:replay.length,failedDecisionCommitted:null,
  priorActionsMatchV630:147,previousRounds:endRows.map(x=>({round:x.round,score:x.score,assets:x,checkpointSha256:x.checkpointSha256})),
  traceSha256:sha(trace),inputCount:admitted.length,maxNativeInputs:Math.max(...admitted.map(x=>x.diag.nativeExecutions)),
  maxMilliseconds:Math.max(...admitted.map(x=>x.ms)),recovery},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({confirmedInputs:147,replayedAfterCheckpoint:replay.length,round:env.observe().publicState.roundNumber,
  maxNative:Math.max(...admitted.map(x=>x.diag.nativeExecutions)),maxMs:Math.max(...admitted.map(x=>x.ms))}));
}finally{env.dispose();}
