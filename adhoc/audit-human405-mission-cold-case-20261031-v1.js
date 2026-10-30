'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),values=require('../randomizer/game/ai/state-value'),agent=require('../randomizer/game/ai/search-agent');
const [label,fixture]=process.argv.slice(2);assert(/^[a-z0-9-]+$/.test(label));assert(fixture);
const version=search.VERSION.split('-').at(-1),output=`reports/ai-foundation-20261023/human405-${version}-cold-${label}-20261031-v1.json`,sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(fs.existsSync(output)){const r=JSON.parse(fs.readFileSync(output));for(const[p,h]of Object.entries(r.sourceHashes))assert.equal(sha(p),h,p);assert.equal(sha(r.rawPath),r.rawSha256);console.log(JSON.stringify({label,reused:true,inputs:r.nativeInputs,ms:r.milliseconds}));process.exit(0);}
const f=JSON.parse(fs.readFileSync(fixture)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope;
const p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{
 const start=performance.now(),root=p.openRoot(),evaluate=values.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET}),milliseconds=performance.now()-start;
 assert(r.complete,r.stopReason);assert.deepEqual(r.unresolved,[]);assert.deepEqual(c.lifecycle.save().envelope,before);
 const rawPath=output.replace('.json','.raw.json.gz');fs.writeFileSync(rawPath,zlib.gzipSync(JSON.stringify(r)+'\n'));
 const report={schemaVersion:'seti-human405-mission-cold-root-v1',baseCommit:'1cd44bde189c9ce26f976bc4c9dd08391ecbde86',candidateAdmitted:false,label,fixture,fixtureSha256:sha(fixture),searchVersion:search.VERSION,valueModel:values.MODEL_VERSION,
  complete:r.complete,actionId:r.actionId,value:r.value,nativeInputs:r.diagnostics.nativeExecutions,milliseconds,diagnostics:r.diagnostics,rootAndRngUnchanged:true,rawPath,rawSha256:sha(rawPath),
  sourceHashes:Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]))};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({label,inputs:report.nativeInputs,ms:milliseconds,complete:r.complete,value:r.value}));
}finally{p.close();c.dispose();}
