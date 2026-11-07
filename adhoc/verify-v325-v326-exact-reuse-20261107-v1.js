'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const W='reports/ai-foundation-20261107/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const parent=W+'committed-computer-recovery-v323-v1/serial-cold-gate-20261107-v1.json',base=read(parent),D325=W+'v325-timing-cache-v1/',D326=W+'v326-observation-score-v1/';
const g325=read(D325+'serial-cold-gate-20261107-v1.json'),g326=read(D326+'serial-cold-gate-20261107-v1.json');
const raw=r=>{assert.equal(sha(r.rawPath),r.rawSha256);return JSON.parse(z.gunzipSync(fs.readFileSync(r.rawPath)).toString().replace(/seti-complete-decision-search-v(?:323|324|325|326)|seti-purpose-capital-state-value-v(?:54|55)|seti-goal-resource-preparation-v(?:25|26)/g,'version'));};
const compare=(old,row)=>{const a=read(old),b=read(row.evidence),x=raw(a),y=raw(b);delete x.diagnostics.milliseconds;delete y.diagnostics.milliseconds;assert.deepEqual(x,y);assert(b.rootAndRngUnchanged);for(const n of ['timingPrefixBuilds','timingPrefixReuses','movementTimingCacheHits','movementTimingCacheMisses','movementTimingCacheEntries'])assert.equal(a.portDiagnostics[n],b.portDiagnostics[n]);return{label:row.label,native:row.nativeInputs,ms:row.milliseconds,oldMs:a.milliseconds,cacheHits:b.portDiagnostics.movementTimingCacheHits,cacheMisses:b.portDiagnostics.movementTimingCacheMisses};};
const rows=g325.rows.map(row=>compare(F+(row.label==='teacher-r3-after-amiba-reveal'?'v323':'v324')+'-cold-'+row.label+'-20261107-v1.json',row));
rows.push(compare(g325.failure.evidence,g326.failure));
const modulePath=require.resolve('../randomizer/app/rule-observation'),priorSource=process.argv[2];assert(priorSource);const v324=read(W+'v324-held-landing-route-v1/source-manifest-20261107-v1.json');
assert.equal(sha(priorSource),v324.sourceHashes['randomizer/app/rule-observation.js']||v324.baseRuntimeHashes['randomizer/app/rule-observation.js']);
const old=new Module(modulePath,module);old.filename=modulePath;old.paths=module.paths;old._compile(fs.readFileSync(priorSource,'utf8'),modulePath);const reference=old.exports,live=require(modulePath);
const frozen=read(D326+'source-manifest-20261107-v1.json');assert.equal(sha(modulePath),frozen.sourceHashes['randomizer/app/rule-observation.js']);
const roots=new Map(base.rows.map(r=>[r.identity,r.fixture]));let views=0,fullNativeBoards=0;
function check(state,seed,id,cheap){const before=JSON.stringify(state),args=[state,seed,id,[],{cheap}];assert.deepEqual(live.buildRuleObservation(...args),reference.buildRuleObservation(...args));assert.equal(JSON.stringify(state),before);views++;}
for(const fixture of roots.values()){
 const f=read(fixture),state=f.compositionEnvelope.session?.session?.workingState||JSON.parse(f.compositionEnvelope.committedState);
 const board=state.finalScoring;
 if(Array.isArray(board?.thresholds)&&Object.keys(board.tiles||{}).length===4&&['a','b','c','d'].every(id=>board.tiles[id]?.id===id&&Array.isArray(board.tiles[id].marks)&&[1,2].includes(board.tileVariants?.[id])))fullNativeBoards++;
 check(state,f.source.seed,f.seatId,false);check(state,f.source.seed,f.seatId,true);
}
const seedFixture=read(g325.failure.fixture),original=JSON.parse(seedFixture.compositionEnvelope.committedState);
for(const mutate of [s=>delete s.finalScoring.tiles.b,s=>{s.finalScoring.tileVariants.c='2';},s=>{s.finalScoring.tiles.a.id='z';},s=>delete s.finalScoring.tiles.d.marks,s=>delete s.finalScoring.thresholds,s=>{s.finalScoring.tiles.e={id:'e',marks:[]};}]){
 const state=structuredClone(original);mutate(state);for(const p of state.players.players)check(state,seedFixture.source.seed,p.id,false);
}
console.log(JSON.stringify({rows,rootStates:roots.size,views,fullNativeBoards,sourceMutation:false,newAutonomousRuns:0}));
