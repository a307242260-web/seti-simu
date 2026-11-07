'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
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
 const [input,knownOutput,out]=process.argv.slice(2),unzip=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(p))),old=unzip(input),initial=proof.roundStarts[3].envelope,rows=[];let nativeInputs=0;
 assert(old.rootAndRngRestored);const control=unzip(knownOutput).rows.find(r=>r.trace==='trace:1:blue:amiba:4'&&r.finalTech==='blue1'&&r.finalSlot===3);assert.equal(control.end.score,91);
 for(const source of old.rows){
  assert(c.lifecycle.restore(source.afterOptional.envelope).ok);assert.deepEqual(env(),source.afterOptional.envelope);
  const route=[];
  function take(a,step){assert(a,step+' '+JSON.stringify(menu().map(q=>q.target)));submit(a);nativeInputs++;route.push({step,actionId:a.actionId,target:a.target,family:a.family});}
  function choice(id){return menu().find(a=>a.actorId===seat&&a.target?.choiceId===id);}
  for(let step=183;step<=186;step++)take(findRecorded(step,false),step);
  take(choice('tech:purple2'),187);
  for(let step=188;step<=193;step++)take(findRecorded(step,false),step);
  take(choice('trace:1:blue:amiba:4'),194);take(choice('amiba:display:7'),'revealed-public-card');
  for(const wanted of control.actions){
   const a=menu().find(a=>a.actorId===seat&&a.family===wanted.family&&a.actionId===wanted.actionId);
   assert(a,'typed fixed repair '+JSON.stringify(wanted));assert.deepEqual(a.target,wanted.target);take(a,'typed-fixed-repair');
  }
  const end=snapshot();assert(menu().some(a=>a.family==='pass'));assert.equal(end.score,91);assert.deepEqual(end.tech,control.end.tech);
  assert.deepEqual(end.data,control.end.data);assert.deepEqual(end.reserve,control.end.reserve);
  assert.equal(end.income.credits,6);assert.equal(end.income.energy,4);assert.equal(end.rockets.length,source.choice==='launch'?1:0);
  const standardEnd=JSON.parse(control.end.envelope.committedState),native=JSON.parse(end.envelope.committedState);
  assert.deepEqual(native.meta.rngState,standardEnd.meta.rngState);assert.deepEqual(native.solarSystem,standardEnd.solarSystem);
  rows.push({mode:source.choice,route,end});
 }
 assert(c.lifecycle.restore(initial).ok);assert.deepEqual(env(),initial);
 const result={scope:'Apply the already validated Purple2/visible Amiba7/Blue1 slot3 fixed repair after the independent public +1 energy income and optional Purple4 launch Native controls. No unknown pick or PASS draw.',input,inputSha256:sha(input),knownOutput,knownOutputSha256:sha(knownOutput),sourceRecord:report,sourceRecordSha256:sha(report),rows,nativeInputs,sourceAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(result)+'\n',{flag:'wx'});
 console.log(JSON.stringify({nativeInputs,rows:rows.map(x=>({mode:x.mode,score:x.end.score,wallet:x.end.wallet,income:x.end.income,probe:x.end.rockets.map(p=>p.id),projected:x.end.projected,model:x.end.model}))}));
}finally{c.dispose();}
