'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {checkpointFromSave}=require('../tools/run_research_validation');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const {replaySaveEnriched}=require('../tools/robot-iteration-lib');
const prefix='reports/ai-foundation-20261023/search-unbounded-baseline-20261029-v1',recordPath='reports/research/a760f3dd.ff4b36c1.full.json';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const record=read(recordPath),save=read(record.savePath),state=JSON.parse(save.committedState),beforeHash=sha(record.savePath),summary=read(prefix+'.summary.json');
assert.equal(record.terminal,true);assert.equal(state.turn.gameEnded,true);assert.equal(state.match.finalScoringSettled,true);
assert.equal(record.steps,350);assert.equal(save.replaySteps.length,350);assert.equal(record.wallMs,30412);assert.equal(record.stepsLimit,null);
assert.deepEqual(Object.fromEntries(state.match.finalScores.map(x=>[x.playerId,x.totalScore])),record.summary.scores);
const traces=fs.readFileSync(record.agentTracePath,'utf8').trim().split('\n').map(JSON.parse);
assert.equal(traces.length,350);assert.equal(record.metrics.searches.length,350);assert.equal(record.metrics.budgetHits.length,0);
for(const [i,t]of traces.entries()){
 assert.equal(t.search.complete,true,`step ${i+1}`);assert.deepEqual(t.search.unresolved,[]);assert.equal(t.search.stopReason,null);assert.equal(t.search.actionId,t.actionId);
 assert.deepEqual(t.search.diagnostics.limits,{transitions:null,nodes:null,frontier:null,milliseconds:null});
}
const env=createSimulationEnv();
try{
 env.loadCheckpoint(checkpointFromSave(save,{seed:save.seed,activePlayerCount:4}));
 const restored=env.saveBrowserSave();assert.deepEqual(JSON.parse(restored.committedState),state);assert.deepEqual(restored.session,save.session);assert.deepEqual(restored.replaySteps,save.replaySteps);
 assert.deepEqual(env.legalActions(),[]);
}finally{env.dispose();}
const enrich=replaySaveEnriched(record.savePath);assert.equal(enrich.size,350);
for(const step of save.replaySteps){const row=enrich.get(step.stepIndex);assert(Number.isInteger(row.before.r));assert(Number.isInteger(row.before.t));}
const last=enrich.get(save.replaySteps.at(-1).stepIndex).after;
for(const player of state.players.players)assert.deepEqual(last.p[player.id],[player.resources.score,player.resources.credits,player.resources.energy,player.resources.publicity,player.hand.length,player.reservedCards.length]);
const reg=read('reports/iteration/registry.json'),v=reg.versions.find(x=>x.id===summary.experiment),result=v.results.find(x=>x.recordPath===recordPath);
assert.equal(reg.currentBaseline,v.id);assert.equal(v.isHead,true);assert.equal(read('reports/iteration/versions.json').versions.find(x=>x.id===v.id).baselineEligible,true);assert.equal(result.scoreSource,'save-final');assert.deepEqual(result.scores,record.summary.scores);
const html=fs.readFileSync(result.reportPath,'utf8');assert(html.includes('终局分数（完整终局口径，存档 finalScores）'));assert(!html.includes('R?·T?'));
for(const label of ['蓝','绿','棕','白'])assert(!html.includes(`${label}色玩家 · 1 个回合`));
assert.equal(sha(record.savePath),beforeHash);
const runtime=read(prefix+'.manifest.json');for(const [p,h]of Object.entries(runtime.sourceHashes))assert.equal(sha(p),h,p);
const log=fs.readFileSync(prefix+'.run.log','utf8');assert.equal((log.match(/\[world\]/g)||[]).length,1);
const verification={schemaVersion:'seti-unbounded-baseline-verification-v1',experiment:v.id,runtimeCommit:runtime.codeCommit,terminal:true,finalScoringSettled:true,steps:350,replayRows:enrich.size,finalScores:record.summary.scores,wallMs:record.wallMs,allDecisionsComplete:true,allLimitsNull:true,budgetHits:0,searchDecisions:summary.actualSearchDecisions,reusedPlanInputs:summary.reusedPlanInputs,nativeSearchInputs:summary.nativeSearchInputs,maxNativeSearchInputs:Math.max(...traces.map(t=>t.search.diagnostics.nativeExecutions||0)),maxRootAndSearchMs:summary.maxRootAndSearchMs,checkpointRestore:'native state, RNG, session and replay steps identical; terminal legal actions empty',replay:'350 confirmed actions replayed without AI search; final resources match native save',saveUnchanged:true,standardFullWorldRuns:1,baselineRegistered:true,scope:'One fixed-world four-seat self-play game; completeness is within the agreed policies and turn/information boundaries.',hashes:Object.fromEntries([recordPath,record.agentTracePath,record.savePath,result.reportPath,prefix+'.summary.json'].map(p=>[p,sha(p)]))};
fs.writeFileSync(prefix+'.verification.json',JSON.stringify(verification,null,2)+'\n');console.log(JSON.stringify(verification,null,2));
