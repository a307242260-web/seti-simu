'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),directory=path.join(repo,'reports/ai-foundation-20261119');
const m=JSON.parse(fs.readFileSync(path.join(directory,'blue-income-forecast-prototype-preflight-20261119-v1.json'))),runtime=m.runtime;
const {createSeededRandom}=require(path.join(runtime,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(runtime,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(runtime,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(runtime,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(runtime,'randomizer/game/ai/decision-search'));
const outcome=require(path.join(runtime,'randomizer/game/ai/outcome-model'));
const agent=require(path.join(runtime,'randomizer/game/ai/search-agent')),value=require(path.join(runtime,'randomizer/game/ai/state-value'));
const saved=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(directory,'r2-blue-cash-before104-native-20261119-v1.json.gz'))));
const suffix=process.argv[2]||'v1';assert(/^v\d+$/.test(suffix));
const output=path.join(directory,`blue-income-forecast-root104-benchmark-20261119-${suffix}.json`);assert(!fs.existsSync(output));
const seed='seti-free-analyze-v1',seatId='player-white',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const k=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)}),c=k.composition;
const report={sourceCommit:m.sourceCommit,candidateChangedFiles:m.candidateChangedFiles,rootInput:104,
 budget:{transitions:256,nodes:1024,frontier:256,milliseconds:600},nativeSearches:1,newAutonomousGames:0,productionChanged:false};
let port;
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(saved.envelope).ok);
 assert.deepEqual(c.lifecycle.save().envelope,saved.envelope);
 port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 const started=performance.now(),root=port.openRoot(),evaluate=value.createStateValueEvaluator(seatId);
 const official=outcome.createDecisionObservation(root.observation,{seatId,stateVersion:root.legalActions[0].stateVersion,decisionVersion:root.legalActions[0].decisionVersion});
 assert.deepEqual(official,saved.expectedTrace.observation);report.officialObservationExact=true;
 const result=searchDecision({port,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:report.budget,
  scanOrbitBudget:{nativeInputs:256,deadline:started+600}});
 report.rootAndSearchMilliseconds=performance.now()-started;
 report.search=result;report.analysis=port.getDiagnostics();
 report.complete=result.complete;report.action=root.legalActions.find(a=>a.actionId===result.actionId)||null;
 report.withinGate=result.complete&&report.rootAndSearchMilliseconds<=600&&report.analysis.submissionCount<=256;
}catch(error){report.error={name:error.name,message:error.message.slice(0,1000),stack:error.stack.split('\n').slice(-8).join('\n')};}
finally{if(port)port.close();report.sourceRootPreserved=JSON.stringify(c.lifecycle.save().envelope)===JSON.stringify(saved.envelope);c.dispose();}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({complete:report.complete,withinGate:report.withinGate,milliseconds:report.rootAndSearchMilliseconds,
 nativeSubmissions:report.analysis?.submissionCount,stopReason:report.search?.stopReason,value:report.search?.value,
 action:report.action,plan:report.search?.plan,rootPreserved:report.sourceRootPreserved,error:report.error}));
