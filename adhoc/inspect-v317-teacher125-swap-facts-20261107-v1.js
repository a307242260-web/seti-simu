'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const stage='/private/tmp/seti-v317-case152-static-occupancy-20261107-v1/',D='reports/ai-foundation-20261107/teacher125-v317-hotspots-v1/',read=p=>JSON.parse(fs.readFileSync(p)),hash=x=>crypto.createHash('sha256').update(x).digest('hex'),sha=p=>hash(fs.readFileSync(p));
const report=read(D+'v317-teacher125-swap-quotes-20261107-v1.json');assert.equal(sha(report.checkpoint),report.checkpointSha256);assert.equal(sha(report.manifest),report.manifestSha256);
const m=read(report.manifest);for(const [n,h] of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(stage+n),h,n);
const raw=JSON.parse(z.gunzipSync(fs.readFileSync(report.checkpoint))),states=new Map(Object.entries(raw.states).map(([k,s])=>[k,JSON.parse(s)]));
const file=require.resolve(stage+'randomizer/game/ai/resource-demand'),mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;
const text=fs.readFileSync(file,'utf8'),pos=text.lastIndexOf('return Object.freeze({');assert(pos>0);
mod._compile(text.slice(0,pos)+text.slice(pos).replace('return Object.freeze({','return Object.freeze({diagnosticValueFacts:valueFacts,'),file);
function compare(keyFn){
 const keys=new Map(),counts={hits:0,misses:0,estimatedSavedMs:0,maxPayloadBytes:0,keyMs:0},groups=[];
 for(const row of raw.prices){
  const state=states.get(row.stateKey),p=state.players.players.find(p=>p.id===row.playerId),start=performance.now(),facts=mod.exports.diagnosticValueFacts(state,p);
  const key=keyFn(facts,row);counts.keyMs+=performance.now()-start;counts.maxPayloadBytes=Math.max(counts.maxPayloadBytes,key.length*2);
  const entry=keys.get(key);
  if(entry){assert.equal(entry.value,row.value,'same observed inputs must retain exact current value');counts.hits++;counts.estimatedSavedMs+=row.elapsed;entry.rows.push({kind:row.kind,cardId:row.cardId,stateKey:row.stateKey});}
  else{counts.misses++;const e={value:row.value,rows:[{kind:row.kind,cardId:row.cardId,stateKey:row.stateKey}]};keys.set(key,e);groups.push(e);}
 }
 return {...counts,repeatedGroups:groups.filter(x=>x.rows.length>1).length};
}
const full=compare(f=>JSON.stringify(f));
const stateDup=raw.prices.reduce(({seen,ms},q)=>({seen:seen.add(q.playerId+':'+q.stateKey),ms:ms+(seen.has(q.playerId+':'+q.stateKey)?0:q.elapsed)}),{seen:new Set(),ms:0});
const byKey=new Map();let exactDuplicateMs=0;for(const q of raw.prices){const key=q.playerId+':'+q.stateKey;if(byKey.has(key))exactDuplicateMs+=q.elapsed;else byKey.set(key,q.value);}
const outputs={scope:'Offline effective inputs of all actual portfolio quotes; JSON equality is observational, not yet a safe general cache contract.',checkpoint:report.checkpoint,checkpointSha256:report.checkpointSha256,
 calls:raw.prices.length,full,exactStateHits:raw.prices.length-stateDup.seen.size,exactDuplicateMs,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(D+'v317-teacher125-swap-effective-facts-20261107-v1.json',JSON.stringify(outputs,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(outputs));
