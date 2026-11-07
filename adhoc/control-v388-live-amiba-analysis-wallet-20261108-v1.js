'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [fixture,out]=process.argv.slice(2),seed='seti-free-analyze-v1',seat='player-white';
const source=JSON.parse(fs.readFileSync(fixture));
const kernel=()=>{const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});return k.composition;};
const c=kernel(),independent=kernel(),rows={};
// Two fixed paths and the same stopping points. No graph expansion, unknown-card
// spending, new-round actions, or merge of unequal Native states.
const save=(k=c)=>k.lifecycle.save().envelope;
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=(k=c)=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(a,k=c){
 assert.deepEqual(menu(k).find(q=>q.actionId===a.actionId),a);
 const d=k.inspect().session?.decision;
 const r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
   a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
function read(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat);
 return {e,s,p};
}
function view(){
 const {e,s,p}=read();
 const choices=menu().map(a=>({family:a.family,target:a.target,summary:a.summary}));
 return {e,wallet:p.resources,income:p.income,hand:p.hand.map(q=>[q.id,q.cardId]),tech:p.techState,
  computer:p.dataState.placedTokens.filter(x=>x.placementKind==='computer').map(x=>x.placementSlot),
  blue:p.dataState.placedTokens.filter(x=>x.placementKind==='blueBonus').map(x=>x.blueSlot),
  rng:s.meta.rngState,round:s.turn.roundNumber,choices};
}
try{
 for(const [label,branch] of Object.entries(source.rows)){
  const origin=branch.after.e,steps=[],checkpoints={},t=performance.now();
  restore(origin);
  const step=(family,test=()=>true,optional=false)=>{
   const a=menu().find(q=>q.family===family&&test(q));
   if(!a&&optional)return false;
   assert(a,JSON.stringify(menu().map(q=>[q.family,q.target,q.summary])));
   assert(steps.length<16,'fixed experiment input limit');
   steps.push(a);submit(a);return true;
  };
  step('place_data');
  step('choose_target',a=>a.target.target==='computer');
  step('end_turn');
  step('analyze');
  step('choose_target',a=>a.target.choiceId==='trace:1:blue:amiba:4');
  step('choose_card',a=>a.target.choiceId==='amiba:display:7');
  checkpoints.analyzed=view();
  step('card_corner',a=>a.target.cardInstanceId==='alien-amiba-7-10',true);
  checkpoints.afterKnownCorner=view();
  step('end_turn');
  checkpoints.nextTurn=view();
  const canFundBlueFromData=checkpoints.nextTurn.wallet.availableData>=2;
  step('place_data');
  step('choose_target',a=>a.target.target==='computer');
  if(canFundBlueFromData){
   step('place_data');
   step('choose_target',a=>a.target.target==='blueBonus'&&a.target.blueSlot===1);
  }
  checkpoints.afterBlueFunding=view();
  assert.deepEqual(checkpoints.afterBlueFunding.blue,canFundBlueFromData?[1]:[]);
  assert.equal(checkpoints.afterBlueFunding.wallet.energy,canFundBlueFromData?2:1);
  assert.equal(checkpoints.nextTurn.wallet.availableData,label==='orange'?3:1);
  assert.equal(checkpoints.afterBlueFunding.choices.some(q=>q.family==='scan'),canFundBlueFromData);
  restore(origin,independent);for(const a of steps)submit(a,independent);
  assert.deepEqual(save(independent),checkpoints.afterBlueFunding.e);
  restore(origin);
  assert(Object.values(checkpoints).every(x=>x.round===3));
  rows[label]={origin,steps,checkpoints,independentStateSessionRng:true,ms:performance.now()-t};
  console.log(label,Object.fromEntries(Object.entries(checkpoints).map(([k,x])=>[k,[x.wallet,x.computer,x.blue,x.choices.filter(a=>['scan','research_tech','place_data'].includes(a.family)).map(a=>a.family)]])));
 }
 fs.writeFileSync(out,JSON.stringify({source:fixture,rows,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();independent.dispose();}
