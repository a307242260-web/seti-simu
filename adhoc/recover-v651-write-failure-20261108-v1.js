'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [recordStem,priorSave,out]=process.argv.slice(2);
const read=p=>JSON.parse(fs.readFileSync(p)),bytes=p=>fs.readFileSync(p),sha=p=>crypto.createHash('sha256').update(bytes(p)).digest('hex');
const { createEnvironment, FIRST_THREE_ROUNDS_ID, settled }=require(path.resolve('tools/research-human405-round1.js'));
const r1=recordStem+'.round-end-1.checkpoint.json',trace=recordStem+'.decisions.jsonl',roundPath=recordStem+'.round-ends.jsonl';
const cp=read(r1),endRows=bytes(roundPath).toString().trim().split('\n').map(JSON.parse),partial=bytes(trace).toString().trim().split('\n').map(JSON.parse);
assert.equal(cp.replayCursor.stepIndex,60);
assert.deepEqual(endRows.map(x=>[x.round,x.score]),[[1,15]]);
assert.deepEqual(endRows.map(x=>x.checkpointSha256),[sha(r1)]);

const prior=read(priorSave).replaySteps;
const actionKey=x=>JSON.parse(JSON.stringify([x.actorId,x.family,x.phase,x.actionId,x.target,x.payload]));
const ids=partial.map(t=>t.context.legalActions.find(a=>a.actionId===t.actionId&&a.actorId===t.context.seatId));assert(ids.every(Boolean));
assert.equal(ids.length,50);
assert.deepEqual(ids.map(actionKey),prior.slice(23,73).map(x=>actionKey(x.action)));
assert.deepEqual(ids.slice(0,37).map(actionKey),cp.replaySteps.slice(23).map(x=>actionKey(x.action)));
const admitted=partial.map((t,i)=>({i:24+i,diag:t.search?.diagnostics,ms:t.search?.rootAndSearchMilliseconds,complete:t.search?.complete})).filter(x=>x.diag&&typeof x.ms==='number');
assert(admitted.every(x=>x.complete&&x.diag.nativeExecutions<=256&&x.ms<=600));
const env=createEnvironment({}, {id:FIRST_THREE_ROUNDS_ID});
try{
 env.loadCheckpoint(cp);
 assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,cp.coreState.compositionEnvelope);
 const replay=[];
 for(let i=cp.replayCursor.stepIndex;i<73;i++){
  const expected=ids[i-23],legal=env.legalActions(),a=legal.find(x=>x.actionId===expected.actionId&&x.actorId===expected.actorId);
  assert(a);assert.deepEqual(actionKey(a),actionKey(expected));const result=env.step(a);assert(result.ok,JSON.stringify(result.error));replay.push(actionKey(a));
 }
 const endpoint=env.createCheckpoint();
 assert.equal(endpoint.replayCursor.stepIndex,73);
 assert(!settled(env.observe(),{stopAfterRound:3}));
 assert.deepEqual(endpoint.replaySteps.map(e=>actionKey(e.action)),prior.slice(0,73).map(e=>actionKey(e.action)));
 const opening=read('reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.checkpoint.json');
 env.loadCheckpoint(opening);
 for(const expected of ids){
  const a=env.legalActions().find(x=>x.actionId===expected.actionId&&x.actorId===expected.actorId);
  assert(a);assert.deepEqual(actionKey(a),actionKey(expected));assert(env.step(a).ok);
 }
 const fromOpening=env.createCheckpoint();
 const a=fromOpening.coreState.compositionEnvelope,b=endpoint.coreState.compositionEnvelope;
 assert.equal(a.committedState,b.committedState);
 // A restored host allocates a fresh local effect-session sequence. Preserve
 // all suffixes, links, queues, RNG, and committed/working state.
 const normalize=e=>JSON.parse(JSON.stringify(e,(k,v)=>typeof v==='string'&&
   (v===e.session?.session?.sessionId||v.startsWith(e.session?.session?.sessionId+':'))?
   'pending-session'+v.slice(e.session.session.sessionId.length):v));
 assert.deepEqual(normalize(a),normalize(b));
 assert.deepEqual(fromOpening.replaySteps.map(e=>actionKey(e.action)),endpoint.replaySteps.map(e=>actionKey(e.action)));
 const recovery={...endpoint,machineAI:{}};
 fs.writeFileSync(out,JSON.stringify({scope:'Native restoration of the 73 accepted inputs before the V651 artifact write failure. Later unpersisted action and machine proof are unknown; cold continuation is a separate control, not the official run.',
  independentOpeningAndRoundEndRecoveryModuloSessionId:true,originalStatus:'artifact-write-enospc',confirmedInputs:73,replayedAfterCheckpoint:replay.length,failedDecisionCommitted:null,
  priorActionsMatchV649:73,previousRounds:endRows.map(x=>({round:x.round,score:x.score,assets:x,checkpointSha256:x.checkpointSha256})),
  traceSha256:sha(trace),inputCount:admitted.length,maxNativeInputs:Math.max(...admitted.map(x=>x.diag.nativeExecutions)),
  maxMilliseconds:Math.max(...admitted.map(x=>x.ms)),recovery},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({confirmedInputs:73,replayedAfterCheckpoint:replay.length,round:env.observe().publicState.roundNumber,
  maxNative:Math.max(...admitted.map(x=>x.diag.nativeExecutions)),maxMs:Math.max(...admitted.map(x=>x.ms))}));
}finally{env.dispose();}
