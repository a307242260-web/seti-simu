'use strict';
// One declared scan purpose from each already verified comparison endpoint.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),pre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
const old=read(path.join(dir,'teaching-purple2-blue2-continuation-20261119-v1.json'));
const oldProof=read(path.join(dir,'teaching-purple2-blue2-replay-verification-20261119-v1.json'));
assert(oldProof.verified&&oldProof.totalNativeIncludingControls===150);
const failed=read(path.join(dir,'teaching-funded-scan-pair-20261119-v1.json'));
assert(failed.status==='failed'&&failed.nativeInputs===1);
const sort=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(sort):Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(sort(x))).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const value=require(path.join(rt,'randomizer/game/ai/state-value'));
const random=createSeededRandom(old.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:old.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,old.seed,v?.playerId)});
const output=path.join(dir,'teaching-funded-scan-pair-20261119-v2.json');assert(!fs.existsSync(output));
const report={schemaVersion:'seti-teaching-funded-scan-pair-v1',sourceCommit:pre.sourceCommit,seed:old.seed,status:'running',priorNativeIncludingVerification:151,priorFailedNativeInputs:1,nativeInputs:0,newAISearches:0,newFullGames:0,branches:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(b,action){assert(action?.actorId===seat,'Known funded scan action missing');assert(report.nativeInputs<24,'Reserved independent-replay input limit');
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
 assert(result.ok,JSON.stringify(result));report.nativeInputs++;b.actions.push(action);b.lastEnvelope=envelope();b.nextLegal=legal();persist();
}
function snapshot(){const before=envelope(),p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const r=p.openRoot();const result={observation:r.observation,value:value.evaluateStateValue(r.observation,seat)};assert.deepEqual(envelope(),before);return result;}finally{p.close();}}
try{
 c.lifecycle.newGame({seed:old.seed,activePlayerCount:4,initialize:true,rngState});
 for(const previous of old.branches){
  assert(c.lifecycle.restore(previous.endpoint).ok);assert.deepEqual(envelope(),previous.endpoint);
  const b={name:previous.name,actions:[],before:previous.snapshot};report.branches.push(b);persist();
  submit(b,legal().find(a=>a.family==='scan'));
  const earth=legal().find(a=>a.family==='choose_target'&&a.target?.nebulaId==='sector-1-a');
  submit(b,earth);b.earthScanTarget=earth.target;
  let choices=legal();
  assert(choices.some(a=>a.family==='choose_card'&&a.target?.choiceId?.startsWith('public:')));
  const publicChoice=choices.find(a=>a.family==='choose_card'&&a.target?.nebulaId==='sector-1-a')
    ||choices.find(a=>a.family==='choose_card'&&a.target?.nebulaId&&a.target.nebulaId!=='sector-2-a');
  submit(b,publicChoice);b.publicScanTarget=publicChoice.target;
  choices=legal();
  const done=choices.find(a=>a.target?.done===true);
  if(done)submit(b,done);
  submit(b,legal().find(a=>a.target?.mode==='move'&&a.target?.deltaX===0&&a.target?.deltaY===1));
  b.beforePurple2=snapshot();choices=legal();
  const action=b.name==='teacher-extra-signal'?choices.find(a=>a.target?.nebulaId==='sector-2-a')
    :choices.find(a=>a.target?.skip===true||a.target?.choiceId==='skip'||a.target?.choiceId?.endsWith(':skip'));
  submit(b,action);
  submit(b,legal().find(a=>a.family==='end_turn'));
  b.endpoint=envelope();b.after=snapshot();persist();
 }
 assert.deepEqual(report.branches[0].publicScanTarget,report.branches[1].publicScanTarget);
 const archive={schemaVersion:'seti-native-paired-income-control-v1',sourceCommit:pre.sourceCommit,seed:old.seed,
  sourceRuntimePreflight:'reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json',nativeInputsAlreadyExecuted:151+report.nativeInputs,
  frozenOpponentPolicy:'pass-only',priorRootVerification:'teaching-purple2-blue2-replay-verification-20261119-v1.json',
  branches:report.branches.map((b,i)=>({name:b.name,rootEnvelope:old.branches[i].endpoint,actions:b.actions,expectedEnvelope:b.endpoint}))};
 const file=path.join(dir,'teaching-funded-scan-replay-20261119-v1.json.gz');assert(!fs.existsSync(file));fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(archive)));
 report.status='complete';report.nativeBeforeNewVerification=archive.nativeInputsAlreadyExecuted;persist();
 console.log(JSON.stringify({status:report.status,nativeInputs:report.nativeInputs,nativeBeforeNewVerification:report.nativeBeforeNewVerification,
  branches:report.branches.map(b=>({name:b.name,inputs:b.actions.length,after:b.after.observation.publicState.players.find(p=>p.playerId===seat),value:b.after.value}))}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}
