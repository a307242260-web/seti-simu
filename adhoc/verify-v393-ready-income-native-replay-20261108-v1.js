'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const rule=require('../randomizer/game/rule-composition'),values=require('../randomizer/game/ai/state-value'),probe=require('../randomizer/game/ai/probe-capital'),outcome=require('../randomizer/game/ai/outcome-model'),demand=require('../randomizer/game/ai/resource-demand');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/', files={
 original:F+'v207-known-computer3-analysis-prefix-20261106-v1.checkpoint.json',factor:F+'v208-income-factor-prefixes-20261106-v1.checkpoint.json',
 mask:F+'v204-actual-safety-choice-native-20261106-v1.json'};
const read=p=>JSON.parse(fs.readFileSync(p)),source=read(files.original),factor=read(files.factor),info=read(files.mask).branches.safety.observation,seat='player-white';
const origin=source.originalEnvelope,seed=JSON.parse(origin.committedState).meta.seed;
function instance(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k.composition;}
const c=instance(),v=instance();
const save=(comp=c)=>comp.lifecycle.save().envelope;
function restore(e,comp=c){assert(comp.lifecycle.restore(e).ok);assert.deepEqual(save(comp),e);}
function submit(a,comp=c){
 const d=comp.inspect().session?.decision,choices=d?.choices||comp.inputPort.enumerateActions({});
 assert.deepEqual(choices.find(x=>x.actionId===a.actionId),a);
 const r=d?comp.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
  a.phase==='quick'?comp.inputPort.submitQuickAction(a):comp.inputPort.submitAction(a);
 assert(r.ok);
}
function assess(){
 const e=save(),p=JSON.parse(e.committedState).players.players.find(p=>p.id===seat);
 const view=c.projection({role:'player',playerId:seat}).state,masked=rule.sanitizeHiddenInformationObservation(info,view,{code:'hidden_card_reveal'});
 const mv=values.evaluateStateValue(masked,seat),formal=outcome.createDecisionObservation(masked,{seatId:seat}),valueOnly=c.projection({role:'player',playerId:seat,valueOnly:true}).state;
 assert.deepEqual(values.evaluateStateValue(formal,seat),mv);
 assert.deepEqual(values.evaluateStateValue(rule.sanitizeHiddenInformationObservation(info,valueOnly,{code:'hidden_card_reveal'}),seat),mv);
 const facts={...probe.factsFromObservation(masked,seat),supply:masked.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0},plan=values.purposeCapital(facts);
 const known=masked.selfState.hand.filter(card=>!card.hidden).map(card=>card.id);
 assert.deepEqual(save(),e);
 return {value:mv,physical:{resources:p.resources,income:p.income,score:p.resources.score,known,
  anonymousCards:masked.selfState.hand.filter(c=>c.hidden).length},plan:{incomeCardId:plan.analysisPlan.selected?.incomeCardId??null,
  value:plan.analysisPlan.value,position:plan.analysisPlan.selected?.position??null,preparationPlacements:plan.analysisPlan.selected?.preparationPlacements??null}};
}
try{
 restore(origin);
 let before;
 const rows={};
 for(const [i,a] of factor.common.steps.entries()){
  submit(a);assert.deepEqual(save(),factor.common.prefixes[i]);
  if(i===1)before=assess();
 }
 assert.deepEqual(save(),factor.common.envelope);
 assert.equal(before.plan.incomeCardId,'card-18-0');assert.equal(before.plan.position,4);
 const state=save().session.session.workingState,actions=c.inspect().session.decision.choices.filter(a=>before.physical.known.includes(a.target.cardInstanceId));
 const fixed=demand.incomeChoice({state,seatId:seat,goal:{kind:'analyze',targetComputerSlot:6,required:{energy:0}},actions});
 assert.equal(actions.find(a=>a.actionId===fixed.actionId).target.cardInstanceId,before.plan.incomeCardId);
 for(const [name,branch] of Object.entries(factor.branches)){
  const steps=branch.steps||source.steps.slice(4);
  restore(factor.common.envelope);
  for(const [i,a] of steps.entries()){submit(a);if(branch.prefixes)assert.deepEqual(save(),branch.prefixes[i]);}
  assert.deepEqual(save(),branch.envelope);
  restore(origin,v);for(const a of [...factor.common.steps,...steps])submit(a,v);
  assert.deepEqual(save(v),save());
  rows[name]={...assess(),inputs:steps.length,incomeCardId:steps[0].target.cardInstanceId};
 }
 const e=rows['energy-B48'];
 assert.equal(e.physical.income.energy,before.physical.income.energy+1);
 assert(!e.physical.known.includes(before.plan.incomeCardId));
 assert.equal(e.value.total,before.value.total);
 assert.equal(e.value.total,Math.max(...Object.values(rows).map(x=>x.value.total)));
 restore(origin);
 const output={model:values.MODEL_VERSION,rootSessionAndRngExact:true,before,rows,uniqueNativeInputs:factor.common.steps.length+Object.values(rows).reduce((a,b)=>a+b.inputs,0),
  inputs:Object.fromEntries(Object.entries(files).map(([k,p])=>[k,{path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}]))};
 fs.writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n',{flag:'wx'});
 console.log([before.value.total,...Object.values(rows).map(x=>x.value.total)]);
}finally{c.dispose();v.dispose();}
