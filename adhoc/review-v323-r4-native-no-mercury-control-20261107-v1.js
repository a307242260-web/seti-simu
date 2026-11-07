'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const w=process.cwd(),load=p=>require(path.join(w,p)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const R='reports/ai-foundation-20261107/',sourceDir=R+'v336-fixed-mission-rewards-v1/',manifestPath=R+'committed-computer-recovery-v323-v1/source-manifest-20261107-v1.json',m=read(manifestPath),seat='player-white';
for(const [p,h] of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(p),h,p);
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),cards=load('randomizer/game/cards/deck'),seed='seti-free-analyze-v1';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,env=()=>c.lifecycle.save().envelope,s=()=>env().session?.session?.workingState||JSON.parse(env().committedState),p=()=>s().players.players.find(x=>x.id===seat);
const root=env(),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),rows=[];let nativeInputs=0;
const snapshot=()=>{const x=p(),o=c.projection({role:'player',playerId:seat}).state,player=o.publicState.players.find(x=>x.playerId===seat);return {wallet:x.resources,income:x.income,hand:x.hand.map(c=>[c.id,c.cardId]),computer:x.dataState.placedTokens.map(t=>[t.placementKind,t.placementSlot??t.blueSlot]),forecastFinal:player.finalScore,tech:x.techState,mainActionCompleted:x.mainActionCompleted};};
try{
 const name='v323-purple2-native-scan-launch-20261107-v1.json.gz',sourcePath=sourceDir+name,source=JSON.parse(z.gunzipSync(fs.readFileSync(sourcePath))),chosen=source.outcomes.find(o=>o.use),e=source.before.envelope;
 assert(source.sourceRestored);assert(c.lifecycle.restore(e).ok);assert.deepEqual(env(),e);
 const steps=[];
 function take(f,allowed){
   const a=menu().filter(a=>a.actorId===seat&&a.family===f&&allowed(a));assert.equal(a.length,1,JSON.stringify({f,menu:menu().map(a=>[a.family,a.target])}));
   const d=c.inspect().session?.decision,q=a[0],r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:q}):q.phase==='quick'?c.inputPort.submitQuickAction(q):c.inputPort.submitAction(q);
   assert(r.ok,JSON.stringify(r));nativeInputs++;steps.push({actionId:q.actionId,family:q.family,target:q.target,after:snapshot()});
 }
 for(const a of chosen.actions.slice(0,-1))take(a.family,q=>q.actionId===a.id);
 const boundary=env(),beforeChoice=snapshot(),family=chosen.actions.at(-1).family;
 assert.equal(boundary.session.session.queue[0].payload.options.label,'水星扇区扫描');
 const scopeActions=steps.splice(0);
 take(family,a=>a.target?.skip===true||a.target?.mode==='skip');
 const before=snapshot();
 assert.equal(s().turn.roundNumber,4);assert.equal(s().turn.currentPlayerId,seat);assert(before.mainActionCompleted);
 assert.equal(before.wallet.availableData,2);assert.equal(before.wallet.score,91);
 for(let i=0;i<2;i++){take('place_data',()=>true);take('choose_target',a=>a.target.choiceId==='data:computer');}
 const incomeReward=null,line='purple2-skip-mercury';
 const known=p().hand.find(c=>c.cardId==='b_111.webp');assert(known);
 const heldCorner=cards.getDiscardActionRewardForCard(known);
   const after=snapshot();
  assert.equal(after.computer.length,before.computer.length+2);assert.equal(after.wallet.availableData,0);assert(after.mainActionCompleted);
  assert.equal(after.computer.at(-1)[1],3);assert.equal(env().randomState,e.randomState);
  rows.push({line,source:sourcePath,sourceSha256:sha(sourcePath),beforeChoice,scopeActions,before,steps,incomeReward,heldCorner,after,finalEnvelope:env()});
 assert(c.lifecycle.restore(root).ok);assert.deepEqual(env(),root);
 const result={scope:'Same Purple2 start and same original launch/scan prefix. Skip only Mercury, then place the two actual data tokens in the computer without acquiring new cards.',sourceManifest:manifestPath,sourceManifestSha256:sha(manifestPath),rows,nativeInputs,sourceAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(process.argv[2],JSON.stringify(result)+'\n',{flag:'wx'});
 console.log(JSON.stringify(rows.map(x=>({line:x.line,from:x.before.wallet,to:x.after.wallet,computer:x.after.computer,final:[x.before.forecastFinal,x.after.forecastFinal],income:x.incomeReward,inputs:x.steps.length}))));
}finally{c.dispose();}
