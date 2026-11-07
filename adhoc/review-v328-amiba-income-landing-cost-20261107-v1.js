'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fixture='reports/ai-foundation-20261105/third-round-teacher-v1/v209-income-before-amiba-root-20261106-v1.json',f=read(fixture),seed=f.source.seed,seat=f.seatId;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),probe=require('../randomizer/game/ai/probe-capital'),value=require('../randomizer/game/ai/state-value'),cards=require('../randomizer/game/cards/deck');
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,env=()=>c.lifecycle.save().envelope,state=()=>env().session?.session?.workingState||JSON.parse(env().committedState),p=()=>state().players.players.find(x=>x.id===seat),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const ledger=[];
function act(label,match){const as=menu().filter(a=>a.actorId===seat&&match(a));assert.equal(as.length,1,label+' '+JSON.stringify(menu().map(a=>[a.family,a.target])));const a=as[0],d=c.inspect().session?.decision;const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));ledger.push({label,actionId:a.actionId,family:a.family,target:a.target});}
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=env();
 act('play held data and symbol card',a=>a.family==='play_card'&&a.target.cardInstanceId==='alien-amiba-0-1');
 act('choose visible blue symbol',a=>a.target?.choiceId==='symbol:blue_1');
 act('start one computer placement',a=>a.family==='place_data');
 act('fill computer slot 4',a=>a.family==='choose_target'&&a.target?.target==='computer');
 const shared=env(),recordedPrefix=[...ledger];
 const supplier=(id)=>p().hand.find(c=>c.id===id);
 assert.deepEqual(cards.getIncomeGainForCard(supplier('card-51-0')),cards.getIncomeGainForCard(supplier('card-59-0')));
 assert.deepEqual(cards.getDiscardActionRewardForCard(supplier('card-51-0')).gain,cards.getDiscardActionRewardForCard(supplier('card-59-0')).gain);
 const branches=[];
 for(const id of ['card-51-0','card-59-0']){
  assert(c.lifecycle.restore(shared).ok);ledger.length=0;
  const paid=supplier(id),nativeChoices=menu().map(a=>a.target);
  act('choose known +1 credit income',a=>a.family==='choose_card'&&(a.target?.cardInstanceId===id||a.target?.choiceId===id));
  const s=state(),owner=p(),q=probe.quote({...probe.factsFromState(s,owner),investment:()=>0},value.DEFAULT_WEIGHTS),o=c.projection({role:'player',playerId:seat}).state;
  branches.push({playedIncome:paid.cardId,actions:[...ledger],nativeChoices,wallet:owner.resources,income:owner.income,hand:owner.hand.map(c=>[c.id,c.cardId]),probeValue:q.value,heldLandingCandidates:q.candidates.filter(x=>x.knownLandingCardId),value:value.evaluateStateValue(o,seat).total,envelope:env()});
 }
 const [use,keep]=branches;assert.deepEqual(use.wallet,keep.wallet);assert.deepEqual(use.income,keep.income);
 assert.equal(use.heldLandingCandidates.length,0);assert(keep.heldLandingCandidates.length>0);
 assert(c.lifecycle.restore(keep.envelope).ok);ledger.length=0;
 const mission=keep.heldLandingCandidates.find(g=>g.planet==='uranus');assert(mission);
 act('advance to same seat without intervening turn',a=>a.family==='end_turn');
 assert.equal(state().turn.currentPlayerId,seat);assert(!p().mainActionCompleted);
 for(let i=0;i<mission.payment.energyPurchases;i++)act('fund movement, retaining card fee',a=>a.target?.tradeId==='credits-for-energy');
 for(const step of mission.route.path){
  act('fixed route toward Uranus',a=>a.family==='move'&&a.target.rocketId===5&&a.target.deltaX===step.deltaX&&a.target.deltaY===step.deltaY);
  act('pay by energy without discarding',a=>a.family==='choose_payment'&&a.target.choiceId==='energy');
 }
 act('play protected landing card',a=>a.family==='play_card'&&a.target.cardInstanceId==='card-51-0');
 act('land at Uranus',a=>a.family==='choose_target'&&a.target?.planetId==='uranus'&&a.target?.landTarget?.type==='planet');
 if(menu().some(a=>a.target?.kind==='planet-reward-alien-trace')){
  const choice=menu().filter(a=>a.target?.kind==='planet-reward-alien-trace').sort((a,b)=>a.target.choiceId.localeCompare(b.target.choiceId))[0];
  act('complete one current visible planetary trace',a=>a.actionId===choice.actionId);
 }
 assert(p().reservedCards.some(c=>c.cardId==='dlc_31.png'));
 const executedLanding={wallet:p().resources,actions:[...ledger],envelope:env()};
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(env(),original);
 const out=process.argv[2]||'/private/tmp/seti-v328-amiba-income-landing-cost-20261107-v2.json';
 fs.writeFileSync(out,JSON.stringify({scope:'Two real Native computer4 income choices sharing identical currency, income and corner reward; no new policy decisions or autonomous runs.',fixture,fixtureSha256:sha(fixture),recordedPrefix,shared,branches,executedLanding,sourceRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,branches:branches.map(b=>({card:b.playedIncome,probeValue:b.probeValue,held:b.heldLandingCandidates.length,model:b.value,wallet:b.wallet}))}));
}finally{c.dispose();}
