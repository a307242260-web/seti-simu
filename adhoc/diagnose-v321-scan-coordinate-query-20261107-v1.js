'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const stage='/private/tmp/seti-v321-income-before-amiba-prepaid-trace-20261107-v1/',R='reports/ai-foundation-20261107/',D=R+'teacher-r3-after-amiba-scan-coordinate-v1/',manifest=R+'income-before-amiba-prepaid-trace-v321-v1/source-manifest-20261107-v1.json';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),m=read(manifest);
const label=process.argv[3]||'teacher-r3-after-amiba-reveal',version=process.argv[2]||'v1';assert(/^v[0-9]+$/.test(version));assert(['teacher-r3-after-amiba-reveal','income-before-amiba','actual-v256-125','actual-v256-132','corpus-case-152'].includes(label));
const reference=manifest;
const ev='reports/ai-foundation-20261105/third-round-teacher-v1/'+'v321'+'-cold-'+label+'-20261107-v1.json',cold=read(ev),f=read(cold.fixture);
assert.equal(cold.candidateSourceManifestSha256,sha(reference));assert.equal(cold.fixtureSha256,sha(cold.fixture));assert.equal(cold.rawSha256,sha(cold.rawPath));
for(const[p,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(stage+p),h,p);
const file=require.resolve(stage+'randomizer/game/effects/science-session'),prototype=D+'science-scan-coordinates-prototype-20261107-'+version+'.js',mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;mod._compile(fs.readFileSync(prototype,'utf8'),file);mod.loaded=true;require.cache[file]=mod;
const {createSimulationRuleComposition}=require(stage+'randomizer/training/simulation-rule-composition'),{createSeededRandom}=require(stage+'randomizer/game/random'),{buildRuleObservation}=require(stage+'randomizer/app/rule-observation'),{createAnalysisPort}=require(stage+'randomizer/game/ai/analysis-port'),search=require(stage+'randomizer/game/ai/decision-search'),values=require(stage+'randomizer/game/ai/state-value'),agent=require(stage+'randomizer/game/ai/search-agent');
const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),evaluate=values.createStateValueEvaluator(f.seatId);
try{
 const start=performance.now(),root=p.openRoot(),out=search.searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET}),ms=performance.now()-start;
 const old=JSON.parse(z.gunzipSync(fs.readFileSync(cold.rawPath))),rank=r=>[r.actionId,r.value,r.realization,r.preparationDebt,r.lines[0].distance];
 assert(out.complete);assert.equal(out.diagnostics.nativeExecutions,cold.nativeInputs);assert.equal(JSON.stringify(rank(out)),JSON.stringify(rank(old)));
 for(const key of ['roots','lines','sharedPrefixGraph','candidates','unresolved'])assert.equal(JSON.stringify(out[key]),JSON.stringify(old[key]),key);
 assert.deepEqual(c.lifecycle.save().envelope,before);
 const result={scope:'Module prototype parity diagnostic. The unchanged V321 cold sample remains authoritative; no new candidate cold acceptance or game.',label,evidence:ev,reference,referenceSha256:sha(reference),fixture:cold.fixture,fixtureSha256:cold.fixtureSha256,manifest,manifestSha256:sha(manifest),prototype,prototypeSha256:sha(prototype),ms,nativeInputs:out.diagnostics.nativeExecutions,rank:rank(out),fullNativeGraphAndRootExact:true,researchWork:values.diagnosticOrderedResearchQuotes(),newAutonomousRuns:0};
 fs.writeFileSync(D+'scan-coordinates-'+label+'-diagnostic-20261107-'+version+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}finally{p.close();c.dispose();}
