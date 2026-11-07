'use strict';

const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const [fixture,out]=process.argv.slice(2),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const f=JSON.parse(fs.readFileSync(fixture)),seat=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope;
const read=()=>{const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState);};
const player=()=>read().players.players.find(p=>p.id===seat);
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const path=[];
function pick(family,test=()=>true){
  const actions=menu().filter(a=>a.actorId===seat&&a.family===family&&test(a));
  assert.equal(actions.length,1);
  const a=actions[0],d=c.inspect().session?.decision;
  const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:seat,choice:a})
    :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(r.ok,JSON.stringify(r));path.push({id:a.actionId,family:a.family,target:a.target});
}
try{
  assert(c.lifecycle.restore(f.compositionEnvelope).ok);assert.deepEqual(save(),f.compositionEnvelope);
  const p=player();
  pick('quick_trade',a=>a.target.tradeId==='cards-for-energy');
  for(const id of ['amiba_0.webp','amiba_1.webp']){
    const card=p.hand.find(x=>x.cardId===id);
    assert(card);
    pick('choose_payment',a=>a.target.cardInstanceId===card.id&&a.target.select);
  }
  pick('choose_payment',a=>a.target.confirm);
  pick('scan');
  pick('choose_target',a=>a.target.nebulaId==='sector-3-a');
  pick('choose_card',a=>a.target.nebulaId==='sector-3-a');
  pick('choose_target',a=>a.target.choiceId==='trace:1:pink:state-extra');
  assert.equal(read().data.sectorSettlements.winsByPlayerId[seat].length,3);
  assert(menu().some(a=>a.family==='complete_task'&&a.target.ruleId==='dlc9-three-sector-wins'));
  assert.equal(path.length,8);
  const result={fixture,fixtureSha256:sha(fixture),initial:p.resources,after:player().resources,path,taskReady:true,endpoint:save()};
  assert(c.lifecycle.restore(f.compositionEnvelope).ok);assert.deepEqual(save(),f.compositionEnvelope);
  if(out)fs.writeFileSync(out,JSON.stringify({...result,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({inputs:path.length,after:result.after,taskReady:true}));
}finally{c.dispose();}
