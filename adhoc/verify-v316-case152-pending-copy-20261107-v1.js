'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const A='reports/ai-foundation-20261107/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',D=A+'case152-pending-copy-v316-v1/';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const root='/private/tmp/seti-v316-case152-pending-copy-20261107-v1/',refRoot='/private/tmp/seti-v315-case152-lean-proof-path-20261107-v1/';
for(const [v,base,manifestPath] of [[315,refRoot,A+'case152-lean-proof-path-v315-v1/source-manifest-20261107-v1.json'],[316,root,D+'source-manifest-20261107-v1.json']]){
 const m=read(manifestPath);assert.equal(m.searchVersion,'seti-complete-decision-search-v'+v);
 for(const [p,h] of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(base+p),h,p);
}
const api=require(root+'randomizer/game/effects/session-runtime'),old=require(refRoot+'randomizer/game/effects/session-runtime'),copy=require(root+'randomizer/game/state/state-store').copyForkData;
const shared={v:-0,u:undefined,'é':true},graph={a:shared,b:shared,list:[shared,,null],nil:Object.assign(Object.create(null),{value:2})};
graph.self=graph;
const fallback={...graph,map:new Map([[shared,shared]]),special:Object.fromEntries([['__proto__',shared]])};
function check(data){const a=copy(data),b=structuredClone(data);assert.deepEqual(a,b);assert.equal(a.a,a.b);assert.equal(a.a,a.list[0]);assert.notEqual(a.a,data.a);assert(Object.is(a.a.v,-0));assert(!Object.hasOwn(a.list,1));}
check(graph);check(fallback);
assert.throws(()=>copy({x:Symbol('noncloneable')}),e=>e.name==='DataCloneError');
const cold=read(F+'v316-cold-actual-v256-132-20261107-v1.json');
assert.equal(sha(cold.fixture),cold.fixtureSha256);
const fixture=read(cold.fixture);
const paths=[cold.fixture,...read(A+'analysis-lazy-trace-contexts-v1/serial-cold-gate-20261107-v1.json').rows.map(r=>r.fixture),
 ...fs.readdirSync(F).filter(x=>/-root-2026110[67]-v1\.json$/.test(x)).map(x=>F+x)];
const checkpoints=[],fixturePaths=[];
for(const f of new Set(paths)){const cp=read(f).compositionEnvelope?.session;if(cp){checkpoints.push(cp);fixturePaths.push(f);}if(checkpoints.length===12)break;}
assert.equal(checkpoints.length,12);
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
const reference=old.createRuntime({trustedIsolatedOwnership:true}),actual=api.createRuntime({trustedIsolatedOwnership:true,cloneTrustedCheckpoint:copy});
for(const cp of checkpoints){
 const b=JSON.stringify(cp);freeze(cp);
 for(const readOnly of [true,false]){
   const options={trustedFrozenState:true,readOnly},r=actual.restoreCheckpoint(cp,options);
   assert(r.ok);assert.deepEqual(r,reference.restoreCheckpoint(cp,options));
   assert.equal(r.session.baseState,cp.session.baseState);
   assert.equal(r.session.workingState===cp.session.workingState,readOnly);
   assert.notEqual(r.session.queue,cp.session.queue);
   if(!readOnly)r.session.workingState.meta.stateVersion=999999;
   assert.equal(JSON.stringify(cp),b);
 }
 assert.deepEqual(actual.restoreCheckpoint(cp),reference.restoreCheckpoint(cp));
 const broken={...cp,replayCursor:cp.replayCursor+1};assert.deepEqual(actual.restoreCheckpoint(broken,{trustedFrozenState:true}),reference.restoreCheckpoint(broken,{trustedFrozenState:true}));
}
const compared=[];
for(const label of ['corpus-case-152','actual-v256-132']){
 const record=[315,316].map(v=>read(F+'v'+v+'-cold-'+label+'-20261107-v1.json'));
 const [a,b]=record.map(x=>{assert.equal(sha(x.rawPath),x.rawSha256);return JSON.parse(z.gunzipSync(fs.readFileSync(x.rawPath)));});
 const rank=r=>[r.actionId,r.value,r.realization,r.preparationDebt,r.lines[0].distance];
 assert.deepEqual(rank(a),rank(b));assert.deepEqual(a.roots,b.roots);assert.deepEqual(a.unresolved,b.unresolved);
 assert(a.complete&&b.complete);assert.deepEqual(record[0].rootActions,record[1].rootActions);
 compared.push({label,rank:rank(b),rootActions:record[1].rootActions.length,complete:true,firstV315Milliseconds:record[0].milliseconds,firstV316Milliseconds:record[1].milliseconds,firstV315Gate:record[0].decisionGatePassed,firstV316Gate:record[1].decisionGatePassed});
}
for(const n of ['state/state-store','state/low-coupling-slices','state/high-coupling-slices','effects/session-runtime','ai/goal-movement'])require(root+'randomizer/game/'+n+'.test.js');
const result={scope:'Pending session fast-copy controls and V315/V316 official first-sample behavioral parity. No second samples, additional autonomous games, or full source admission.',checkpointGroups:checkpoints.length,fixturePaths,restoreModes:['trusted-write','trusted-read','ordinary'],aliasAndFallbackControls:true,regularCopiesUntouched:true,compared,targetedNodePassed:5,newAutonomousRuns:0};
fs.writeFileSync(D+'pending-copy-validation-20261107-v1.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
