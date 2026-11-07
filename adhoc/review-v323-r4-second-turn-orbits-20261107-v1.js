'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const load=p=>require(path.join(process.cwd(),p)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const D='reports/ai-foundation-20261107/',P=D+'committed-computer-recovery-v323-v1/source-manifest-20261107-v1.json',m=read(P),seat='player-white',seed='seti-free-analyze-v1';
for(const [p,h] of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(p),h,p);
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),{getResourceGoalRequirements}=load('randomizer/game/production-kernel'),{passiveAgent}=load('tools/research-human405-round1'),rocket=load('randomizer/game/abilities/rocket');
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,env=()=>c.lifecycle.save().envelope,s=()=>env().session?.session?.workingState||JSON.parse(env().committedState),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const root=env(),source=process.argv[3],prior=read(source),sourceRows=prior.rows,rows=[];let inputs=0;
try{
 const variants=[['blue1','venus',0],['purple2','venus',2],['blue1','uranus',2]];
 for(const [line,planet,trades] of variants){
  const row=sourceRows.find(r=>r.line===line),route=row.probes.find(r=>r.family==='orbit'&&r.planet===planet);
  assert(c.lifecycle.restore(row.checkpoint).ok);assert.deepEqual(env(),row.checkpoint);
  const actor=()=>s().players.players.find(p=>p.id===seat),actions=[];
  function use(family,match){
   const a=menu().filter(a=>a.family===family&&a.actorId===seat&&match(a));assert.equal(a.length,1,JSON.stringify({family,menu:menu().map(q=>[q.family,q.target])}));
   const d=c.inspect().session?.decision,q=a[0],r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:q}):q.phase==='quick'?c.inputPort.submitQuickAction(q):c.inputPort.submitAction(q);
   assert(r.ok,JSON.stringify(r));inputs++;actions.push({id:q.actionId,family:q.family,actor:q.actorId,target:q.target,wallet:actor().resources});
  }
  const snapshots=()=>{const o=c.projection({role:'player',playerId:seat}).state,p=actor();return{wallet:p.resources,income:p.income,final:o.publicState.players.find(p=>p.playerId===seat).finalScore,
   handSize:p.hand.length,orbiting:p.id&&s().pieces.rockets.filter(q=>q.playerId===seat).map(q=>[q.id,q.surface,q.planetId]),knownHeld:p.hand.filter(q=>row.hand.some(([id])=>id===q.id)).map(q=>[q.id,q.cardId])};};
  const before=snapshots();assert.equal(before.wallet.score,row.wallet.score);
  for(let i=0;i<trades;i++)use('quick_trade',a=>a.target.tradeId==='credits-for-energy');
  for(const [deltaX,deltaY] of route.path){use('move',a=>a.target.rocketId===6&&a.target.deltaX===deltaX&&a.target.deltaY===deltaY);if(c.inspect().session?.decision)use('choose_payment',a=>a.target.choiceId==='energy');}
  use('orbit',a=>a.target.rocketId===6&&a.target.planetId===planet);
  if(planet==='venus'&&line==='blue1')use('choose_card',a=>a.target.cardInstanceId===row.hand.find(([,id])=>id==='b_111.webp')[0]&&a.target.choiceId.startsWith('income:'));
  if(planet==='uranus'){
   // Only a public scan menu is used after the native blind draw. None of
   // the newly drawn card identities become choices or estimates here.
   const d=c.inspect().session?.decision;
   if(d){const a=menu().find(q=>q.family==='choose_target'&&q.target.nebulaId);assert(a);use(a.family,q=>q.actionId===a.actionId);}
  }
  const after=snapshots();assert.equal(after.wallet.score-before.wallet.score,route.benefit.score);
  assert(!c.inspect().session?.decision);rows.push({line,planet,route,trades,actions,before,after,checkpoint:env()});
 }
 assert(c.lifecycle.restore(root).ok);assert.deepEqual(env(),root);
 const out={scope:'Execute only the recorded fixed Venus orbit for both next-white roots, plus Blue1 Uranus. Use the prescribed shortest path, known trades and already-held B111 only; no decision conditions on the Uranus blind draws.',source,sourceSha256:sha(source),manifest:P,manifestSha256:sha(P),inputs,rows,rootAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(process.argv[2],JSON.stringify(out)+'\n',{flag:'wx'});
 console.log(JSON.stringify(rows.map(({line,planet,before,after,actions})=>({line,planet,before,after,actions:actions.map(q=>q.family)}))));
}finally{c.dispose();}
