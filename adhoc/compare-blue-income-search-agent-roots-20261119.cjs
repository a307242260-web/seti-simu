'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),directory=path.join(repo,'reports/ai-foundation-20261119');
const candidate=JSON.parse(fs.readFileSync(path.join(directory,'blue-income-forecast-prototype-preflight-20261119-v2.json')));
const baseline=JSON.parse(fs.readFileSync(path.join(directory,'blue-income-admission-baseline-comparison-20261119-v1.json')));
const lastOnly=process.argv[2]==='--last-only';
const output=path.join(directory,`blue-income-admission-agent-root-comparison-20261119-${lastOnly?'v2':'v1'}.json`);assert(!fs.existsSync(output));
const cases=lastOnly?[['0b908c22',2,'scan']]:[['e15da1c1',1,'pass'],['0aef5774',1,'pass'],['0aef5774',2,'scan'],['0b908c22',2,'scan']];
const report={sourceCommit:candidate.sourceCommit,candidateChangedFiles:candidate.candidateChangedFiles,
 scope:'Fresh current agent on each exact historical guard checkpoint; one real submitted action per source, no autonomous game or manual continuation.',
 cases:[],newAutonomousGames:0};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const [record,round,expectedFamily]of cases){
 const file=`reports/research/${record}.532563ef.full.json.round-end-${round}.checkpoint.json`;
 if(!fs.existsSync(path.join(candidate.runtime,file))){report.cases.push({file,missing:true});continue;}
 const checkpoint=JSON.parse(fs.readFileSync(path.join(candidate.runtime,file))),pair={file,expectedFamily,sources:[]};
 for(const [label,runtime]of [['baseline',baseline.baselineRuntime],['candidate',candidate.runtime]]){
  const factory=require(path.join(runtime,'tools/research-free-analyze-random20'));
  const env=factory.createEnvironment({},{id:'free-analyze-random20-guarded-v1'});
  const row={label};
  try{
   env.loadCheckpoint(checkpoint);
   const before=env.saveBrowserSave(),state=JSON.parse(before.committedState);
   row.nativeRootSha256=sha(before.committedState);row.round=state.turn.roundNumber;row.currentPlayer=state.turn.currentPlayerId;
   row.sourceVersion=require(path.join(runtime,'randomizer/game/ai/search-agent')).VERSION;
   const started=performance.now(),decision=env.runAgentDecision(),search=decision.searches[0];
   row.wallMilliseconds=performance.now()-started;
   row.actionId=decision.agentTrace.actionId;row.expectedFamilyMatched=row.actionId.startsWith(expectedFamily+':');
   row.search={complete:search.complete,value:search.value,stopReason:search.stopReason,nativeExecutions:search.diagnostics.nativeExecutions,
    rootAndSearchMilliseconds:search.rootAndSearchMilliseconds,searchMilliseconds:search.diagnostics.milliseconds,
    roots:search.roots.map(x=>({actionId:x.actionId,goal:x.goal,value:x.value,completion:x.completion})),
    scanBeforePass:search.scanBeforePass,scope:search.scope};
   row.gate=search.complete&&search.diagnostics.nativeExecutions<=256&&(search.rootAndSearchMilliseconds??search.diagnostics.milliseconds)<=600;
   row.afterNativeSha256=sha(env.saveBrowserSave().committedState);
  }catch(error){row.error={message:error.message.slice(0,1000),search:error.search&&{complete:error.search.complete,stopReason:error.search.stopReason,
    rootAndSearchMilliseconds:error.search.rootAndSearchMilliseconds,diagnostics:error.search.diagnostics}};}
  finally{env.dispose();}
  pair.sources.push(row);
 }
 pair.sameNativeRoot=pair.sources[0].nativeRootSha256===pair.sources[1].nativeRootSha256;
 assert(pair.sameNativeRoot);
 pair.sameAction=pair.sources[0].actionId===pair.sources[1].actionId;
 report.cases.push(pair);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({file,expectedFamily,sameRoot:true,sameAction:pair.sameAction,
  sources:pair.sources.map(s=>({label:s.label,actionId:s.actionId,expected:s.expectedFamilyMatched,gate:s.gate,
   value:s.search?.value,nativeInputs:s.search?.nativeExecutions,milliseconds:s.search?.rootAndSearchMilliseconds,error:s.error}))}));
}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
