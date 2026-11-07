'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),deep=require('node:util').isDeepStrictEqual;
const w=process.cwd(),load=n=>require(path.join(w,n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),values=load('randomizer/game/ai/state-value');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',source=D+'v323-r3-carried-data-native-20261107-v1.json',c0=read(source),record=read(c0.record),save=read(record.savePath),seat='player-white',seed=record.seed;
assert.equal(sha(c0.source),c0.sourceSha256);assert.equal(sha(c0.record),c0.recordSha256);
const verification=read(D+'v323-first3-native-development-20261107-v1.json');assert.equal(sha(record.savePath),verification.saveSha256);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const env=()=>c.lifecycle.save().envelope,state=(e=env())=>e.session?.session?.workingState||JSON.parse(e.committedState),restore=e=>assert(c.lifecycle.restore(e).ok);
let steps=[];
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function take(label,condition){
 const aa=menu().filter(condition);assert.equal(aa.length,1,label+' '+JSON.stringify(menu().map(x=>[x.family,x.target])));
 const a=aa[0],d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));steps.push({label,id:a.actionId,family:a.family,actor:a.actorId,target:a.target});
}
function rec(i){const {action,actorPlayerId}=save.replaySteps[i-1];take('actual '+i,a=>a.actionId===action.actionId&&a.actorId===actorPlayerId&&deep(a.target,action.target));}
function own(label,family,test=()=>true){take(label,a=>a.actorId===seat&&a.family===family&&test(a));}
function view(){
 const s=state(),p=s.players.players.find(x=>x.id===seat),o=c.projection({role:'player',playerId:seat}).state;
 return {round:s.turn.roundNumber,turn:s.turn.turnNumber,wallet:p.resources,income:p.income,hand:p.hand.map(c=>c.cardId),reserved:p.reservedCards.map(c=>[c.id,c.cardId,c.cardEffectState]),tech:p.techState,
  computer:p.dataState.placedTokens.filter(t=>t.placementKind==='computer').map(t=>t.placementSlot),blue:p.dataState.placedTokens.filter(t=>t.placementKind==='blueBonus').map(t=>t.blueSlot),
  probes:s.pieces.rockets.filter(r=>r.playerId===seat),scans:s.data.sectorSettlements.winsByPlayerId[seat]||[],alien:o.publicState.board.aliens,trace:o.selfState.traceCounts,finalMarks:s.finalScoring.tiles,
  model:values.evaluateStateValue(o,seat).total,projectedFinal:o.publicState.players.find(x=>x.playerId===seat).finalScore};
}
const actual=verification.compare.find(r=>r.round===3).ai.checkpoint,actualRoundEnd=read(actual).coreState.compositionEnvelope;
function replayPostponed(){
 restore(c0.postponed.afterLand.envelope);steps=[];
 for(let i=171;i<=203;i++)rec(i);
 const delayed=env(),delayedAssets=view(),trace=[...steps];restore(actualRoundEnd);const actualAssets=view();
 const {turn:ta,...a}=actualAssets,{turn:tb,...b}=delayedAssets;assert.equal(tb-ta,1);
 const differences=Object.keys(a).filter(key=>!deep(a[key],b[key]));
 const [s,t]=[actualRoundEnd,delayed].map(state),rawDiff=Object.keys(s).filter(key=>!deep(s[key],t[key]));
 assert.deepEqual(s.meta.rngState,t.meta.rngState);assert.deepEqual(s.cards.drawPileCardIds,t.cards.drawPileCardIds);
 return {sourceActual:actual,sourceActualSha256:sha(actual),actual:actualAssets,delayed:delayedAssets,delayedEnvelope:delayed,trace,differences,rawDiff,deckAndRngExact:true};
}
try{
 const postponed=replayPostponed(),late=[];
 for(const branch of c0.late){
  restore(branch.envelope);steps=[];
  if(branch.remainingForced.length)own('take the publicly offered Amiba 9','choose_card',a=>a.target.choiceId==='amiba:display:9');
  for(let i=0;i<4;i++){own('place a known data token','place_data');own('fill computer','choose_target',a=>a.target.target==='computer');}
  own('take the held DLC32 as money income','choose_card',a=>a.target.choiceId==='income:card-49-0');
  own('end the analysis turn','end_turn');
  const q=view();assert.equal(q.round,3);assert.equal(q.income.credits,7);
  late.push({option:branch.option,actions:[...steps],assets:q,envelope:env()});
 }
 restore(c0.actual.beforeLand.envelope);assert.deepEqual(env(),c0.actual.beforeLand.envelope);
 const out=D+'v323-r3-carried-data-outcomes-20261107-v1.json';
 const r={scope:'Continue saved Native controls: reuse the actual remaining R3 route after the same delayed blue trace; materialize each revealed trace with the same known money-income refilling plan. The latter branches end at one earlier boundary, not at the end of R3. No white policy requery, no blind identity priced, no autonomous games.',source,sourceSha256:sha(source),record:c0.record,recordSha256:c0.recordSha256,postponed,late,newNativeInputs:postponed.trace.length+late.reduce((n,x)=>n+x.actions.length,0),newAiQueries:0,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,newNativeInputs:r.newNativeInputs,postponed:{actual:[postponed.actual.wallet.score,postponed.actual.model],delayed:[postponed.delayed.wallet.score,postponed.delayed.model],diff:postponed.differences,raw:postponed.rawDiff},late:late.map(x=>[x.option.choiceId,x.assets.wallet.score,x.assets.wallet.credits,x.assets.wallet.publicity,x.assets.income.credits,x.assets.hand,x.assets.model,x.assets.projectedFinal])}));
}finally{c.dispose();}
