'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const original=Module._extensions['.js'];
const traced={};
Module._extensions['.js']=function(m,filename){
 if(!filename.endsWith('/randomizer/game/ai/analysis-port.js')&&!filename.endsWith('/randomizer/game/effects/session-runtime.js'))return original(m,filename);
 let s=fs.readFileSync(filename,'utf8');
 if(filename.endsWith('/analysis-port.js')){
  const anchor='const failure = result?.failure || result;\n        throw new Error';
  assert(s.includes(anchor));s=s.replace(anchor,`const failure = result?.failure || result;
        traced.action = {current, failure: {code:failure.code,message:failure.message,type:failure.type,effectId:failure.effectId}, keys:Object.keys(failure)};
        throw new Error`);
 }else{
  const a='if (!result || result.ok !== true || !("nextState" in result)) {',b='if (!executor || typeof executor.execute !== "function") {';
  assert(s.includes(a)&&s.includes(b));
  const log=`traced.effect = {type:effect.type,kind:effect.kind,ownerId:effect.ownerId,payload:effect.payload,actions:session.journal.actions.map(x=>x.action?.summary)};`;
  s=s.replace(a,a+log+`traced.effect.response=result&&{ok:result.ok,code:result.code,message:result.message,keys:Object.keys(result)};`).replace(b,b+log);
 }
 m._compile('const traced=globalThis.__setiV661Diagnostic;\n'+s,filename);
};
globalThis.__setiV661Diagnostic=traced;
const {createEnvironment}=require(path.resolve('tools/research-free-analyze-random20'));
for(const n of ['2f9eb996','6c4f1f97','22c44c19']){
 delete traced.action;delete traced.effect;
 const cp=JSON.parse(fs.readFileSync('reports/research/'+n+'.d39dd7a2.full.json.failed-checkpoint.json')),env=createEnvironment();
 try{
  env.loadCheckpoint(cp);
  const before=env.createCheckpoint();
  try{env.runAgentDecision();throw Error('expected failure');}catch(e){assert(e.message.includes('ANALYSIS_EXECUTION_FAILED'));console.log(JSON.stringify({n,error:e.message,...traced}));}
  assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,before.coreState.compositionEnvelope);
 }finally{env.dispose();}
}
