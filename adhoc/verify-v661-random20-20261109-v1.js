'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createEnvironment}=require(path.resolve('tools/research-free-analyze-random20'));
const [checkpoint,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rows=fs.readFileSync(checkpoint,'utf8').trim().split('\n').map(JSON.parse).sort((a,b)=>a.number-b.number),seat='player-white';
const catalog=read('reports/fixed-boards/free-analyze-random20-20261104-v1.json').boards;
assert.deepEqual(rows.map(x=>[x.number,x.seed]),catalog.map(b=>[b.number,b.seed]));
for(const row of rows){
 const r=read(row.record),save=read(r.savePath),config={seed:r.seed,activePlayerCount:4,agentType:'custom',seat,compactReplay:true,
  opponentIdentity:r.scenario.opponentPolicyVersion},env=createEnvironment();
 try{
  env.reset(config);assert.equal(save.replaySteps.length,r.steps);assert.equal(r.scenario.boardNumber,row.number);
  const opening=r.scenarioResult.openingInputs;
  assert(save.replaySteps.slice(0,opening).some(e=>e.actorPlayerId===seat&&e.action.target?.cardId==='industry:深空探测.png'));
  for(let i=0;i<r.steps;i++){
   const e=save.replaySteps[i],a=env.legalActions().find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);
   assert(a,'illegal action at '+(i+1));
   for(const f of ['schemaVersion','family','phase','actorId','target','payload'])
    assert.deepEqual(a[f]===undefined?undefined:JSON.parse(JSON.stringify(a[f])),e.action[f],(i+1)+':'+f);
   if(i>=opening&&a.actorId!==seat)assert(a.family==='pass'||(a.family==='choose_card'&&['pass-reserve-card','pass-hand-limit'].includes(a.target?.kind)));
   const round=(r.roundEnds||[]).find(x=>x.beforeInput===i+1);
   if(round){
    const c=env.createCheckpoint().coreState.compositionEnvelope;
    assert.equal(sha(round.checkpointPath),round.checkpointSha256);assert.deepEqual(c,read(round.checkpointPath).coreState.compositionEnvelope);
   }
   assert(env.step(a).ok,'submit failed at '+(i+1));
  }
  const end=env.saveBrowserSave();assert.equal(end.committedState,save.committedState);assert.deepEqual(end.session,save.session);
  assert.equal(env.isTerminal(),row.terminal);
  const m=JSON.parse(end.committedState).match;
  if(row.terminal){
   assert(m.finalScoringSettled);
   const w=m.finalScores.find(x=>x.playerId===seat);
   assert.equal(w.totalScore,row.score);assert.equal(r.summary.scores[seat],row.score);
   assert.equal(r.scenarioResult.completedRoundEnds.length,4);
   Object.assign(row,{boardScore:w.baseScore,tileScore:w.tileScore,cardScore:w.cardScore});
  }else{
   assert.equal(r.failure.failedDecisionCommitted,false);
   assert.equal(read(r.failure.checkpointPath).coreState.committedState,end.committedState);
   Object.assign(row,{failedRound:JSON.parse(end.committedState).turn.roundNumber,failedAfterInput:r.steps});
  }
  Object.assign(row,{recordSha256:sha(row.record),save:r.savePath,saveSha256:sha(r.savePath),trace:r.agentTracePath,traceSha256:sha(r.agentTracePath),
   replayed:r.steps,openingInputs:opening,nativeStateSessionRngExact:true});
  console.log(JSON.stringify({board:row.number,score:row.score,inputs:r.steps,terminal:row.terminal}));
 }finally{env.dispose();}
}
fs.writeFileSync(out,JSON.stringify({strategy:'V661',seedCatalog:'free-analyze-random20-20261104-v1',terminal:rows.filter(x=>x.terminal).length,rows},null,2)+'\n',{flag:'wx'});
