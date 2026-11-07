'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const old='/private/tmp/seti-v316-case152-pending-copy-20261107-v1/',next='/private/tmp/seti-v317-case152-static-occupancy-20261107-v1/';
const R='reports/ai-foundation-20261107/',D=R+'case152-static-occupancy-v317-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=D+'source-manifest-20261107-v1.json',m=read(manifest);for(const[p,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(next+p),h,p);
const p=R+'case152-primary-bound-v1/movement-timing-key-dependencies-20261107-v1.json',trace=read(p);
assert.equal(sha(trace.checkpoint),trace.checkpointSha256);
const rows=JSON.parse(z.gunzipSync(fs.readFileSync(trace.checkpoint)));
const r0=require(old+'randomizer/game/rockets'),r1=require(next+'randomizer/game/rockets'),solar=require(next+'randomizer/solar-system/core'),k0=require(old+'randomizer/game/production-kernel'),k1=require(next+'randomizer/game/production-kernel');
const e0=require(old+'randomizer/game/effects/session-runtime'),e1=require(next+'randomizer/game/effects/session-runtime');
const states=new Map();for(const q of rows)states.set(JSON.stringify([q.seat,q.state]),q);
const policy=require(next+'randomizer/game/abilities/rocket'),dirs=policy.MOVE_DIRECTIONS;
const layouts=[...states.values()].map(x=>x.state.pieces);
const crowded={rockets:solar.LAUNCH_SLOT_PRIORITY.map((slotIndex,i)=>({id:i+1,sectorX:1,sectorY:3,slotIndex}))};
layouts.push(crowded,{rockets:[]},{rockets:[...crowded.rockets,{id:90,sectorX:1,sectorY:3,slotIndex:0},{id:91,sectorX:1,sectorY:3,slotIndex:-1},{id:92,sectorX:'1',sectorY:3,slotIndex:1}]});
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
let geometricChecks=0;
for(const layout of layouts){
 const bytes=JSON.stringify(layout);freeze(layout);
 const ids=[null,1,90,...layout.rockets.filter(x=>x.surface==='solar-board').map(x=>x.id)];
 for(const id of new Set(ids)){
  const move=r1.createStaticCoordinateMoveQuery(layout,id);
  for(const x of solar.SECTOR_COORDINATE_X_IDS)for(const y of solar.SECTOR_COORDINATE_RING_IDS)for(const dir of dirs){
   const at={x,y},a=r0.canMoveFromCoordinate(layout,at,dir.deltaX,dir.deltaY,id);
   assert.deepEqual(move(at,dir.deltaX,dir.deltaY),a);geometricChecks++;
  }
 }
 assert.equal(JSON.stringify(layout),bytes);
}
assert(geometricChecks>10000);
for(const {state,seat} of states.values()){
 freeze(state);
 assert.deepEqual(k1.getProbeRouteRequirements(state,seat),k0.getProbeRouteRequirements(state,seat));
}
for(const {state,seat,id,path,free,result}of rows)assert.deepEqual(k1.comparePlannedMovementTiming(state,seat,id,path,free),result);
function execute(api,trusted,which){
 const runtime=api.createRuntime({trustedIsolatedOwnership:trusted});
 const a={actionId:'target:1',target:{slot:1},payload:{cost:2}},b={actionId:'target:2',target:{slot:2},payload:{cost:1}},sameId={...b,target:{slot:3}};
 runtime.registerExecutor('pick',{getLegalChoices(){return [a,b,sameId,{legacy:true}];},
 resolveDecision(state,e,c){return {ok:true,nextState:{...state,picked:c}};}});
 const dispatch=runtime.dispatchAction({version:1},{family:'fixture'},()=>({effects:[{type:'pick',kind:'decision',ownerId:'p1'}]}));
 assert(dispatch.ok);const s=dispatch.session;assert(runtime.drain(s).ok);
 const d=runtime.inspect(s).decision,before=structuredClone(s);
 const pick={collision:sameId,spoof:{...sameId,payload:{cost:99}},legacy:{legacy:true},unknown:{actionId:'target:999',target:{slot:3},payload:{cost:1}},stale:a,wrongOwner:a}[which];
 const r=runtime.resolveDecision(s,{decisionId:d.decisionId,decisionVersion:d.decisionVersion+Number(which==='stale'),ownerId:which==='wrongOwner'?'p2':d.ownerId,choice:pick});
 if(!r.ok)assert.deepEqual(s,before);
 return r;
}
const choiceControls=['collision','spoof','legacy','unknown','stale','wrongOwner'];
for(const trusted of [false,true])for(const which of choiceControls){
 const r=execute(e1,trusted,which),a=execute(e0,trusted,which);
 assert.deepEqual(r,a);assert.equal(r.ok,['collision','legacy'].includes(which));
}
const cold=[];
for(const label of ['corpus-case-152','actual-v256-132']){
 const [a,b]=[316,317].map(v=>read(F+'v'+v+'-cold-'+label+'-20261107-v1.json'));
 for(const q of [a,b])assert.equal(sha(q.rawPath),q.rawSha256);
 const [x,y]=[a,b].map(q=>JSON.parse(z.gunzipSync(fs.readFileSync(q.rawPath))));
 assert.deepEqual(x.roots,y.roots);assert.deepEqual(x.lines,y.lines);assert.deepEqual(a.rootActions,b.rootActions);assert(b.decisionGatePassed);
 cold.push({label,nativeInputs:b.nativeInputs,milliseconds:b.milliseconds,unchangedLines:y.lines.length});
}
for(const n of ['rockets','effects/session-runtime','ai/goal-movement','state/state-store'])require(next+'randomizer/game/'+n+'.test.js');
const result={scope:'Frozen V317 targeted equivalence and first-sample Native graph parity. No repeats of the cold performance roots.',manifest,manifestSha256:sha(manifest),geometricChecks,layouts:layouts.length,fullMenuGroups:states.size,timingCases:rows.length,choiceControls:choiceControls.length*2,cold,tests:4,newAutonomousRuns:0};
fs.writeFileSync(D+'occupancy-and-choice-parity-20261107-v1.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
