'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const local=require('../randomizer/game/ai/local-decision-plans');
const cards=require('../randomizer/game/cards/effects'),data=require('../randomizer/game/data'),players=require('../randomizer/game/players');
const [fixture,output]=process.argv.slice(2),q=JSON.parse(fs.readFileSync(fixture)).rows.find(row=>row.label==='pink-trigger');
const seatId='player-white',seed='seti-free-analyze-v1',session=q.envelope.session.session,owner=s=>s.players.players.find(p=>p.id===seatId);
const native=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
native.newGame({seed});const c=native.composition;
const save=()=>c.lifecycle.save().envelope,restore=()=>{assert(c.lifecycle.restore(q.envelope).ok);assert.deepEqual(save(),q.envelope);};
const apply=()=>local.pureOptional({state:structuredClone(session.workingState),seatId,actions:q.actions,session});
try{
 restore();const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 let spec;try{port.setResourcePlanning(true);spec=port.localDecisionSpec(port.openRoot());}finally{port.close();}
 assert.equal(spec.reason,'greedy-free-retained-trigger-data');assert.deepEqual(spec,apply());assert.equal(spec.isEquivalence,false);
 const confirm=q.actions.find(a=>a.actionId===spec.selectedActionId),skip=q.actions.find(a=>spec.excludedActionIds.includes(a.actionId));
 const caseSpec=(mutate,changeSession=x=>x)=>{const s=structuredClone(session.workingState);mutate(s);return local.pureOptional({state:s,seatId,actions:q.actions,session:changeSession(session)});};
 assert.equal(caseSpec(s=>{const p=owner(s);while(p.resources.availableData<players.RESOURCE_LIMITS.availableData)assert(data.gainData(p,{root:s}).ok);}),null);
 assert.equal(caseSpec(s=>{const card=owner(s).reservedCards.find(c=>c.id===confirm.target.cardInstanceId),other=cards.getCardModel(card).triggers.find(t=>t.id!==confirm.target.ruleId);assert(cards.consumeTrigger(card,other.id));}),null);
 assert.equal(caseSpec(()=>{},s=>({...s,queue:[...s.queue,{type:'residual_gain_data',ownerId:seatId}]})),null);
 const masked=caseSpec(s=>{const d=s.cards.drawPileCardIds;assert(d.length>2);[d[0],d[1]]=[d[1],d[0]];});
 assert.deepEqual(masked,spec);
 const rows={};
 for(const a of [confirm,skip]){
  restore();const d=c.inspect().session.decision;
  const r=c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:d.choices.find(x=>x.actionId===a.actionId)});
  assert(r.ok);const envelope=save(),state=JSON.parse(envelope.committedState),p=owner(state);
  const card=p.reservedCards.find(c=>c.id===confirm.target.cardInstanceId);
  assert(card);
  rows[a.actionId]={envelope,data:p.resources.availableData,hand:p.hand.map(c=>c.id),credits:p.resources.credits,energy:p.resources.energy,score:p.resources.score,
    refill:state.cards.publicCards,remainingDeck:state.cards.drawPileCardIds,consumed:card.cardEffectState.consumedTriggerIds,rng:state.meta.rngState};
 }
 const yes=rows[confirm.actionId],no=rows[skip.actionId];assert.equal(yes.data-no.data,1);assert.deepEqual(yes.consumed,[confirm.target.ruleId]);assert.deepEqual(no.consumed,[]);
 for(const k of ['hand','credits','energy','score','refill','remainingDeck','rng'])assert.deepEqual(yes[k],no[k]);
 restore();const proof={spec,rows,guarded:['full-data-pool','would-consume-last-trigger','unproved-queued-effect'],maskedDeckSwapUnchanged:true,rootAndRngRestored:true};
 fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log('native confirm and skip, three guard counterexamples, masked deck swap: pass');
}finally{c.dispose();}
