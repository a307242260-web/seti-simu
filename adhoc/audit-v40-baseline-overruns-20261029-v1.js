'use strict';
// Reuse the completed baseline trajectory; only its six unverified overrun roots
// are searched once with v40. This does not run a new game or change any policy.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const agent=require('../randomizer/game/ai/search-agent');
const prefix='reports/ai-foundation-20261023/v40-baseline-overruns-20261029-v1',output=prefix+'.json';
if(fs.existsSync(output)&&JSON.parse(fs.readFileSync(output)).status==='complete'){console.log('Reuse completed overrun audit: '+output);process.exit(0);}
const tracePath='reports/research/a760f3dd.ff4b36c1.full.json.decisions.jsonl',bytes=fs.readFileSync(tracePath),traces=bytes.toString().trim().split('\n').map(JSON.parse);
const oldRows=traces.map((trace,i)=>({step:i+1,trace})).filter(({trace})=>trace.search.rootAndSearchMilliseconds>600||trace.search.diagnostics.nativeExecutions>256);
assert.deepEqual(oldRows.map(r=>r.step),[181,199,206,215,272,295,317]);
const previous=JSON.parse(fs.readFileSync('reports/ai-foundation-20261023/reorg-greedy-step295-20261029-v1.json'));
const report=fs.existsSync(output)?JSON.parse(fs.readFileSync(output)):{schemaVersion:'seti-v40-baseline-overrun-audit-v1',status:'running',thresholds:{rootAndSearchMilliseconds:600,nativeInputs:256,condition:'either strictly exceeded'},searchVersion:require('../randomizer/game/ai/decision-search').VERSION,budget:agent.BUDGET,sourceTrace:tracePath,sourceTraceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'All seven roots that exceeded either target in the completed v39 game. Exact old trajectory replay, cold ports, no plan token. Step295 v40 result reused, six newly searched. No new full game; timings are single sequential samples.',rows:[]};
const count=r=>Object.fromEntries(Object.entries(r.sharedPrefixGraph.edges.reduce((m,e)=>{const k=e.actionId.split(':')[0];m[k]=(m[k]||0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]));
function save(){fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
for(const {step,trace}of oldRows){
 if(report.rows.some(r=>r.step===step))continue;
 const state=trace.context.observation.publicState,old=trace.search;
 const row={step,round:state.roundNumber,turn:state.turnNumber,seatId:trace.context.seatId,before:{nativeInputs:old.diagnostics.nativeExecutions,rootAndSearchMilliseconds:old.rootAndSearchMilliseconds,actionId:old.actionId,value:old.value}};
 if(step===295){Object.assign(row,{reusedRecord:'reports/ai-foundation-20261023/reorg-greedy-step295-20261029-v1.json',complete:previous.complete,nativeInputs:previous.diagnostics.nativeExecutions,rootAndSearchMilliseconds:previous.rootAndSearchMilliseconds,nodes:previous.diagnostics.nodes,actionId:previous.actionId,value:previous.value,nativeActionFamilies:previous.nativeActionFamilies,rootAndRngUnchanged:previous.rootAndRngUnchanged,rawPath:previous.rawPath,rawSha256:previous.rawSha256});}
 else{
  const checkpointStep=Math.floor((step-1)/20)*20,checkpointPath=`reports/ai-foundation-20261023/search-unbounded-baseline-20261029-v1.checkpoint-step-${checkpointStep}.json`,env=createSimulationEnv();let envelope;
  try{env.loadCheckpoint(JSON.parse(fs.readFileSync(checkpointPath)));for(let i=checkpointStep;i<step-1;i++){const action=env.legalActions().find(a=>a.actionId===traces[i].actionId);assert(action,`native replay ${i+1}`);assert.equal(env.step(action).ok,true);}envelope=env.createCheckpoint().coreState.compositionEnvelope;}finally{env.dispose();}
  const fixture=`adhoc/ai-decision-corpus-20261029-reorg-v1/step${step}-20261029-v1.json`;assert(!fs.existsSync(fixture));fs.writeFileSync(fixture,JSON.stringify({compositionEnvelope:envelope,seatId:row.seatId,source:{seed:JSON.parse(envelope.committedState).meta.seed,tracePath,checkpointPath,step,originalActionId:trace.actionId},classification:{round:row.round,turn:row.turn,seatId:row.seatId}},null,2)+'\n');
  const seed=JSON.parse(envelope.committedState).meta.seed,kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const comp=kernel.composition;assert(comp.lifecycle.restore(envelope).ok);const before=comp.lifecycle.save().envelope,port=createAnalysisPort({composition:comp,seatId:row.seatId,maxCacheEntries:0});
  try{
   const at=performance.now(),root=port.openRoot(),key=a=>Object.fromEntries(['actionId','actorId','stateVersion','decisionVersion','family','phase','target','payload'].map(k=>[k,a[k]]));assert.deepEqual(root.legalActions.map(key),trace.context.legalActions.map(key));
   const evaluate=createStateValueEvaluator(row.seatId),result=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:agent.BUDGET}),ms=performance.now()-at;
   assert(result.complete,result.stopReason);assert.deepEqual(result.unresolved,[]);assert.deepEqual(comp.lifecycle.save().envelope,before);
   const rawPath=prefix+`.step${step}.raw.json.gz`,raw=zlib.gzipSync(JSON.stringify(result)+'\n');fs.writeFileSync(rawPath,raw);
   Object.assign(row,{fixture,fixtureSha256:crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),complete:result.complete,nativeInputs:result.diagnostics.nativeExecutions,rootAndSearchMilliseconds:ms,nodes:result.diagnostics.nodes,actionId:result.actionId,value:result.value,nativeActionFamilies:count(result),diagnostics:result.diagnostics,port:port.getDiagnostics(),rootAndRngUnchanged:true,rawPath,rawSha256:crypto.createHash('sha256').update(raw).digest('hex')});
  }finally{port.close();comp.dispose();}
 }
 row.overTime=row.rootAndSearchMilliseconds>600;row.overInputs=row.nativeInputs>256;row.sameAction=row.actionId===row.before.actionId;row.sameValue=row.value===row.before.value;report.rows.push(row);save();console.log(JSON.stringify({step,round:row.round,turn:row.turn,seat:row.seatId,inputs:row.nativeInputs,ms:row.rootAndSearchMilliseconds,overTime:row.overTime,overInputs:row.overInputs,sameAction:row.sameAction,sameValue:row.sameValue,families:row.nativeActionFamilies}));
}
report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));report.status='complete';save();
