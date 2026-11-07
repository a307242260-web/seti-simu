'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),util=require('node:util');
const R='reports/ai-foundation-20261107/',D=R+'committed-computer-recovery-v323-v1/',oldPath=R+'public-alien-offer-v1/serial-cold-gate-20261107-v1.json',nextPath=D+'serial-cold-gate-20261107-v1.json';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),old=read(oldPath),next=read(nextPath);
assert.equal(old.status,'complete');assert(['complete','failed-gate'].includes(next.status));
const refs=new Map(old.rows.map(r=>[r.identity,r])),details=[],fields=['actionId','value','selectionPlan','selectionContinuation','planContinuation','planEvidence','roots','lines','sharedPrefixGraph','candidates','unresolved'];
function data(row){const e=read(row.evidence);assert.equal(e.rawSha256,sha(e.rawPath));assert.equal(e.fixtureSha256,sha(e.fixture));assert(e.complete&&e.rootAndRngUnchanged);return JSON.parse(z.gunzipSync(fs.readFileSync(e.rawPath)).toString('utf8').replace(/seti-complete-decision-search-v(?:278|323)/g,'seti-complete-decision-search'));}
const verified=new Set();
for(const r of next.rows){
 if(verified.has(r.identity)||!refs.has(r.identity))continue;verified.add(r.identity);
 const f=read(r.fixture),round=JSON.parse(f.compositionEnvelope.committedState).turn.roundNumber;
 if(round>2)continue;
 const before=refs.get(r.identity),[a,b]=[data(before),data(r)],changed=fields.filter(k=>!util.isDeepStrictEqual(a[k],b[k]));
 details.push({label:r.label,round,identity:r.identity,prior:before.evidence,current:r.evidence,priorChoice:a.actionId,currentChoice:b.actionId,priorValue:a.value,currentValue:b.value,changed});
}
assert(details.length>0);
const out={scope:'Cold root regression on observed Native R1/R2 fixtures shared with released V278. Only the search version is normalized. Saved graph behavior does not prove autonomous round assets.',prior:oldPath,priorGateSha256:sha(oldPath),current:nextPath,currentGateSha256:sha(nextPath),candidateGateStatus:next.status,sharedFirstTwoRoots:details.length,changedGraphs:details.filter(d=>d.changed.length).length,changedActions:details.filter(d=>d.priorChoice!==d.currentChoice).length,changedValues:details.filter(d=>d.priorValue!==d.currentValue).length,details,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(D+'first-two-production-comparison-20261107-v1.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({sharedFirstTwoRoots:out.sharedFirstTwoRoots,changedGraphs:out.changedGraphs,changedActions:out.changedActions,changedValues:out.changedValues}));
