'use strict';
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict');
const root=process.cwd(),load=n=>require(path.join(root,n)),read=n=>JSON.parse(fs.readFileSync(n));
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const {createSeededRandom}=load('randomizer/game/random'),data=load('randomizer/game/data'),{passiveAgent}=load('tools/research-human405-round1');
const [fixtures,out]=process.argv.slice(2),x=JSON.parse(z.gunzipSync(fs.readFileSync(fixtures))),r=read(x.record),s=read(r.savePath);
const origin=x.snapshots[248].envelope,seat='player-white',seed=r.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
const state=()=>{const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState)};
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function facts(){
 const t=state(),p=t.players.players.find(p=>p.id===seat);
 return {round:t.turn.roundNumber,active:t.turn.currentPlayerId,board:p.resources.score,wallet:p.resources,income:p.income,
  hand:p.hand.map(c=>[c.id,c.cardId]),computer:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),
  blue:data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot),tech:p.techState,probes:t.pieces.rockets.filter(r=>r.playerId===seat),
  marks:t.finalScoring,rng:t.meta.rngState};
}
function execute(reference,accepted){
 const actions=menu(),d=c.inspect().session?.decision;
 const a=actions.find(a=>a.actionId===reference.actionId&&a.actorId===reference.actorId);assert(a,reference.summary);
 assert.deepEqual(a.target,reference.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));accepted.push(a);
}
const savedAction=i=>s.replaySteps[i-1].action;
function run(bank){
 restore(origin);const accepted=[];
 if(!bank)for(let i=248;i<=256;i++)execute(savedAction(i),accepted);
 execute(savedAction(257),accepted);
 const beforePass=facts(),beforePassEnvelope=save();
 if(!bank)assert.deepEqual(beforePassEnvelope,x.snapshots[258].envelope);
 execute(savedAction(258),accepted);execute(savedAction(259),accepted);
 assert.equal(state().turn.roundNumber,4);
 for(let i=0;i<28;i++){
  const actions=menu(),actor=actions[0]?.actorId;assert(actor);
  if(actor===seat){assert(!c.inspect().session);break;}
  const d=passiveAgent(actor).decide({legalActions:actions,observation:c.projection({role:'player',playerId:actor}).state});
  const a=actions.find(a=>a.actionId===d.actionId);assert(a);execute(a,accepted);
 }
 assert.equal(state().turn.currentPlayerId,seat);
 const opening=facts();
 if(bank)for(let i=248;i<=256;i++){
  const old=savedAction(i),a=menu().find(a=>a.family===old.family&&JSON.stringify(a.target)===JSON.stringify(old.target));
  assert(a,old.summary);execute(a,accepted);
 }
 const end=facts(),endEnvelope=save();
 restore(origin);const again=[];for(const a of accepted)execute(a,again);assert.deepEqual(save(),endEnvelope);restore(origin);
 return {bank,accepted,beforePass,beforePassEnvelope,opening,end,endEnvelope,replayExact:true};
}
try{
 const rows=[run(false),run(true)],a=rows[0],b=rows[1];
 const changes=Object.keys(a.end).filter(key=>JSON.stringify(a.end[key])!==JSON.stringify(b.end[key]));
 fs.writeFileSync(out,z.gzipSync(JSON.stringify({scope:'From actual V654 input 248, bank four data into R4, then fill the same slots for the same held income card before the first white R4 main. No AI decisions or future draw used.',newAutonomousRuns:0,rows,changes})),{flag:'wx'});
 console.log(JSON.stringify({changes,rows:rows.map(r=>({bank:r.bank,inputs:r.accepted.length,beforePass:r.beforePass.wallet,opening:r.opening.wallet,end:r.end.wallet,income:r.end.income,hand:r.end.hand,computer:r.end.computer}))}));
}finally{c.dispose();}
