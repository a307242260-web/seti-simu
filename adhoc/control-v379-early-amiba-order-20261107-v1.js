'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const data=require('../randomizer/game/data');
const [fixture,route,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),r=read(fixture),path=read(route).rows[0].path;
const seed=r.source.seed,seatId=r.seatId,n=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});n.newGame({seed});const c=n.composition;
const save=()=>c.lifecycle.save().envelope,restore=()=>{assert(c.lifecycle.restore(r.compositionEnvelope).ok);assert.deepEqual(save(),r.compositionEnvelope);};
const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const step=id=>{const d=c.inspect().session?.decision,a=legal().find(a=>a.actionId===id);
 assert(a,JSON.stringify({id,legal:legal().map(a=>[a.actionId,a.summary])}));
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(result.ok);return{id,summary:a.summary,target:a.target};};
const ix=(...positions)=>positions.map(i=>{
 const x=path[i],a=legal().find(a=>a.actionId===x.id)||legal().find(a=>JSON.stringify(a.target)===JSON.stringify(x.target));
 if(!a)throw new Error(JSON.stringify({index:i,x,legal:legal().map(a=>[a.actionId,a.summary,a.target])}));
 return step(a.actionId);
});
const snapshot=()=>{
 const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seatId),port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 let value;try{const root=port.openRoot(),ev=createStateValueEvaluator(seatId);value=ev.details(port.valueObservation(root));}finally{port.close();}
 return{e,wallet:p.resources,income:p.income,hand:p.hand.map(c=>c.cardId),computer:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),
  turn:s.turn.turnNumber,trace:s.aliens.amiba.traceSlotsByAlienSlotId,symbols:s.aliens.amiba.symbolSlots,value:value.value,
  unrealized:value.unrealizedPurposeValue,menu:legal().map(x=>[x.actionId,x.summary])};
};
const rows={};try{
 for(const mode of ['blue-then-yellow','yellow-then-blue','red-then-blue','blue-then-red','blue-then-analysis']){
  restore();let steps=[],first,second,analyzed,unavailable;
  const attempt=(action)=>{try{steps.push(...action());return true;}catch(e){unavailable=e.message;return false;}};
  if(mode.startsWith('blue')){
   assert(attempt(()=>ix(0,1,2,3,4,5,6)));first=snapshot();
   if(mode==='blue-then-analysis'){
    if(attempt(()=>ix(10,11,12,13)))analyzed=snapshot();
   }else{
    if(attempt(()=>[...ix(7),...(mode==='blue-then-red'?[step('choose_target:178e1f5e')]:ix(8)),...ix(9)]))second=snapshot();
    if(!unavailable&&attempt(()=>ix(10,11,12,13)))analyzed=snapshot();
   }
  }else{
   assert(attempt(()=>[...ix(7),...(mode==='red-then-blue'?[step('choose_target:178e1f5e')]:ix(8)),...ix(9)]),unavailable);first=snapshot();
   if(attempt(()=>ix(0,1,2,3,4,5,6)))second=snapshot();
   if(!unavailable&&attempt(()=>ix(10,11,12,13)))analyzed=snapshot();
  }
  const end=analyzed||second||first;
  if(!unavailable){restore();for(const x of steps)step(x.id);assert.deepEqual(save(),end.e);}
  rows[mode]={steps,first,second,analyzed,unavailable,independentReplayExact:!unavailable};
 }
 restore();fs.writeFileSync(output,JSON.stringify({rows,rootRestored:true},null,2)+'\n',{flag:'wx'});
 for(const [k,v] of Object.entries(rows))console.log(k,v.unavailable,v.first.wallet,v.second?.wallet,v.analyzed?.wallet,v.analyzed?.value,v.analyzed?.hand,v.first.value);
}finally{c.dispose();}
