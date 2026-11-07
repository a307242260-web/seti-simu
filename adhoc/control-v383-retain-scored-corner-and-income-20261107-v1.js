'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {getStandardScanCost}=require('../randomizer/game/actions/scan-effects');
const [source,output,autonomy]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const origin=read(source).decisionRoots['early-A0-analyzed'].envelope,seed='seti-free-analyze-v1',seatId='player-white';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
const valuation=createStateValueEvaluator(seatId),rows={};
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(pred){
 const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({}),a=menu.find(pred);
 assert(a,JSON.stringify(menu.map(a=>[a.family,a.summary,a.target])));
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
function view(){
 const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seatId),cost=getStandardScanCost(p);
 return{e,wallet:p.resources,income:p.income,hand:p.hand.map(c=>[c.id,c.cardId]),
  computer:p.dataState.placedTokens.filter(t=>t.placementKind==='computer').map(t=>t.placementSlot),
  blue:p.dataState.placedTokens.filter(t=>t.placementKind==='blueBonus').map(t=>t.blueSlot),
  score:p.resources.score,tech:p.techState,scanFunded:Object.entries(cost).every(([k,v])=>p.resources[k]>=v),
  details:valuation.details(buildRuleObservation(s,seed,seatId))};
}
try{
 for(const label of ['computer-first','research-first','corner-for-income-first']){
  restore(origin);const steps=[];
  const a=(family,extra=()=>true)=>steps.push(act(x=>x.family===family&&extra(x)));
  const research=()=>{a('research_tech');a('choose_target',x=>x.target.tileId==='purple1');};
  const fill=(n)=>{for(let i=0;i<n;i++){a('place_data');a('choose_target',x=>x.target.target==='computer');}};
  const income=()=>a('choose_card',x=>x.target.cardInstanceId==='alien-amiba-1-2');
  const blue=()=>{a('place_data');a('choose_target',x=>x.target.target==='blueBonus'&&x.target.blueSlot===1);};
  if(label==='computer-first'){fill(3);research();fill(1);income();blue();}
  else if(label==='research-first'){research();fill(3);blue();fill(1);income();}
  else{a('card_corner',x=>x.summary.startsWith('amiba_7'));fill(4);income();research();blue();}
  a('end_turn');const result=view();
  restore(origin);for(const x of steps)assert.deepEqual(act(a=>a.actionId===x.actionId),x);assert.deepEqual(save(),result.e);
  assert(result.scanFunded&&result.income.credits===7);
  assert.equal(result.hand.some(c=>c[1]==='amiba_7.webp'),label!=='corner-for-income-first');
  rows[label]={steps,analyzed:result};
  console.log(label,result.wallet,result.income,result.details.value,result.hand.map(x=>x[1]));
 }
 restore(origin);
 fs.writeFileSync(output,JSON.stringify({origin,rows,standardExperiment:false,rootRestored:true},null,2)+'\n',{flag:'wx'});
 if(autonomy)fs.writeFileSync(autonomy,JSON.stringify({rows:Object.fromEntries(Object.entries(rows).map(([k,x])=>[k,{analyzed:{e:x.analyzed.e}}]))})+'\n',{flag:'wx'});
}finally{c.dispose();}
