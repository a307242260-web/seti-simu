'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const w=process.cwd(),load=p=>require(path.join(w,p)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),
 {passiveAgent}=load('tools/research-human405-round1'),rules=load('randomizer/game/production-kernel'),effects=load('randomizer/game/cards/effects'),probe=load('randomizer/game/ai/probe-capital'),values=load('randomizer/game/ai/state-value');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',fixturePath=D+'v323-r2-blue1-keep-publicity-r3-root-20261107-v1.json',f=read(fixturePath),
 coldPath='reports/ai-foundation-20261105/third-round-teacher-v1/v323-cold-v323-blue1-keep-publicity-first-r3-20261107-v1.json',cold=read(coldPath),seat=f.seatId,seed=f.source.seed;
assert.equal(sha(fixturePath),cold.fixtureSha256);assert.equal(sha(f.source.control),f.source.controlSha256);assert.equal(sha(cold.rawPath),cold.rawSha256);assert(cold.decisionGatePassed);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const env=()=>c.lifecycle.save().envelope,state=()=>{const e=env();return e.session?.session?.workingState||JSON.parse(e.committedState);};
const current=()=>state().players.players.find(p=>p.id===seat),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const snapshot=()=>{const s=state(),p=current(),o=c.projection({role:'player',playerId:seat}).state;return {round:s.turn.roundNumber,turn:s.turn.turnNumber,wallet:p.resources,income:p.income,hand:p.hand.map(c=>[c.id,c.cardId]),reserve:p.reservedCards.map(c=>c.cardId),tech:p.techState,traceCounts:o.selfState.traceCounts,publicSpecies:o.publicState.board.aliens.slots.map(x=>[x.slotId,x.alienId]),model:values.evaluateStateValue(o,seat),envelope:env()};};
const actions=[];
function act(label,p){
 const aa=menu().filter(p);assert.equal(aa.length,1,label+' '+JSON.stringify(menu().map(a=>[a.family,a.target])));
 const a=aa[0],d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,label+' '+JSON.stringify(r));actions.push({label,id:a.actionId,actor:a.actorId,family:a.family,target:a.target});
}
const own=(label,family,filter=()=>true)=>act(label,a=>a.actorId===seat&&a.family===family&&filter(a));
const proof=read(D+'v323-known-free-landing-native-20261107-v1.json');
const route=()=>rules.getProbeRouteRequirements(state(),seat).candidates.find(g=>g.rocketId===proof.jupiter.rocketId&&g.endpointFamily==='land'&&g.planetId==='jupiter'&&g.endpointTarget.type==='planet');
const payTrade=()=>own('fund exact deficit','quick_trade',a=>a.target.tradeId==='credits-for-energy');
function move(g,steps){for(const p of g.path.slice(0,steps)){
 own('follow fixed route','move',a=>a.target.rocketId===g.rocketId&&a.target.deltaX===p.deltaX&&a.target.deltaY===p.deltaY);
 own('pay exact route energy','choose_payment',a=>a.target.choiceId==='energy');
}}
function reopen(){
 own('end launch turn','end_turn');
 for(let i=0;i<10;i++){
  const s=state(),d=c.inspect().session?.decision,owner=d?.ownerId||s.turn.currentPlayerId;if(owner===seat)break;
  const o=c.projection({role:'player',playerId:owner}).state,legalActions=menu().filter(a=>a.actorId===owner);
  const next=passiveAgent(owner).decide({observation:o,legalActions});act('passive seat contract',a=>a.actorId===owner&&a.actionId===next.actionId);
 }
 assert.equal(state().turn.currentPlayerId,seat);assert.equal(state().turn.roundNumber,3);
}
function run(prefix){
 assert(c.lifecycle.restore(proof.launched.envelope).ok);actions.length=0;const start=snapshot(),g=route();assert.equal(g.required.paidMovementPoints,3);
 if(prefix===3)payTrade();move(g,prefix);reopen();
 const after=snapshot(),next=route();assert(next);const energy=next.required.paidMovementPoints;
 const hand=current().hand.find(a=>a.cardId==='dlc_31.png');assert(hand);const cardFee=effects.getCardPrice(hand),requiredTrades=Math.max(0,energy-after.wallet.energy);
 assert(after.wallet.credits>=2*requiredTrades+cardFee);
 for(let i=0;i<requiredTrades;i++)payTrade();move(next,next.path.length);
 own('play known landing card','play_card',a=>a.target.cardInstanceId===hand.id);
 if(menu().some(a=>a.target?.planetId==='jupiter'))own('confirm Jupiter','choose_target',a=>a.target.planetId==='jupiter');
 own('same observed Jupiter yellow trace, slot 1','choose_target',a=>a.target.choiceId==='trace:1:yellow');
 const landed=snapshot();assert(landed.reserve.includes('dlc_31.png'));assert(landed.hand.some(c=>c[1]==='b_101.webp'));
 return {prefix,actualRemainingEnergy:energy,requiredTrades,after,landed,actions:[...actions]};
}
try{
 assert(c.lifecycle.restore(proof.launched.envelope).ok);const original=env(),g=route();
 const timing=rules.comparePlannedMovementTiming(state(),seat,g.requirementId,g.path.map(p=>({...p,rocketId:g.rocketId})),0);
 const paths=[0,1,3].map(run);assert(c.lifecycle.restore(original).ok);assert.deepEqual(env(),original);
 const out='/private/tmp/seti-v323-held-landing-timing-native-20261107-v1.json';
 fs.writeFileSync(out,JSON.stringify({source:proof.fixture,sourceSha256:proof.fixtureSha256,timing,paths,sourceRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,prefix:timing.bestPrefixLength,paths:paths.map(p=>({prefix:p.prefix,afterEnergy:p.actualRemainingEnergy,tradesAfter:p.requiredTrades,wallet:p.landed.wallet,inputs:p.actions.length}))}));
}finally{c.dispose();}
