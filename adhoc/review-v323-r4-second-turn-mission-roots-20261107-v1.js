'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const load=p=>require(path.join(process.cwd(),p)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const D='reports/ai-foundation-20261107/',P=D+'committed-computer-recovery-v323-v1/source-manifest-20261107-v1.json',m=read(P),seat='player-white',seed='seti-free-analyze-v1';
for(const [p,h] of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(p),h,p);
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),{getResourceGoalRequirements}=load('randomizer/game/production-kernel'),{passiveAgent}=load('tools/research-human405-round1'),rocket=load('randomizer/game/abilities/rocket');
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,env=()=>c.lifecycle.save().envelope,s=()=>env().session?.session?.workingState||JSON.parse(env().committedState),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const root=env(),source=D+'v340-income-preview-handoff-v1/v323-r4-native-computer-conversion-20261107-v1.json.gz',sourceRows=JSON.parse(z.gunzipSync(fs.readFileSync(source))).rows,rows=[];let inputs=0;
try{
 for(const row of sourceRows){
  assert(c.lifecycle.restore(row.finalEnvelope).ok);assert.deepEqual(env(),row.finalEnvelope);
  const actions=[];
  function use(a){const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
   assert(r.ok,JSON.stringify(r));inputs++;actions.push({id:a.actionId,family:a.family,actor:a.actorId,target:a.target});
  }
  use(menu().find(a=>a.family==='end_turn'&&a.actorId===seat));
  for(let i=0;i<16;i++){
   const other=c.inspect().session?.decision?.ownerId||s().turn.currentPlayerId;if(other===seat)break;
   const o=c.projection({role:'player',playerId:other}).state,choice=passiveAgent(other).decide({observation:o,legalActions:menu()}).actionId,a=menu().find(a=>a.actionId===choice);
   assert(a.family==='pass'||c.inspect().session?.decision?.ownerId===other);use(a);
  }
  const state=s(),p=state.players.players.find(p=>p.id===seat);assert.equal(state.turn.currentPlayerId,seat);assert.equal(state.turn.roundNumber,4);assert(!p.mainActionCompleted);
  const probes=getResourceGoalRequirements(state,seat).probeCandidates.filter(g=>!g.launchRequired&&g.rocketId!=null).map(g=>({family:g.endpointFamily,target:g.endpointTarget,planet:g.planetId,id:g.requirementId,path:g.path.map(x=>[x.deltaX,x.deltaY]),movementCost:g.required?.movementPoints??g.movementPoints??g.cost??null,benefit:g.targetBenefit,cost:g.endpointFacts.cost}));
  rows.push({line:row.line,actions,wallet:p.resources,hand:p.hand.map(c=>[c.id,c.cardId]),probes,openMenu:menu().map(a=>[a.family,a.target]),checkpoint:env()});
 }
 assert(c.lifecycle.restore(root).ok);assert.deepEqual(env(),root);
 const out={scope:'Two exact next-white roots after only end turn and the other seats PASS or required choices. Native goal requirements shown; no movement enumeration or AI decision.',source,sourceSha256:sha(source),manifest:P,manifestSha256:sha(P),inputs,rows,rootAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(process.argv[2],JSON.stringify(out)+'\n',{flag:'wx'});
 console.log(JSON.stringify(rows.map(({line,wallet,hand,probes})=>({line,wallet,hand,probes:probes.slice(0,12)}))));
}finally{c.dispose();}
