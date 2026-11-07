'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [fixture,output]=process.argv.slice(2),{root}=JSON.parse(fs.readFileSync(fixture));
const seed='seti-free-analyze-v1',seat='player-white';
function run(label,enabled,source){
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
 const c=k.composition;assert(c.lifecycle.restore(source).ok);
 const p=createAnalysisPort({composition:c,seatId:seat}), before=c.lifecycle.save().envelope;
 try{
  const t=performance.now(), node=p.openRoot(), evaluate=createStateValueEvaluator(seat);
  const port=enabled?p:{...p,researchDataPurpose:()=>null};
  const r=searchDecision({port,root:node,evaluate,budget:BUDGET,modelKey:evaluate.modelKey,...OPTIONS});
  const ms=performance.now()-t;
  assert(r.complete&&!r.unresolved.length&&r.diagnostics.nativeExecutions<=256&&ms<=600,JSON.stringify([r.stopReason,r.diagnostics.nativeExecutions,ms]));
  assert.deepEqual(c.lifecycle.save().envelope,before);
  return {label,ms,raw:r,selected:r.planEvidence?.goal??r.roots.find(x=>x.actionId===r.actionId)?.goal,
   physical:r.lines.map(l=>[l.status,l.edges.map(e=>[e.actionId,e.target,e.steps,e.cost])]),
   quotes:r.lines.filter(l=>l.researchData).map(l=>({type:l.status,value:l.value,...l.researchData}))};
 }finally{p.close();c.dispose();}
}
const before=run('disabled',false,root), after=run('active',true,root);
assert.deepEqual(before.physical,after.physical);
assert.equal(before.selected.tileId,'blue1');
assert(['blue4','purple1'].includes(after.selected.tileId));
assert(after.quotes.length);
const masked=structuredClone(root), state=JSON.parse(masked.committedState);
const pile=state.cards.drawPileCardIds;assert.notEqual(pile[0],pile[1]);[pile[0],pile[1]]=[pile[1],pile[0]];
for(const id of ['blue1','blue4','purple1']){const stack=state.tech.stacks[id];const i=stack.bonusIndex;assert.notEqual(stack.bonusQueue[i+1],stack.bonusQueue[i+2]);
 [stack.bonusQueue[i+1],stack.bonusQueue[i+2]]=[stack.bonusQueue[i+2],stack.bonusQueue[i+1]];}
masked.committedState=JSON.stringify(state);
const alternate=run('hidden-permutation',true,masked);
assert.deepEqual(alternate.quotes,after.quotes);assert.deepEqual(alternate.selected,after.selected);
const rows=[before,after,alternate];
if(output)fs.writeFileSync(output,JSON.stringify({fixture,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(x=>({label:x.label,ms:x.ms,selected:x.selected,value:x.raw.value,native:x.raw.diagnostics.nativeExecutions,quotes:x.quotes}))));
