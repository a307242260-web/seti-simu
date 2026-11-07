'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{searchDecision}=require('../randomizer/game/ai/decision-search'),{BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [source,output,inputs]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const origin=read(source).origin,seed='seti-free-analyze-v1',seatId='player-white',evaluate=createStateValueEvaluator(seatId);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(pred){
 const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({}),a=menu.find(pred);
 assert(a,JSON.stringify(menu.map(a=>[a.family,a.summary,a.target])));
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
function view(){
 const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seatId),obs=buildRuleObservation(s,seed,seatId);
 return{e,wallet:p.resources,hand:p.hand.map(c=>[c.id,c.cardId]),income:p.income,tech:p.techState,final:obs.publicState.players.find(v=>v.playerId===seatId).finalScore,
  model:evaluate.details(obs),probes:s.pieces.rockets.filter(r=>r.playerId===seatId)};
}
try{
 const rows={};
 for(const cardId of ['card-60-0','card-62-0','card-65-0']){
  restore(origin);const actions=[];
  const pick=(family,test=()=>true)=>actions.push(act(a=>a.family===family&&test(a)));
  pick('card_corner',a=>a.target.cardInstanceId==='alien-amiba-9-5');
  pick('research_tech');pick('choose_target',a=>a.target.tileId==='orange1');
  pick('choose_card',a=>a.target.cardInstanceId===cardId);const afterPick=view();
  pick('end_turn');const analyzed=view();
  restore(origin);for(const a of actions)assert.deepEqual(act(x=>x.actionId===a.actionId),a);assert.deepEqual(save(),analyzed.e);
  rows[cardId]={actions,afterPick,analyzed};
  console.log(cardId,analyzed.hand,analyzed.model,analyzed.final);
 }
 const run=e=>{
   restore(e);const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
   try{const at=performance.now(),root=p.openRoot(),search=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
    assert.deepEqual(save(),e);console.log(root.legalActions.find(a=>a.actionId===search.actionId).summary,search.value,search.diagnostics.nativeExecutions,
     search.roots.filter(r=>r.goal?.tileId||r.goal?.id).map(r=>[r.goal?.id,r.value]));
    return{e,search,ms:performance.now()-at,actions:root.legalActions};
   }finally{p.close();}
 };
 const analysis=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,run(v.afterPick.e)]));
 restore(origin);
 fs.writeFileSync(output,JSON.stringify({rows,analysis,origin,standardExperiment:false,rootRestored:true},null,2)+'\n',{flag:'wx'});
 if(inputs)fs.writeFileSync(inputs,JSON.stringify({rows:{'last-research':{analyzed:{e:origin}}}})+'\n',{flag:'wx'});
}finally{c.dispose();}
