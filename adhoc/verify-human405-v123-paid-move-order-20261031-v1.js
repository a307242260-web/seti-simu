'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const fixture='adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-025-20261030-v1.json',f=JSON.parse(fs.readFileSync(fixture)),output='reports/ai-foundation-20261023/human405-v123-paid-move-order-20261030-v1.json',existing=fs.existsSync(output)?JSON.parse(fs.readFileSync(output)):null;
const rows=existing?.rows||[];
for(const name of existing?[]:['teacher-pay-then-move','student-move-then-pay']){
 const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
 try{
  const nativeSteps=[];
  function legal(){return c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});}
  function submit(a){assert(a);const d=c.inspect().session?.decision,result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(result.ok,JSON.stringify(result));nativeSteps.push({family:a.family,summary:a.summary,target:a.target});}
  if(name==='teacher-pay-then-move'){
   submit(legal().find(a=>a.actionId===f.source.teacherActionId));
   submit(legal().find(a=>a.target?.rocketId===3&&a.target.deltaX===0&&a.target.deltaY===1));
  }else{
   submit(legal().find(a=>a.family==='move'&&a.target?.rocketId===3&&a.target.deltaX===0&&a.target.deltaY===1));
   submit(legal().find(a=>a.family==='choose_payment'&&a.summary==='消耗 1 能量'));
  }
  const envelope=c.lifecycle.save().envelope;assert.equal(envelope.session,null);
  rows.push({name,nativeSteps,envelope,state:JSON.parse(envelope.committedState),observation:c.projection({role:'player',playerId:f.seatId}).state,legal:legal()});
 }finally{c.dispose();}
}
const differences=[];
function diff(a,b,p=''){
 if(isDeepStrictEqual(a,b))return;
 if(a&&b&&typeof a==='object'&&typeof b==='object')for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p?`${p}.${k}`:k);
 else differences.push({path:p,teacher:a,student:b});
}
diff(rows[0].state,rows[1].state);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
if(existing){assert.equal(existing.fixtureSha256,sha(fixture));for(const[p,h]of Object.entries(existing.sourceHashes))assert.equal(sha(p),h,p);}
sourceHashes['randomizer/game/ai/analysis-port.js']=sha('randomizer/game/ai/analysis-port.js');
const gameState=s=>({...s,match:Object.fromEntries(Object.entries(s.match).filter(([key])=>key!=='decisionVersion'))}),action=a=>Object.fromEntries(Object.entries(a).filter(([key])=>key!=='decisionVersion'));
assert(isDeepStrictEqual(gameState(rows[0].state),gameState(rows[1].state)));
assert(isDeepStrictEqual(rows[0].legal.map(action),rows[1].legal.map(action)));
assert.deepEqual(differences.map(x=>x.path),['match.decisionVersion']);
fs.writeFileSync(output,JSON.stringify({schemaVersion:'seti-paid-move-order-native-control-v1',sourceCommit:'945301446ad6e2198fbf3b9e6a284602d078a037',fixture,fixtureSha256:sha(fixture),sameFormalState:isDeepStrictEqual(rows[0].state,rows[1].state),sameObservation:isDeepStrictEqual(rows[0].observation,rows[1].observation),sameLegalActions:isDeepStrictEqual(rows[0].legal,rows[1].legal),sameRuleStateExcludingInputRevision:true,sameActionsExcludingInputRevision:true,normalizationContract:'Existing AnalysisPort normalization excludes match.decisionVersion. Native actionId also excludes authority versions; actual submitted input must use its own current version.',differences,rows,sourceHashes,scope:'Two native compositions restore exactly the same teacher25 checkpoint, execute two real inputs and settle all effects. Only the input concurrency revision differs; all game facts and RNG are identical. This classifies the two-input paid-move prefix, not future orbit-versus-land strategic targets. Existing checkpoints are reused without new native execution.'},null,2)+'\n');console.log(JSON.stringify({output,reusedNativeCheckpoint:!!existing,sameRuleStateExcludingInputRevision:true,sameActionsExcludingInputRevision:true,differences}));
