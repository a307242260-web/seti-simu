'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),values=require('../randomizer/game/ai/state-value'),{passiveAgent}=require('../tools/research-human405-round1');
const [techSource,purpleDataSource,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const tech=read(techSource),purpleData=read(purpleDataSource),arms=[tech.rows.find(r=>r.tile==='purple2'),purpleData.rows[0],tech.rows.find(r=>r.tile==='orange3')],seat='player-white',seed=JSON.parse(arms[0].end.envelope.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
const save=()=>c.lifecycle.save().envelope,state=()=>{const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState);},actor=()=>state().players.players.find(p=>p.id===seat),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),restore=e=>assert(c.lifecycle.restore(e).ok);
const own=()=>c.inspect().session?.decision?.ownerId||state().turn.currentPlayerId;
const report=()=>{const s=state(),p=actor(),o=c.projection({role:'player',playerId:seat}).state;return{round:s.turn.roundNumber,wallet:p.resources,income:p.income,tech:p.techState,hand:p.hand.map(x=>[x.id,x.cardId]),data:p.dataState,scan:Object.entries(s.data.nebulae).map(([id,b])=>[id,b.tokens.filter(t=>t.replacedByPlayerColor==='white').map(t=>t.slotIndex)]).filter(([,xs])=>xs.length),rockets:s.pieces.rockets.filter(r=>r.playerId===seat),traces:o.selfState.traceCounts,projected:o.publicState.players.find(x=>x.playerId===seat).finalScore,model:values.evaluateStateValue(o,seat).total};};
let inputs=0;
function exec(a){assert(a);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));inputs++;return{actionId:a.actionId,family:a.family,actorId:a.actorId,target:a.target};}
function pick(family,pred=()=>true){const actions=menu().filter(a=>a.family===family&&a.actorId===seat&&pred(a));assert.equal(actions.length,1,JSON.stringify(menu().map(a=>[a.family,a.target])));return exec(actions[0]);}
const results=[];
try{
 for(const arm of arms){restore(arm.end.envelope);const original=save(),entry=[pick('pass')],available=menu().filter(a=>a.family==='choose_card'&&a.actorId===seat).map(a=>a.target.cardId);
  entry.push(pick('choose_card',a=>a.target.cardId==='b_111.webp'));
  for(let i=0;i<12&&own()!==seat;i++){
   const other=own(),o=c.projection({role:'player',playerId:other}).state,id=passiveAgent(other).decide({observation:o,legalActions:menu()}).actionId;
   const a=menu().find(x=>x.actionId===id);assert(a&&a.actorId===other&&(a.family==='pass'||c.inspect().session?.decision?.ownerId===other));entry.push(exec(a));
  }
  assert.equal(state().turn.roundNumber,4);assert.equal(own(),seat);const startEnvelope=save(),start=report(),path=[];
  path.push(pick('scan'),pick('choose_target',a=>a.target.choiceId==='nebula:sector-4-b'),
    pick('choose_card',a=>a.target.choiceId==='public:card-60-0:sector-2-b'),pick('choose_card',a=>a.target.choiceId==='public:done'),
    pick('choose_target',a=>a.target.choiceId==='scan4:skip'));
  if(arm.tile==='purple2'){
   const d=c.inspect().session?.decision;assert(d);
   assert.equal(save().session.session.queue[0].payload.options.label,'水星扇区扫描');
   const targets=menu().filter(a=>!a.target?.skip&&a.target?.mode!=='skip');assert.equal(targets.length,1);path.push(exec(targets[0]));
  }
  assert(!c.inspect().session?.decision);
  const afterScan=report(),afterScanEnvelope=save();
  // Use only already available data; exact same goal, distinct source stock.
  for(let i=0;i<3&&actor().resources.availableData>0;i++){
   path.push(pick('place_data'),pick('choose_target',a=>a.target.target==='computer'));
   if(c.inspect().session?.decision){
    const options=menu().filter(a=>a.family==='choose_card'&&a.target.cardInstanceId===actor().hand.find(c=>c.cardId==='b_111.webp')?.id);
    assert.equal(options.length,1,JSON.stringify(menu()));path.push(exec(options[0]));
   }
  }
  const end=report();results.push({tile:arm.tile,availableReserve:available,entry,start,startEnvelope,path,afterScan,afterScanEnvelope,end,endEnvelope:save()});
  restore(original);assert.deepEqual(save(),original);
 }
 assert(inputs<=80);assert.equal(results.length,3);
 assert(results.slice(1).every(r=>JSON.stringify(r.entry.map(a=>a.actionId))===JSON.stringify(results[0].entry.map(a=>a.actionId))));
 assert(results.slice(1).every(r=>JSON.stringify(r.start.hand)===JSON.stringify(results[0].start.hand)));
 const result={scope:'Three legal R3 endpoints, same known PASS card, same other-seat forced/pass inputs and initial hand, same baseline two R4 scan inputs; Purple2 uses its legal Mercury option, existing data goes to computer and common B111 funds income if reached. No AI or future unknown identity used.',techSource,techSourceSha256:sha(techSource),purpleDataSource,purpleDataSourceSha256:sha(purpleDataSource),inputs,results,rootAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({inputs,rows:results.map(r=>({tile:r.tile,start:r.start.wallet,afterScan:r.afterScan.wallet,end:r.end.wallet,income:r.end.income,computer:r.end.data.placedTokens,projected:r.end.projected}))}));
}finally{c.dispose();}
