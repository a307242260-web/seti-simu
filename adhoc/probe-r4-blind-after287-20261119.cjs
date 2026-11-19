'use strict';
// One fresh-process search at the independently verified teacher R4 root.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const pre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const proof=read(path.join(dir,'teacher-r4-free-pick-preparation-20261119-v1.json'));
assert.equal(proof.status,'verified');assert(proof.exactActualInput287Observation);
const source=path.join(repo,proof.afterPath),before=JSON.parse(zlib.gunzipSync(fs.readFileSync(source))).envelope;
const output=path.join(dir,'teacher-r4-blind-after287-cold-20261119-v1.json');assert(!fs.existsSync(output));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(rt,'randomizer/game/ai/decision-search'));
const value=require(path.join(rt,'randomizer/game/ai/state-value')),agent=require(path.join(rt,'randomizer/game/ai/search-agent'));
const random=createSeededRandom('seti-free-analyze-v1'),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:'seti-free-analyze-v1',activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,'seti-free-analyze-v1',v?.playerId)});
const report={schemaVersion:'seti-teacher-r4-exact-start-cold-search-v1',sourceCommit:pre.sourceCommit,seed:'seti-free-analyze-v1',status:'running',
 sourceRootArchive:proof.afterPath,sourceRootArchiveSha256:hash(fs.readFileSync(source)),sourceFilesVerified:Object.keys(pre.sourceFiles).length,
 controlledPrefixInputs:287,newAISearches:0,newAutonomousGames:0};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
let port;
try{
 c.lifecycle.newGame({seed:'seti-free-analyze-v1',activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(before).ok);assert.deepEqual(c.lifecycle.save().envelope,before);
 const state=JSON.parse(before.committedState);assert.equal(state.turn.roundNumber,4);assert.equal(state.turn.currentPlayerId,seat);assert.deepEqual([...state.turn.passedPlayerIds].sort(),['player-blue','player-brown','player-green']);
 port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 const evaluate=value.createStateValueEvaluator(seat);report.newAISearches++;persist();
 const started=performance.now(),root=port.openRoot();
 const result=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});
 const milliseconds=performance.now()-started;
 assert.deepEqual(c.lifecycle.save().envelope,before);
 report.search=result;report.cold={complete:result.complete,actionId:result.actionId,value:result.value,nativeInputs:result.diagnostics.nativeExecutions,milliseconds,rootAndRngUnchanged:true};
 report.cold.gatePassed=result.complete&&report.cold.nativeInputs<=256&&milliseconds<=600;
 report.status=report.cold.gatePassed?'complete':'single-point-gate-failed';persist();
 console.log(JSON.stringify({status:report.status,cold:report.cold}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{port?.close();c.dispose();}
