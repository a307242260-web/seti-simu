'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),load=p=>require(path.resolve(p));
const full=load('tools/research-human405-full'),first=load('tools/research-human405-round1');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation');
const [recordPath,out]=process.argv.slice(2),r=read(recordPath),save=read(r.savePath),prefix=full.continuation(full.V661_ID);
const opening=first.opening().checkpoint,seat='player-white';
assert.equal(r.scenario.id,full.V661_ID);
assert.deepEqual(r.scenario.continuation,prefix.provenance);
assert.equal(r.resumeStep,prefix.save.replaySteps.length);
assert.deepEqual(save.replaySteps.slice(0,r.resumeStep),prefix.save.replaySteps);
assert.deepEqual(r.roundEnds.slice(0,3),prefix.record.roundEnds);
assert.deepEqual(r.roundEnds.map(x=>x.round),[1,2,3,4]);
assert.equal(r.steps,save.replaySteps.length);
assert(r.terminal&&r.summary.terminal&&r.scenarioResult.fullGameCompleted);
assert.equal(r.wallMsIncludingSourcePrefix,r.wallMs+prefix.record.wallMs);
assert(r.wallMsIncludingSourcePrefix<=180000);
const checks=r.metrics.searches;
assert.deepEqual(checks.slice(0,prefix.record.metrics.searches.length),prefix.record.metrics.searches);
assert(checks.every(x=>x.complete&&!x.unresolved.length&&!x.stopReason&&Object.values(x.diagnostics.limits).every(v=>v===null)));
const exceeds=checks.filter(x=>x.diagnostics.nativeExecutions>256||x.rootAndSearchMilliseconds>600)
 .map(x=>({step:x.step,actionId:x.actionId,nativeInputs:x.diagnostics.nativeExecutions,milliseconds:x.rootAndSearchMilliseconds}));
const seed=r.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});const c=k.composition,at=()=>c.lifecycle.save().envelope;
let passiveInputs=0;
try{
 assert(c.lifecycle.restore(opening.coreState.compositionEnvelope).ok);
 for(let i=23;i<r.steps;i++){
  const e=save.replaySteps[i],d=c.inspect().session?.decision,before=at();
  if(i===r.resumeStep){assert.equal(before.committedState,prefix.save.committedState);assert.deepEqual(before.session,prefix.save.session);}
  const actions=d?.choices||c.inputPort.enumerateActions({}),a=actions.find(x=>x.actionId===e.action.actionId&&x.actorId===e.actorPlayerId);
  assert(a,'missing native input '+(i+1));
  for(const f of ['schemaVersion','family','phase','actorId','target','payload'])
   assert.deepEqual(a[f]===undefined?undefined:JSON.parse(JSON.stringify(a[f])),e.action[f],(i+1)+':'+f);
  if(e.actorPlayerId!==seat){assert(a.family==='pass'||d?.ownerId===e.actorPlayerId);passiveInputs++;}
  const round=r.roundEnds.find(x=>x.beforeInput===i+1);
  if(round){
   assert.equal(a.family,'pass');assert.equal(a.actorId,seat);assert.equal(sha(round.checkpointPath),round.checkpointSha256);
   assert.deepEqual(before,read(round.checkpointPath).coreState.compositionEnvelope);
   assert.equal(JSON.parse(before.committedState).players.players.find(p=>p.id===seat).resources.score,round.score);
  }
  const response=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(response.ok,JSON.stringify(response));
 }
 const end=at(),match=JSON.parse(end.committedState).match;
 assert.equal(end.committedState,save.committedState);assert.deepEqual(end.session,save.session);
 assert(match.finalScoringSettled);
 const totals=Object.fromEntries(match.finalScores.map(x=>[x.playerId,x.totalScore]));
 assert.deepEqual(totals,r.summary.scores);
 const white=match.finalScores.find(x=>x.playerId===seat);
 const result={record:recordPath,recordSha256:sha(recordPath),save:r.savePath,saveSha256:sha(r.savePath),trace:r.agentTracePath,traceSha256:sha(r.agentTracePath),
  strategySourceCommit:prefix.provenance.sourceCommit,scope:r.scenario.comparisonScope,terminal:true,originalOpeningInputs:23,
  reusedInputs:r.resumeStep,continuationInputs:r.steps-r.resumeStep,independentlyReplayed:r.steps-23,passiveInputs,nativeStateSessionAndRngExact:true,
  rounds:r.roundEnds.map(x=>({round:x.round,boardScore:x.score,establishedScore:x.projectedFinalScore,technology:x.technology,income:x.income,resources:x.resources,
   hand:x.hand,probes:x.probes,data:x.data,scanProgress:x.scanProgress,aliens:x.aliens,finalScoring:x.finalScoring})),
  wallMs:r.wallMs,wallMsIncludingSourcePrefix:r.wallMsIncludingSourcePrefix,searches:checks.length,exceeds,
  maxNativeInputs:Math.max(...checks.map(x=>x.diagnostics.nativeExecutions)),maxMilliseconds:Math.max(...checks.map(x=>x.rootAndSearchMilliseconds)),
  boardScore:white.baseScore,tileScore:white.tileScore,cardScore:white.cardScore,totals};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({rounds:result.rounds.map(x=>x.boardScore),totals,verifiedInputs:result.independentlyReplayed,wallMs:result.wallMsIncludingSourcePrefix,exceeds}));
}finally{c.dispose();}
