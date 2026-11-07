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
 const source=process.argv[2],old=read(source),initial=proof.roundStarts[3].envelope;
 assert.equal(old.recordSha256,sha(report));assert.equal(old.checkpointSha256,sha(verification.checkpoint));
 const branches=[],available=()=>menu().map(a=>({family:a.family,target:a.target}));let nativeInputs=0;
 function apply(a){submit(a);nativeInputs++;return{family:a.family,target:a.target,actionId:a.actionId};}
 function find(family,test=()=>true){const out=menu().filter(a=>a.actorId===seat&&a.family===family&&test(a));assert(out.length<=1,family+' '+out.length);return out[0]||null;}
 for(const row of old.selected.filter(x=>x.step===187&&x.blocked?.step===195)){
  assert(c.lifecycle.restore(row.end.envelope).ok);assert.equal(actor().resources.availableData,0);
  const prepare=apply(find('end_turn')),before=snapshot();assert.equal(state().turn.currentPlayerId,seat);
  const knownCorner=find('card_corner',a=>a.target.cardInstanceId==='alien-amiba-9-8');
  const payable=before.wallet.publicity+2>=6&&knownCorner;
  if(!payable){assert(find('pass'));branches.push({tile:row.tileId,slot:row.slot,prepare,options:available(),branch:'keep-held-card-before-PASS',end:before});continue;}
  const step=apply(knownCorner),research=find('research_tech');assert(research);
  const opened=apply(research),atTech=env(),choices=menu().filter(a=>a.target?.tileId&&['blue1','orange2','orange4','purple2'].includes(a.target.tileId));
  for(const alt of choices){
   assert(c.lifecycle.restore(atTech).ok);const choice=apply(menu().find(a=>a.actionId===alt.actionId)),endTurn=find('end_turn');assert(endTurn);const final=apply(endTurn);assert(find('pass'));
   branches.push({tile:row.tileId,slot:row.slot,finalTech:alt.target.tileId,finalSlot:alt.target.blueSlot??null,branch:'exactly-funded-existing-last-research',actions:[prepare,step,opened,choice,final],end:snapshot()});
  }
 }
 assert(c.lifecycle.restore(initial).ok);assert.deepEqual(env(),initial);
 const out=process.argv[3],artifact={scope:'Directed Native repair of branches whose recorded first post-analysis data placement is no longer legal. Reuse only an already-held known publicity corner when it fully funds the last historical research; otherwise stop before PASS retaining the card. No AI invocation or future draw identity.',source,sourceSha256:sha(source),branches,nativeInputs,sourceRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(artifact)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,nativeInputs,branches:branches.map(x=>[x.tile,x.slot,x.finalTech??null,x.finalSlot??null,x.end.score,x.end.wallet.credits,x.end.wallet.energy,x.end.wallet.publicity,x.end.wallet.handSize,x.end.projected,x.end.model])}));
}finally{c.dispose();}
