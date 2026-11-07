'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const w=process.cwd(),load=p=>require(path.join(w,p)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report='reports/research/614d33af.720da076.quick-400.json',record=read(report),save=read(record.savePath),dir='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',verification=read(dir+'v323-first3-native-development-20261107-v1.json'),proof=read(verification.checkpoint);
assert.equal(sha(report),verification.recordSha256);assert.equal(sha(record.savePath),verification.saveSha256);assert.equal(sha(verification.checkpoint),verification.checkpointSha256);
const source=read(dir+'source-manifest-20261107-v1.json');for(const [p,h] of Object.entries({...source.baseRuntimeHashes,...source.sourceHashes}))assert.equal(sha(p),h,p);
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),values=load('randomizer/game/ai/state-value'),seat=record.scenario.learnerSeat,seed=record.seed;
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition,env=()=>c.lifecycle.save().envelope,state=()=>{const e=env();return e.session?.session?.workingState||JSON.parse(e.committedState);},actor=()=>state().players.players.find(p=>p.id===seat),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const snapshot=()=>{const s=state(),p=actor(),o=c.projection({role:'player',playerId:seat}).state;return{round:s.turn.roundNumber,turn:s.turn.turnNumber,score:p.resources.score,wallet:p.resources,income:p.income,tech:p.techState,hand:p.hand.map(c=>[c.id,c.cardId]),reserve:p.reservedCards.map(c=>[c.id,c.cardId]),data:p.dataState,rockets:s.pieces.rockets.filter(r=>r.playerId===seat),scan:Object.entries(s.data.nebulae).map(([id,b])=>[id,b.tokens.filter(t=>t.replacedByPlayerId===seat||t.replacedByPlayerColor===p.color).map(t=>t.slotIndex)]).filter(([,xs])=>xs.length),trace:o.selfState.traceCounts,aliens:o.publicState.board.aliens,finalScoring:s.finalScoring,projected:o.publicState.players.find(x=>x.playerId===seat).finalScore,model:values.evaluateStateValue(o,seat).total,envelope:env()};};
function submit(a){const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
function findRecorded(step,exact){const rr=save.replaySteps[step-1],a=menu().find(q=>q.actionId===rr.action.actionId&&q.actorId===rr.actorPlayerId);if(!a)return null;for(const k of exact?['family','phase','target','payload']:['family','phase','target'])assert.deepEqual(a[k],rr.action[k],step+':'+k);return a;}
try{
 const start=proof.roundStarts[3];assert.equal(start.beforeInput,136);assert(c.lifecycle.restore(start.envelope).ok);const roots={};
 for(let step=136;step<=203;step++){
  if(step===187||step===202)roots[step]=env();const a=findRecorded(step,true);assert(a,'historical input '+step);submit(a);
 }
 const official=read(record.roundEnds[2].checkpointPath).coreState.compositionEnvelope;assert.deepEqual(env(),official);const original=snapshot();
 const selected=[];let submittedCounterfactual=0;
 for(const step of [187,202]){
  assert(c.lifecycle.restore(roots[step]).ok);const options=menu().filter(a=>a.family==='choose_target'&&a.target?.tileId);assert(options.length>=4);
  for(const option of options){
   assert(c.lifecycle.restore(roots[step]).ok);const a=menu().find(x=>x.actionId===option.actionId);assert(a);submit(a);submittedCounterfactual++;
   const immediate=snapshot(),path=[];let blocked=null;
   for(let i=step+1;i<=203;i++){
    const action=findRecorded(i,false);
    if(!action){const wanted=save.replaySteps[i-1].action;blocked={step:i,wanted:{family:wanted.family,target:wanted.target},visible:menu().map(x=>({family:x.family,target:x.target}))};break;}
    submit(action);path.push({step:i,actionId:action.actionId});submittedCounterfactual++;
   }
   const end=snapshot(),isOfficial=option.actionId===save.replaySteps[step-1].action.actionId;
   if(isOfficial){assert(!blocked);assert.deepEqual(end.envelope,official);}
   selected.push({step,tileId:a.target.tileId,slot:a.target.blueSlot??null,actionId:a.actionId,isOfficial,immediate,path,blocked,end,atSameRoundEnd:!blocked});
  }
 }
 assert(c.lifecycle.restore(start.envelope).ok);assert.deepEqual(env(),start.envelope);
 const out=process.argv[2],artifact={scope:'Controlled Native technology substitutions on actual V323 third-round roots. Continue only with exact known historical action targets up to before PASS. Stop on divergence; no new AI decision, no strategy for other seats, no assumed future draws.',record:report,recordSha256:sha(report),checkpoint:verification.checkpoint,checkpointSha256:sha(verification.checkpoint),sourceManifest:dir+'source-manifest-20261107-v1.json',sourceManifestSha256:sha(dir+'source-manifest-20261107-v1.json'),official,original,roots,selected,submittedCounterfactual,sourceRestored:true,newAiQueries:0,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(artifact)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,submittedCounterfactual,branches:selected.map(x=>[x.step,x.tileId,x.slot,x.isOfficial,x.immediate.score,x.immediate.wallet.credits,x.immediate.wallet.energy,x.immediate.wallet.publicity,x.immediate.wallet.availableData,x.blocked?.step??null,x.end.score,x.end.projected])}));
}finally{c.dispose();}
