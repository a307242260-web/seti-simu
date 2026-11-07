'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const [inputs,output,incomeCardId='alien-amiba-1-2']=process.argv.slice(2),source=JSON.parse(fs.readFileSync(inputs)).rows.find(x=>x.i===7).envelope;
const seatId='player-white',seed='seti-free-analyze-v1',k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
const valuation=createStateValueEvaluator(seatId),trace=[];
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function view(){const e=save(),state=JSON.parse(e.committedState),p=state.players.players.find(x=>x.id===seatId);
 return{e,turn:state.turn.turnNumber,round:state.turn.roundNumber,wallet:p.resources,income:p.income,owned:p.techState.ownedTiles,
  hand:p.hand.map(x=>x.cardId),data:p.dataState,details:valuation.details(buildRuleObservation(state,seed,seatId))};}
function take(predicate){
 const d=c.inspect().session?.decision,choices=d?.choices||c.inputPort.enumerateActions({}),a=choices.find(predicate);
 assert(a,JSON.stringify(choices.map(a=>[a.family,a.target,a.summary])));const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
function act(family,field,value){const action=take(a=>a.family===family&&(!field||a.target?.[field]===value));trace.push({action,...view()});}
try{
 restore(source);const a=view();
 act('end_turn');const b=view();
 act('card_corner','cardInstanceId','alien-amiba-7-7');
 act('place_data');act('choose_target','target','computer');
 act('card_corner','cardInstanceId','alien-amiba-9-5');
 act('research_tech');act('choose_target','tileId','purple1');
 act('place_data');act('choose_target','target','computer');
 act('place_data');act('choose_target','target','computer');
 act('choose_card','cardInstanceId',incomeCardId);const after=view();
 assert.equal(b.turn,a.turn+1);assert.equal(b.round,a.round);assert.equal(after.income[incomeCardId==='alien-amiba-1-2'?'credits':'energy'],a.income[incomeCardId==='alien-amiba-1-2'?'credits':'energy']+1);
 assert.equal(after.wallet.availableData,0);assert(after.owned.purple1);
 restore(source);for(const {action:x,e} of trace){assert.deepEqual(take(y=>y.actionId===x.actionId),x);assert.deepEqual(save(),e);}
 restore(source);
 fs.writeFileSync(output,JSON.stringify({a,b,after,trace,originalRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 console.log('first turnover',b.details,'fixed endpoint',after.details,'income',after.income,'wallet',after.wallet,trace.length);
}finally{c.dispose();}
