'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const agent=require('../randomizer/game/ai/search-agent');
const prefix='reports/ai-foundation-20261023/round1-v54-compat-step317-20261029-v1',output=prefix+'.json';
if(fs.existsSync(output)){console.log(fs.readFileSync(output,'utf8'));process.exit(0);}
const f=JSON.parse(fs.readFileSync('adhoc/ai-decision-corpus-20261029-reorg-v1/step317-20261029-v1.json')),seed=f.source.seed;
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const comp=kernel.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
const before=comp.lifecycle.save().envelope,port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),at=performance.now();
try{
 const root=port.openRoot(),actions=new Map(),capture=n=>{for(const a of n.legalActions)actions.set(a.actionId,a);},observed={...port,identity(n){capture(n);return port.identity(n);}};
 for(const name of ['expandResourcePlan','expandWithCardPick','expandGoalMovementPlan','expandPostMainOptimalPlan'])observed[name]=(...args)=>{const r=port[name](...args);for(const p of r.prefixes||[])capture(p.node);capture(r.node);return r;};
 const evaluate=createStateValueEvaluator(f.seatId),result=searchDecision({port:observed,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:agent.BUDGET}),ms=performance.now()-at;result.diagnosticActions=Object.fromEntries(actions);
 assert(result.complete,result.stopReason);assert.deepEqual(result.unresolved,[]);assert.deepEqual(comp.lifecycle.save().envelope,before);
 const old=JSON.parse(zlib.gunzipSync(fs.readFileSync('reports/ai-foundation-20261023/v40-baseline-overruns-20261029-v1.step317.raw.json.gz')));
 const count=r=>Object.fromEntries(Object.entries(r.sharedPrefixGraph.edges.reduce((acc,e)=>{const family=e.actionId.split(':')[0];acc[family]=(acc[family]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]));
 const raw=prefix+'.raw.json.gz',rawBytes=zlib.gzipSync(JSON.stringify(result)+'\n');fs.writeFileSync(raw,rawBytes);
 const banned=new Set([...actions.values()].filter(a=>a.family==='industry'&&a.target?.abilityId==='helios_remove_tech_income').map(a=>a.actionId));assert(banned.size>0);assert(result.sharedPrefixGraph.edges.every(e=>!banned.has(e.actionId)));assert(result.lines.every(n=>n.edges.every(e=>e.resourcePlan?.goal?.abilityId!=='helios_remove_tech_income')));
 const record={schemaVersion:'seti-no-helios-benchmark-v1',scope:'one cold decision with Helios initiation disabled replayed at exact baseline step317 root; no full game or score claim',searchVersion:result.schemaVersion,budget:agent.BUDGET,complete:result.complete,rootAndSearchMilliseconds:ms,actionId:result.actionId,value:result.value,diagnostics:result.diagnostics,port:port.getDiagnostics(),nativeActionFamilies:count(result),rootAlternatives:result.candidates,disabledSkillNativeExecutions:0,before:{nativeInputs:old.diagnostics.nativeExecutions,rootAndSearchMilliseconds:JSON.parse(fs.readFileSync('reports/ai-foundation-20261023/v40-baseline-overruns-20261029-v1.json')).rows.find(r=>r.step===317).rootAndSearchMilliseconds,actionId:old.actionId,value:old.value,nativeActionFamilies:count(old)},sameAction:result.actionId===old.actionId,sameValue:result.value===old.value,rootAndRngUnchanged:true,rawPath:raw,rawSha256:crypto.createHash('sha256').update(rawBytes).digest('hex'),sourceHashes:Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))};
 fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({complete:record.complete,nativeInputs:record.diagnostics.nativeExecutions,states:record.diagnostics.nodes,ms,sameAction:record.sameAction,sameValue:record.sameValue,rootAlternatives:record.rootAlternatives.length,disabledSkillNativeExecutions:0,families:record.nativeActionFamilies},null,2));
}finally{port.close();comp.dispose();}
