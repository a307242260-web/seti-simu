'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const file=path.join(dir,process.argv[2]||'board19-income-replay-20261119-v1.json.gz'),archive=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
const pre=JSON.parse(fs.readFileSync(path.join(repo,archive.sourceRuntimePreflight))),rt=pre.runtime;
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(ordered(x))).digest('hex');
assert.equal(archive.sourceCommit,pre.sourceCommit);
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const output=path.join(dir,process.argv[3]||'board19-income-replay-verification-20261119-v1.json');assert(!fs.existsSync(output));
const report={schemaVersion:'seti-native-income-replay-verification-v1',sourceCommit:pre.sourceCommit,archiveSha256:hash(fs.readFileSync(file)),
 sourceFilesVerified:Object.keys(pre.sourceFiles).length,status:'running',verifiedInputs:0,newAISearches:0,newFullGames:0,branches:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const random=createSeededRandom(archive.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:archive.seed,activePlayerCount:4,random,rngState});
try{
 c.lifecycle.newGame({seed:archive.seed,activePlayerCount:4,initialize:true,rngState});
 for(const branch of archive.branches){
  assert(c.lifecycle.restore(branch.rootEnvelope).ok);assert.deepEqual(c.lifecycle.save().envelope,branch.rootEnvelope);
  const result={name:branch.name,inputs:0,verified:false};report.branches.push(result);persist();
  for(const desired of branch.actions){
   assert(archive.nativeInputsAlreadyExecuted+report.verifiedInputs<200);
   if(archive.frozenOpponentPolicy==='pass-only'&&desired.actorId!=='player-white')assert(desired.family==='pass'||desired.phase==='conditional','FROZEN_OPPONENT_ACTION_FORBIDDEN');
   const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
   const actions=d?d.choices:c.inputPort.enumerateActions({});
   const action=actions.find(a=>a.family===desired.family&&a.actorId===desired.actorId&&hash(a.target||{})===hash(desired.target||{}));
   assert(action,'Archived action unavailable: '+desired.actionId);
   const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action})
    :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
   assert(r.ok,JSON.stringify(r));report.verifiedInputs++;result.inputs++;persist();
  }
  const actual=c.lifecycle.save().envelope;assert.deepEqual(actual,branch.expectedEnvelope);
  result.verified=true;result.nativeEnvelopeSha256=hash(actual);persist();
 }
 report.status='complete';report.verified=true;report.totalNativeIncludingControls=archive.nativeInputsAlreadyExecuted+report.verifiedInputs;persist();
 console.log(JSON.stringify(report));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}
