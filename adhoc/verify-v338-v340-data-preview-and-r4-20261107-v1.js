'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const W='reports/ai-foundation-20261107/',D=W+'v340-income-preview-handoff-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),raw=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p)));
function take(v){
 const p=F+'v'+v+'-cold-income-before-amiba-20261107-v1.json',e=read(p);assert.equal(sha(e.rawPath),e.rawSha256);
 assert(e.rootAndRngUnchanged&&e.complete);assert.equal(e.nativeInputs,106);assert.equal(e.value,125);
 const g=JSON.parse(z.gunzipSync(fs.readFileSync(e.rawPath)).toString().replace(/seti-complete-decision-search-v(?:335|338|339|340)/g,'version'));delete g.diagnostics.milliseconds;
 return {e,g};
}
const [original,...versions]=[335,338,339,340].map(take);for(const r of versions){assert.equal(r.e.fixtureSha256,original.e.fixtureSha256);assert.deepEqual(r.g,original.g);assert.equal(sha(r.e.candidateSourceManifest),r.e.candidateSourceManifestSha256);}
const s=W+'v338-blue-tail-reuse-v1/',reuse=read(s+'reuse-counts-20261107-v1.json').counts,cross=read(s+'cross-tail-value-endpoints-20261107-v1.json').counts.crossEndpoint;
assert.equal(reuse.hits,26);assert.equal(cross.sameIdentityMutable,37);
const knownSwap=read(D+'swap-spent-mark-counterfactual-20261107-v1.json').counts;assert.equal(knownSwap.same,177);assert.equal(knownSwap.offers,177);
const profile=read(D+'instrumented-cpu-summary-20261107-v1.json');assert.equal(sha(D+'instrumented-cpu-20261107-v1.json.gz'),profile.profileSha256);
const [r4,skip,corner]=['computer-conversion','no-mercury-control','no-mercury-b111-corner'].map(s=>raw(D+'v323-r4-native-'+s+'-20261107-v1.json.gz'));
for(const r of [r4,skip,corner]){assert(r.sourceAndRngRestored);assert.equal(sha(r.sourceManifest),r.sourceManifestSha256);assert.equal(r.newAutonomousRuns,0);}
for(const row of [...r4.rows,...skip.rows])assert.equal(sha(row.source),row.sourceSha256);
const snap=row=>({line:row.line,score:row.after.wallet.score,credit:row.after.wallet.credits,energy:row.after.wallet.energy,publicity:row.after.wallet.publicity,hand:row.after.wallet.handSize,computer:row.after.computer.map(a=>a[1]),publicProjectedFinal:row.after.forecastFinal});
const report=[...r4.rows,...skip.rows,...corner.rows].map(snap);
assert.deepEqual(report.map(r=>[r.score,r.energy,r.publicity,r.hand,r.computer.length,r.publicProjectedFinal]),[[91,3,4,2,2,121],[93,1,1,0,4,123],[93,0,2,1,3,123],[93,0,2,0,4,123]]);
assert.equal(skip.rows[0].heldCorner.dataCount,1);assert.deepEqual(r4.rows[1].incomeReward,{energy:1});assert.equal(corner.rows[0].sourceSha256,crypto.createHash('sha256').update(z.gunzipSync(fs.readFileSync(D+'v323-r4-native-no-mercury-control-20261107-v1.json.gz'))).digest('hex'));
const inputs=r4.nativeInputs+skip.nativeInputs+corner.nativeInputs;assert.equal(inputs,23);
console.log(JSON.stringify({fullGraphV335V338V339V340Exact:true,roots:versions.map(v=>({version:v.e.searchVersion,milliseconds:v.e.milliseconds,nativeInputs:v.e.nativeInputs,gatePassed:v.e.decisionGatePassed})),reuse:reuse.hits,mutableCrossTailIdentical:cross.sameIdentityMutable,companyOffersMarkControl:knownSwap.same,controlledR4:report,sourceAndRngRestored:true,fixedNativeInputs:inputs,newAutonomousRuns:0}));
