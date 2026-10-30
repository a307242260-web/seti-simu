'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const native=require('../randomizer/game/production-kernel'),{createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const scenario=require('../tools/research-human405-round1');
const fixture='adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json',f=JSON.parse(fs.readFileSync(fixture));
const output='reports/ai-foundation-20261023/requested-owner-native-land-cost-counterexample-20261031-v1.json';
assert(!fs.existsSync(output),'Reuse native counterexample');
const seed=f.source.seed,k=native.createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,
 trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const original=c.lifecycle.save().envelope,fork=c.counterfactualPort.createFork(original,{branchKey:'requested-owner-cost',restoreRandomState:true}),n=fork.composition||fork;
const seat='player-green',steps=[];
const snapshot=()=>n.lifecycle.save().envelope;
const working=()=>{const e=snapshot();return e.session?.session?.workingState||JSON.parse(e.committedState);};
const fees=()=>Object.fromEntries(n.projection({role:'player',playerId:seat}).state.probeRouteRequirements.candidates
 .filter(r=>r.endpointFamily==='land'&&r.endpointTarget.type==='planet').map(r=>[r.planetId,r.endpointFacts.cost.energy]));
try{
 const initial=working(),before=fees();assert.equal(initial.turn.currentPlayerId,'player-blue');
 assert(initial.players.players.find(p=>p.id===seat).techState.ownedTiles.orange3);
 for(let i=0;i<30;i++){
  const state=working(),d=n.inspect().session?.decision;if(!d&&state.turn.currentPlayerId===seat)break;
  const legal=d?.choices||n.inputPort.enumerateActions({}),actor=d?.ownerId||state.turn.currentPlayerId;
  let a;
  if(!d){assert.notEqual(actor,seat);a=legal.find(a=>a.family==='pass');}
  else{
   const observation=n.projection({role:'player',playerId:actor}).state;
   try{const pick=scenario.passiveAgent(actor).decide({seatId:actor,legalActions:legal,observation});a=legal.find(a=>a.actionId===pick.actionId);}
   catch(error){assert(legal.every(a=>a.phase==='conditional'));a=[...legal].sort((a,b)=>a.actionId.localeCompare(b.actionId))[0];}
  }
  assert(a);const r=d?n.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):n.inputPort.submitAction(a);assert(r.ok);
  steps.push({actor,family:a.family,target:a.target,summary:a.summary});
 }
 const final=working(),after=fees();assert.equal(final.turn.currentPlayerId,seat);assert.equal(n.inspect().session,null);
 assert.deepEqual(initial.planets,final.planets);assert.deepEqual(initial.players.players.find(p=>p.id===seat).techState,final.players.players.find(p=>p.id===seat).techState);
 const compared=Object.keys(before).filter(id=>after[id]!=null);assert(compared.length>=5);
 assert(compared.every(id=>before[id]===after[id]+1),'current v99 uses the foreign current actor to quote the requested green owner');
 assert.deepEqual(c.lifecycle.save().envelope,original);
 const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
 fs.writeFileSync(output,JSON.stringify({schemaVersion:'seti-native-requested-owner-cost-defect-v1',sourceCommit:'0dc7785da8a4dce7bc81eabbb7dc92dcf6faf58f',sourceHashes,fixture,fixtureSha256:sha(fixture),
  requestedOwner:seat,ownOrange3:true,actualCurrentActorBefore:initial.turn.currentPlayerId,actualCurrentActorAfter:final.turn.currentPlayerId,before,after,compared,
  nativeInputs:steps.length,steps,planetMarkersAndRequestedTechnologyUnchanged:true,sourceRootAndRngUnchanged:true,runtimeDefectConfirmed:true,
  finding:'Requested green landing quotes are one energy too high while another seat is current. Native PASS-only advancement changes neither planet markers nor green technology; own-turn quotes then apply the native orange3 discount.',
  scope:'A read-only requested-owner projection counterexample plus isolated native PASS/mandatory inputs. Not an autonomous game or patched native state.'},null,2)+'\n');
 console.log(JSON.stringify({output,inputs:steps.length,before,after,defect:true}));
}finally{n.dispose();c.dispose();}
