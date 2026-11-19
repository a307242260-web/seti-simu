'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),D=path.join(repo,'reports/ai-foundation-20261119'),read=p=>JSON.parse(fs.readFileSync(p)),unzip=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,p)))),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),seat='player-white';
const pre=read(path.join(D,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
for(const[p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const prep=read(path.join(D,'teacher-r4-order-preparation-20261119-v1.json')),two=read(path.join(D,'teacher-r4-two-action-order-control-20261119-v1.json')),record=read(path.join(repo,'reports/research/adcb348b.42c7f5fd.full.terminal-recovery.json')),save=read(path.join(repo,record.savePath));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random')),{createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const random=createSeededRandom(record.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()},{composition:c}=createSimulationRuleComposition({seed:record.seed,activePlayerCount:4,random,rngState});
const output=path.join(D,'teacher-r4-order-native-verification-20261119-v1.json');assert(!fs.existsSync(output));let inputs=0;
const proof={schemaVersion:'seti-teacher-r4-order-native-verification-v1',status:'running',sourceCommit:pre.sourceCommit,nativeInputs:0,newAISearches:0,newGames:0,checkpoints:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');persist();
function submit(action){const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null,choices=d?d.choices:c.inputPort.enumerateActions({}),a=choices.find(a=>a.actionId===action.actionId&&a.actorId===action.actorId);assert(a);assert.deepEqual(a.target,action.target);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);inputs++;proof.nativeInputs=inputs;persist();}
function exact(name,expected){assert.deepEqual(c.lifecycle.save().envelope,expected);proof.checkpoints.push({name,nativeAndSessionAndRngExact:true});persist();}
try{
 c.lifecycle.newGame({seed:record.seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(unzip('reports/ai-foundation-20261119/teacher-r4-before-input246-20261119-v1.json.gz').envelope).ok);
 for(const e of save.replaySteps.slice(245,262))submit(e.action);const root=unzip(prep.rootPath).envelope;exact('before263',root);
 for(const[first,second]of [['landing-first','landing-then-analysis'],['analysis-first','analysis-then-landing'],['scan-first',null]]){
  assert(c.lifecycle.restore(root).ok);const a=unzip(prep.branches[first].checkpoint);for(const action of a.actions)submit(action);exact(first,a.envelope);
  if(second){const b=unzip(two.branches[second].checkpoint);assert.deepEqual(c.lifecycle.save().envelope,b.before);for(const action of b.actions)submit(action);exact(second,b.envelope);}
 }
 assert.equal(inputs,81);proof.status='verified';persist();console.log(JSON.stringify({status:proof.status,nativeInputs:inputs,exactNativeEndpoints:proof.checkpoints.length,newGames:0,newSearches:0}));
}catch(e){proof.status='failed';proof.failure={message:e.message,stack:e.stack};persist();console.error(e.stack);process.exitCode=1}finally{c.dispose()}
