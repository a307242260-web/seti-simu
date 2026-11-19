'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),pre=read('v486-random20-runtime-preflight-20261119-v1.json');
const {replay}=require(path.join(pre.runtime,'tools/archive_research_replay'));
const control=read('opening-policy-board20-native-20261119-v2.json'),branch=control.branches[1];
const r1=read('opening-policy-board20-retained-purple-round1-20261119-v1.json'),r2=read('opening-policy-board20-retained-purple-round2-20261119-v1.json');
const launch=read('opening-policy-board20-forced-launch-round1-20261119-v1.json');
const root=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'opening-policy-board20-forced-launch-root-20261119-v1.json.gz'))));
const actions=d=>d.decisions.slice(0,d.inputs).map(r=>r.action);
const prefix=[...control.prefix,...branch.setupInputs,...branch.turnInputs];
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(ordered(x))).digest('hex');
const cases=[['purple-first-r1',[...prefix,...actions(r1)],'opening-policy-board20-retained-purple-round1-checkpoint-20261119-v1.json.gz'],
 ['purple-first-r2-stop',[...prefix,...actions(r1),...actions(r2)],'opening-policy-board20-retained-purple-round2-checkpoint-20261119-v1.json.gz'],
 ['launch-first-r1',[...control.prefix,...root.events,...actions(launch)],'opening-policy-board20-forced-launch-round1-checkpoint-20261119-v1.json.gz']];
const receipts=[];
for(const [name,steps,checkpoint]of cases){
 const file=path.join(dir,`opening-policy-${name}-replay-20261119-v1.json.gz`);assert(!fs.existsSync(file));
 const saved=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,checkpoint)))),s=JSON.parse(saved.envelope.committedState);
 const archive={schemaVersion:'seti-research-replay-v1',seed:control.seed,worldVersion:s.meta.worldVersion,ruleCommit:pre.sourceCommit,policyVersion:'v486-controlled-opening',activePlayerCount:4,
  actions:steps.map(a=>({action:{actionId:a.actionId,actorId:a.actorId,family:a.family,target:a.target}})),decisions:[],expected:{nativeStateSha256:hash(s),sessionSha256:hash(saved.envelope.session),rng:s.meta.rngState}};
 fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(archive)));assert.deepEqual(replay(archive),archive.expected);
 receipts.push({name,path:path.relative(repo,file),sha256:hash(fs.readFileSync(file)),inputs:steps.length,verified:true,expected:archive.expected});
}
fs.writeFileSync(path.join(dir,'opening-policy-replay-verification-20261119-v1.json'),JSON.stringify({cases:receipts,nativeReplayInputs:receipts.reduce((n,x)=>n+x.inputs,0),newFullGames:0},null,2)+'\n');
console.log(JSON.stringify(receipts.map(({name,inputs,verified})=>({name,inputs,verified}))));
