const fs = require('node:fs'), assert = require('node:assert/strict'), inspector = require('node:inspector');
const base = '/Users/bilibili/code/seti-simu';
const req = require('node:module').createRequire(process.cwd() + '/adhoc/trace24.js');
const unbounded=process.argv.includes('--unbounded');
const entryStates=process.argv.includes('--entry-states');
const dataPairStates=process.argv.includes('--data-pair-states');
assert.ok(!dataPairStates || (!unbounded && !entryStates));
const recordArg = process.argv.indexOf('--record');
const recordFile = recordArg >= 0 ? process.argv[recordArg + 1] : 'reports/research/7dfcf27e.aaaed8d0.full.json';
assert.ok(recordFile, '--record需要记录路径');
const record = JSON.parse(fs.readFileSync(base + '/' + recordFile));
const sourceCommit = record.gitCommit;
const compressed = process.argv.includes('--gzip');
const output = base + '/reports/iteration/'+(unbounded?'step24-unbounded-trace-20260908':dataPairStates?`step24-data-pair-search-${sourceCommit}-20260908`:entryStates?`step24-entry-states-${sourceCommit}-20260908`:`step24-goal-trace-${sourceCommit}-20260908`)+'.json'+(compressed?'.gz':'');
if (fs.existsSync(output)) { console.log('已有追踪，跳过：' + output); process.exit(0); }
const streamPath=output.replace(/\.json$/,'.jsonl');
const stream=unbounded?fs.openSync(streamPath,'wx'):null;
const started=performance.now();let rowCount=0;
const save = JSON.parse(fs.readFileSync(base + '/' + record.savePath));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const report = {source:sourceCommit,recordFile,unbounded,codeHead:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),step:24,rows:[],errors:[],streamPath:unbounded?streamPath:null,note:'只读断点追踪；耗时含日志开销，不作为性能成绩'};
const debug = new inspector.Session(); debug.connect();
const post = (method, params={}) => { let done=false,error,result; debug.post(method,params,(e,r)=>{done=true;error=e;result=r;}); assert.ok(done);if(error)throw error;return result; };
const env = req('../randomizer/app/simulation-env').createSimulationEnv();
debug.on('Debugger.paused', ({params}) => {
  try {
    const r=post('Debugger.evaluateOnCallFrame',{callFrameId:params.callFrames[0].callFrameId,expression:`JSON.stringify({ordinal:executedNodeCount,strategic:Boolean(secondaryAgentSearch),queue:frontier.length,key,node:{action:node.action,priority:node.priority,depth:node.depth,origins:node.origins.map(o=>({target:o.routeTargetId,plan:o.routePlanId,chain:o.chain,goalPaths:o.goalTracePaths,proxyDepth:o.proxyDepth}))},execution:{failed:execution.failed,priority:execution.branchPriority,inputs:execution.planSteps?.map(s=>s.action)}})`,returnByValue:true});
    assert.equal(r.exceptionDetails,undefined);const row=JSON.parse(r.result.value);rowCount++;
    if(dataPairStates){const pair=post('Debugger.evaluateOnCallFrame',{callFrameId:params.callFrames[0].callFrameId,expression:'JSON.stringify({state:getTrustedState(execution.childEnvelope),session:execution.childEnvelope.session,origins:node.origins.map(o=>({rootActionId:o.rootAction.actionId,rootTarget:o.rootRouteTargetId,rootPlan:o.rootRoutePlanId,target:o.routeTargetId,plan:o.routePlanId,proxyDepth:o.proxyDepth,informationMasked:o.informationMasked,chain:o.chain}))})',returnByValue:true});assert.equal(pair.exceptionDetails,undefined);row.pairState=JSON.parse(pair.result.value);}
    if(entryStates){const state=post('Debugger.evaluateOnCallFrame',{callFrameId:params.callFrames[0].callFrameId,expression:`JSON.stringify({player:(node.envelope.session?.session?.workingState || JSON.parse(node.envelope.committedState)).players.players.find(p=>p.id==='player-white'),entryOrigins:node.origins.map(o=>({target:o.routeTargetId,paths:o.goalTracePaths,chain:o.chain,entry:!(o.goalTraceActions||[]).length,informationMasked:o.informationMasked}))})`,returnByValue:true});assert.equal(state.exceptionDetails,undefined);row.entryState=JSON.parse(state.result.value);}
    if(unbounded)fs.writeSync(stream,r.result.value+'\n');else report.rows.push(row);
    if(rowCount%256===0)console.log('[第24步'+(unbounded?'去上限':'目标追踪')+'] 已执行 '+rowCount+' 节点 · 队列 '+row.queue+' · 用时 '+((performance.now()-started)/1000).toFixed(1)+'s · RSS '+Math.round(process.memoryUsage().rss/1048576)+'MB');
  }catch(e){report.errors.push(e.stack);}
  finally{post('Debugger.resume');}
});
try {
  env.reset({...config,traceCounterfactualGoalClusters:true});
  for(const expected of save.replaySteps.slice(0,23)){
    const action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
    assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
  }
  console.log('[第24步目标追踪] 前23步正式重放一致，开始'+(unbounded?'去上限':'4096上限')+'搜索');
  const lines=fs.readFileSync(req.resolve('../randomizer/game/rule-composition'),'utf8').split('\n');
  const hits=lines.flatMap((l,i)=>l.includes('const execution = executeNode(node);')?[i+1]:[]);assert.equal(hits.length,1);
  post('Debugger.enable');post('Debugger.setBreakpointByUrl',{urlRegex:'rule-composition\\.js$',lineNumber:hits[0],...(dataPairStates?{condition:'Boolean(secondaryAgentSearch) && (executedNodeCount === 12 || executedNodeCount === 18)'}:{})});
  const result=env.runHeuristicPolicyDecision();
  report.diagnostics=env.getCounterfactualDiagnostics();report.selected=result.policyDecision;
  assert.equal(result.ok,true);assert.deepEqual(report.errors,[]);
  const prior=record.metrics.searches.find(s=>s.step===24&&s.kind==='strategic');
  report.parity={};
  for(const k of ['executedNodeCount','successfulInputSubmissionCount','executedNodeCountByDecisionKind','failedNodeCountByCode']){
    report.parity[k]=JSON.stringify(report.diagnostics[k])===JSON.stringify(prior.diagnostics[k]);
  }
  report.actionMatches=report.selected.actionId===prior.action;
  report.passed=true;
  if(unbounded)report.outcomeCompleteness=result.actionOutcomes.map(o=>({action:o.actionId,status:o.status,completeness:o.searchCompleteness,reasons:o.reasonCodes}));
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{post('Debugger.disable');debug.disconnect();env.dispose();if(stream!==null)fs.closeSync(stream);report.wallMs=performance.now()-started;report.rowCount=rowCount;const bytes=JSON.stringify(report,null,2)+'\n';fs.writeFileSync(output,compressed?require('node:zlib').gzipSync(bytes):bytes,{flag:'wx'});console.log(JSON.stringify({output,rows:rowCount,passed:report.passed,error:report.error,parity:report.parity,actionMatches:report.actionMatches}));}
