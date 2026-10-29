'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const agent=require('../randomizer/game/ai/search-agent');
const prefix='reports/ai-foundation-20261023/reorg-greedy-step295-20261029-v1',output=prefix+'.json';
if(fs.existsSync(output)){console.log(fs.readFileSync(output,'utf8'));process.exit(0);}
const f=JSON.parse(fs.readFileSync('adhoc/ai-decision-corpus-20261029-reorg-v1/step295-20261029-v1.json')),seed=f.source.seed;
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const comp=kernel.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
const before=comp.lifecycle.save().envelope,port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),at=performance.now();
try{
 const root=port.openRoot(),evaluate=createStateValueEvaluator(f.seatId),result=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:agent.BUDGET}),ms=performance.now()-at;
 assert(result.complete,result.stopReason);assert.deepEqual(result.unresolved,[]);assert.deepEqual(comp.lifecycle.save().envelope,before);
 const old=JSON.parse(zlib.gunzipSync(fs.readFileSync('reports/ai-foundation-20261023/search-step295-analysis-20261029-v1.trace.json.gz'))).search;
 const count=r=>Object.fromEntries(Object.entries(r.sharedPrefixGraph.edges.reduce((acc,e)=>{const family=e.actionId.split(':')[0];acc[family]=(acc[family]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]));
 const raw=prefix+'.raw.json.gz',rawBytes=zlib.gzipSync(JSON.stringify(result)+'\n');fs.writeFileSync(raw,rawBytes);
 const reorg=result.lines.flatMap(n=>n.edges.filter(e=>e.resourcePlan?.goal?.cardId==='card-57-0'));
 assert(reorg.length>0);assert(reorg.every(e=>!e.fallbackReason));
 const record={schemaVersion:'seti-reorg-greedy-benchmark-v1',scope:'one cold decision replayed at exact baseline step295 root; no full game or score claim',searchVersion:result.schemaVersion,budget:agent.BUDGET,complete:result.complete,rootAndSearchMilliseconds:ms,actionId:result.actionId,value:result.value,diagnostics:result.diagnostics,port:port.getDiagnostics(),nativeActionFamilies:count(result),reorganizationPlans:reorg.map(e=>({cost:e.cost,steps:e.steps,fallbackReason:e.fallbackReason||null})),before:{nativeInputs:old.diagnostics.nativeExecutions,rootAndSearchMilliseconds:old.rootAndSearchMilliseconds,actionId:old.actionId,value:old.value,nativeActionFamilies:count(old)},sameAction:result.actionId===old.actionId,sameValue:result.value===old.value,rootAndRngUnchanged:true,rawPath:raw,rawSha256:crypto.createHash('sha256').update(rawBytes).digest('hex'),sourceHashes:Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))};
 fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({complete:record.complete,nativeInputs:record.diagnostics.nativeExecutions,states:record.diagnostics.nodes,ms,sameAction:record.sameAction,sameValue:record.sameValue,reorgPlans:record.reorganizationPlans,families:record.nativeActionFamilies},null,2));
}finally{port.close();comp.dispose();}
