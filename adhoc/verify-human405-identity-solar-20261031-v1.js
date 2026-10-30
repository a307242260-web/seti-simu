'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const archive='adhoc/human405-v119-reference-sources-20261031-v1.json.gz',reference=JSON.parse(zlib.gunzipSync(fs.readFileSync(archive))),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sources=['randomizer/solar-system/core.js','randomizer/game/ai/analysis-port.js'];
const output='reports/ai-foundation-20261023/human405-v119-identity-solar-differential-20261031-v2.json';
const sourceHashes=Object.fromEntries([...sources,archive,'adhoc/verify-human405-identity-solar-20261031-v1.js'].map(p=>[p,sha(p)]));
if(fs.existsSync(output)){assert.deepEqual(JSON.parse(fs.readFileSync(output)).sourceHashes,sourceHashes);console.log(JSON.stringify({reused:true,output}));process.exit(0);}
function solar(source){const context={module:{exports:{}},require:p=>{assert.equal(p,'./layout');return require('../randomizer/solar-system/layout');}};vm.runInNewContext(source,context);return context.module.exports;}
const oldSolar=solar(reference.files[sources[0]]),newSolar=solar(fs.readFileSync(sources[0],'utf8'));
let geometryChecks=0,identityChecks=0;
const equal=(a,b)=>{assert.deepEqual(structuredClone(a),structuredClone(b));geometryChecks++;};
for(let n=-8;n<=16;n++)for(const aomomoActive of [false,true])for(const sectorBySlot of [undefined,{1:4,2:1,3:3,4:2}]){
 const rotation={wheel1Steps:n,wheel2Steps:-n-1,wheel3Steps:n+2,wheel4Steps:0,rotationCount:n};
 const input={rotation,sectorBySlot,aomomoActive};
 for(const method of ['collectPlanetLocations','collectVisibleCoordinateContents','createSolarSnapshot'])equal(newSolar[method](input),oldSolar[method](input));
 for(let y=0;y<=5;y++)for(let x=0;x<8;x++)equal(newSolar.resolveVisibleContent(x,y,input),oldSolar.resolveVisibleContent(x,y,input));
 for(const legacy of [rotation,{rotation},[0,n,-n-1,n+2,0],null])for(const id of [1,2,3,4,'1','2','01',0,5,null])equal(newSolar.getWheelStep(legacy,id),oldSolar.getWheelStep(legacy,id));
}
function identity(source){const start=source.indexOf('  function forwardIdentity('),end=source.indexOf('\n  function createAnalysisPort(',start);assert(start>=0&&end>start);return vm.runInNewContext('('+source.slice(start,end).trim()+')');}
const oldIdentity=identity(reference.files[sources[1]]),newIdentity=identity(fs.readFileSync(sources[1],'utf8'));
const teacher=JSON.parse(fs.readFileSync('reports/ai-foundation-20261023/human405-round1-v119-audit-20261030-v1.json'));
const compat=JSON.parse(fs.readFileSync('reports/ai-foundation-20261023/human405-v119-compat-cold-20261031-v1.json'));
const fixtures=[...teacher.rows.map(r=>`adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-${String(r.step).padStart(3,'0')}-20261030-v1.json`),...compat.rows.map(r=>JSON.parse(fs.readFileSync(r.evidencePath)).fixture)];
assert.equal(fixtures.length,45);const fixtureHashes=Object.fromEntries(fixtures.map(p=>[p,sha(p)]));
function freeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;for(const c of Object.values(v))freeze(c);return Object.freeze(v);}
for(const file of fixtures){const envelope=JSON.parse(fs.readFileSync(file)).compositionEnvelope;
 for(const mutable of [true,false]){const state=JSON.parse(envelope.committedState);if(!mutable)freeze(state);const oldCache=new Map(),newCache=new Map();
  for(const status of ['stable','decision','information-barrier','turn-boundary'])for(const boundary of [null,'hidden-card-revealed'])for(let hit=0;hit<2;hit++){
   assert.equal(newIdentity(envelope,status,boundary,state,newCache),oldIdentity(envelope,status,boundary,state,oldCache),file);identityChecks++;
  }
 }
}
fs.writeFileSync(output,JSON.stringify({schemaVersion:'seti-human405-native-differential-v1',baseCommit:reference.baseCommit,geometryChecks,identityChecks,fixtures:fixtures.length,sourceHashes,fixtureHashes,scope:'Exact native geometry outputs, legacy wheel coercion, and complete forward identity bytes; mutable/frozen states and repeated cache reads. No rules, identity fields or native inputs omitted.'},null,2)+'\n');
console.log(JSON.stringify({geometryChecks,identityChecks,fixtures:fixtures.length,output}));
