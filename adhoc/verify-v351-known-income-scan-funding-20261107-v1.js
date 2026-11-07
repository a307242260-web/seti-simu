'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const dir='reports/ai-foundation-20261107/v351-known-income-scan-funding-v1/',fixture=dir+'v323-r3-income-166-public-energy-20261107-v1.raw.json.gz';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),root=JSON.parse(zlib.gunzipSync(fs.readFileSync(fixture)));
const manifest=JSON.parse(fs.readFileSync(dir+'source-manifest-20261107-v1.json'));for(const [p,h]of Object.entries({...manifest.baseRuntimeHashes,...manifest.sourceHashes}))assert.equal(sha(p),h,p);
assert.equal(sha(root.source),root.sourceSha256);assert.equal(sha(root.sourceManifest),root.sourceManifestSha256);
const load=name=>require(path.resolve('randomizer',name)),{createSimulationRuleComposition}=load('training/simulation-rule-composition'),{createSeededRandom}=load('game/random');
const record=JSON.parse(fs.readFileSync(root.source)),seatId=record.scenario.learnerSeat,seed=record.seed;
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});kernel.newGame({seed});const c=kernel.composition;
const make=load('game/ai/card-pick-planning').createCardPickPlanner,planner=make();
try{
 const envelope=root.before.envelope;assert(c.lifecycle.restore(envelope).ok);const saved=c.lifecycle.save().envelope;assert.deepEqual(saved,envelope);
 const d=c.inspect().session.decision;const session=envelope.session.session;assert.deepEqual(session.queue.map(q=>q.type),['science_domain_pick_card']);
 assert.deepEqual(d.choices.map(a=>a.actionId).sort(),root.choices.map(a=>a.actionId).sort());
 const {workingState:state}=session,own=s=>s.players.players.find(p=>p.id===seatId),p=own(state),choose=(s,actions=d.choices)=>planner.plan({state:s,seatId,actions,status:'decision',session});
 const before=JSON.stringify(state),money=root.choices.find(x=>x.gain.credits).actionId,energy=root.choices.find(x=>x.gain.energy).actionId;
 const proof=choose(state);assert.equal(proof.selectedActionId,energy);assert.equal(proof.goal.id,'income:computer:4');assert.deepEqual(proof.retainedActionIds,[energy]);assert.equal(proof.isEquivalence,false);
 assert.equal(choose(state).selection.cache,'hit');assert.equal(JSON.stringify(state),before);assert.deepEqual(c.lifecycle.save().envelope,saved);
 const variants=[
  ['standard-scan-already-funded',(s,p)=>{p.resources.energy=2;}],
  ['income-does-not-close-the-gap',(s,p)=>{p.resources.credits=1;}],
  ['opponent-still-active',s=>{s.turn.passedPlayerIds.pop();}],
  ['purple4-disabled',(s,p)=>{p.techState.disabledTiles.purple4=true;}],
  ['probe-already-in-flight',s=>{s.pieces.rockets.push({surface:'solar-board',kind:'standard',playerId:seatId});}],
  ['income-too-late',s=>{s.turn.roundNumber=4;}],
  ['main-action-still-open',(s,p)=>{p.mainActionCompleted=false;}],
  ['anonymous-hand-card',(s,p)=>{p.resources.handSize=1;}],
  ['offer-not-known',s=>{s.cards.publicCards.find(x=>x.id===root.choices.find(q=>q.actionId===energy).id).hidden=true;}],
 ];
 const results=variants.map(([name,alter])=>{const s=structuredClone(state);alter(s,own(s));const r=choose(s);assert.equal(r.selectedActionId,money,name);return{name,selected:r.selectedActionId};});
 assert.equal(choose(state,d.choices.filter(a=>a.actionId!==energy)).selectedActionId,money);
 assert.equal(choose(state).selectedActionId,energy,'Wallet and visibility differences must not alias the fixed selection cache');
 const out={fixture,fixtureSha256:sha(fixture),candidateManifestSha256:sha(dir+'source-manifest-20261107-v1.json'),old:money,candidate:energy,goal:proof.goal,publicOffers:root.choices,wallet:p.resources,guards:results,rootAndRngUnchanged:true,searchNodesAdded:0,newAutonomousRuns:0};
 fs.writeFileSync(dir+'income-166-selection-verification-20261107-v1.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(out));
}finally{c.dispose();}
