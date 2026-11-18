'use strict';
// Unique instrumented identity diagnostic, never an admission timing retry.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict'),os=require('node:os'),cp=require('node:child_process');
const R=path.resolve(__dirname,'..'),M=path.join(R,'reports/ai-foundation-20261118'),out=path.join(M,'v513-quiet-reuse-diagnostic-20261118-v1.json.gz'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(fs.existsSync(out)){console.log('REUSE',out);process.exit(0);}
const parentPath=path.join(M,'r4-browser-cargo-checks-source-20261118-v1.json'),parent=JSON.parse(fs.readFileSync(parentPath)),runtime=fs.mkdtempSync(path.join(os.tmpdir(),'seti-v513-quiet-diagnostic-20261118-'));
cp.execFileSync('cp',['-cR',parent.runtime+'/.',runtime]);
for(const [p,h] of Object.entries({...parent.unchangedParentPaths,...parent.changedPaths}))assert.equal(sha(fs.readFileSync(path.join(runtime,p))),h);
const file=path.join(runtime,'randomizer/game/ai/analysis-port.js'),base=fs.readFileSync(file,'utf8'),needle='    function quietFinalValue(node){';assert.equal(base.split(needle).length,2);
const wrapper=`    function quietFinalValue(node){
      const started=performance.now(),result=uncachedQuietFinalValue(node),elapsed=performance.now()-started,stored=nodes.get(node);
      globalThis.__setiQuietReuseObserver({status:node.status,boundary:node.boundary,envelope:stored.envelope,
        knowledge:cardKnowledgeKey(stored.envelope),barrier:stored.informationBarrier,result,elapsed});
      return result;
    }
    function uncachedQuietFinalValue(node){`;
fs.writeFileSync(file,base.replace(needle,wrapper));
const patch={file:'randomizer/game/ai/analysis-port.js',beforeSha256:sha(Buffer.from(base)),afterSha256:sha(fs.readFileSync(file)),needle,wrapper};
const referencePath=path.join(M,'r4-main-owned-point289-v513-20261118-v1.json.gz'),reference=JSON.parse(z.gunzipSync(fs.readFileSync(referencePath))),envelopes=new WeakMap(),barriers=new WeakMap(),groups=new Map(),rawGroups=new Map(),rows=[];let nextEnvelope=0,nextBarrier=0;
globalThis.__setiQuietReuseObserver=({status,boundary,envelope,knowledge,barrier,result,elapsed})=>{
 if(!envelopes.has(envelope))envelopes.set(envelope,++nextEnvelope);if(barrier&&!barriers.has(barrier))barriers.set(barrier,++nextBarrier);
 const key=JSON.stringify([envelopes.get(envelope),status,boundary,knowledge,barrier?barriers.get(barrier):null]),rawKey=sha(Buffer.from(JSON.stringify([envelope,status,boundary,knowledge,barrier]))),resultHash=sha(Buffer.from(JSON.stringify(result)));
 const row={envelopeId:envelopes.get(envelope),status,boundary,knowledge,barrierId:barrier?barriers.get(barrier):null,key,rawKey,resultHash,available:result!==null,milliseconds:elapsed};rows.push(row);
 for(const [map,k]of [[groups,key],[rawGroups,rawKey]]){let group=map.get(k);if(!group){group={key:k,calls:0,available:result!==null,resultHash,milliseconds:0,repeatMilliseconds:0,resultConsistent:true};map.set(k,group)}else{group.repeatMilliseconds+=elapsed;if(group.resultHash!==resultHash)group.resultConsistent=false;}group.calls++;group.milliseconds+=elapsed;}
};
process.chdir(runtime);const {open}=require(path.join(R,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1/native-root-harness-20261118-v1.cjs')),m=open(reference.root);
const result={kind:'Exact-envelope/context reuse diagnostic; instrumentation cost is not admission timing',parentManifestSha256:sha(fs.readFileSync(parentPath)),referenceSha256:sha(fs.readFileSync(referencePath)),driverSha256:sha(fs.readFileSync(__filename)),patch,runtime,rows};
try{
 const q=m.automatic();result.search={complete:q.complete,native:q.n,value:q.value,graphNodes:q.lines.length,actionId:q.a.actionId,wireGraphSha256:sha(Buffer.from(JSON.stringify(q.lines))),wireRootsSha256:sha(Buffer.from(JSON.stringify(q.roots)))};
 result.exactEnvelopeGroups=[...groups.values()];result.rawEnvelopeGroups=[...rawGroups.values()];result.newDiagnosticSearches=1;result.newGames=0;
 result.graphAndRootsExact=result.search.wireGraphSha256===sha(Buffer.from(JSON.stringify(reference.search.lines)))&&result.search.wireRootsSha256===sha(Buffer.from(JSON.stringify(reference.search.roots)));
 const summary=list=>({calls:list.reduce((n,g)=>n+g.calls,0),unique:list.length,repeatedCalls:list.reduce((n,g)=>n+g.calls-1,0),availableCalls:list.filter(g=>g.available).reduce((n,g)=>n+g.calls,0),availableRepeatedCalls:list.filter(g=>g.available).reduce((n,g)=>n+g.calls-1,0),milliseconds:list.reduce((n,g)=>n+g.milliseconds,0),repeatMilliseconds:list.reduce((n,g)=>n+g.repeatMilliseconds,0),consistent:list.every(g=>g.resultConsistent)});
 result.exactSummary=summary(result.exactEnvelopeGroups);result.rawSummary=summary(result.rawEnvelopeGroups);fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));
 assert(result.graphAndRootsExact&&q.complete&&q.n===69&&q.value===239.5);assert(result.exactSummary.consistent&&result.rawSummary.consistent);console.log(JSON.stringify({output:out,search:result.search,exact:result.exactSummary,raw:result.rawSummary}));
}catch(error){result.failure={message:error.message,stack:error.stack};fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));throw error;}
finally{delete globalThis.__setiQuietReuseObserver;m.dispose();}
