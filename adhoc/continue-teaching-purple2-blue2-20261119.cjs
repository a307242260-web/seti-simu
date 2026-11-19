'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),pre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(ordered(x))).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const pair=read(path.join(dir,'teaching-purple2-signal-pair-20261119-v1.json'));assert.equal(pair.status,'complete');
const replay=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'teaching-purple2-signal-replay-20261119-v1.json.gz'))));
const save=read(path.join(repo,'seti-saves/seti-save-teacher-current-legal-reference-384-20261118-v1.json'));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const value=require(path.join(rt,'randomizer/game/ai/state-value'));
const random=createSeededRandom(replay.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:replay.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,replay.seed,v?.playerId)});
const output=path.join(dir,'teaching-purple2-blue2-continuation-20261119-v1.json');assert(!fs.existsSync(output));
const report={schemaVersion:'seti-teaching-purple2-blue2-continuation-v1',sourceCommit:pre.sourceCommit,seed:replay.seed,status:'running',priorLiteralInputs:35,nativeInputs:0,newAISearches:0,newFullGames:0,branches:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(b,desired){assert(desired?.actorId===seat);assert(report.priorLiteralInputs+report.nativeInputs<220);
 const action=legal().find(a=>a.actorId===seat&&a.family===desired.family&&hash(a.target||{})===hash(desired.target||{}));assert(action,'Known input unavailable: '+JSON.stringify(desired));
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
 assert(result.ok,JSON.stringify(result));report.nativeInputs++;b.actions.push(action);persist();
}
function snapshot(){const before=envelope(),p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const r=p.openRoot();const result={observation:r.observation,value:value.evaluateStateValue(r.observation,seat)};assert.deepEqual(envelope(),before);return result;}finally{p.close();}}
try{
 c.lifecycle.newGame({seed:replay.seed,activePlayerCount:4,initialize:true,rngState});
 for(const branch of replay.branches.slice(2)){
  assert(c.lifecycle.restore(branch.expectedEnvelope).ok);assert.deepEqual(envelope(),branch.expectedEnvelope);
  const b={name:branch.name,actions:[]};report.branches.push(b);persist();
  for(let step=147;step<=162;step++)submit(b,save.replaySteps[step-1].action);
  b.afterAnalysis=snapshot();const p=b.afterAnalysis.observation.publicState.players.find(p=>p.playerId===seat);
  assert.equal(p.availableData,b.name==='teacher-extra-signal'?2:1);
  assert.deepEqual(p.dataProgress.computerSlots,[]);assert.equal(p.dataProgress.blueBonusCount,0);
  submit(b,legal().find(a=>a.family==='place_data'));
  submit(b,legal().find(a=>a.family==='choose_target'&&a.target?.target==='computer'));
  if(b.name==='teacher-extra-signal'){
   submit(b,legal().find(a=>a.family==='place_data'));
   submit(b,legal().find(a=>a.family==='choose_target'&&a.target?.blueSlot===1));
  }
  submit(b,legal().find(a=>a.family==='end_turn'&&a.actorId===seat));
  b.endpoint=envelope();b.snapshot=snapshot();
  branch.actions.push(...b.actions);branch.expectedEnvelope=b.endpoint;persist();
 }
 assert.equal(report.nativeInputs,40);
 replay.nativeInputsAlreadyExecuted=75;
 const archive=path.join(dir,'teaching-purple2-blue2-replay-20261119-v1.json.gz');assert(!fs.existsSync(archive));fs.writeFileSync(archive,zlib.gzipSync(JSON.stringify(replay)));
 report.status='complete';report.totalLiteralInputs=75;persist();
 console.log(JSON.stringify({status:report.status,totalLiteralInputs:75,branches:report.branches.map(b=>({name:b.name,value:b.snapshot.value,player:b.snapshot.observation.publicState.players.find(p=>p.playerId===seat)}))}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}
