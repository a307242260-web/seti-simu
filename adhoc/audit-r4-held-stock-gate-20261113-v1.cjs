'use strict';
const fs=require('fs'),z=require('zlib'),assert=require('assert/strict'),path=require('path'),cp=require('child_process'),Module=require('module');
const file=path.resolve('randomizer/game/ai/analysis-port.js');
let src=cp.execFileSync('git',['show','HEAD:randomizer/game/ai/analysis-port.js'],{encoding:'utf8',maxBuffer:8<<20});
if(process.env.SETI_HELD_POOL_PATCH)src=fs.readFileSync(process.env.SETI_HELD_POOL_PATCH,'utf8');
if(process.env.SETI_HELD_POOL_PROFILE) {
 const prior=src;
 src=src.replace('      loadedEnvelope = null;\n      const executeAt','      globalThis.__heldTrace(current,head,session,loadedEnvelope);\n      loadedEnvelope = null;\n      const executeAt');
 assert.notEqual(src,prior);
}
const residual=path.resolve('randomizer/game/effects/residual-domain-session.js');
const resource=path.resolve('randomizer/game/ai/resource-demand.js');
const old=Module._extensions['.js'];
Module._extensions['.js']=(m,f)=>f===file?m._compile(src,f):f===residual&&process.env.SETI_HELD_POOL_RESIDUAL?m._compile(fs.readFileSync(process.env.SETI_HELD_POOL_RESIDUAL,'utf8'),f):f===resource&&process.env.SETI_HELD_POOL_RESOURCE?m._compile(fs.readFileSync(process.env.SETI_HELD_POOL_RESOURCE,'utf8'),f):old(m,f);
const from=n=>require(path.resolve(n)),white='player-white';
const {createSimulationRuleComposition}=from('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=from('randomizer/app/rule-observation');
const {createSeededRandom}=from('randomizer/game/random');
const {createAnalysisPort}=from('randomizer/game/ai/analysis-port');
const {createSearchAgent}=from('randomizer/game/ai/search-agent');
function open(root){
 const seed=JSON.parse(root.committedState).meta.seed;
 const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
   projectCounterfactualState:(state,v)=>buildRuleObservation(state,seed,v?.playerId||null,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
 kernel.newGame({seed});const c=kernel.composition,save=()=>c.lifecycle.save().envelope;
 const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
 const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 const apply=expected=>{
  const a=menu().find(a=>a.actionId===expected.actionId),d=c.inspect().session?.decision;assert.deepEqual(a,expected);
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(result.ok);return a;
 };
 restore(root);
 function automatic(){
  const port=createAnalysisPort({composition:c,seatId:white,maxCacheEntries:0}),legalActions=menu();
  try{
   const agent=createSearchAgent({seatId:white,analysisPort:port});
   const q=agent.decide({seatId:white,legalActions}).search;
   return {a:legalActions.find(a=>a.actionId===q.actionId),n:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,
     value:q.value,complete:q.complete&&!q.unresolved.length,roots:q.roots,lines:q.lines,diagnostics:q.diagnostics};
  }finally{port.close();}
 }
 return {menu,save,restore,apply,automatic,dispose:()=>c.dispose()};
}
const read=n=>JSON.parse(z.gunzipSync(fs.readFileSync('reports/ai-foundation-20261113/prepass-funded-landing/'+n+'-20261113-v1.json.gz')));
const roots=[...read('r3-standard-last-analysis-partial').groups[0].rows,...read('r3-teacher-paired-stock-terminal').groups[0].rows.slice(0,2)];
const result=[];
for (const i of process.argv.slice(3).map(Number)){
 const {end,name}=roots[i],m=open(end),traces=[];
 globalThis.__heldTrace=(a,h,s,e)=>traces.push({a,h:h?.type,origin:s?.journal.actions[0]?.action?.family,
   originCard:s?.journal.actions[0]?.action?.target?.cardInstanceId,shape:s?.queue.map(q=>q.type),barrier:s?.irreversibleBarrier?.code,e});
 try{
  const verified=[];
  globalThis.__heldYellowCheck=process.env.SETI_HELD_POOL_SKIP_VERIFY?undefined:(root,a,projected)=>verified.push({root,a,projected});
  const q=m.automatic();assert.deepEqual(m.save(),end);
  for(const v of verified){
   m.restore(v.root);m.apply(v.a);
   const real=m.save();
   const diffs=[];
   function cmp(a,b,k){
    if(Object.is(a,b))return;
    if(a&&b&&typeof a==="object"&&typeof b==="object"){
      if(k.endsWith(".undoFrames"))return;
      for(const key of new Set([...Object.keys(a),...Object.keys(b)]))cmp(a[key],b[key],k+"."+key);
    }else diffs.push([k,typeof a==="string"&&a.length>200?a.length:a,typeof b==="string"&&b.length>200?b.length:b]);
   }
   cmp(JSON.parse(v.projected.envelope.committedState),JSON.parse(real.committedState),"base");
   cmp(v.projected.envelope.session,real.session,"session");
   if(diffs.length)throw Error(JSON.stringify(diffs.slice(0,25)));
   assert.deepEqual(v.projected.inspection.session.decision.choices,m.menu());
  }
  m.restore(end);
  console.log('parity',i,verified.length);
  const summary={i,name,n:q.n,ms:q.ms,complete:q.complete,action:q.a?.summary,value:q.value,verified:verified.length,roots:q.roots,
    trace:traces.map(({e,...r})=>r),diagnostics:q.diagnostics,lines:q.lines};
  if(process.env.SETI_HELD_POOL_PROFILE)assert.equal(traces.length,q.n);
  console.log(JSON.stringify([i,name,q.n,q.ms,q.a?.summary,q.value]));
  result.push(summary);
 }finally{m.dispose();}
}
fs.writeFileSync(process.argv[2],z.gzipSync(JSON.stringify(result)),{flag:'wx'});
