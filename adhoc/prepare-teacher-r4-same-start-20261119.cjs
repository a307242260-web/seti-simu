'use strict';
// Validate the legal teacher replay, capture first White R4, verify fresh prefix.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),pre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(ordered(x))).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const base=path.join(repo,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1');
const archivePath=path.join(base,'teacher-current-legal-reference-384-20261118-v1.replay.json'),archive=read(archivePath);
const teacherSavePath=path.join(repo,'seti-saves/seti-save-teacher-current-legal-reference-384-20261118-v1.json'),teacherSave=read(teacherSavePath);
assert.equal(archive.actions.length,474);assert.equal(teacherSave.replaySteps.length,474);
for(let i=0;i<245;i++){
 const actual=archive.actions[i].action,full=teacherSave.replaySteps[i].action;
 assert.deepEqual(actual,{actionId:full.actionId,actorId:full.actorId,family:full.family,target:full.target});
}
assert.equal(archive.actions[245].action.actorId,seat);assert.equal(archive.actions[245].action.family,'launch');
const openingProofPath=path.join(repo,'reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.json'),opening=read(openingProofPath);
const openingBytes=fs.readFileSync(path.join(repo,opening.checkpointPath));assert.equal(hash(openingBytes),opening.checkpointSha256);
const openingEnvelope=JSON.parse(openingBytes).coreState.compositionEnvelope;
const old=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(base,'teacher-r4-first-point-20261118-v1.json.gz'))));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const output=path.join(dir,'teacher-r4-same-start-preparation-20261119-v1.json');assert(!fs.existsSync(output));
const report={schemaVersion:'seti-teacher-r4-exact-start-preparation-v1',sourceCommit:pre.sourceCommit,teacherRuleCommit:archive.ruleCommit,
 sourceArchive:path.relative(repo,archivePath),sourceArchiveSha256:hash(fs.readFileSync(archivePath)),teacherSave:path.relative(repo,teacherSavePath),teacherSaveSha256:hash(fs.readFileSync(teacherSavePath)),
 seed:archive.seed,status:'running',nativeInputs:0,newAISearches:0,newAutonomousGames:0,sourceFilesVerified:Object.keys(pre.sourceFiles).length,
 correctBeforeInput:246,controlledPrefixInputs:245,originalOpeningInputs:23,openingCheckpointSha256:opening.checkpointSha256};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
let c;
function make(){const random=createSeededRandom(archive.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
 const {composition}=createSimulationRuleComposition({seed:archive.seed,activePlayerCount:4,random,rngState});
 composition.lifecycle.newGame({seed:archive.seed,activePlayerCount:4,initialize:true,rngState});composition.inputPort.beginDrain({metadata:{source:'teacher-r4-control-preparation'}});return composition;
}
const envelope=()=>c.lifecycle.save().envelope;
function state(){const e=envelope();return e.session?.session?.workingState||JSON.parse(e.committedState);}
function checkpoint(){fs.writeFileSync(path.join(dir,'teacher-r4-active-preparation-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({envelope:envelope(),nativeInputs:report.nativeInputs})));}
function submit(step){assert(report.nativeInputs<800);const desired=archive.actions[step-1].action;
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null,choices=d?d.choices:c.inputPort.enumerateActions({});
 const action=choices.find(a=>a.actionId===desired.actionId&&a.actorId===desired.actorId&&a.family===desired.family&&hash(a.target||{})===hash(desired.target||{}));
 assert(action,'Current legal teacher action unavailable at '+step);
 if(step>23&&action.actorId!==seat)assert(action.family==='pass'||action.phase==='conditional','PASS_ONLY_CONTRACT');
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
 assert(r.ok,JSON.stringify(r));report.nativeInputs++;report.lastReferenceInput=step;persist();if(report.nativeInputs%20===0)checkpoint();
}
function first23(){const actual=envelope();assert.deepEqual(JSON.parse(actual.committedState),JSON.parse(openingEnvelope.committedState));assert.deepEqual(actual.session,openingEnvelope.session);}
try{
 c=make();let root;
 for(let i=1;i<=474;i++){
  if(i===242){const s=state(),p=s.players.players.find(p=>p.id===seat);assert.equal(p.resources.score,105);assert.equal(s.turn.roundNumber,3);report.teacherR3End={score:p.resources.score,resources:p.resources,income:p.income,technology:p.techState};}
  if(i===246){
   root=envelope();assert.equal(root.session,null);const s=state();assert.equal(s.turn.roundNumber,4);assert.equal(s.turn.currentPlayerId,seat);assert.deepEqual(s.turn.passedPlayerIds,['player-brown']);
   report.oldArchivedFirstRootNativeEqual=hash(JSON.parse(old.root.root.committedState))===hash(JSON.parse(root.committedState))&&hash(old.root.root.session)===hash(root.session);
   report.oldArchivedBeforeTeacherInput=old.root.beforeTeacherInput;
   report.rootPath='reports/ai-foundation-20261119/teacher-r4-before-input246-20261119-v1.json.gz';
   fs.writeFileSync(path.join(repo,report.rootPath),zlib.gzipSync(JSON.stringify({envelope:root})));
   report.rootNativeEnvelopeSha256=hash(root);report.rootNativeStateSha256=hash(JSON.parse(root.committedState));checkpoint();persist();
  }
  submit(i);if(i===23){first23();report.original23NativeOpeningExact=true;persist();}
 }
 const final=envelope(),s=JSON.parse(final.committedState);
 const expected={nativeStateSha256:hash(s),sessionSha256:hash(final.session),rng:s.meta.rngState};assert.deepEqual(expected,archive.expected);
 assert.deepEqual(s,JSON.parse(teacherSave.committedState));assert.deepEqual(final.session,teacherSave.session);
 assert.equal(s.match.finalScores.find(p=>p.playerId===seat).totalScore,384);
 report.fullTeacher474InputsVerified=true;c.dispose();c=make();
 for(let i=1;i<=245;i++){submit(i);if(i===23)first23();}
 assert.deepEqual(envelope(),root);report.fresh245PrefixNativeAndRngExact=true;assert.equal(report.nativeInputs,719);
 const current=JSON.parse(root.committedState),browser={...teacherSave,seed:archive.seed,gameId:current.meta.gameId,rulesetVersion:current.meta.rulesetVersion,stateVersion:current.meta.stateVersion,
  committedState:root.committedState,session:root.session,replaySteps:teacherSave.replaySteps.slice(0,245),machineAI:{},name:'教师同起点第四轮对照',savedAt:new Date().toISOString()};
 delete browser.readableState;
 report.browserSavePath='seti-saves/seti-save-teacher-r4-same-start-before246-20261119-v1.json';
 assert(!fs.existsSync(path.join(repo,report.browserSavePath)));fs.writeFileSync(path.join(repo,report.browserSavePath),JSON.stringify(browser,null,2)+'\n');
 report.browserSaveSha256=hash(fs.readFileSync(path.join(repo,report.browserSavePath)));report.status='verified';checkpoint();persist();
 console.log(JSON.stringify({status:report.status,nativeInputs:719,fullTeacher474InputsVerified:true,fresh245PrefixNativeAndRngExact:true,oldArchivedFirstRootNativeEqual:report.oldArchivedFirstRootNativeEqual,rootPath:report.rootPath,browserSavePath:report.browserSavePath}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};if(c){report.failureEnvelope=envelope();report.failureInspect=c.inspect();}persist();console.error(error.stack);process.exitCode=1;}
finally{c?.dispose();}
