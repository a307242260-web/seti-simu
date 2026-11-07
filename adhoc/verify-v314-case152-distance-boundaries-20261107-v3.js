'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),crypto=require('node:crypto'),z=require('node:zlib');
const D='reports/ai-foundation-20261107/case152-primary-bound-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),trace=read(D+'movement-timing-key-dependencies-20261107-v1.json'),fixtures=JSON.parse(z.gunzipSync(fs.readFileSync(trace.checkpoint))),out=D+'distance-boundary-controls-20261107-v3.json',checkpoint=D+'distance-boundary-controls-20261107-v3.checkpoint.json';assert(!fs.existsSync(out));assert.equal(sha(trace.checkpoint),trace.checkpointSha256);
const file=require.resolve('../randomizer/game/production-kernel'),ref=require(file),prototype=D+'production-kernel-shallow-distance-prototype-20261107-v2.js',m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(prototype,'utf8'),file);const candidate=m.exports,rockets=require('../randomizer/game/rockets');
const sample=fixtures.find(q=>q.result.comparable&&q.path.length>=2&&q.id.includes(':orbit:'));assert(sample);
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
const check=(q,api)=>api.comparePlannedMovementTiming(q.state,q.seat,q.id,q.path,q.free);
function data(name,edit){const q=structuredClone(sample);q.name=name;edit(q,q.state.players.players.find(p=>p.id===q.seat));return q;}
const controls=[
 data('missing-native-target',q=>{q.id='rocket:999999:orbit:earth:planet:';q.path=[];}),
 data('borrowed-movement-tech',(_,p)=>{p.industryBorrowedTechTileId='orange2';}),
 data('temporary-move-effect',q=>{q.state.turn.cardTurnEventBonuses=[{movementModifiers:{ignoreAsteroidRestriction:true}}];}),
 data('company-free-movement',(_,p)=>{p.initialSelection.industry='寰宇动力';}),
 data('paid-wallet-changed',q=>{for(const p of q.state.players.players){p.resources.credits=0;p.resources.energy=0;p.resources.publicity=9;}}),
 data('free-prefix-credit',q=>{q.free=q.path[0].requiredMovePoints;}),
 data('stale-move-cost',q=>{q.path[0].requiredMovePoints+=1;})
];
let zero=null;for(const q of fixtures.filter(x=>x.result.comparable&&x.id.includes(':orbit:')).slice(0,8)){
 for(let x=0;x<8&&!zero;x++)for(let y=1;y<=4&&!zero;y++){
  const s=structuredClone(q.state),ship=s.pieces.rockets.find(r=>r.id===q.path[0]?.rocketId);if(!ship)continue;
  const slot=rockets.findAvailableSlotIndex(s.pieces,x,y,ship.id);if(slot===null)continue;
  rockets.assignRocketToSlot(ship,x,y,slot);const attempt={...q,state:s,path:[],free:0,name:'zero-paid-distance'};
  const result=check(attempt,ref);if(result.comparable&&result.waitPaidPoints===0)zero=attempt;
 }
 if(zero)break;
}assert(zero,'finite Native geometry controls must contain reachable zero distance');controls.push(zero);
const rows=[];for(const q of controls){const before=JSON.stringify(q.state);freeze(q.state);const outcome=api=>{try{return {value:check(q,api)}}catch(error){return {errorName:error.name,message:error.message}}};const a=outcome(ref),b=outcome(candidate);assert.deepEqual(a,b,q.name);assert.equal(JSON.stringify(q.state),before);if(q.name==='paid-wallet-changed')assert.deepEqual(a.value,sample.result);if(q.name==='stale-move-cost')assert.equal(a.message,'PROBE_PLAN_MOVE_COST_INVALID');else if(['missing-native-target','borrowed-movement-tech','temporary-move-effect','company-free-movement'].includes(q.name))assert.equal(a.value.comparable,false);rows.push({name:q.name,result:a});}
fs.writeFileSync(checkpoint,JSON.stringify(controls)+'\n');const report={status:'passed',scope:'Controlled Native timing API parity, not a game or fresh gate. Inputs deep-frozen.',prototype,prototypeSha256:sha(prototype),sourceTrace:trace.checkpoint,sourceTraceSha256:trace.checkpointSha256,checkpoint,checkpointSha256:sha(checkpoint),rows,sourceAndRngUntouched:true,newAutonomousRuns:0};fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,rows:rows.map(x=>[x.name,x.result.value?.comparable??null,x.result.value?.waitPaidPoints??null,x.result.message??null])}));
