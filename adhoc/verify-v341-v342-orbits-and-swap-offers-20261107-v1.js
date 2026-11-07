'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const W='reports/ai-foundation-20261107/',D=W+'v342-swap-offer-public-context-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(p)),digest=b=>crypto.createHash('sha256').update(b).digest('hex'),sha=p=>digest(fs.readFileSync(p)),unzip=p=>z.gunzipSync(fs.readFileSync(p));
function take(v){
 const e=read(F+'v'+v+'-cold-income-before-amiba-20261107-v1.json');assert.equal(sha(e.rawPath),e.rawSha256);
 assert(e.rootAndRngUnchanged&&e.complete);assert.equal(e.nativeInputs,106);assert.equal(e.value,125);
 const g=JSON.parse(unzip(e.rawPath).toString().replace(/seti-complete-decision-search-v(?:340|341|342)/g,'version'));delete g.diagnostics.milliseconds;
 return {e,g};
}
const [original,...versions]=[340,341,342].map(take);
for(const x of versions){assert.equal(x.e.fixtureSha256,original.e.fixtureSha256);assert.deepEqual(x.g,original.g);assert.equal(sha(x.e.candidateSourceManifest),x.e.candidateSourceManifestSha256);}
const input=read(D+'offer-input-parity-20261107-v1.json').counts;
assert.equal(input.offers,177);assert.equal(input.sourceExact,177);assert.equal(input.maskedRow,48);
const ro=D+'v323-r4-second-turn-mission-roots-20261107-v1.json.gz',native=JSON.parse(unzip(ro)),moves=JSON.parse(unzip(D+'v323-r4-second-turn-orbits-20261107-v1.json.gz'));
assert.equal(sha(native.source),native.sourceSha256);assert.equal(digest(unzip(ro)),moves.sourceSha256);
assert(native.rootAndRngRestored&&moves.rootAndRngRestored);assert.equal(native.newAutonomousRuns+moves.newAutonomousRuns,0);
assert.equal(native.inputs+moves.inputs,35);
const summary=moves.rows.map(r=>({line:r.line,planet:r.planet,nativeInputs:r.actions.length,score:r.after.wallet.score,addedScore:r.after.wallet.score-r.before.wallet.score,credits:r.after.wallet.credits,energy:r.after.wallet.energy,publicity:r.after.wallet.publicity,handSize:r.after.handSize,knownHeld:r.after.knownHeld,finalIfStopped:r.after.final,trades:r.trades}));
assert.deepEqual(summary.map(r=>[r.score,r.addedScore,r.credits,r.energy,r.publicity,r.handSize,r.finalIfStopped,r.trades]),[[100,9,5,1,5,1,130,0],[102,9,2,0,2,0,132,2],[102,11,1,0,6,5,132,2]]);
const purple=native.rows.find(r=>r.line==='purple2'),blue=native.rows.find(r=>r.line==='blue1'),route=r=>r.probes.find(g=>g.planet==='uranus'&&g.family==='orbit'),funding=r=>({needed:route(r).movementCost+route(r).cost.energy,capacity:r.wallet.energy+Math.floor((r.wallet.credits-route(r).cost.credits)/2)});
assert.deepEqual([funding(blue),funding(purple)],[{needed:5,capacity:5},{needed:6,capacity:4}]);
console.log(JSON.stringify({fullGraphV340V341V342Exact:true,roots:versions.map(x=>({version:x.e.searchVersion,coldMs:x.e.milliseconds,nativeInputs:x.e.nativeInputs,gatePassed:x.e.decisionGatePassed})),swapOffers:input,secondTurn:summary,uranusWithWalletOnly:{blue1:funding(blue),purple2:funding(purple)},nativeInputs:35,rootAndRngRestored:true,newAutonomousRuns:0}));
