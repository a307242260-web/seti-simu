'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),directory=path.join(repo,'reports/ai-foundation-20261119');
const m=JSON.parse(fs.readFileSync(path.join(directory,'blue-income-forecast-prototype-preflight-20261119-v2.json'))),r=m.runtime;
const {createSeededRandom}=require(path.join(r,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(r,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(r,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(r,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(r,'randomizer/game/ai/decision-search'));
const agent=require(path.join(r,'randomizer/game/ai/search-agent')),values=require(path.join(r,'randomizer/game/ai/state-value')),data=require(path.join(r,'randomizer/game/data'));
const original=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(directory,'r2-blue-cash-continued-blue1-after-dlc37-checkpoint-20261119-v1.json.gz')))).envelope;
const seed='seti-free-analyze-v1',seatId='player-white',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const k=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)}),c=k.composition;
const activation=process.argv[2]==='--activation';
const output=path.join(directory,`blue-income-admission-bound-controls-20261119-${activation?'v2':'v1'}.json`);assert(!fs.existsSync(output));
const report={sourceCommit:m.sourceCommit,candidateChangedFiles:m.candidateChangedFiles,
 scope:'Synthetic unit roots derived from the exact Native checkpoint: below first mark, no owned mark, other seats active, main action completed. These are rule-restorable counterexamples, not teaching trajectories or additional autonomous games.',
 budget:{transitions:256,nodes:1024,frontier:256,milliseconds:600},cases:[],newAutonomousGames:0};
let port;
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});
 const variants=activation?[
  {name:'activation-from-computer2',credits:0,energy:0,publicity:3,stock:5,prefix:2},
  {name:'activation-at-currency-caps',credits:6,energy:6,publicity:3,stock:5,prefix:2},
  {name:'activation-via-computer2-publicity',credits:0,energy:0,publicity:2,stock:6,prefix:1},
  {name:'unfunded-after-computer2-publicity',credits:0,energy:0,publicity:1,stock:6,prefix:1},
 ]:[
  {name:'funded-energy-income',credits:1,energy:0,publicity:3,stock:3},
  {name:'no-currency',credits:0,energy:0,publicity:3,stock:3},
  {name:'currency-caps',credits:6,energy:6,publicity:3,stock:3},
  {name:'publicity-and-data-caps',credits:1,energy:0,publicity:11,stock:6},
  {name:'publicity-short',credits:1,energy:0,publicity:2,stock:3},
  {name:'data-short',credits:1,energy:0,publicity:3,stock:2},
  {name:'credit-offer-only',credits:1,energy:0,publicity:3,stock:3,offers:'credit'},
  {name:'no-public-offers',credits:1,energy:0,publicity:3,stock:3,offers:'none'},
 ];
 for(const variant of variants){
  const env=structuredClone(original),state=JSON.parse(env.committedState),owner=state.players.players.find(p=>p.id===seatId);
  Object.assign(owner.resources,{credits:variant.credits,energy:variant.energy,publicity:variant.publicity,score:10});owner.mainActionCompleted=true;
  for(const tile of Object.values(state.finalScoring.tiles))tile.marks=tile.marks.filter(mark=>mark.playerId!==seatId);
  state.turn.passedPlayerIds=[];if(state.passingPlayerIds)state.passingPlayerIds=[];
  if(variant.prefix){
   const removed=owner.dataState.placedTokens.filter(token=>token.placementKind==='computer'&&token.placementSlot>variant.prefix
    ||token.placementKind==='blueBonus'&&token.blueSlot===2);
   owner.dataState.placedTokens=owner.dataState.placedTokens.filter(token=>!removed.includes(token));
   owner.dataState.discardedCount+=removed.length;
  }
  for(const key of Object.keys(owner.blueBonusResources||{}))owner.blueBonusResources[key]=Math.min(owner.blueBonusResources[key],owner.resources[key]);
  while(owner.dataState.poolTokens.length>variant.stock){owner.dataState.poolTokens.pop();owner.dataState.discardedCount++;}
  owner.resources.availableData=owner.dataState.poolTokens.length;
  while(owner.resources.availableData<variant.stock)assert(data.gainData(owner,{root:state}).ok);
  if(variant.offers==='credit')state.cards.publicCards=state.cards.publicCards.map(card=>card?.incomeCode===0?card:null);
  if(variant.offers==='none')state.cards.publicCards=state.cards.publicCards.map(()=>null);
  env.committedState=JSON.stringify(state);assert(c.lifecycle.restore(env).ok);const preserved=c.lifecycle.save().envelope;
  port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  const started=performance.now(),root=port.openRoot(),evaluate=values.createStateValueEvaluator(seatId);
  const result=searchDecision({port,root,evaluate,...agent.OPTIONS,postMainPruning:false,modelKey:evaluate.modelKey,budget:report.budget,
   scanOrbitBudget:{nativeInputs:256,deadline:started+600}});
  const milliseconds=performance.now()-started,bound=port.postMainValueBound(root),rootValue=evaluate(root.observation),diagnostics=port.getDiagnostics();
  const row={...variant,rootSha256:crypto.createHash('sha256').update(env.committedState).digest('hex'),complete:result.complete,
   milliseconds,nativeSubmissions:diagnostics.submissionCount,stopReason:result.stopReason,rootValue,bestValue:result.value,
   bound,boundCoversActual:bound?result.value<=rootValue+bound.maximumValueIncrease:null};
  report.cases.push(row);port.close();port=null;assert.deepEqual(c.lifecycle.save().envelope,preserved);
  if(!result.complete||milliseconds>600||diagnostics.submissionCount>256||row.boundCoversActual===false)break;
 }
 report.completedCases=report.cases.length;
 report.validBounds=report.cases.filter(row=>row.bound).length;
 report.passed=report.completedCases===variants.length&&report.validBounds>0&&report.cases.every(row=>row.complete&&row.milliseconds<=600&&row.nativeSubmissions<=256&&row.boundCoversActual!==false);
 report.sourceRootAndRngPreserved=true;
}catch(error){report.error={name:error.name,message:error.message.slice(0,1500),stack:error.stack.split('\n').slice(-8).join('\n')};report.passed=false;}
finally{port?.close();c.dispose();}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,cases:report.cases.map(({bound,...row})=>({...row,bound:bound&&{proof:bound.proof,increase:bound.maximumValueIncrease,analysisUpper:bound.maximumAnalysisLinear}}))}));
