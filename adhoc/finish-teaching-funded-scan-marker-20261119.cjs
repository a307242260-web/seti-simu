'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p))),pre=read('v486-random20-runtime-preflight-20261119-v1.json'),rt=pre.runtime;
const input=read('teaching-funded-scan-pair-20261119-v2.json');assert.equal(input.status,'complete');assert.equal(input.nativeBeforeNewVerification,165);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(rt,'randomizer/game/ai/decision-search'));
const value=require(path.join(rt,'randomizer/game/ai/state-value')),agent=require(path.join(rt,'randomizer/game/ai/search-agent'));
const random=createSeededRandom(input.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:input.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,input.seed,v?.playerId)});
const output=path.join(dir,'teaching-funded-scan-pair-20261119-v3.json');assert(!fs.existsSync(output));
const report={...input,status:'running',markerNativeInputs:0,newAISearches:0};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;
try{
 c.lifecycle.newGame({seed:input.seed,activePlayerCount:4,initialize:true,rngState});
 const b=report.branches[0];assert(c.lifecycle.restore(b.endpoint).ok);assert.deepEqual(envelope(),b.endpoint);
 const before=envelope(),port=createAnalysisPort({composition:c,seatId:'player-white',maxCacheEntries:0});
 try{
  const started=performance.now(),root=port.openRoot(),evaluate=value.createStateValueEvaluator('player-white');report.newAISearches=1;persist();
  const result=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});
  report.markerSearch=result;report.markerCold={complete:result.complete,nativeInputs:result.diagnostics.nativeExecutions,milliseconds:performance.now()-started,actionId:result.actionId};
  assert.deepEqual(envelope(),before);report.markerCold.rootAndRngUnchanged=true;
  report.markerCold.gatePassed=result.complete&&report.markerCold.nativeInputs<=256&&report.markerCold.milliseconds<=600;assert(report.markerCold.gatePassed);
  const x=c.inspect(),d=x.session.decision;const action=d.choices.find(a=>a.actionId===result.actionId);assert(action?.actorId==='player-white');
  const r=c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action});assert(r.ok,JSON.stringify(r));
  report.markerNativeInputs=1;b.actions.push(action);b.endpoint=envelope();
  const nextPort=createAnalysisPort({composition:c,seatId:'player-white',maxCacheEntries:0});
  try{const n=nextPort.openRoot();b.after={observation:n.observation,value:value.evaluateStateValue(n.observation,'player-white')};b.nextLegal=n.legalActions;}finally{nextPort.close();}
  for(const branch of report.branches){const p=branch.after.observation.publicState.players.find(p=>p.playerId==='player-white');assert.equal(p.mainActionCompleted,false);}
  report.nativeInputs=15;report.nativeBeforeNewVerification=166;report.status='complete';persist();
 }finally{port.close();}
 const previous=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'teaching-funded-scan-replay-20261119-v1.json.gz'))));
 previous.nativeInputsAlreadyExecuted=166;
 previous.branches=report.branches.map((b,i)=>({...previous.branches[i],actions:b.actions,expectedEnvelope:b.endpoint}));
 const file=path.join(dir,'teaching-funded-scan-replay-20261119-v2.json.gz');assert(!fs.existsSync(file));fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(previous)));
 console.log(JSON.stringify({status:report.status,markerCold:report.markerCold,nativeBeforeNewVerification:166,branches:report.branches.map(b=>({name:b.name,player:b.after.observation.publicState.players.find(p=>p.playerId==='player-white'),value:b.after.value.total}))}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}
