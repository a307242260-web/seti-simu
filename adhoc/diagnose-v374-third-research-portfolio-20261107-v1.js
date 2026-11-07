'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const values=require('../randomizer/game/ai/state-value');
const probe=require('../randomizer/game/ai/probe-capital');
const ready=require('../randomizer/game/ai/ready-analysis-capital');
const [source,output]=process.argv.slice(2), input=JSON.parse(fs.readFileSync(source));
const seat='player-white', seed='seti-free-analyze-v1';
function run(row){
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
 k.newGame({seed});const c=k.composition,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 assert(c.lifecycle.restore(input.root).ok);
 const save=()=>c.lifecycle.save().envelope;
 const rows=[];
 function capture(label){
  const root=save();
  const o=p.openRoot().observation;
  try{
   const pl=o.publicState.players.find(x=>x.playerId===seat), f={...probe.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,
    researchCost:pl.researchPublicityCost,computerSlots:pl.dataProgress.computerSlots,analyzeEnergyCost:ready.energyCost(pl.industryAbilityId),reservedCards:o.selfState.reservedCards};
   const {total,components}=values.evaluateStateValue(o,seat), capital=values.purposeCapital(f);
   assert.deepEqual(save(),root);
   rows.push({label,total,components,pool:pl.availableData,publicity:pl.publicity,computerSlots:f.computerSlots,
    analysisPlan:capital.analysisPlan,analysisPublicityPlan:capital.analysisPublicityPlan,researchSymbolPlan:capital.researchSymbolPlan});
  }finally{p.close();}
 }
 try{
  capture('common-root');
  for(const x of row.path.slice(0,17)){
   const d=c.inspect().session?.decision, a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===x.id);
   assert(a);
   const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
     :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
   assert(r.ok);
   if(['choose_target','complete_task','end_turn'].includes(x.family))capture(x.target?.tileId||x.family);
  }
  assert(c.lifecycle.restore(input.root).ok);assert.deepEqual(save(),input.root);
  return {name:row.name,rows};
 }finally{p.close();c.dispose();}
}
const rows=input.rows.filter(r=>['blue4-then-purple1','purple1-then-blue4'].includes(r.name)).map(run);

if(output)fs.writeFileSync(output,JSON.stringify({source,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(x=>[x.name,x.rows.map(y=>[y.label,y.total,y.pool,y.publicity,y.components,y.analysisPublicityPlan?.reason,y.analysisPlan?.selected?.incomeCardId])])));
