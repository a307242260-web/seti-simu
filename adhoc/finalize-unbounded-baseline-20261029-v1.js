'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),prefix='reports/ai-foundation-20261023/search-unbounded-baseline-20261029-v1';
const manifest=JSON.parse(fs.readFileSync(path.join(root,prefix+'.manifest.json'),'utf8'));
const identity=manifest.identity,recordFile=`${manifest.fingerprint.slice(0,8)}.${identity.gitCommit.slice(0,8)}.full.json`,recordPath='reports/research/'+recordFile;
// Existing standard records are reused; aggregation never overwrites them or reruns a game.
if(fs.existsSync(path.join(root,prefix+'.failure.json'))&&!fs.existsSync(path.join(root,recordPath))){
 const failure=JSON.parse(fs.readFileSync(path.join(root,prefix+'.failure.json'),'utf8'));
 const tracePath=recordPath+'.decisions.jsonl',traces=fs.existsSync(path.join(root,tracePath))?fs.readFileSync(path.join(root,tracePath),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 const checkpoint=JSON.parse(fs.readFileSync(path.join(root,failure.checkpointPath),'utf8'));
 const current=checkpoint.coreState.compositionEnvelope.session?.session?.workingState||JSON.parse(checkpoint.coreState.committedState);
 const metrics={famsBySeat:{},whiteQuickTrade:0,whiteResearchSteps:[],traceEvents:[],revealEvents:[],budgetHits:[],searches:[]};
 for(const [i,trace] of traces.entries()){
  const seat=trace.context.seatId,family=trace.actionId.split(':')[0];metrics.famsBySeat[seat]??={};metrics.famsBySeat[seat][family]=(metrics.famsBySeat[seat][family]||0)+1;
  if(seat==='player-white'&&family==='quick_trade')metrics.whiteQuickTrade++;
  if(seat==='player-white'&&family==='research_tech')metrics.whiteResearchSteps.push(i+1);
  if(trace.search)metrics.searches.push({step:i+1,searchIndex:0,seat,action:trace.actionId,...trace.search});
 }
 const failedSearch=failure.lastTrace?.search||failure.error.cause?.search;
 if(failedSearch)metrics.searches.push({step:traces.length+1,searchIndex:0,seat:failure.lastTrace?.context?.seatId||'?',action:null,...failedSearch});
 const record={schemaVersion:'seti-research-validation-record-v1',name:manifest.experiment,fingerprint:manifest.fingerprint,mode:'full',seed:identity.seed,
  activePlayerCount:identity.activePlayerCount,world:identity.world,aiDifficulty:identity.aiDifficulty,policyVersion:identity.policyVersion,agentType:identity.agentType,
  agentTracePath:tracePath,searchCoverage:'incomplete',flags:identity.flags,createdAt:new Date().toISOString(),gitCommit:identity.gitCommit,
  steps:failure.steps,stepsLimit:null,terminal:false,status:'failed',wallMs:failure.wallMs,resumedFrom:null,resumeStep:0,savePath:failure.savePath,
  summary:{round:current.turn.roundNumber,terminal:false,scores:{},avgScore:null},metrics,
  failure:{code:failure.error.cause?.code||failure.error.code||'FAILED',message:failure.error.message,evidencePath:prefix+'.failure.json',failedDecisionCommitted:false},
  note:'单局baseline资格尝试中途失败，不是完整终局成绩。wallMs截至失败，不是完整局时长；所有阶段分数均不作baseline。'};
 fs.writeFileSync(path.join(root,recordPath),JSON.stringify(record,null,2)+'\n');
}
const record=JSON.parse(fs.readFileSync(path.join(root,recordPath),'utf8'));
const telemetry=fs.readFileSync(path.join(root,prefix+'.telemetry.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const sum=(rows,fn)=>rows.reduce((n,row)=>n+(fn(row)||0),0),milliseconds={};
for(const key of ['restore','execute','observation','checkpoint','resourceOrder','valueBound','postMainPlan','preMainDataPlan'])milliseconds[key]=sum(telemetry,r=>r.analysis?.milliseconds?.[key]);
const failedEvidence=fs.existsSync(path.join(root,prefix+'.failure.json'))?JSON.parse(fs.readFileSync(path.join(root,prefix+'.failure.json'),'utf8')):null;
const maxCompletedRootAndSearchMs=Math.max(0,...telemetry.map(r=>r.rootAndSearchMs||0)),maxCompletedDecisionMs=Math.max(0,...telemetry.map(r=>r.decisionMs||0));
const maxRootAndSearchMs=Math.max(maxCompletedRootAndSearchMs,failedEvidence?.lastTrace?.search?.rootAndSearchMilliseconds||0),maxDecisionMs=Math.max(maxCompletedDecisionMs,failedEvidence?.failedDecisionMs||0);
const result={schemaVersion:'seti-ai-baseline-summary-v1',...manifest,recordPath,terminal:record.terminal,eligibleAsCompleteBaseline:record.terminal===true,maxRootAndSearchMs,maxDecisionMs,maxCompletedRootAndSearchMs,maxCompletedDecisionMs,allSearchDecisionsWithin2s:maxRootAndSearchMs<=2000,
 accepted180Seconds:record.terminal===true&&record.wallMs<=180000,acceptedBaseline:record.terminal===true&&record.wallMs<=180000,wallMs:record.wallMs,steps:record.steps,
 formalFinalScores:record.terminal===true?record.summary.scores:null,
 failure:record.failure||null,decisions:telemetry.length,
 reusedPlanInputs:telemetry.filter(r=>r.diagnostics?.planContinuation==='hit').length,
 actualSearchDecisions:telemetry.filter(r=>(r.diagnostics?.transitions||0)>0).length,
 nativeSearchInputs:sum(telemetry,r=>r.diagnostics?.nativeExecutions),
 decisionMs:sum(telemetry,r=>r.decisionMs),rootAndSearchMs:sum(telemetry,r=>r.rootAndSearchMs),analysisMilliseconds:milliseconds,
 peakObservedHeapBytes:Math.max(0,...telemetry.map(r=>r.memory?.heapUsed||0)),peakObservedRssBytes:Math.max(0,...telemetry.map(r=>r.memory?.rss||0)),
 warning:'One fixed-world four-seat self-play game is an operational baseline candidate, not evidence of relative playing strength. Incomplete attempts provide no formal final score.'};
fs.writeFileSync(path.join(root,prefix+'.summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
