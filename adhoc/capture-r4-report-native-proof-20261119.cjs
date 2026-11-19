'use strict';
// Observe the standard HTML report replay in the parent process only.
// The agent runner subprocess is untouched; no extra replay or AI run occurs.
if(process.argv[1]?.endsWith('robot_iterate.js')){
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
 const root=path.resolve(__dirname,'..'),file=path.join(root,'randomizer/training/simulation-rule-composition.js'),api=require(file),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 require.cache[require.resolve(file)].exports={...api,createSimulationRuleComposition(options){
  const kernel=api.createSimulationRuleComposition(options),core=kernel.composition;let reporting=false,inputs=0;
  const port=new Proxy(core.inputPort,{get(target,key){
   const fn=target[key];if(key==='beginDrain')return arg=>{reporting=arg?.metadata?.source==='report-enrich';return fn(arg)};
   if(['submitAction','submitQuickAction','submitDecision'].includes(key))return(...args)=>{const result=fn(...args);if(reporting&&result.ok)inputs++;return result};
   return fn;
  }});
  return{...kernel,composition:new Proxy(core,{get(target,key){return key==='inputPort'?port:target[key]}}),dispose(){
   try{if(reporting){
    const records=fs.readdirSync(path.join(root,'reports/research')).filter(p=>p.endsWith('.full.json')).map(p=>({path:p,record:JSON.parse(fs.readFileSync(path.join(root,'reports/research',p)))}));
    const active=records.find(x=>x.record.name==='teacher-r4-free-blind-control-20261119');assert(active&&active.record.terminal);
    const record=active.record,save=JSON.parse(fs.readFileSync(path.join(root,record.savePath))),actual=core.lifecycle.save().envelope;
    assert.equal(inputs,save.replaySteps.length);assert(inputs+9<=400,'Registered report exceeded the route Native verification budget');
    assert.deepEqual(JSON.parse(actual.committedState),JSON.parse(save.committedState));assert.deepEqual(actual.session,save.session);
    const out=path.join(root,'reports/ai-foundation-20261119/teacher-r4-free-pick-report-native-proof-20261119-v1.json');assert(!fs.existsSync(out));
    fs.writeFileSync(out,JSON.stringify({schemaVersion:'seti-r4-free-pick-report-native-proof-v1',verified:true,inputs,nativeStateAndRngExactlyEqual:true,sessionExactlyEqual:true,record:'reports/research/'+active.path,savePath:record.savePath,nativeStateSha256:hash(actual.committedState),reusedStandardReportReplay:true,newAISearches:0,newGames:0},null,2)+'\n');
   }}finally{kernel.dispose?.()}
  }};
 }};
}
