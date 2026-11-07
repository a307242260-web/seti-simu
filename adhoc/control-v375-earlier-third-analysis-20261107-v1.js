'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const cardDeck=require('../randomizer/game/cards/deck'),effects=require('../randomizer/game/cards/effects');
const [input,output]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(input)),seat=f.seatId,seed=f.source.seed;
function make(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k.composition;}
const c=make();
const save=()=>c.lifecycle.save().envelope, read=()=>{const x=save();return x.session?.session?.workingState||JSON.parse(x.committedState);};
const player=()=>read().players.players.find(p=>p.id===seat), menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const path=[];
function act(family,select=()=>true){const a=menu().filter(x=>x.actorId===seat&&x.family===family&&select(x));assert.equal(a.length,1,JSON.stringify(menu().map(x=>[x.family,x.target])));const x=a[0],d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:seat,choice:x}):x.phase==='quick'?c.inputPort.submitQuickAction(x):c.inputPort.submitAction(x);
 assert(r.ok,JSON.stringify(r));path.push({id:x.actionId,family,target:x.target,wallet:player().resources});}
function snapshot(){const p=player(),s=read();return{wallet:p.resources,income:p.income,tech:p.techState,data:p.dataState.placedTokens,
 hand:p.hand.map(q=>({id:q.id,cardId:q.cardId,income:cardDeck.getIncomeGainForCard(q),corner:cardDeck.getDiscardActionRewardForCard(q),price:effects.getCardPrice(q),
  playEffects:effects.getCardModel(q)?.playEffects?.map(x=>x.type)})),publicCards:s.cards.publicCards.map(q=>({id:q.id,cardId:q.cardId,income:cardDeck.getIncomeGainForCard(q)})),
 menus:menu().map(x=>[x.family,x.target])};}
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);assert.deepEqual(save(),f.compositionEnvelope);
 const start=snapshot();for(let i=0;i<2;i++){act('place_data');act('choose_target',x=>x.target?.target==='computer');}
 act('analyze');act('choose_target',x=>x.target?.choiceId==='trace:1:blue:amiba:4');act('choose_card',x=>x.target?.choiceId==='amiba:display:7');
 const afterEarlyAnalysis=snapshot();assert(afterEarlyAnalysis.data.length===0);
 act('end_turn');act('accept_optional_effect',x=>x.target.choiceId.startsWith('skip:task:'));
 act('research_tech');act('choose_target',x=>x.target?.tileId==='purple1');act('complete_task',x=>x.target.ruleId==='dlc9-three-sector-wins');
 const afterKnownRefill=snapshot(),endpoint=save();assert(c.lifecycle.restore(f.compositionEnvelope).ok);assert.deepEqual(save(),f.compositionEnvelope);
 const replay=make();try{assert(replay.lifecycle.restore(f.compositionEnvelope).ok);for(const row of path){
  const d=replay.inspect().session?.decision,a=(d?.choices||replay.inputPort.enumerateActions({})).find(x=>x.actionId===row.id);
  assert(a&&a.actorId===seat);assert.deepEqual(a.target,row.target);
  const result=d?replay.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:seat,choice:a})
   :a.phase==='quick'?replay.inputPort.submitQuickAction(a):replay.inputPort.submitAction(a);
  assert(result.ok);
 }assert.deepEqual(replay.lifecycle.save().envelope,endpoint);}finally{replay.dispose();}
 assert(afterKnownRefill.wallet.availableData===2&&afterKnownRefill.data.length===0&&afterKnownRefill.wallet.publicity===8);
 const proof={fixture:input,sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),start,afterEarlyAnalysis,afterKnownRefill,path,endpoint,independentReplayExact:true,newAutonomousRuns:0};
 if(output)fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({path:path.length,afterEarlyAnalysis,afterKnownRefill}));
}finally{c.dispose();}
