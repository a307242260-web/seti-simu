'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent'),plans=require('../randomizer/game/ai/local-decision-plans');
const [source,direct,output,autonomy]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const prior=read(source),witness=read(direct),b=witness.b.e,a=prior.rows.find(x=>x.i===7).envelope;
const seatId='player-white',seed='seti-free-analyze-v1',valuation=createStateValueEvaluator(seatId);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function search(e){
 restore(e);
 const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const at=performance.now(),root=p.openRoot(),result=searchDecision({port:p,root,evaluate:valuation,modelKey:valuation.modelKey,budget:BUDGET,...OPTIONS});
  assert(result.complete&&!result.unresolved.length);assert.deepEqual(save(),e);
  return{e,result,ms:performance.now()-at,native:result.diagnostics.nativeExecutions,action:root.legalActions.find(x=>x.actionId===result.actionId)};
 }finally{p.close();}
}
function act(expected){
 const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(x=>x.actionId===expected.actionId);
 assert.deepEqual(a,expected);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
}
const state=e=>JSON.parse(e.committedState),select=result=>result.lines.flatMap(l=>l.deferredComputerIncome?[l.deferredComputerIncome]:[]);
try{
 const rows={source:search(a)};
 assert.equal(rows.source.action.family,'end_turn');assert.equal(rows.source.native,3);assert.equal(rows.source.result.value,159.5);
 const [quote]=select(rows.source.result);assert.equal(quote.value,1.5);assert.equal(quote.incomeCardId,witness.trace.at(-1).action.target.cardInstanceId);
 act(rows.source.action);assert.deepEqual(save(),b);
 for(const x of witness.trace.slice(1)){act(x.action);assert.deepEqual(save(),x.e);}
 assert.deepEqual(quote.wallet,witness.after.wallet);
 const obs=structuredClone(buildRuleObservation(state(witness.after.e),seed,seatId));
 obs.publicState.board.techSupply.stacks.purple1.bonusHidden=true;
 obs.publicState.board.techSupply.stacks.purple1.bonusId=null;
 const knownOnlyValue=valuation.details(obs).value;
 assert.equal(knownOnlyValue,rows.source.result.value);
 const changed=state(a),stack=changed.tech.stacks.purple1,n=stack.bonusIndex+1,deck=changed.cards.drawPileCardIds;
 [stack.bonusQueue[n],stack.bonusQueue[n+1]]=[stack.bonusQueue[n+1],stack.bonusQueue[n]];
 [deck[0],deck[1]]=[deck[1],deck[0]];
 rows.hiddenOrders=search({...a,committedState:JSON.stringify(changed)});
 assert.equal(rows.hiddenOrders.action.actionId,rows.source.action.actionId);
 assert.equal(rows.hiddenOrders.native,3);assert.deepEqual(select(rows.hiddenOrders.result),[quote]);
 const unavailable=state(a),p=unavailable.players.players.find(p=>p.id===seatId);
 p.resources.publicity--;
 rows.shortPublicity=search({...a,committedState:JSON.stringify(unavailable)});
 assert.equal(select(rows.shortPublicity.result).length,0);
 rows.spentData=search(prior.rows.find(x=>x.i===8).envelope);
 assert.equal(select(rows.spentData.result).length,0);
 const notKnown=state(a),viewer=notKnown.players.players.find(p=>p.id===seatId),visible=new Set([...viewer.hand,...viewer.reservedCards].map(c=>c.id));
 visible.delete(quote.cornerCardId);
 assert.equal(plans.deferredComputerIncomeSource({state:notKnown,seatId,knownCards:visible}),null);
 restore(a);
 fs.writeFileSync(output,JSON.stringify({rows,knownOnlyValue,quote,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
 if(autonomy)fs.writeFileSync(autonomy,JSON.stringify({rows:{'cold-after-analysis':{analyzed:{e:a}},'cold-before-computer1':{analyzed:{e:prior.rows.find(x=>x.i===5).envelope}}}},null,2)+'\n',{flag:'wx'});
 console.log('known-only Native V',knownOnlyValue,'available',quote.value,'missing funds and unknown/spent corner rejected');
}finally{c.dispose();}
