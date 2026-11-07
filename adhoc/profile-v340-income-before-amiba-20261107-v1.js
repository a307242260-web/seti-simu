'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),values=require('../randomizer/game/ai/state-value'),agent=require('../randomizer/game/ai/search-agent');
const [label,fixture]=process.argv.slice(2);assert(/^[a-z0-9-]+$/.test(label));assert(fixture);const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const candidatePath=process.env.SETI_CANDIDATE_SOURCE_MANIFEST||null,candidate=candidatePath?JSON.parse(fs.readFileSync(candidatePath)):null;const overlayPath=process.env.SETI_CANDIDATE_VALIDATION_OVERLAY||null,overlay=overlayPath?JSON.parse(fs.readFileSync(overlayPath)):null;
if(overlay){assert(candidate);assert.equal(overlay.sourceManifest,candidatePath);assert.equal(overlay.sourceManifestSha256,sha(candidatePath));assert.equal(overlay.runtimeChanged,false);for(const[p,h]of Object.entries(overlay.validationSourceHashes)){assert(p.endsWith('.test.js')||['tools/audit_v_state_inputs.js','tools/browser-smoke-inventory.js'].includes(p));assert.equal(overlay.originalSourceHashes[p],candidate.sourceHashes[p]);assert.equal(sha(p),h,p);}}
if(candidate){assert.equal(candidate.searchVersion,search.VERSION);for(const[p,h]of Object.entries(candidate.sourceHashes))assert.equal(sha(p),overlay?.validationSourceHashes[p]||h,p);}else assert.equal(search.VERSION,'seti-complete-decision-search-v189','uncommitted candidates need their frozen source manifest');
const f=JSON.parse(fs.readFileSync(fixture)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
const inspector=require('node:inspector'),session=new inspector.Session(),post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(err,ret)=>err?reject(err):resolve(ret)));
(async()=>{
 session.connect();try{
  await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:250});await post('Profiler.start');
  const root=p.openRoot(),evaluate=values.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET});
  const {profile}=await post('Profiler.stop');assert.deepEqual(c.lifecycle.save().envelope,before);assert(r.complete);assert.deepEqual(r.unresolved,[]);assert.equal(r.diagnostics.nativeExecutions,106);assert.equal(r.actionId,'play_card:cb499bba');assert.equal(r.value,125);
  const raw=z.gzipSync(JSON.stringify(profile)+'\n'),fout=process.argv[4],summary=process.argv[5];fs.writeFileSync(fout,raw,{flag:'wx'});
  const ns=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map(profile.nodes.flatMap(n=>(n.children||[]).map(c=>[c,n.id]))),self=new Map(),inclusive=new Map();
  const key=n=>{const f=n.callFrame;return f.url.split('/').at(-1)+':'+(f.lineNumber+1)+' '+(f.functionName||'(anonymous)');},add=(m,k,w)=>m.set(k,(m.get(k)||0)+w);
  profile.samples.forEach((id,i)=>{
   const weight=profile.timeDeltas[i]/1000;add(self,key(ns.get(id)),weight);const counted=new Set();
   for(let n=id;n;n=parents.get(n)){const name=key(ns.get(n));if(!counted.has(name)){add(inclusive,name,weight);counted.add(name);}}
  });
  const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,45).map(([frame,ms])=>({frame,ms:Number(ms.toFixed(3))}));
  fs.writeFileSync(summary,JSON.stringify({scope:'V340 instrumented sample from root open through complete decision; stack times overlap and are not acceptance timing',fixture,profileSha256:sha(fout),samples:profile.samples.length,nativeInputs:106,selection:r.actionId,value:r.value,rootAndRngUnchanged:true,leaf:top(self),inclusive:top(inclusive)},null,2)+'\n',{flag:'wx'});
 }finally{session.disconnect();p.close();c.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
