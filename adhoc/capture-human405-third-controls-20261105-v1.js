'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationEnv}=require('../randomizer/app/simulation-env');
const d='reports/ai-foundation-20261105/third-round-teacher-v1';
const read=p=>JSON.parse(fs.readFileSync(p));
function writeOrVerify(p,value){if(fs.existsSync(p))assert.deepEqual(read(p),JSON.parse(JSON.stringify(value)));else fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n');}
for(const [n,label]of [[113,'first-white'],[120,'after-amiba-reveal']]){
 const cp=d+'/teacher-before-input-'+n+'-20261105-v1.checkpoint.json',fixture=d+'/teacher-r3-'+label+'-20261105-v1.json';
 const checkpoint=read(cp);if(!fs.existsSync(fixture))writeOrVerify(fixture,{source:{seed:'seti-free-analyze-v1',checkpoint:cp,historicalInput:n},seatId:'player-white',compositionEnvelope:checkpoint.coreState.compositionEnvelope});
 else assert.deepEqual(read(fixture).compositionEnvelope,checkpoint.coreState.compositionEnvelope);
}
const env=createSimulationEnv();try{
 env.loadCheckpoint(read(d+'/teacher-before-input-120-20261105-v1.checkpoint.json'));
 const old=read('seti-saves/seti-save-537-merged.json').replaySteps[119],a=env.legalActions().find(a=>a.actionId===old.action.actionId);assert(a);assert(env.step(a).ok);
 const cp=env.createCheckpoint(),p=d+'/teacher-r3-before-safety-protocol-20261105-v1.checkpoint.json',f=d+'/teacher-r3-before-safety-protocol-root-20261105-v1.json';
 if(fs.existsSync(p))assert.deepEqual(read(p).coreState.compositionEnvelope,cp.coreState.compositionEnvelope);else writeOrVerify(p,cp);
 if(fs.existsSync(f))assert.deepEqual(read(f).compositionEnvelope,cp.coreState.compositionEnvelope);
 else writeOrVerify(f,{source:{seed:'seti-free-analyze-v1',checkpoint:p,historicalInput:121,nativeInputsFromFrozen120:1},seatId:'player-white',compositionEnvelope:cp.coreState.compositionEnvelope});
 console.log(JSON.stringify({threeNativeRootsCapturedOrExactReused:true,nativeInputs:1,policyQueries:0}));
}finally{env.dispose();}
