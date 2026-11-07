'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),[proofFile,dest]=process.argv.slice(2),proof=read(proofFile),record=read(proof.record),save=read(proof.save),seat='player-white',seed=record.seed;
assert(proof.completed&&proof.nativeRoundAndFinalStateSessionRngExact);assert.equal(sha(proof.record),proof.recordSha256);assert.equal(sha(proof.save),proof.saveSha256);assert.equal(sha(proof.checkpoint),proof.checkpointSha256);
const start=read(proof.checkpoint).roundStarts[3],wanted=new Set([151,159,165,167,185,188,190,191,197,201]);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
const snap=()=>c.lifecycle.save().envelope;
try{assert(c.lifecycle.restore(start.envelope).ok);const original=snap(),rows=[];let inputs=0;
 for(let step=start.beforeInput;step<=201;step++){
  const stored=save.replaySteps[step-1],d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({}),a=actions.find(x=>x.actorId===stored.actorPlayerId&&x.actionId===stored.action.actionId);
  assert(a,'missing legal action at '+step);assert.deepEqual(JSON.parse(JSON.stringify(a.target)),stored.action.target);
  if(wanted.has(step)){
   const choice=record.metrics.searches.find(x=>x.step===step);assert(choice&&choice.actionId===a.actionId);
   const fixture=dest+'/v371-actual-r3-before-'+step+'-root-20261107-v1.json';
   fs.writeFileSync(fixture,JSON.stringify({seatId:seat,source:{seed,record:proof.record,recordSha256:proof.recordSha256,proof:proofFile,input:step},compositionEnvelope:snap()},null,2)+'\n',{flag:'wx'});
   rows.push({step,fixture,fixtureSha256:sha(fixture),chosen:a.actionId,value:choice.value,oldNativeInputs:choice.diagnostics.nativeExecutions});
  }
  if(step===201)break;
  const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(r.ok);inputs++;
 }
 assert.equal(rows.length,wanted.size);assert(c.lifecycle.restore(original).ok);assert.deepEqual(snap(),original);
 const result={scope:'Exact Native replay from previously verified actual R3 start; retain seven before-action roots for counterfactuals, no new search or game.',rows,inputs,rootAndRngUnchanged:true,newAutonomousRuns:0};
 fs.writeFileSync(dest+'/v371-actual-r3-focused-roots-20261107-v1.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({checkpoints:rows.length,inputs,rootAndRngUnchanged:true}));
}finally{c.dispose();}
