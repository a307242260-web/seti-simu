'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {createSeededRandom}=load('randomizer/game/random');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const [newRecordPath,oldRecordPath,fixturePath,metadataPath,rawPath,out]=process.argv.slice(2);
const current=read(newRecordPath),prior=read(oldRecordPath),f=read(fixturePath),meta=read(metadataPath);
assert.equal(meta.rawSha256,sha(rawPath));assert.equal(meta.fixtureSha256,sha(fixturePath));
const cold=JSON.parse(zlib.gunzipSync(fs.readFileSync(rawPath)));
assert(cold.complete);assert.equal(cold.actionId,'research_tech:806ccfc8');assert.equal(cold.value,158.5);
const sNew=read(current.savePath),sOld=read(prior.savePath),sameInputs=178,seat='player-white',seed=current.seed;
const first=read(current.roundEnds[1].checkpointPath).coreState.compositionEnvelope;
const oldSecond=read(prior.roundEnds[1].checkpointPath).coreState.compositionEnvelope;
assert.deepEqual(first,oldSecond);
const startInput=current.roundEnds[1].beforeInput;
assert.deepEqual(sNew.replaySteps.slice(0,sameInputs).map(e=>[e.actorPlayerId,e.action]),sOld.replaySteps.slice(0,sameInputs).map(e=>[e.actorPlayerId,e.action]));
const stateOf=e=>e.session?.session?.workingState||JSON.parse(e.committedState);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function observe(envelope){
  const state=stateOf(envelope),p=state.players.players.find(q=>q.id===seat),v=c.projection({role:'player',playerId:seat}).state;
  return {round:state.turn.roundNumber,score:p.resources.score,tech:p.techState,income:p.income,wallet:p.resources,
    hand:p.hand.map(q=>[q.id,q.cardId]),data:p.dataState,probes:state.pieces.rockets.filter(q=>q.playerId===seat),
    wins:state.data.sectorSettlements.winsByPlayerId[seat]||[],traces:v.selfState.traceCounts,
    finalProjected:v.publicState.players.find(q=>q.playerId===seat).finalScore};
}
function replay(source,begin,end){
  const rows=[];
  for(let index=begin;index<end;index++){
    const step=source.replaySteps[index-1],d=c.inspect().session?.decision,before=save(),
      menu=d?.choices||c.inputPort.enumerateActions({}),a=menu.find(q=>q.actionId===step.action.actionId&&q.actorId===step.actorPlayerId);
    assert(a,'action no longer legal at input '+index);
    for(const prop of ['schemaVersion','family','actorId','phase','target','payload']) {
      assert.deepEqual(a[prop]===undefined?undefined:JSON.parse(JSON.stringify(a[prop])),step.action[prop],index+':'+prop);
    }
    const response=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
      :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
    assert(response.ok,JSON.stringify(response));const after=save();
    rows.push({index,action:a,before:observeAfterRestore(before),after:observe(after)});
  }
  return rows;
}
function observeAfterRestore(before){
  const after=save();
  assert(c.lifecycle.restore(before).ok);
  const result=observe(before);
  assert(c.lifecycle.restore(after).ok);
  return result;
}
try{
  assert(c.lifecycle.restore(first).ok);
  const prefix=replay(sNew,startInput,179),root=save();
  assert.deepEqual(root,f.compositionEnvelope);assert.equal(prefix.length,179-startInput);
  const rows={};
  for(const [label,record,source]of [['V375-legal-fixed-route',prior,sOld],['V397-actual-route',current,sNew]]){
    assert(c.lifecycle.restore(root).ok);
    const endInput=record.roundEnds[2].beforeInput,steps=replay(source,179,endInput),terminal=save();
    assert.equal(source.replaySteps[endInput-1].action.family,'pass');
    assert.deepEqual(terminal,read(record.roundEnds[2].checkpointPath).coreState.compositionEnvelope);
    rows[label]={fromInput:179,beforePass:endInput,steps,assets:observe(terminal),checkpoint:record.roundEnds[2].checkpointPath,envelope:terminal};
  }
  assert(c.lifecycle.restore(root).ok);assert.deepEqual(save(),root);
  const proof={scope:'One exact Native root and two already-recorded action paths, independently submitted to current Production. No search or standard run.',
    rootInput:179,prefixCount:prefix.length,sourceCheckpoint:current.roundEnds[1].checkpointPath,fixtureSha256:sha(fixturePath),rawSearchSha256:sha(rawPath),
    sameRound2Envelope:true,sameRootStateSessionRng:true,oldAndNewLegalWithCurrentProduction:true,
    selectedCold:{actionId:cold.actionId,value:cold.value,nativeInputs:cold.diagnostics.nativeExecutions},prefix,root,rows,newAutonomousRuns:0};
  fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({rootInput:179,prefixCount:prefix.length,rows:Object.fromEntries(Object.entries(rows).map(([label,q])=>[label,{inputs:q.steps.length,score:q.assets.score,tech:Object.keys(q.assets.tech.ownedTiles),income:q.assets.income,probes:q.assets.probes.length,wins:q.assets.wins.length,foldedFinal:q.assets.finalProjected}]))}));
}finally{c.dispose();}
