(async()=>{
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),inspector=require('node:inspector');
const stage='/private/tmp/seti-v319-income-before-amiba-probe-20261107-v1/',R='reports/ai-foundation-20261107/',D=R+'income-before-amiba-v319-hotspots-v1/',manifest=R+'income-before-amiba-probe-v319-v1/source-manifest-20261107-v1.json';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const m=read(manifest),evidence='reports/ai-foundation-20261105/third-round-teacher-v1/v319-cold-income-before-amiba-20261107-v1.json',r=read(evidence),f=read(r.fixture);
assert.equal(r.candidateSourceManifestSha256,sha(manifest));assert.equal(r.fixtureSha256,sha(r.fixture));assert.equal(r.rawSha256,sha(r.rawPath));
for(const[p,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(stage+p),h,p);
const {createSimulationRuleComposition}=require(stage+'randomizer/training/simulation-rule-composition'),{createSeededRandom}=require(stage+'randomizer/game/random'),{buildRuleObservation}=require(stage+'randomizer/app/rule-observation'),{createAnalysisPort}=require(stage+'randomizer/game/ai/analysis-port'),search=require(stage+'randomizer/game/ai/decision-search'),values=require(stage+'randomizer/game/ai/state-value'),agent=require(stage+'randomizer/game/ai/search-agent');
const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),evaluate=values.createStateValueEvaluator(f.seatId),session=new inspector.Session();session.connect();
const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(e,r)=>e?reject(e):resolve(r)));
try{
 await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});await post('Profiler.start');
 const out=search.searchDecision({port:p,root:p.openRoot(),evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET});
 const {profile}=await post('Profiler.stop'),old=JSON.parse(z.gunzipSync(fs.readFileSync(r.rawPath)));
 const rank=x=>[x.actionId,x.value,x.realization,x.preparationDebt,x.lines[0].distance];assert.deepEqual(rank(out),rank(old));assert(out.complete);for(const key of ['roots','lines','sharedPrefixGraph','candidates','unresolved'])assert.deepEqual(JSON.parse(JSON.stringify(out[key])),old[key],key);assert.equal(out.diagnostics.nativeExecutions,r.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);
 const name=D+'v319-income-before-amiba-runtime-20261107-v1.cpuprofile';fs.writeFileSync(name,JSON.stringify(profile),{flag:'wx'});
 const by=new Map(profile.nodes.map(n=>[n.id,n])),par=new Map(profile.nodes.flatMap(n=>(n.children||[]).map(c=>[c,n.id]))),incl=new Map(),self=new Map();
 function add(m,k,x){m.set(k,(m.get(k)||0)+x);}
 function label(i){const{functionName:f,url:u,lineNumber:l}=by.get(i).callFrame;return f+' '+u.split('/').slice(-2).join('/')+':'+(l+1);}
 profile.samples.forEach((s,i)=>{const time=profile.timeDeltas[i]/1000,set=new Set();add(self,label(s),time);for(let t=s;t;t=par.get(t))set.add(label(t));for(const k of set)add(incl,k,time);});
 const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([name,ms])=>({name,ms:Math.round(ms*1000)/1000}));
 const result={scope:'CPU sample attribution only. Existing first cold result remains authoritative and is not overwritten. No acceptance sample or autonomous game.',manifest,manifestSha256:sha(manifest),existingColdEvidence:evidence,rank:rank(out),nativeInputs:out.diagnostics.nativeExecutions,samples:profile.samples.length,profile:name,profileSha256:sha(name),self:top(self),inclusive:top(incl)};
 const outFile=D+'v319-income-before-amiba-runtime-hotspots-20261107-v1.json';fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({outFile,profile:name,nativeInputs:result.nativeInputs,self:result.self.slice(0,11)}));
}finally{session.disconnect();p.close();c.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
