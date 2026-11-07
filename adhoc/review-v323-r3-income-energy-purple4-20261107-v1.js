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
 const input=process.argv[3],prior=read(input),alternative=prior.rows.find(x=>x.option.gain.energy===1),root=alternative.end.envelope,start=proof.roundStarts[3].envelope;
 assert.equal(alternative.missing.step,183);assert(prior.sourceAndRngRestored);assert.equal(prior.sourceSha256,sha(report));
 const rows=[];let nativeInputs=0;
 for(const choice of ['skip','launch']){
  assert(c.lifecycle.restore(root).ok);assert.deepEqual(env(),root);
  const a=menu().find(q=>q.target.choiceId==='scan4:'+choice);assert(a);submit(a);nativeInputs++;
  const afterOptional=snapshot(),route=[];let missing=null;
  for(let i=183;i<204;i++){
   const next=findRecorded(i,false);
   if(!next){const recorded=save.replaySteps[i-1].action;missing={step:i,target:recorded.target,menu:menu().map(q=>[q.family,q.target])};break;}
   submit(next);nativeInputs++;route.push({step:i,id:next.actionId,family:next.family,target:next.target});
  }
  const end=snapshot();rows.push({choice,afterOptional,route,end,missing});
 }
 assert(c.lifecycle.restore(start).ok);assert.deepEqual(env(),start);
 const out={scope:'At the saved extra purple4 prompt created by the known energy income, compare skip versus actual launch, then follow the original R3 actions and stop before PASS.',source:input,sourceSha256:sha(input),rootAndRngRestored:true,nativeInputs,rows,newAutonomousRuns:0};
 fs.writeFileSync(process.argv[2],JSON.stringify(out)+'\n',{flag:'wx'});
 console.log(JSON.stringify({nativeInputs,rows:rows.map(x=>({choice:x.choice,after:x.afterOptional.wallet,end:x.end.wallet,income:x.end.income,probes:x.end.rockets.map(q=>q.id),missing:x.missing}))}));
}finally{c.dispose();}
