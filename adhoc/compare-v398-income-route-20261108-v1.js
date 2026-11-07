'use strict';
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{evaluateStateValue}=load('randomizer/game/ai/state-value');
const [proofFile,archiveFile,out]=process.argv.slice(2),proof=read(proofFile),archive=JSON.parse(z.gunzipSync(fs.readFileSync(archiveFile)));
const root=proof.root,seat='player-white',seed=JSON.parse(root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function summary(index){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),q=s.players.players.find(v=>v.id===seat),o=c.projection({role:'player',playerId:seat}).state;
 return {index,wallet:q.resources,income:q.income,tech:q.techState,hand:q.hand.map(h=>[h.id,h.cardId]),data:q.dataState,
  probes:s.pieces.rockets.filter(q=>q.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],traces:o.selfState.traceCounts,
  projectedFinal:o.publicState.players.find(x=>x.playerId===seat).finalScore,estimate:evaluateStateValue(o,seat).total,
  publicOffer:o.publicState.board.cards?.publicCards??o.publicState.publicCards??s.cards.publicCards.map(x=>x?[x.id,x.cardId]:null)};
}
try{
 const rows={};
 for(const mode of ['normal','masked']){
  const prefix=JSON.parse(archive.checkpoints[mode+'Prefix'].json),tail=JSON.parse(archive.checkpoints[mode+'Tail'].json);
  const start=structuredClone(root);
  if(mode==='masked'){
   const state=JSON.parse(start.committedState),deck=state.cards.drawPileCardIds;
   assert.deepEqual(prefix.changedDrawIds,deck.slice(0,2));[deck[0],deck[1]]=[deck[1],deck[0]];start.committedState=JSON.stringify(state);
  }else assert.equal(prefix.changedDrawIds??null,null);
  restore(start);const route=[],ends=[];
  for(const record of [prefix.rows[0],tail.rows[0]]){
   for(const step of record.path){
    const d=c.inspect().session?.decision,a=menu().find(q=>q.actorId===seat&&q.actionId===step.id);assert(a,step.id);assert.deepEqual(a.target,step.target);
    const before=summary(178+route.length);
    const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
     :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(result.ok,JSON.stringify(result));
    const after=summary(179+route.length);route.push({action:a,before,after});
    if(a.family==='end_turn')ends.push(after);
   }
   assert.deepEqual(save(),record.endpoint);
  }
  assert(menu().some(a=>a.family==='pass'&&a.actorId===seat));
  const atEnd=summary(178+route.length),envelope=save();rows[mode]={route,ends,atEnd,envelope};
 }
 restore(root);assert.deepEqual(rows.normal.route[0].action,rows.masked.route[0].action);
 const brief=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{actions:v.route.length,first:v.route[0].action.summary,
  turns:v.ends.map(x=>[x.index,x.wallet.score,x.estimate,x.income.credits,x.income.energy,x.wallet.availableData]),
  final:[v.atEnd.wallet.score,v.atEnd.income.credits,v.atEnd.income.energy,v.atEnd.projectedFinal],incomeSteps:v.route.filter(x=>x.after.income.credits!==x.before.income.credits||x.after.income.energy!==x.before.income.energy).map(x=>[x.after.index,x.action.summary])}]));
 fs.writeFileSync(out,JSON.stringify({scope:'Two existing fixed income routes replayed from the exact V397 R179 state and compared at each turn on current scoring. No searches.',sourceSha256:sha(proofFile),routeArchiveSha256:sha(archiveFile),rows,brief,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(brief));
}finally{c.dispose();}
