'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const [source,controls,traces,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const from=read(source).decisionRoots['before-research-income-paid'].envelope,ordered=read(controls).control.scanFirst;
const fits=read(traces).worlds[0].rows.pink2.afterTrace.e;
const seed='seti-free-analyze-v1',seatId='player-white';
const n=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});n.newGame({seed});const c=n.composition;
const save=()=>c.lifecycle.save().envelope,restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function step(fn){
 const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(fn);assert(a);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
const end=()=>step(a=>a.family==='end_turn'),task=()=>step(a=>a.family==='complete_task'),accept=()=>step(a=>a.target?.choiceId?.startsWith('confirm:task:'));
const evaluate=createStateValueEvaluator(seatId);
function compare(a,b,at='',out=[]){
 if(Object.is(a,b))return out;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'){out.push(at);return out;}
 for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],at+'/'+k,out);
 return out;
}
try{
 restore(from);for(const x of ordered.steps.slice(0,11))step(a=>a.actionId===x.id);
 const overflow=save(),p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 let deferred;
 try{
  p.setResourcePlanning(true);p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
  const root=p.openRoot(),spec=p.turnTailSummary(root,'end-turn');
  assert(spec?.deferredPublicity);assert.equal(spec.requiredNativeInputs,2);assert.equal(spec.netGain,0);
  assert.equal(p.resourceSpec(root).fixedPublicityTask,undefined);
  const first=p.expand(root,spec.firstActionId),fixed=p.localDecisionSpec(first);
  assert.equal(fixed.kind,'fixed-defer-overflow-task');const leaf=p.expand(first,fixed.selectedActionId);
  const baseline=evaluate(p.valueObservation(root)),final=evaluate(p.valueObservation(leaf));
  const actualQuote=p.deferredSectorPublicityQuote(leaf),proof=p.turnTailBoundary(root,spec);
  assert.deepEqual(p.deferredSectorPublicityQuote(proof),actualQuote);
  assert.equal(baseline,final);assert.deepEqual(actualQuote,spec.deferredPublicity);
  assert.deepEqual(save(),overflow);
  deferred={overflow,spec,baseline,final,actualQuote,skip:fixed.selectedActionId};
 }finally{p.close();}
 restore(overflow);end();step(a=>a.actionId===deferred.skip);assert.deepEqual(save(),ordered.scanBoundary.env);
 deferred.independentReplayExact=true;
 restore(fits);const q=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});let chosen;
 try{
  const root=q.openRoot(),search=searchDecision({port:q,root,evaluate,budget:BUDGET,modelKey:evaluate.modelKey,...OPTIONS});
  assert(search.complete);assert.equal(search.lines[0].resourcePolicy.fixedPublicityTask.gain,3);
  chosen=root.legalActions.find(a=>a.actionId===search.actionId);assert.equal(chosen.family,'complete_task');
  assert.deepEqual(save(),fits);
 }finally{q.close();}
 task();end();const early=save();restore(fits);end();accept();const late=save();
 const differences=compare(JSON.parse(early.committedState),JSON.parse(late.committedState));
 assert(differences.every(d=>d==='/meta/stateVersion'||d==='/match/decisionVersion'),JSON.stringify(differences));
 restore(from);
 fs.writeFileSync(output,JSON.stringify({deferred,fits:{fits,chosen,early,late,differences},rootRestored:true},null,2)+'\n',{flag:'wx'});
 console.log('Native end/skip and its defer quote match; early and end-task payout differences:',JSON.stringify(differences));
}finally{c.dispose();}
