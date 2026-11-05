'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const value=require('./state-value'),probe=require('./probe-capital'),ready=require('./ready-analysis-capital'),rules=require('../rule-composition'),{createAnalysisPort}=require('./analysis-port');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../',F+p))),prior=read('v218-paired-visible-scan-prefix-20261106-v1.checkpoint.json'),suffix=read('v218-paired-scan-income-analysis-prefix-20261106-v1.checkpoint.json'),seat='player-white',seed=JSON.parse(prior.branches.DLC31.envelope.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
function facts(o){const p=o.publicState.players.find(p=>p.playerId===seat);return {...probe.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,researchCost:p.researchPublicityCost,computerSlots:p.dataProgress.computerSlots,analyzeEnergyCost:ready.energyCost(p.industryAbilityId),reservedCards:o.selfState.reservedCards};}
const rows=[];
try{for(const[name,b]of Object.entries(prior.branches)){
 assert(c.lifecycle.restore(b.envelope).ok);const before=c.lifecycle.save().envelope,obs=rules.sanitizeHiddenInformationObservation(b.informationRoot,c.projection({role:'player',playerId:seat}).state,{code:'hidden_card_reveal'}),f=facts(obs),q=value.purposeCapital(f),v=value.evaluateStateValue(obs,seat);
 assert(c.lifecycle.restore(suffix.branches[name].prefixes[2]).ok);const after=rules.sanitizeHiddenInformationObservation(b.informationRoot,c.projection({role:'player',playerId:seat}).state,{code:'hidden_card_reveal'}),afterV=value.evaluateStateValue(after,seat);
 assert(v.total>=afterV.total,'known, free public income exchange must already be valued before it is executed');
 if(name==='DLC31'){
  assert.equal(v.total,afterV.total);assert.equal(q.knownPublicIncomeSwapPlan.incomingCardId,'card-18-0');assert.equal(q.knownPublicIncomeSwapPlan.outgoingCardId,null);assert.equal(q.knownPublicIncomeSwapPlan.netGain,11.833333333333334);
  for(const variant of ['b_2.webp','dlc_31.png','amiba_0.webp']){const altered=structuredClone(f);for(const card of altered.hand)if(card.hidden)Object.assign(card,{id:'ignored-secret',cardId:variant,price:999,income_code:0});assert.equal(value.purposeCapital(altered).total,q.total,'hidden metadata cannot fund a known public income');}
  const counted={...f,hand:[],extraUnknownCount:1};assert.equal(value.purposeCapital(counted).total,q.total,'count-only and explicitly masked hand must agree');
  const noCompany={...f,companyState:{...f.companyState,roundMarkRound:f.round}};assert.equal(value.purposeCapital(noCompany).knownPublicIncomeSwapPlan,null);
  for(const altered of [{...f,hand:[],extraUnknownCount:0},{...f,passing:true},{...f,terminal:true},{...f,pendingNativeEffects:true},{...f,pendingHandCardTriggers:['pending']},{...f,computerSlots:[1,2,3,4]},{...f,player:{...f.player,availableData:2}},{...f,board:{...f.board,publicCards:[{hidden:true,cardId:'b_48.webp'}]}}])assert.equal(value.purposeCapital(altered).knownPublicIncomeSwapPlan,null);
 }
 // Recover the already accepted Native prefixes cold. The scalar forecast
 // must choose existing real menu IDs through both pending swap selections.
 for(let i=0;i<3;i++){
  const e=i===0?b.envelope:suffix.branches[name].prefixes[i-1];assert(c.lifecycle.restore(e).ok);const original=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{p.setResourcePlanning(true);p.setCardPickPlanning(true);const root=p.openRoot(),policy=p.cardPickSpec(root);
   if(name==='DLC31'){const id=policy.selectedActionId,a=root.legalActions.find(a=>a.actionId===id);assert(a);if(i===0){assert.equal(a.family,'industry');assert.equal(policy.companySwap.reason,'realize-known-income-funding-option');assert.deepEqual(policy.companySwap.discardIds,['card-58-0']);}else assert.equal(a.target.cardInstanceId,i===1?'card-58-0':'card-18-0');}
   assert.deepEqual(c.lifecycle.save().envelope,original);
  }finally{p.close();}
 }
 rows.push({branch:name,before:v.total,after:afterV.total});assert(c.lifecycle.restore(before).ok);assert.deepEqual(c.lifecycle.save().envelope,before);
}console.log(JSON.stringify({publicAmibaIncomeSwap:'passed',rows,newNativeInputs:0,newAutonomousRuns:0,rootAndRngRestored:true}));}finally{c.dispose();}
