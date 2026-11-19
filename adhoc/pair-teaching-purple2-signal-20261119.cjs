'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),pre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
const probe=read(path.join(dir,'teaching-tech-root127-probe-20261119-v1.json'));assert.equal(probe.status,'complete');
const order=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(order):Object.fromEntries(Object.keys(x).sort().map(k=>[k,order(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(order(x))).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const source=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,probe.sourceRootArchive))));
const save=read(path.join(repo,'seti-saves/seti-save-teacher-current-legal-reference-384-20261118-v1.json'));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const value=require(path.join(rt,'randomizer/game/ai/state-value'));
const random=createSeededRandom(probe.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:probe.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,probe.seed,v?.playerId)});
const output=path.join(dir,'teaching-purple2-signal-pair-20261119-v1.json');assert(!fs.existsSync(output));
const report={schemaVersion:'seti-teaching-purple2-signal-pair-v1',sourceCommit:pre.sourceCommit,seed:probe.seed,status:'running',priorLiteralInputs:probe.nativeInputs,nativeInputs:0,newAISearches:0,newFullGames:0,bridge:[],branches:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(actions,desired){
 assert(desired.actorId===seat);assert(report.priorLiteralInputs+report.nativeInputs<220);
 const action=legal().find(a=>a.actorId===seat&&a.family===desired.family&&hash(a.target||{})===hash(desired.target||{}));assert(action,'Known teacher input unavailable: '+JSON.stringify(desired));
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
 assert(result.ok,JSON.stringify(result));report.nativeInputs++;actions.push(action);persist();
}
function snapshot(){const before=envelope(),p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=p.openRoot();const o=root.observation;const result={observation:o,value:value.evaluateStateValue(o,seat),legal:root.legalActions};assert.deepEqual(envelope(),before);return result;}finally{p.close();}}
try{
 c.lifecycle.newGame({seed:probe.seed,activePlayerCount:4,initialize:true,rngState});
 const root127=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,probe.rootPath)))).envelope;
 assert(c.lifecycle.restore(root127).ok);assert.deepEqual(envelope(),root127);
 for(let step=127;step<=145;step++)submit(report.bridge,save.replaySteps[step-1].action);
 const root146=envelope();report.root=snapshot();
 const choices=legal();assert(choices.some(a=>a.target?.nebulaId==='sector-2-a'));
 const skip=choices.find(a=>a.target?.skip===true||a.target?.choiceId==='skip'||a.target?.choiceId?.endsWith(':skip'));
 assert(skip,'Native purple2 skip choice missing: '+JSON.stringify(choices));
 for(const name of ['teacher-extra-signal','skip-extra-signal']){
  assert(c.lifecycle.restore(root146).ok);assert.deepEqual(envelope(),root146);
  const b={name,actions:[]};report.branches.push(b);persist();
  submit(b.actions,name==='teacher-extra-signal'?save.replaySteps[145].action:skip);
  b.endpoint=envelope();b.snapshot=snapshot();persist();
 }
 const replay={schemaVersion:'seti-native-paired-income-control-v1',sourceCommit:pre.sourceCommit,seed:probe.seed,
  sourceRuntimePreflight:'reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json',nativeInputsAlreadyExecuted:probe.nativeInputs+report.nativeInputs,frozenOpponentPolicy:'pass-only',
  branches:[{name:'teacher-prefix-113-to-126',rootEnvelope:source.root,actions:probe.prefix,expectedEnvelope:root127},
   {name:'teacher-known-bridge-127-to-145',rootEnvelope:root127,actions:report.bridge,expectedEnvelope:root146},
   ...report.branches.map(b=>({name:b.name,rootEnvelope:root146,actions:b.actions,expectedEnvelope:b.endpoint}))]};
 assert.equal(replay.nativeInputsAlreadyExecuted,35);
 const archive=path.join(dir,'teaching-purple2-signal-replay-20261119-v1.json.gz');assert(!fs.existsSync(archive));fs.writeFileSync(archive,zlib.gzipSync(JSON.stringify(replay)));
 report.status='complete';report.totalLiteralInputs=35;persist();
 console.log(JSON.stringify({status:report.status,totalLiteralInputs:35,rootValue:report.root.value,branches:report.branches.map(b=>({name:b.name,value:b.snapshot.value,player:b.snapshot.observation.publicState.players.find(p=>p.playerId===seat)}))}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}
