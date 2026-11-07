'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),v8=require('node:v8'),Module=require('node:module');
const W='reports/ai-foundation-20261107/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',D=W+'v346-aomomo-read-only-score-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),unzip=p=>z.gunzipSync(fs.readFileSync(p));
function take(v){
 const e=read(F+'v'+v+'-cold-income-before-amiba-20261107-v1.json');assert.equal(sha(e.rawPath),e.rawSha256);assert(e.complete&&e.rootAndRngUnchanged);
 assert.equal(e.nativeInputs,106);assert.equal(e.value,125);
 const g=JSON.parse(unzip(e.rawPath).toString().replace(/seti-complete-decision-search-v(?:342|343|344|345|346)/g,'version'));delete g.diagnostics.milliseconds;
 return{e,g};
}
const [base,...variants]=[342,343,344,345,346].map(take);
for(const v of variants){assert.equal(v.e.fixtureSha256,base.e.fixtureSha256);assert.deepEqual(v.g,base.g);assert.equal(sha(v.e.candidateSourceManifest),v.e.candidateSourceManifestSha256);}
const probePath='randomizer/game/ai/probe-capital.js',valuePath='randomizer/game/ai/state-value.js',baseSource=read(base.e.candidateSourceManifest);
function graph(manifest,probe,value){
 for(const [n,p] of [[probePath,probe],[valuePath,value]])assert.equal(sha(p),manifest.sourceHashes[n]||manifest.baseRuntimeHashes[n]);
 function load(n,p,dependency){
  const filename=require.resolve('../'+n),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
  if(dependency){const r=m.require.bind(m);m.require=id=>id==='./probe-capital'?dependency:r(id);}
  m._compile(fs.readFileSync(p,'utf8'),filename);return m.exports;
 }
 return load(valuePath,value,load(probePath,probe));
}
const ref=graph(baseSource,W+'v330-trace-quote-v1/source-snapshot/'+probePath,W+'v335-research-layout-key-v1/source-snapshot/'+valuePath);
const candidates=variants.slice(0,3).map(({e})=>{const m=read(e.candidateSourceManifest);return graph(m,m.changedSourceSnapshot+'/'+probePath,m.changedSourceSnapshot+'/'+valuePath);});
const corp=['company-fixed-intent-v1/complete-capital-inputs-20261107-v1.v8.gz','portfolio-repetition-v1/hard132-full-portfolio-inputs-20261107-v1.v8.gz'].flatMap(p=>v8.deserialize(unzip(W+p)).inputs);
let comparisons=0,custom=0;
for(const {facts,weights} of corp){
 const stable=JSON.stringify(facts),d=JSON.stringify(weights)===JSON.stringify(ref.DEFAULT_WEIGHTS),w=d?ref.DEFAULT_WEIGHTS:weights,result=ref.purposeCapital(facts,w);
 for(const value of candidates){
  assert.deepEqual(value.purposeCapital(facts,d?value.DEFAULT_WEIGHTS:weights),result);comparisons++;
  assert.equal(JSON.stringify(facts),stable);
 }
}
const funded=corp.find(x=>x.facts.board?.rockets?.length&&x.facts.round===3);
assert(funded);
for(const publicity of [0,3,6,10])for(const credits of [0,5])for(const energy of [0,3]){
 const facts={...funded.facts,player:{...funded.facts.player,publicity,credits,energy}},w={...ref.DEFAULT_WEIGHTS,energy:.875};
 const expected=ref.purposeCapital(facts,w);
 for(const value of candidates){assert.deepEqual(value.purposeCapital(facts,w),expected);custom++;}
}
const lines=p=>fs.readFileSync(p,'utf8').trim().split(String.fromCharCode(10));
const before=lines(D+'v342-value-input-stack-20261107-v1.log'),after=lines(D+'value-input-audit-20261107-v1.log');
assert(before.some(s=>s.includes('ensureAomomoState')));assert.equal(before.filter(l=>l.startsWith('[PASS]')).length,65);
assert.equal(before.filter(l=>l.startsWith('[FAIL]')).length,1);assert.equal(after.filter(l=>l.startsWith('[PASS]')).length,66);
assert.equal(after.filter(l=>l.startsWith('[FAIL]')).length,0);
const stale=lines(D+'v342-related-node-candidate-20261107-v1.log');
assert(stale.some(s=>s.includes('scope:'))&&stale.some(s=>s.includes('passed=6 failed=1')));
assert(lines(D+'related-node-20261107-v1.log').some(s=>s.includes('passed=12 failed=0')));
console.log(JSON.stringify({completeGraphV342V343V344V345V346Exact:true,rootAndRngExact:true,portfolioComparisons:comparisons,custom,actualCandidateAudit:{before:65,after:66,failedAfter:0},newAutonomousRuns:0,firstCold:variants.map(x=>({version:x.e.searchVersion,ms:x.e.milliseconds,inputs:x.e.nativeInputs,gate:x.e.decisionGatePassed}))}));
