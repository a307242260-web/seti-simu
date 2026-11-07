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
 const start=proof.roundStarts[3];assert.equal(start.beforeInput,136);assert(c.lifecycle.restore(start.envelope).ok);
 for(let step=start.beforeInput;step<166;step++){const a=findRecorded(step,true);assert(a,step);submit(a);}
 const before=snapshot(),root=env(),deck=load('randomizer/game/cards/deck'),choices=menu().filter(a=>a.target.choiceId?.startsWith('pick:')).map(a=>{
  const card=state().cards.publicCards[a.target.publicSlotIndex];assert.equal(card.id,a.target.cardInstanceId);
  return {actionId:a.actionId,id:card.id,model:card.cardId,gain:deck.getIncomeGainForCard(card)};
 });
 const recorded=save.replaySteps[165].action.actionId,actual=choices.find(x=>x.actionId===recorded);
 assert.deepEqual(actual.gain,{credits:1});const variants=[actual,...choices.filter(x=>x.gain?.energy===1)];
 const rows=[];let nativeInputs=30;
 for(const option of variants){
  assert(c.lifecycle.restore(root).ok);assert.deepEqual(env(),root);
  const route=[];
  function take(a,step){assert(a,step);submit(a);nativeInputs++;route.push({step,id:a.actionId,target:a.target,family:a.family});}
  take(menu().find(a=>a.actionId===option.actionId),166);
  for(let i=167;i<=168;i++)take(findRecorded(i,true),i);
  const income=menu().find(a=>a.target.choiceId==='income:'+option.id);assert(income);
  take(income,169);
  const immediate=snapshot();let missing=null;
  for(let i=170;i<204;i++){
   const a=findRecorded(i,false);
   if(!a){const intended=save.replaySteps[i-1].action;missing={step:i,family:intended.family,target:intended.target,menu:menu().map(q=>[q.family,q.target])};break;}
   take(a,i);
  }
  const end=snapshot();rows.push({option,route,immediate,end,missing});
 }
 assert(c.lifecycle.restore(start.envelope).ok);assert.deepEqual(env(),start.envelope);
 const out={scope:'At the exact V323 step 166 Native public menu, change only the known supply card and then test whether the original remainder of round 3 remains legally executable. No new policy and no actual PASS draw.',source:report,sourceSha256:sha(report),sourceManifest:dir+'source-manifest-20261107-v1.json',sourceManifestSha256:sha(dir+'source-manifest-20261107-v1.json'),choices,before,rows,nativeInputs,sourceAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(process.argv[2],JSON.stringify(out)+'\n',{flag:'wx'});
 console.log(JSON.stringify({choices,nativeInputs,rows:rows.map(x=>({option:x.option,immediate:x.immediate.wallet,income:x.end.income,end:x.end.wallet,missing:x.missing&&[x.missing.step,x.missing.family]}))}));
}finally{c.dispose();}
