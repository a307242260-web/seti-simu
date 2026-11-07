'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),z=require('node:zlib');
const [fixture,reference,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),f=read(fixture),old=JSON.parse(z.gunzipSync(fs.readFileSync(reference)));
const file=require.resolve('../randomizer/game/ai/analysis-port'),mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;
let source=fs.readFileSync(file,'utf8'),rows=[];
const inject=(a,b)=>{assert.equal(source.split(a).length,2);source=source.replace(a,b);};
globalThis.__v394Data=(side,node,plan,detail)=>rows.push({side,goal:plan?.goal?.id,first:plan?.firstActionId,status:node.status,boundary:node.boundary,legal:node.legalActions,...detail});
inject('    function expandResourcePlan(node,plan,hasCapacity) {','    function expandResourcePlan(node,plan,hasCapacity) {\n      if(plan.goal.kind==="blue-data"||plan.goal.kind==="computer-prefix"){const stored=nodes.get(node);globalThis.__v394Data("native",node,plan,{envelope:stored.envelope,informationBarrier:stored.informationBarrier,intent:stored.intent,resourceControl:stored.resourceControl,movement:goalMovementSpec(node),pick:cardPickSpec(node)});}');
inject('              if(compound.available&&compound.plans[0]?.goal.id===plan.goal.id','              globalThis.__v394Data("compound",node,plan,{available:compound.available,primaryOnly:compound.primaryOnly,reason:compound.reason});\n              if(compound.available&&compound.plans[0]?.goal.id===plan.goal.id');
mod._compile(source,file);mod.loaded=true;require.cache[file]=mod;
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),values=require('../randomizer/game/ai/state-value'),{BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const k=createSimulationRuleComposition({seed:f.source.seed,random:createSeededRandom(f.source.seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,f.source.seed,v?.playerId)});k.newGame({seed:f.source.seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const initial=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{
 const root=p.openRoot(),evaluate=values.createStateValueEvaluator(f.seatId),r=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
 assert(r.complete);assert.equal(r.diagnostics.nativeExecutions,old.diagnostics.nativeExecutions);
 assert.deepEqual(JSON.parse(JSON.stringify(r.roots)),old.roots);assert.deepEqual(c.lifecycle.save().envelope,initial);
 fs.writeFileSync(out,JSON.stringify({rootUnchanged:true,fullRanksEqual:true,rows},null,2)+'\n',{flag:'wx'});
 console.log(rows.length);
}finally{p.close();c.dispose();delete globalThis.__v394Data;}
