'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {searchDecision}=require('../randomizer/game/ai/decision-search'),{BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [originFile,output]=process.argv.slice(2),seatId='player-white',seed='seti-free-analyze-v1';
const origins=JSON.parse(fs.readFileSync(originFile)).rows;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(pick){const d=c.inspect().session?.decision,choices=d?.choices||c.inputPort.enumerateActions({}),a=choices.find(pick);
 assert(a,JSON.stringify(choices.map(a=>[a.family,a.target,a.summary])));const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;}
function search(){
 const origin=save(),p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
 try{const at=performance.now(),root=p.openRoot(),result=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS}),ms=performance.now()-at;
 assert.deepEqual(save(),origin);return{result,ms,native:result.diagnostics.nativeExecutions,legal:root.legalActions};}finally{p.close();}
}
const rows={};
try{
 for(const label of ['amiba0-blue','amiba0-computer-only']){
  const origin=origins[label].analyzed.e;restore(origin);
  const root=search();const steps=[];
  const push=a=>steps.push(a);
  push(act(a=>a.family==='place_data'));push(act(a=>a.family==='choose_target'&&a.target?.target==='computer'));
  push(act(a=>a.family==='analyze'));
  const traceMenu=save(),selected=search(),choices=selected.legal;
  console.log(label,'root',root.native,root.result.actionId,root.result.value,'trace',choices.map(a=>[a.summary,a.target,selected.result.roots.find(r=>r.actionId===a.actionId)?.value]));
  for(const trace of choices.filter(a=>a.family==='choose_target')){
   restore(traceMenu);
   const actions=[...steps,act(a=>a.actionId===trace.actionId)],tail=[];
   while(actions.length<20){
    const e=save(),cold=search(),a=cold.legal.find(a=>a.actionId===cold.result.actionId);
    if(!cold.result.complete||cold.native>256||cold.ms>600)break;
    tail.push({native:cold.native,ms:cold.ms,value:cold.result.value,actionId:a.actionId});
    actions.push(act(x=>x.actionId===a.actionId));
    if(a.family==='end_turn')break;
    assert.notDeepEqual(save(),e);
   }
   if(actions.at(-1).family!=='end_turn')continue;
   const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(p=>p.id===seatId);
   restore(origin);for(const a of actions)assert.deepEqual(act(x=>x.actionId===a.actionId),a);assert.deepEqual(save(),e);
   const k=label+' / '+trace.summary;
   rows[k]={analyzed:{e,actions},tail,score:p.resources.score,pool:p.resources.availableData,hand:p.hand.map(c=>c.cardId),income:p.income,resources:p.resources,
    tech:p.techState.ownedTiles,root:{native:root.native,ms:root.ms,value:root.result.value,
     rank:root.result.roots.filter(r=>r.value!=null).map(r=>[r.actionId,r.goal?.id,r.value])}};
   console.log(k,rows[k].score,rows[k].pool,rows[k].hand);
   if(label==='amiba0-computer-only'&&trace.target.position===4){
    const draw=actions.findIndex(a=>a.family==='choose_card');
    assert(draw>=0&&actions[draw+1].family==='place_data'&&actions[draw+2].target.target==='computer');
    for(const [suffix,prefix] of [['keep-A7-and-pool',draw+1],['keep-A7-and-computer1',draw+3]]){
     restore(origin);const fixed=actions.slice(0,prefix);
     for(const a of fixed)assert.deepEqual(act(x=>x.actionId===a.actionId),a);
     fixed.push(act(a=>a.family==='end_turn'));const endpoint=save();
     restore(origin);for(const a of fixed)assert.deepEqual(act(x=>x.actionId===a.actionId),a);assert.deepEqual(save(),endpoint);
     const pp=JSON.parse(endpoint.committedState).players.players.find(p=>p.id===seatId);
     rows[k+' / '+suffix]={analyzed:{e:endpoint,actions:fixed},score:pp.resources.score,pool:pp.resources.availableData,hand:pp.hand.map(c=>c.cardId),
       resources:pp.resources,income:pp.income,tech:pp.techState.ownedTiles};
    }
   }
  }
 }
 fs.writeFileSync(output,JSON.stringify({rows,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}
