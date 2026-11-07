'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),crypto=require('node:crypto'),z=require('node:zlib');
const D='reports/ai-foundation-20261107/',P=D+'case152-primary-bound-v1/',N=D+'case152-timing-prefix-key-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const trace=read(P+'movement-timing-key-dependencies-20261107-v1.json'),rows=JSON.parse(z.gunzipSync(fs.readFileSync(trace.checkpoint))),oldPath=P+'production-kernel-card-history-key-prototype-20261107-v4.js',newPath=N+'production-kernel-timing-prefix-key-prototype-20261107-v1.js',safePath=N+'production-kernel-timing-prefix-key-prototype-20261107-v2.js';
assert.equal(sha(trace.checkpoint),trace.checkpointSha256);assert.equal(sha(oldPath),read(P+'card-history-key-native-parity-20261107-v4.json').prototypeSha256);
const manifest=read(trace.manifest);for(const[n,h]of Object.entries(manifest.sourceHashes))assert.equal(sha(n),h,n);
const s=fs.readFileSync(newPath,'utf8'),needle='    return buildProbeRouteRequirements(snapshot, seatId, null, false, requirementId, true);';
assert.equal(s.split(needle).length,2);
fs.writeFileSync(safePath,s.replace(needle,`    // Retain the established Native failure or no-match behavior for inputs
    // outside the scalar contract, including a missing goal or ended game.
    if (snapshot.turn.gameEnded || typeof requirementId !== "string") {
      const candidate = buildProbeRouteRequirements(snapshot, seatId, null, false, requirementId)
        .candidates.find(c => c.requirementId === requirementId);
      return candidate ? candidate.required.paidMovementPoints : null;
    }
`+needle),{flag:'wx'});
const file=require.resolve('../randomizer/game/production-kernel');
const native=require(file);
function load(path){const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(path,'utf8'),file);return m.exports;}
const old=load(oldPath),next=load(safePath),controls=read(P+'distance-boundary-controls-20261107-v3.checkpoint.json'),out=N+'timing-prefix-key-native-parity-20261107-v2.json';
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const outcome=(fn,args)=>{try{return {value:fn(...args)}}catch(e){return {name:e.name,message:e.message}}};
for(const [i,q] of [...rows,...controls].entries()){
  const args=[freeze(q.state),q.seat,q.id,q.path,q.free],bytes=JSON.stringify(q.state);
  assert.equal(next.plannedMovementTimingKey(...args),old.plannedMovementTimingKey(...args),'exact key '+i);
  assert.deepEqual(outcome(next.comparePlannedMovementTiming,args),outcome(native.comparePlannedMovementTiming,args),'Native timing '+i);
  if(i<rows.length)assert.deepEqual(next.getProbeRouteRequirements(q.state,q.seat),native.getProbeRouteRequirements(q.state,q.seat),'full first-step menu '+i);
  assert.equal(JSON.stringify(q.state),bytes);
}
const q=rows[0],ended=structuredClone(q.state);ended.turn.gameEnded=true;
const invalid=[['ended',ended,q.id],['undefined',q.state,undefined],['null',q.state,null],['numeric',q.state,13],['object',q.state,{id:q.id}]].map(([name,state,id])=>{
  const args=[freeze(state),q.seat,id,q.path,q.free],nativeOutcome=outcome(native.comparePlannedMovementTiming,args);
  assert.deepEqual(outcome(next.comparePlannedMovementTiming,args),nativeOutcome,name);
  return {name,nativeOutcome};
});
for(const[n,h]of Object.entries(manifest.sourceHashes))assert.equal(sha(n),h,n);
const result={status:'passed',scope:'Identical movement key bytes and Native timing outputs/errors. Full menus retain every first action after scalar cache use. V2 fallback affects only invalid or terminal requests; search timing for V1 must not be relabeled V2.',cases:rows.length,boundaryCases:controls.length,fullMenuCases:rows.length,invalid,prototype:safePath,prototypeSha256:sha(safePath),trace:trace.checkpoint,traceSha256:trace.checkpointSha256,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
