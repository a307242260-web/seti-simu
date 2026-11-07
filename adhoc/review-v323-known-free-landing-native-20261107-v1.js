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
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=env(),initial=snapshot();
 const hand=current().hand.find(a=>a.cardId==='dlc_31.png');assert(hand);assert.equal(effects.getCardPrice(hand),1);
 own('standard launch from known cash','launch');
 const launched=snapshot(),jupiter=rules.getProbeRouteRequirements(state(),seat).candidates.find(g=>g.endpointFamily==='land'&&g.planetId==='jupiter'&&g.endpointTarget.type==='planet');assert(jupiter);
 assert.equal(jupiter.required.paidMovementPoints,3);
 assert.equal(jupiter.endpointFacts.cost.energy,2);
 const ordinaryQuote=probe.quote({...probe.factsFromState(state(),current()),investment:()=>0},values.DEFAULT_WEIGHTS);
 const ordinaryJupiter=ordinaryQuote.candidates.find(q=>q.id===jupiter.rocketId+':land:jupiter:planet');
 assert(ordinaryJupiter&&!ordinaryJupiter.funded,'ordinary mission pricing excludes this known cheaper Jupiter landing');
 const p0=launched.wallet,price=effects.getCardPrice(hand);
 assert(!probe.funding(p0,{energy:jupiter.required.paidMovementPoints+jupiter.endpointFacts.cost.energy},values.DEFAULT_WEIGHTS));
 assert(probe.funding(p0,{credits:price,energy:jupiter.required.paidMovementPoints},values.DEFAULT_WEIGHTS));
 own('one known credit-to-energy trade for the named route','quick_trade',a=>a.target.tradeId==='credits-for-energy');
 for(const p of jupiter.path){
  own('follow fixed Jupiter route','move',a=>a.target.rocketId===jupiter.rocketId&&a.target.deltaX===p.deltaX&&a.target.deltaY===p.deltaY);
  own('pay exact route energy','choose_payment',a=>a.target.choiceId==='energy');
 }
 const arrived=snapshot();assert.equal(arrived.wallet.energy,0);assert.equal(arrived.wallet.credits,3);
 own('close launch turn','end_turn');
 for(let i=0;i<10;i++){
  const s=state(),d=c.inspect().session?.decision,owner=d?.ownerId||s.turn.currentPlayerId;
  if(owner===seat)break;
  const o=c.projection({role:'player',playerId:owner}).state,legalActions=menu().filter(a=>a.actorId===owner);
  const next=passiveAgent(owner).decide({observation:o,legalActions});act('recorded passive seat contract',a=>a.actorId===owner&&a.actionId===next.actionId);
 }
 assert.equal(state().turn.currentPlayerId,seat);assert.equal(state().turn.roundNumber,3);
 const beforeLanding=snapshot();
 own('use previously held DLC31 at the named landing','play_card',a=>a.target.cardInstanceId===hand.id);
 if(menu().some(a=>a.target?.planetId==='jupiter'))own('confirm Jupiter','choose_target',a=>a.target.planetId==='jupiter');
 own('same observed Jupiter yellow trace, slot 1','choose_target',a=>a.target.choiceId==='trace:1:yellow');
 const landed=snapshot();
 assert.equal(landed.wallet.score,63);assert.equal(landed.wallet.credits,2);assert.equal(landed.wallet.energy,0);assert.equal(landed.wallet.availableData,2);
 assert(landed.reserve.includes('dlc_31.png'));assert(landed.hand.some(c=>c[1]==='b_101.webp'));
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(env(),original);
 const r={scope:'One Native launch then the shortest known Jupiter path and one already-held DLC31 play, proving the ordinary-only funding omission. No hidden draw or standard opponent main action is used to fund this chain. End after confirmed yellow trace, before any new follow-up decision.',fixture:fixturePath,fixtureSha256:sha(fixturePath),cold:coldPath,coldSha256:sha(coldPath),initial,launched,ordinaryJupiter,jupiter,arrived,beforeLanding,landed,actions,newNativeInputs:actions.length,newAiQueries:0,newAutonomousRuns:0,sourceRestored:true};
 const out=D+'v323-known-free-landing-native-20261107-v1.json';fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,actions:r.newNativeInputs,launched:[launched.wallet.credits,launched.wallet.energy,launched.model.components.probePotential],arrived:[arrived.wallet.credits,arrived.wallet.energy],landed:{wallet:landed.wallet,hand:landed.hand,reserve:landed.reserve,model:landed.model.total,publicSpecies:landed.publicSpecies}}));
}finally{c.dispose();}
