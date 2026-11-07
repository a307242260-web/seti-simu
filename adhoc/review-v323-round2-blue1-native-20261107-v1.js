'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),deep=require('node:util').isDeepStrictEqual;
const cwd=process.cwd(),load=n=>require(path.join(cwd,n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),{passiveAgent}=load('tools/research-human405-round1'),value=load('randomizer/game/ai/state-value');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',source=D+'v323-round2-carryover-native-controls-20261107-v1.json',prior=read(source),verification=read(prior.nativeVerification),record=read(prior.record),save=read(record.savePath),seed=record.seed,seat='player-white';
assert.equal(sha(prior.nativeVerification),prior.nativeVerificationSha256);assert.equal(sha(record.savePath),verification.saveSha256);assert.equal(sha(prior.record),prior.recordSha256);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
let actions=[];
const env=()=>c.lifecycle.save().envelope,state=()=>{const e=env();return e.session?.session?.workingState||JSON.parse(e.committedState);};
const restore=e=>assert(c.lifecycle.restore(e).ok);
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function take(label,p){
 const choices=menu().filter(p);assert.equal(choices.length,1,label+' '+JSON.stringify(menu().map(a=>[a.family,a.target])));
 const a=choices[0],d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok);actions.push({label,id:a.actionId,actor:a.actorId,family:a.family,target:a.target});
}
const own=(label,family,p=()=>true)=>take(label,a=>a.actorId===seat&&a.family===family&&p(a));
const rec=i=>{const {action,actorPlayerId}=save.replaySteps[i-1];take('recorded '+i,a=>a.actorId===actorPlayerId&&a.actionId===action.actionId&&deep(a.target,action.target));};
function snapshot(){
 const s=state(),p=s.players.players.find(p=>p.id===seat),view=c.projection({role:'player',playerId:seat}).state;
 return {round:s.turn.roundNumber,turn:s.turn.turnNumber,wallet:p.resources,income:p.income,tech:p.techState,hand:p.hand.map(c=>[c.id,c.cardId]),
  publicCards:s.cards.publicCards.filter(Boolean).map(c=>[c.id,c.cardId]),deckCommitment:crypto.createHash('sha256').update(JSON.stringify(s.cards.drawPileCardIds)).digest('hex'),
  computer:p.dataState.placedTokens.filter(c=>c.placementKind==='computer').map(c=>c.placementSlot),blue:p.dataState.placedTokens.filter(c=>c.placementKind==='blueBonus').map(c=>c.blueSlot),
  probes:s.pieces.rockets.filter(r=>r.playerId===seat),traces:view.selfState.traceCounts,model:value.evaluateStateValue(view,seat).total,envelope:env()};
}
try{
 const start=prior.research.source;restore(start);rec(104);
 own('research blue1 in the same slot','choose_target',a=>a.target?.tileId==='blue1'&&a.target.blueSlot===2);
 rec(107);rec(108);rec(112);rec(113);rec(115);
 // Hold the already-known DLC37 for the same scan and pink trace, rather
 // than assuming a replacement for it or taking an unseen draw.
 for(let i=116;i<=120;i++)rec(i);
 const base=snapshot(),commonActions=[...actions];assert.equal(base.wallet.publicity,3);assert.equal(base.computer.length,3);
 const cases=[];
 for(const [label,id] of [['keep-publicity',null],['buy-known-energy','card-18-0'],['buy-known-credit','card-49-0']]){
  restore(base.envelope);actions=[];
  if(id){
   assert(base.publicCards.some(c=>c[0]===id),'supplier must be public before payment');
   own('spend 3 publicity to obtain named visible supplier','quick_trade',a=>a.target?.tradeId==='publicity-for-card');
   own('take named visible supplier','choose_card',a=>a.target?.cardInstanceId===id);
  }
  own('fill computer4','place_data');own('choose computer4','choose_target',a=>a.target.target==='computer');
  if(id)own('use exactly that supplier as permanent income','choose_card',a=>a.target.choiceId==='income:'+id);
  for(let i=121;i<=127;i++)rec(i);
  if(menu().some(a=>a.target?.kind==='residual-domain'&&a.target.tileId==='a'))
   own('resolve the threshold with the same recorded final A marker','choose_target',a=>a.target?.kind==='residual-domain'&&a.target.tileId==='a');
  const end=snapshot();own('white PASS','pass');
  own('the same B101 reserve choice','choose_card',a=>a.target.kind==='pass-reserve-card'&&a.target.cardId==='b_101.webp');
  const maxMandatory=16;
  for(let i=0;i<maxMandatory;i++){
   const s=state(),d=c.inspect().session?.decision,owner=d?.ownerId||s.turn.currentPlayerId;
   if(owner===seat){assert.equal(s.turn.roundNumber,3);break;}
   const obs=c.projection({role:'player',playerId:owner}).state;
   const legalActions=menu().filter(a=>a.actorId===owner);
   const response=passiveAgent(owner).decide({legalActions,observation:obs});
   take('same passive opponent contract',a=>a.actorId===owner&&a.actionId===response.actionId);
  }
  const s=state();assert.equal(s.turn.currentPlayerId,seat);assert.equal(s.turn.roundNumber,3);
  cases.push({label,end,startR3:snapshot(),actions:[...actions]});
 }
 restore(start);assert.deepEqual(env(),start);
 const out=D+'v323-round2-blue1-native-continuations-20261107-v1.json',p={scope:'One fixed same-slot blue1 line through the same known DLC37 scan; at the saved post-scan point compare keeping publicity against buying either known currency-income supplier. Do not look at refill identities before purchase; keep the original PASS policy and choose the same known B101. No autonomous search.',
  source,sourceSha256:sha(source),record:prior.record,recordSha256:prior.recordSha256,common:base,commonActions,cases,actualR3:prior.analysisOrPass.actualThirdRoundStart,newNativeInputs:commonActions.length+cases.reduce((n,c)=>n+c.actions.length,0),newWhiteAiQueries:0,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(p,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(cases.map(q=>[q.label,q.end.wallet.score,q.end.wallet.credits,q.end.wallet.energy,q.end.wallet.publicity,q.end.income,q.startR3.hand.map(c=>c[1]),q.startR3.model])));
}finally{c.dispose();}
