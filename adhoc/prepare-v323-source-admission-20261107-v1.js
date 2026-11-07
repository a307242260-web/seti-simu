'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',mp=D+'source-manifest-20261107-v1.json';
const source='/private/tmp/seti-v323-committed-computer-recovery-20261107-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),m=read(mp);
const runtime={...m.baseRuntimeHashes,...m.sourceHashes},manifestSha256=sha(mp);assert.equal(manifestSha256,'b26df154d681636ffea2a4ffacf0788cac453e007d0faf2803397779d8027cb3');
const digests=new Map();const digest=p=>{if(!digests.has(p))digests.set(p,sha(p));return digests.get(p);};
for(const [name,hash] of Object.entries(runtime))assert.equal(digest(source+name),hash,name);
const gatePath=D+'serial-cold-gate-20261107-v1.json',g=read(gatePath);
assert.equal(g.manifestSha256,manifestSha256);assert(g.status==='complete'&&g.allClosed);assert.equal(g.cases,1258);assert.equal(g.rows.length,g.cases);
const known=new Set(),evidence=new Set([mp,gatePath]);
for(const row of g.rows){
 const f=read(row.fixture),id=crypto.createHash('sha256').update(JSON.stringify([f.seatId,f.compositionEnvelope])).digest('hex');
 assert.equal(row.identity,id);assert(row.decisionGatePassed&&row.complete&&row.rootAndRngUnchanged);
 assert(row.nativeInputs<=256&&row.milliseconds<=600);evidence.add(row.fixture);
 if(known.has(id))continue;known.add(id);
 const r=read(row.evidence);assert.equal(r.candidateSourceManifestSha256,manifestSha256);assert.equal(r.fixtureSha256,digest(r.fixture));assert.equal(r.rawSha256,digest(r.rawPath));
 assert.equal(r.nativeInputs,row.nativeInputs);assert.equal(r.milliseconds,row.milliseconds);
 const graph=JSON.parse(z.gunzipSync(fs.readFileSync(r.rawPath)));
 assert(graph.complete&&graph.unresolved.length===0&&!graph.stopReason);assert.equal(graph.diagnostics.nativeExecutions,row.nativeInputs);assert.equal(graph.actionId,row.actionId);assert.equal(graph.value,row.value);
 assert.equal(Object.keys(graph.diagnostics.limits).length,4);assert(Object.values(graph.diagnostics.limits).every(v=>v===null));
 for(const [p,h] of Object.entries(r.sourceHashes))assert.equal(digest(source+p),h,p);
 evidence.add(r.fixture);evidence.add(row.evidence);evidence.add(r.rawPath);
}
assert.equal(known.size,g.measuredUniqueRoots);assert.equal(known.size,818);
const node=fs.readFileSync(D+'full-node-20261107-v1.log','utf8'),a=node.match(/SUMMARY unit passed=(\d+) failed=0 total=(\d+)/),b=node.match(/SUMMARY fullFlow passed=1 failed=0 total=1/);assert(a&&a[1]===a[2]&&b&&!/^FAIL /m.test(node));assert(Number(a[1])>=203);
const browser=fs.readFileSync(D+'browser-20261107-v1.log','utf8');assert(browser.includes('SUMMARY browserSmoke passed=7 failed=0 total=7'));
const audit=fs.readFileSync(D+'input-audit-20261107-v1.log','utf8'),bad=audit.split('\n').filter(l=>l.includes('[FAIL]'));assert.equal(bad.length,1);assert(bad[0].includes('Cannot add property aomomo'));assert.equal(audit.split('\n').filter(l=>l.includes('[PASS]')).length,65);
const prior='reports/ai-foundation-20261107/teacher-r3-after-amiba-scan-coordinate-v322-v1/';
const parity=read(D+'v322-v323-raw-graph-comparison-20261107-v1.json'),first2=read(D+'first-two-production-comparison-20261107-v1.json'),control=read(prior+'scan-coordinate-controls-20261107-v1.json'),scope=read(D+'production-runtime-scope-20261107-v1.json');
assert.equal(parity.paired,818);assert.equal(parity.changedRanks,0);assert.equal(first2.sharedFirstTwoRoots,304);assert.equal(control.comparisons,3744);
assert.equal(scope.tracked,953);assert.equal(scope.changed.length,44);assert.equal(scope.unknown.length,25);assert.deepEqual(scope.foreignOverlap,[]);assert.deepEqual(scope.missing,[]);assert.deepEqual(scope.wrongMode,[]);
const r={status:'runtime-and-tests-passed-awaiting-exact-git-snapshot',sourceAdmitted:false,searchVersion:m.searchVersion,valueModel:m.valueModel,manifest:mp,manifestSha256,scope:D+'production-runtime-scope-20261107-v1.json',
 sourceBase:scope.sourceBase,verifiedFrozenInputs:Object.keys(runtime).length,scannedTrackedRuntimeAssetTools:scope.tracked,changedTrackedFiles:scope.changed,newTestFiles:scope.unknown,rootCases:g.cases,distinctRoots:known.size,maxNativeInputs:g.maxNativeInputs,maxMilliseconds:g.maxMilliseconds,defaultGlobalBudgetsRemainNull:true,rootAndRngUnchanged:true,
 unitPassed:Number(a[1]),fullFlowPassed:1,browserPassed:7,inputAudit:{passed:65,knownLegacyAomomoFailure:bad[0]},firstTwoHistoricalRoots:304,firstTwoHistoricalActionsChanged:first2.changedActions,firstTwoHistoricalValuesChanged:first2.changedValues,actualFirstTwoAssetsValidated:false,unchangedRanksVersusV322:parity.paired,scanMenuControls:3744,baseline:'V41',newAutonomousRuns:0,
 evidenceSha256:Object.fromEntries([...evidence].sort().map(p=>[p,digest(p)]))};
fs.writeFileSync(D+'source-admission-precheck-20261107-v1.json',JSON.stringify(r,null,2)+'\n',{flag:'wx'});
const {evidenceSha256,...summary}=r;console.log(JSON.stringify({...summary,evidenceFiles:Object.keys(evidenceSha256).length}));
