'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const [rootFile,normalPrefix,normalTail,maskedPrefix,maskedTail,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const f=read(rootFile),seed=f.source.seed,seat=f.seatId;
function run(label,prefixFile,tailFile,score){
 const p=read(prefixFile),t=read(tailFile),a=p.rows[0],b=t.rows[0],original=f.compositionEnvelope;
 assert.equal(t.lateProofSha256,sha(prefixFile));assert.equal(t.lateRow,a.name);
 assert.equal(p.amiba3FixtureSha256,sha(rootFile));assert.equal(t.amiba3FixtureSha256,sha(rootFile));assert(a.independentReplayExact&&b.independentReplayExact);
 const start=structuredClone(original);
 if(label==='swap-first-unrevealed-pair'){
  const x=JSON.parse(start.committedState),d=x.cards.drawPileCardIds;assert.deepEqual(p.changedDrawIds,d.slice(0,2));
  [d[0],d[1]]=[d[1],d[0]];start.committedState=JSON.stringify(x);
 }else assert.equal(p.changedDrawIds,null);
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
 const save=()=>c.lifecycle.save().envelope;
 try{
  assert(c.lifecycle.restore(start).ok);assert.deepEqual(save(),start);
  const endpoints=[a,b];
  for(const r of endpoints){for(const x of r.path){const d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({});
   const y=actions.find(q=>q.actorId===seat&&q.actionId===x.id);assert(y);assert.deepEqual(y.target,x.target);
   const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:y})
    :y.phase==='quick'?c.inputPort.submitQuickAction(y):c.inputPort.submitAction(y);assert(result.ok);
  }assert.deepEqual(save(),r.endpoint);}
  assert(c.inputPort.enumerateActions({}).some(x=>x.actorId===seat&&x.family==='pass'));
  const s=JSON.parse(save().committedState),player=s.players.players.find(x=>x.id===seat),v=c.projection({role:'player',playerId:seat}).state;
  const asset={score:player.resources.score,income:player.income,resources:player.resources,technology:player.techState,
   probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],data:player.dataState,hand:player.hand,
   traceCounts:v.selfState.traceCounts,projectedFinal:v.publicState.players.find(x=>x.playerId===seat).finalScore};
  assert.equal(asset.score,score);assert.equal(asset.projectedFinal,score+48);
  assert.equal(Object.keys(asset.technology.ownedTiles).length,6);assert.deepEqual([asset.income.credits,asset.income.energy,asset.income.handSize,asset.income.additionalPublicScan],[7,4,2,1]);
  assert.deepEqual(asset.data.placedTokens.map(x=>[x.placementKind,x.placementSlot]),[1,2,3,4].map(n=>['computer',n]));
  assert.equal(asset.wins.length,3);assert.equal(asset.probes.length,1);assert.equal(asset.hand.length,0);
  assert(c.lifecycle.restore(original).ok);assert.deepEqual(save(),original);
  return {label,sha256:{prefix:sha(prefixFile),tail:sha(tailFile)},assets:asset,inputs:a.path.length+b.path.length,exactIntermediateAndEndpoint:true};
 }finally{c.dispose();}
}
const rows=[run('actual-order',normalPrefix,normalTail,110),run('swap-first-unrevealed-pair',maskedPrefix,maskedTail,109)];
const proof={rootFile,rootSha256:sha(rootFile),rows,rootAndRngRestored:true,scope:'Same exact pre-input-179 Native source and one explicit hidden-order control. Only recorded legal inputs, no AI and no PASS or next income committed.',newAutonomousFirst3Runs:0};
if(out)fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(r=>({name:r.label,inputs:r.inputs,score:r.assets.score,projected:r.assets.projectedFinal,exact:r.exactIntermediateAndEndpoint}))));
