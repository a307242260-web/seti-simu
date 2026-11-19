'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),D=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white',branch=process.argv[2];assert(['analysis-first','scan-first','analysis-then-landing'].includes(branch));
const read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),pre=read(path.join(D,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
for(const[p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const prep=read(path.join(D,'teacher-r4-order-preparation-20261119-v1.json'));assert.equal(prep.status,'complete');
const selected=branch==='analysis-then-landing'?read(path.join(D,'teacher-r4-two-action-order-control-20261119-v1.json')).branches[branch]:prep.branches[branch];
const source=selected.checkpoint,before=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,source)))).envelope;
const output=path.join(D,'teacher-r4-order-'+branch+'-cold-20261119-v1.json');assert(!fs.existsSync(output));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random')),{createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition')),{buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation')),{createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port')),{searchDecision}=require(path.join(rt,'randomizer/game/ai/decision-search')),value=require(path.join(rt,'randomizer/game/ai/state-value')),agent=require(path.join(rt,'randomizer/game/ai/search-agent'));
const seed='seti-free-analyze-v1',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const report={schemaVersion:'seti-teacher-r4-order-endpoint-cold-v1',branch,sourceCommit:pre.sourceCommit,source,sourceSha256:hash(fs.readFileSync(path.join(repo,source))),status:'running',newAISearches:0,newGames:0};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();let port;
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(before).ok);assert.deepEqual(c.lifecycle.save().envelope,before);
 port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const evaluate=value.createStateValueEvaluator(seat);report.newAISearches++;persist();
 const t=performance.now(),root=port.openRoot(),q=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}}),ms=performance.now()-t;
 assert.deepEqual(c.lifecycle.save().envelope,before);report.rootObservation=root.observation;report.search=q;
 report.cold={complete:q.complete,actionId:q.actionId,value:q.value,nativeInputs:q.diagnostics.nativeExecutions,milliseconds:ms,rootAndRngUnchanged:true,gatePassed:q.complete&&q.diagnostics.nativeExecutions<=256&&ms<=600};
 report.status=report.cold.gatePassed?'complete':'single-point-gate-failed';persist();console.log(JSON.stringify({status:report.status,branch,cold:report.cold}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack};persist();console.error(e.stack);process.exitCode=1}finally{port?.close();c.dispose()}
