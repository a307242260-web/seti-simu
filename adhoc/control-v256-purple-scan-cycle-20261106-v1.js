'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),source=F+'v253-first-tech-pair-native-control-20261106-v1.json',old=read(source),currentRoot=read(F+'v256-standard-r3-native-verification-prefix-20261106-v1.checkpoint.json').prefixes[125],original=read(old.source).prefixes[125],out=F+'v256-purple-scan-cycle-control-20261106-v1.json';assert.deepEqual(original,currentRoot);assert(!fs.existsSync(out));
const card=(family,id)=>({family,target:{cardInstanceId:id}}),family=f=>({family:f}),choice=id=>({target:{choiceId:id}}),match=(a,s)=>(!s.family||a.family===s.family)&&Object.entries(s.target||{}).every(([k,v])=>a.target?.[k]===v);
// Predeclared preparation, shared by both lines. Newly revealed cards cannot
// become funding. Any unplanned multi-choice decision stops for inspection.
const plan=[family('place_data'),choice('data:computer'),choice('income:card-51-0'),family('place_data'),choice('data:blueBonus:2'),family('place_data'),choice('data:computer'),family('place_data'),choice('data:computer'),card('play_card','card-58-0'),family('end_turn'),family('analyze')];
const result={scope:'Same actual125 root. Independently replay each old fixed first-scan line, verify full endpoint, then same known DLC31 credit income, blue1 payout, fill computer, DLC27 energy, analysis purpose. This does not claim autonomous performance or purple2 superiority. No AI query; bounded256 total Native inputs, no state merging or guessed-card funding.',source,sourceSha256:sha(source),plan,globalNativeInputLimit:256,nativeInputs:0,branches:{},newAutonomousRuns:0};
const save=()=>fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
for(const tile of ['purple1','purple2']){
 const seed='seti-free-analyze-v1',k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,b={steps:[],beforeFirstScan:original};result.branches[tile]=b;assert(c.lifecycle.restore(original).ok);
 const submit=a=>{assert(result.nativeInputs<256);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));result.nativeInputs++;return r;};
 const actions=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 try{
  for(const expected of old.branches[tile].steps){const a=actions().find(a=>a.actionId===expected.actionId&&a.actorId===expected.actorId);assert(a);for(const key of ['schemaVersion','family','phase','actorId','target','payload'])assert.deepEqual(a[key],expected[key]);submit(a);}
  assert.deepEqual(c.lifecycle.save().envelope,old.branches[tile].envelope);b.firstScanEndpointNativeExact=true;b.initialEnvelope=c.lifecycle.save().envelope;save();
  for(let i=0;i<plan.length;i++){
   const a=actions().find(a=>match(a,plan[i]));if(!a){b.stoppedBeforePlanIndex=i;break;}
   submit(a);b.steps.push(a);b.envelope=c.lifecycle.save().envelope;save();
  }
  b.completePredeclaredPlan=b.steps.length===plan.length;b.envelope=c.lifecycle.save().envelope;b.pending=actions().map(a=>({actionId:a.actionId,family:a.family,target:a.target,summary:a.summary}));b.observation=c.projection({role:'player',playerId:'player-white'}).state;assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);b.rootAndRngRestored=true;save();console.log(JSON.stringify({tile,steps:b.steps.length,complete:b.completePredeclaredPlan,pending:b.pending,player:b.observation.publicState.players.find(p=>p.playerId==='player-white')}));
 }finally{c.dispose();}
}
