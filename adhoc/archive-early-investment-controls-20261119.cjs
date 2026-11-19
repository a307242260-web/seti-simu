'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p)));
const pre=read('v486-random20-runtime-preflight-20261119-v1.json'),rt=pre.runtime;
const original=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,'reports/iteration/v486-original20-20261119/board-20-replay-20261119-v1.json.gz'))));
const menu=read('early-investment-native-control-20261119-v1.json');
const first=read('early-investment-card-income-round1-20261119-v1.json'),second=read('early-investment-card-income-round2-20261119-v1.json');
const order=read('early-investment-research-order-control-20261119-v2.json');
const prefix=original.actions.slice(0,46),start=menu.branches.find(b=>b.choice.actionId==='choose_card:3158182c').steps.map(action=>({action}));
const accepted=d=>d.decisions.slice(0,d.inputs).map(x=>({action:x.action}));
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(ordered(x))).digest('hex');
const {replay}=require(path.join(rt,'tools/archive_research_replay'));
const cases=[
 ['card-income-round1',[...prefix,...start,...accepted(first)],'early-investment-card-income-checkpoint-20261119-v1.json.gz'],
 ['card-income-round2-stop',[...prefix,...start,...accepted(first),...accepted(second)],'early-investment-card-income-round2-checkpoint-20261119-v1.json.gz'],
 ['purple4-first-stop',[...prefix,...start,...order.inputs.map(x=>({action:x.action}))],'early-investment-order-checkpoint-20261119-v1.json.gz'],
];
const rows=[];
for(const [name,steps,checkpoint]of cases){
 const file=path.join(dir,`early-investment-${name}-replay-20261119-v1.json.gz`);
 const receipt=path.join(dir,`early-investment-${name}-replay-verification-20261119-v1.json`);assert(!fs.existsSync(file)&&!fs.existsSync(receipt));
 const {envelope}=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,checkpoint))));
 const state=JSON.parse(envelope.committedState);
 const archive={schemaVersion:'seti-research-replay-v1',seed:original.seed,worldVersion:original.worldVersion,ruleCommit:pre.sourceCommit,
  policyVersion:original.policyVersion+'/controlled-income-branch',activePlayerCount:4,
  actions:steps.map(({action:a})=>({action:{actionId:a.actionId,actorId:a.actorId,family:a.family,target:a.target}})),decisions:[],
  expected:{nativeStateSha256:hash(state),sessionSha256:hash(envelope.session),rng:state.meta.rngState}};
 fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(archive)));
 const result=replay(archive);assert.deepEqual(result,archive.expected);
 const row={name,archive:path.relative(repo,file),sha256:hash(fs.readFileSync(file)),inputs:steps.length,verified:true,expected:result};
 fs.writeFileSync(receipt,JSON.stringify(row,null,2)+'\n');rows.push(row);
}
fs.writeFileSync(path.join(dir,'early-investment-replay-verification-20261119-v1.json'),JSON.stringify({cases:rows,nativeReplayInputs:rows.reduce((n,r)=>n+r.inputs,0),newAISearches:0,newFullGames:0},null,2)+'\n');
console.log(JSON.stringify(rows.map(({name,inputs,verified})=>({name,inputs,verified}))));
