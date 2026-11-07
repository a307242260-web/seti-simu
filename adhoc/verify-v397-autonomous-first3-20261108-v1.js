'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=process.cwd(),load=n=>require(path.join(root,n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation');
const D='reports/ai-foundation-20261108/v397-source-admission-v1/',first='reports/ai-foundation-20261104/two-rounds-teacher-v2/',third='reports/ai-foundation-20261105/third-round-teacher-v1/';
const [recordPath]=process.argv.slice(2),r=read(recordPath),save=read(r.savePath),sourceProof=read(D+'source-admission-proof-20261108-v1.json'),seat='player-white';
const m=read(sourceProof.manifest);assert(sourceProof.sourceAdmitted);assert.equal(sha(sourceProof.manifest),sourceProof.manifestSha256);
for(const [n,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))if(n.startsWith('randomizer/')&&!n.includes('.test.')&&!n.includes('.browser-smoke.'))assert.equal(sha(n),h,n);
const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert(head.startsWith(r.gitCommit));assert(r.policyVersion.includes(m.searchVersion+'/'+m.valueModel));
for(const [k,h]of Object.entries(sourceProof.runtimeSubtrees))assert.equal(cp.execFileSync('git',['rev-parse',head+':'+k],{encoding:'utf8'}).trim(),h);
const opening=read('reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.json'),source=read(opening.checkpointPath),start=source.coreState.compositionEnvelope;
assert.equal(sha(opening.checkpointPath),opening.checkpointSha256);assert.equal(r.scenario.openingCheckpointSha256,opening.checkpointSha256);
assert.equal(r.scenario.id,'human405-white-first3-v1');assert.equal(r.scenario.openingInputs,23);
assert.equal(source.replayCursor.stepIndex,23);assert.deepEqual(source.machineAI,{});assert.equal(r.steps,save.replaySteps.length);
assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.actorPlayerId,e.action]),source.replaySteps.map(e=>[e.actorPlayerId,e.action]));
const rounds=r.roundEnds||[],passed=r.stopReason==='first-three-rounds-settled';
if(passed){assert(r.scenarioResult.firstThreeRoundsSettled);assert.deepEqual(rounds.map(x=>x.round),[1,2,3]);}
assert(r.wallMs<=180000);
const acceptedSearches=r.metrics.searches.filter(s=>s.committed!==false);
assert(acceptedSearches.every(s=>s.complete&&!s.stopReason&&!s.unresolved?.length&&s.diagnostics.nativeExecutions<=256&&s.rootAndSearchMilliseconds<=600&&Object.values(s.diagnostics.limits).every(x=>x===null)));
if(r.status==='failed')assert.equal(r.failure.failedDecisionCommitted,false);
const seed=r.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,prefixPath=D+'v397-first3-independent-replay-20261108-v1.checkpoint.json',out=D+'v397-first3-native-development-20261108-v1.json',proof={};
const progress=fs.existsSync(prefixPath)?read(prefixPath):{record:recordPath,recordSha256:sha(recordPath),accepted:0,envelope:start,ledger:[],actual:{},roundStarts:{},passiveInputs:0};assert.equal(progress.recordSha256,sha(recordPath));
const stateOf=e=>e.session?.session?.workingState||JSON.parse(e.committedState),pOf=s=>s.players.players.find(p=>p.id===seat),saveAt=()=>c.lifecycle.save().envelope;
function saveProgress(){fs.writeFileSync(prefixPath+'.tmp',JSON.stringify(progress)+'\n');fs.renameSync(prefixPath+'.tmp',prefixPath);}
function assets(envelope){
 assert(c.lifecycle.restore(envelope).ok);
 const s=stateOf(envelope),p=pOf(s),view=c.projection({role:'player',playerId:seat}).state;
 return {round:s.turn.roundNumber,boardScore:p.resources.score,technology:p.techState,resources:p.resources,income:p.income,
   hand:p.hand,reserved:p.reservedCards,data:p.dataState,probes:s.pieces.rockets.filter(q=>q.playerId===seat),
   planetMarkers:s.planets,sectorWins:s.data.sectorSettlements.winsByPlayerId[seat]||[],
   scanProgress:Object.entries(s.data.nebulae).map(([id,b])=>({sectorId:id,ownedSlots:b.tokens.filter(t=>t.replacedByPlayerId===seat||t.replacedByPlayerColor===p.color).map(t=>t.slotIndex),capacity:b.tokens.length})).filter(q=>q.ownedSlots.length),
   alienPreinvestments:view.publicState.board.aliens,traceCounts:view.selfState.traceCounts,finalScoring:s.finalScoring,
   projectedFinalScore:view.publicState.players.find(q=>q.playerId===seat).finalScore};
}
try{
 assert(c.lifecycle.restore(progress.envelope).ok);
 for(let i=23+progress.accepted;i<save.replaySteps.length;i++){
  const e=save.replaySteps[i],d=c.inspect().session?.decision,before=saveAt(),s=stateOf(before),owner=pOf(s);
  const actions=d?.choices||c.inputPort.enumerateActions({}),a=actions.find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);
  assert(a,'missing legal Native action at '+(i+1));
  for(const f of ['schemaVersion','family','phase','actorId','target','payload']){
   // Archived actions use JSON. The Native optional fields that are
   // undefined at enumeration have no wire representation.
   const actual=f==='payload'&&a[f]!==undefined?JSON.parse(JSON.stringify(a[f])):a[f];
   assert.deepEqual(actual,e.action[f],(i+1)+':'+f);
  }
  if(e.actorPlayerId!==seat){assert(a.family==='pass'||d?.ownerId===e.actorPlayerId,'pass-only opponent selected a voluntary main action');progress.passiveInputs++;}
  if(a.actorId===seat&&!progress.roundStarts[s.turn.roundNumber]){
   progress.roundStarts[s.turn.roundNumber]={beforeInput:i+1,envelope:before,assets:assets(before)};
  }
  const row=rounds.find(x=>x.beforeInput===i+1);
  if(row){
   assert.equal(row.phase,'before-pass-card-and-income');assert.equal(a.family,'pass');assert.equal(a.actorId,seat);assert.equal(sha(row.checkpointPath),row.checkpointSha256);
   assert.deepEqual(before,read(row.checkpointPath).coreState.compositionEnvelope);
   const x=assets(before);assert.equal(row.score,x.boardScore);assert.deepEqual(row.income,x.income);assert.deepEqual(row.technology,x.technology);assert.deepEqual(row.resources,x.resources);
   progress.actual[row.round]={checkpoint:row.checkpointPath,checkpointSha256:row.checkpointSha256,assets:x};
  }
  const response=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
    :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(response.ok,JSON.stringify(response));progress.accepted++;progress.envelope=saveAt();
  if(a.actorId===seat){
   const t=stateOf(progress.envelope),p=pOf(t);
   progress.ledger.push({input:i+1,round:s.turn.roundNumber,turn:s.turn.turnNumber,action:a,before:owner.resources,after:p.resources});
  }
  saveProgress();
 }
 assert.equal(progress.accepted,r.steps-23);assert.equal(progress.envelope.committedState,save.committedState);assert.deepEqual(progress.envelope.session,save.session);
 const historical=read(first+'v189-first2-native-verification-20261105-v1.json'),teacher3=read(third+'v278-third-round-development-comparison-20261107-v1.json').teacher;
 const keys=['credits','energy','handSize','publicity','availableData','additionalPublicScan'],compare=[];
 for(const [key,actual]of Object.entries(progress.actual)){
  const round=Number(key),prior=historical.comparison.find(x=>x.round===round),teacherPath=prior?.teacher.checkpoint||teacher3.checkpointPath,
   teacherSha=prior?.teacher.checkpointSha256||teacher3.checkpointSha256;
  assert.equal(sha(teacherPath),teacherSha);const teacher=assets(read(teacherPath).coreState.compositionEnvelope),a=actual.assets;
  assert.equal(a.round,round);assert.equal(teacher.round,round);
  const delta=(x,y,fields)=>Object.fromEntries(fields.map(k=>[k,x[k]-y[k]]));
  compare.push({round,ai:actual,teacher:{checkpoint:teacherPath,checkpointSha256:teacherSha,assets:teacher},scoreDelta:a.boardScore-teacher.boardScore,incomeDelta:delta(a.income,teacher.income,keys),
   missingTeacherTech:Object.entries(teacher.technology.ownedTiles).filter(([id,yes])=>yes&&!a.technology.ownedTiles[id]).map(([id])=>id),
   extraAiTech:Object.entries(a.technology.ownedTiles).filter(([id,yes])=>yes&&!teacher.technology.ownedTiles[id]).map(([id])=>id)});
 }
 assert(c.lifecycle.restore(start).ok);assert.deepEqual(saveAt(),start);
 const s={scope:'Independent replay of existing accepted inputs from original Native 23-input opening, no AI invocation, compare settled checkpoints before PASS cards and subsequent income.',
   sourceCommit:head,record:recordPath,recordSha256:sha(recordPath),save:r.savePath,saveSha256:sha(r.savePath),checkpoint:prefixPath,checkpointSha256:sha(prefixPath),trace:r.agentTracePath,traceSha256:sha(r.agentTracePath),
   completed:passed,stopReason:r.stopReason||r.failure?.code,failure:r.failure||null,newInputsAfterOpening:progress.accepted,opponentPassOrMandatoryInputs:progress.passiveInputs,sourceRestored:true,nativeRoundAndFinalStateSessionRngExact:true,searchDecisions:r.metrics.searches.length,
   maxNativeInputs:Math.max(0,...acceptedSearches.map(s=>s.diagnostics.nativeExecutions)),maxMilliseconds:Math.max(0,...acceptedSearches.map(s=>s.rootAndSearchMilliseconds)),wallMilliseconds:r.wallMs,compare,roundStarts:Object.fromEntries(Object.entries(progress.roundStarts).map(([k,x])=>[k,{beforeInput:x.beforeInput,assets:x.assets}])),roundStartInputIds:Object.fromEntries(Object.entries(progress.roundStarts).map(([k,x])=>[k,x.beforeInput])),newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(s,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,completed:passed,accepted:progress.accepted,wallMs:r.wallMs,maxNative:s.maxNativeInputs,maxMs:s.maxMilliseconds,
   rounds:compare.map(x=>({round:x.round,ai:x.ai.assets.boardScore,teacher:x.teacher.assets.boardScore,incomeDelta:x.incomeDelta,missingTech:x.missingTeacherTech,extraTech:x.extraAiTech}))}));
}finally{c.dispose();}
