'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=process.cwd(),load=n=>require(path.join(root,n)),read=n=>JSON.parse(fs.readFileSync(n));
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {createSeededRandom}=load('randomizer/game/random'),data=load('randomizer/game/data');
const [record,out]=process.argv.slice(2),r=read(record),s=read(r.savePath),seat='player-white',seed=r.seed;
const op=read('reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.json');
const origin=read(op.checkpointPath).coreState.compositionEnvelope;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
const state=e=>e.session?.session?.workingState||JSON.parse(e.committedState);
const white=t=>t.players.players.find(p=>p.id===seat);
function facts(t){
 const p=white(t),u=p.resources;
 return {wallet:[u.score,u.credits,u.energy,u.availableData,u.publicity],income:p.income,hand:p.hand.map(c=>[c.id,c.cardId]),
   knownPublicCards:t.cards.publicCards.map(c=>c&&[c.id,c.cardId]),computer:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),
   blue:data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot),companyUsed:p.industryRoundMarkRound===3,
   probes:t.pieces.rockets.filter(q=>q.playerId===seat).map(q=>[q.id,q.sectorX,q.sectorY,q.fossilId||null])};
}
try{
 assert(c.lifecycle.restore(origin).ok);assert.deepEqual(save(),origin);
 const snapshots={},ledger=[];
 for(let i=23;i<s.replaySteps.length;i++){
  const idx=i+1,e=s.replaySteps[i],envelope=save(),d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({});
  const a=actions.find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);
  assert(a);assert.deepEqual(a.target,e.action.target);
  if([219,227,230,235,242,245,248,258].includes(idx))snapshots[idx]={envelope,menu:actions,publicFacts:facts(state(envelope))};
  const v=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(v.ok,JSON.stringify(v));
  if(idx>=219&&idx<=258&&a.actorId===seat)ledger.push([idx,a.family,a.summary,facts(state(save()))]);
 }
 assert.equal(save().committedState,s.committedState);assert.deepEqual(save().session,s.session);
 const exact=read(r.roundEnds[2].checkpointPath).coreState.compositionEnvelope;
 assert.deepEqual(snapshots[258].envelope,exact);
 fs.writeFileSync(out,zlib.gzipSync(JSON.stringify({record,newAutonomousRuns:0,independentReplayExact:true,snapshots,ledger})),{flag:'wx'});
 console.log(JSON.stringify(Object.fromEntries(Object.entries(snapshots).map(([i,x])=>[i,{wallet:x.publicFacts.wallet,hand:x.publicFacts.hand.map(y=>y[1]),computer:x.publicFacts.computer,blue:x.publicFacts.blue,companyUsed:x.publicFacts.companyUsed}]))));
}finally{c.dispose();}
