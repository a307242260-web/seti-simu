'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),util=require('node:util');
const R='reports/ai-foundation-20261107/',D=R+'committed-computer-recovery-v323-v1/',p=R+'teacher-r3-after-amiba-scan-coordinate-v322-v1/serial-cold-gate-20261107-v1.json',n=D+'serial-cold-gate-20261107-v1.json';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),prior=read(p),next=read(n);
assert(prior.status==='complete'&&['complete','failed-gate'].includes(next.status));
const oldRows=new Map(prior.rows.map(r=>[r.identity,r])),done=new Set(),changes=[];
const normalize=x=>x.replace(/seti-complete-decision-search-v(?:322|323)/g,'seti-complete-decision-search');
function parse(row){const x=read(row.evidence);assert(x.complete&&x.rootAndRngUnchanged);assert.equal(x.rawSha256,sha(x.rawPath));return JSON.parse(normalize(z.gunzipSync(fs.readFileSync(x.rawPath)).toString('utf8')));}
for(const r of next.rows){
 if(done.has(r.identity))continue;done.add(r.identity);
 const o=oldRows.get(r.identity),a=parse(o),b=parse(r),changed=['roots','lines','sharedPrefixGraph','candidates','unresolved','planEvidence'].filter(k=>!util.isDeepStrictEqual(a[k],b[k]));
 const valueRank=x=>[x.actionId,x.value,x.realization,x.preparationDebt,x.lines[0].distance];
 if(changed.length||!util.isDeepStrictEqual(valueRank(a),valueRank(b))||o.nativeInputs!==r.nativeInputs)
  changes.push({label:r.label,prior:o.evidence,current:r.evidence,priorInputs:o.nativeInputs,currentInputs:r.nativeInputs,
    priorRank:valueRank(a),currentRank:valueRank(b),changed});
}
assert.equal(done.size,next.measuredUniqueRoots);
const result={scope:'Saved first-sample Native graphs, compare 322 vs 323. Exact committed computer prefixes may replace a value-only tail. No reruns.',prior:p,priorSha256:sha(p),current:n,currentSha256:sha(n),status:next.status,paired:done.size,changed:changes,changedRanks:changes.filter(x=>!util.isDeepStrictEqual(x.priorRank,x.currentRank)).length,newAutonomousRuns:0};
fs.writeFileSync(D+'v322-v323-raw-graph-comparison-20261107-v1.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({paired:done.size,changed:changes.length,changedRanks:result.changedRanks,status:next.status}));
