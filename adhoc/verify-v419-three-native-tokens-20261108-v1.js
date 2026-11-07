'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const demand=load('randomizer/game/ai/resource-demand'),data=load('randomizer/game/data');
const [source,out,expected]=process.argv.slice(2),f=read(source),base=f.compositionEnvelope,seat=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inputPort.enumerateActions({});
const owner=s=>s.players.players.find(q=>q.id===seat);
try{
 assert(c.lifecycle.restore(base).ok);const before=JSON.parse(base.committedState),p=owner(before);
 const goal={...demand.catalog({state:before,seatId:seat,requirements:{bluePlacements:data.listBluePlacementRequirements(p)},actions:menu()}).find(g=>g.kind==='income'),incomeCardId:'card-60-0'};
 assert(goal);const funded=demand.dataIncomeFunding({state:before,seatId:seat,goal,actions:menu(),maxCorners:3});assert(funded&&funded.corners.length===3);
 assert.deepEqual(save(),base);
 for(const step of funded.corners){
  const a=menu().find(x=>x.actionId===step.actionId&&x.target?.cardInstanceId===step.cardId);
  assert(a);assert(c.inputPort.submitQuickAction(a).ok);assert(!save().session);
 }
 const real=JSON.parse(save().committedState),native=owner(real),projected=owner(funded.state);
 assert.deepEqual(projected.resources,native.resources);
 assert.deepEqual(projected.hand,native.hand);
 const projectedTokens=projected.dataState.poolTokens.map(t=>t.id),nativeTokens=native.dataState.poolTokens.map(t=>t.id);
 const exact=JSON.stringify(projected.dataState)===JSON.stringify(native.dataState);
 assert.equal(exact,expected==='exact');
 if(exact){assert.deepEqual(projected.dataState,native.dataState);assert.equal(funded.state.meta.sequences.dataToken,real.meta.sequences.dataToken);}
 else assert.equal(new Set(projectedTokens).size,projectedTokens.length-1);
 assert(c.lifecycle.restore(base).ok);assert.deepEqual(save(),base);
 const result={exact,projectedTokens,nativeTokens,payments:funded.corners,projectedSequence:funded.state.meta.sequences.dataToken,nativeSequence:real.meta.sequences.dataToken,rootAndRngRestored:true};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}finally{c.dispose();}
