'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const R='reports/ai-foundation-20261107/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',D=R+'teacher-r3-after-amiba-scan-coordinate-v322-v1/',M=D+'source-manifest-20261107-v1.json',w='/private/tmp/seti-v322-teacher-amiba-scan-coordinates-20261107-v1/';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),manifest=read(M),g=D+'serial-cold-gate-20261107-v1.json',gate=read(g);
assert(gate.status==='failed-gate'||gate.status==='complete');assert.equal(gate.manifestSha256,sha(M));
for(const[n,h]of Object.entries({...manifest.baseRuntimeHashes,...manifest.sourceHashes}))assert.equal(sha(w+n),h,n);
const parents=['teacher125-research-quotes-v318-v1','income-before-amiba-probe-v319-v1','income-before-amiba-scalar-v320-v1','income-before-amiba-prepaid-trace-v321-v1'];
const byId=new Map(parents.flatMap(p=>read(R+p+'/serial-cold-gate-20261107-v1.json').rows.map(r=>[r.identity,r])));
const compared=[],checked=new Set();
for(const row of gate.rows){
 const after=read(row.evidence);
 assert.equal(after.candidateSourceManifestSha256,sha(M));assert.equal(after.fixtureSha256,sha(after.fixture));assert.equal(after.rawSha256,sha(after.rawPath));assert(after.complete&&after.rootAndRngUnchanged);
 if(!byId.has(row.identity)||checked.has(row.identity))continue;
 const before=read(byId.get(row.identity).evidence);assert.equal(before.rawSha256,sha(before.rawPath));
 const [a,b]=[before,after].map(r=>JSON.parse(z.gunzipSync(fs.readFileSync(r.rawPath))));
 const rank=r=>[r.actionId,r.value,r.realization,r.preparationDebt,r.lines[0].distance];
 assert.deepEqual(rank(a),rank(b));assert.equal(a.diagnostics.nativeExecutions,b.diagnostics.nativeExecutions);
 for(const k of ['roots','lines','sharedPrefixGraph','candidates','unresolved'])assert.deepEqual(a[k],b[k],row.label+' '+k);
 assert.deepEqual(before.rootActions,after.rootActions);
 compared.push({label:row.label,previous:byId.get(row.identity).evidence,current:row.evidence,inputs:row.nativeInputs,previousMs:before.milliseconds,currentMs:after.milliseconds,fullGraphUnchanged:true,lines:b.lines.length});
 checked.add(row.identity);
}
assert(compared.length>=1);
const data={scope:'Cross-source V318 through V321 to V322 first-sample raw graph parity. Duplicated roots compared once. No additional search queries.',gate:g,gateSha256:sha(g),status:gate.status,tested:gate.rows.length,unique:gate.measuredUniqueRoots,compared,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(D+'v318-v321-v322-raw-graph-parity-20261107-v1.json',JSON.stringify(data,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({tested:data.tested,unique:data.unique,status:data.status,compared:compared.length}));
