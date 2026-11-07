'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),crypto=require('node:crypto'),z=require('node:zlib');
const D='reports/ai-foundation-20261107/',P=D+'case152-primary-bound-v1/',R=D+'case152-rotation-reuse-v1/',V=D+'case152-validator-paths-v1/',G=D+'case152-planet-location-v1/';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const trace=read(P+'movement-timing-key-dependencies-20261107-v1.json'),rows=JSON.parse(z.gunzipSync(fs.readFileSync(trace.checkpoint))),extra=read(P+'distance-boundary-controls-20261107-v3.checkpoint.json');
assert.equal(sha(trace.checkpoint),trace.checkpointSha256);const m=read(trace.manifest);
for(const[n,h]of Object.entries(m.sourceHashes))assert.equal(sha(n),h,n);
function load(target,prototype,replace=s=>s){const f=require.resolve(target),mod=new Module(f,module);mod.filename=f;mod.paths=module.paths;mod._compile(replace(fs.readFileSync(prototype,'utf8')),f);mod.loaded=true;return mod;}
const native=require('../randomizer/game/production-kernel'),refLow=require('../randomizer/game/state/low-coupling-slices'),refHigh=require('../randomizer/game/state/high-coupling-slices');
const k=load('../randomizer/game/production-kernel',R+'production-kernel-rotation-reuse-prototype-20261107-v2.js').exports;
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
const outcome=(fn,args)=>{try{return {value:fn(...args)}}catch(e){return {name:e.name,message:e.message}}};
const byState=new Map();
for(const q of rows){const key=JSON.stringify([q.seat,q.state]);let list=byState.get(key);if(!list){list=[];byState.set(key,list);}list.push(q);}
for(const qs of byState.values()){
 const state=freeze(qs[0].state),seat=qs[0].seat,before=JSON.stringify(state),query=k.createPlannedMovementTimingQuery(state,seat);
 for(const q of [...qs].reverse()){
   const exact=outcome(native.comparePlannedMovementTiming,[state,seat,q.id,q.path,q.free]);
   assert.deepEqual(exact,{value:q.result});assert.deepEqual(outcome(query,[q.id,q.path,q.free]),exact);
 }
 assert.deepEqual(k.getProbeRouteRequirements(state,seat),native.getProbeRouteRequirements(state,seat));
 assert.equal(JSON.stringify(state),before);
}
const q=rows[0],badPath=q.path.map((p,i)=>i===0?{...p,requiredMovePoints:999}:p),stringPath=q.path.map(p=>({...p,deltaX:String(p.deltaX)}));
const terminal=structuredClone(q.state);terminal.turn.gameEnded=true;
const controls=[...extra,{...q,name:'bad-cost-after-cached-valid-prefix',path:badPath},{...q,name:'noncanonical-delta-not-shared',path:stringPath},{...q,name:'no-req',id:undefined},{...q,name:'null-req',id:null},{...q,name:'numeric-req',id:5},{...q,name:'object-req',id:{id:q.id}},{...q,name:'terminal',state:terminal}];
for(const c of controls){
 const state=freeze(c.state),compare=k.createPlannedMovementTimingQuery(state,c.seat);
 // Warm the same helper with the closest valid path before exercising guard/fallback.
 if(!state.turn.gameEnded)outcome(compare,[c.id??q.id,q.path,c.free]);
 assert.deepEqual(outcome(compare,[c.id,c.path,c.free]),outcome(native.comparePlannedMovementTiming,[state,c.seat,c.id,c.path,c.free]),c.name);
}
const low=load('../randomizer/game/state/low-coupling-slices',V+'low-coupling-slices-prototype-20261107-v1.js');
require.cache[low.filename]=low;
const high=load('../randomizer/game/state/high-coupling-slices',V+'high-coupling-slices-prototype-20261107-v1.js');
require.cache[high.filename]=high;
const movement=load('../randomizer/game/ai/goal-movement',G+'goal-movement-planet-location-prototype-20261107-v2.js');
require.cache[movement.filename]=movement;
const witnesses=read(P+'combined-card-history-key-proofs-20261107-v5.checkpoint.json').rows;
const valid=witnesses.flatMap(w=>[JSON.parse(w.source.committedState),JSON.parse(w.envelope.committedState)]);
const broken=[
 s=>{s.turn.overlay={inside:{debugOnly:true}};s.solarSystem.wheelSteps=2;s.data.extra={playerLabel:'x',nested:{tokenSrc:'y'}};},
 s=>{s.players.players[0].hand[0].src='x';s.pieces.rockets[0].asset=null;s.cards.ui={debugOnly:true};s.tech.stacks.blue1.label='x';},
 s=>{s.aliens.extra=[{id:'aomomo-orbit-992'},{id:'alien-x-12-992'},{id:'banrenma-mark-992'},{traceType:'pink',position:1,sequence:-2}];},
 s=>{s.aliens.extra=[{id:'alien-x-12-12'},{id:'aomomo-landing-13'},{id:'banrenma-mark-14'}];s.meta.sequences.alienEntity=1;},
];
const bad=broken.map(mutate=>{const s=structuredClone(valid[0]);mutate(s);return s;});
const errors=[];
for(const s of [...valid,...bad]){
 const old=[refLow.validateLowCouplingInvariants(s),refHigh.validateHighCouplingInvariants(s)];
 const now=[low.exports.validateLowCouplingInvariants(s),high.exports.validateHighCouplingInvariants(s)];
 assert.deepEqual(now,old);
 if(bad.includes(s)){assert(old.some(a=>!a.ok));errors.push(old.flatMap(x=>x.errors||[]).map(({code,path})=>({code,path})));}
}
for(const t of ['state/low-coupling-slices','state/high-coupling-slices','state/state-store','ai/goal-movement'])require('../randomizer/game/'+t+'.test.js');
const data={scope:'Native timing and exact warm-query controls, current full endpoint menus, validator errors including path and order, and original targeted Node behavior suites. No official cold gate or game.',rotationCases:rows.length,queryGroups:byState.size,fullMenuGroups:byState.size,controls:controls.map(x=>x.name),diagnostics:k.diagnosticRotationReuse(),committedValidatorComparisons:valid.length,malformedValidatorComparisons:bad.length,errors,tests:['low-coupling-slices','high-coupling-slices','state-store','goal-movement'],trace:trace.checkpoint,traceSha256:trace.checkpointSha256,newAutonomousRuns:0};
fs.writeFileSync(R+'rotation-and-validator-native-parity-20261107-v2.json',JSON.stringify(data,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...data,errors:errors.map(x=>x.length)}));
