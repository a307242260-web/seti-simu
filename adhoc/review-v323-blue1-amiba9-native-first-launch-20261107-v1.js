'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const w=process.cwd(),load=p=>require(path.join(w,p)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report='reports/research/614d33af.720da076.quick-400.json',record=read(report),save=read(record.savePath),dir='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',verification=read(dir+'v323-first3-native-development-20261107-v1.json'),proof=read(verification.checkpoint);
assert.equal(sha(report),verification.recordSha256);assert.equal(sha(record.savePath),verification.saveSha256);assert.equal(sha(verification.checkpoint),verification.checkpointSha256);
const source=read(dir+'source-manifest-20261107-v1.json');for(const [p,h] of Object.entries({...source.baseRuntimeHashes,...source.sourceHashes}))assert.equal(sha(p),h,p);
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),values=load('randomizer/game/ai/state-value'),seat=record.scenario.learnerSeat,seed=record.seed;
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition,env=()=>c.lifecycle.save().envelope,state=()=>{const e=env();return e.session?.session?.workingState||JSON.parse(e.committedState);},actor=()=>state().players.players.find(p=>p.id===seat),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const snapshot=()=>{const s=state(),p=actor(),o=c.projection({role:'player',playerId:seat}).state;return{round:s.turn.roundNumber,turn:s.turn.turnNumber,score:p.resources.score,wallet:p.resources,income:p.income,tech:p.techState,hand:p.hand.map(c=>[c.id,c.cardId]),reserve:p.reservedCards.map(c=>[c.id,c.cardId]),data:p.dataState,rockets:s.pieces.rockets.filter(r=>r.playerId===seat),scan:Object.entries(s.data.nebulae).map(([id,b])=>[id,b.tokens.filter(t=>t.replacedByPlayerId===seat||t.replacedByPlayerColor===p.color).map(t=>t.slotIndex)]).filter(([,xs])=>xs.length),trace:o.selfState.traceCounts,aliens:o.publicState.board.aliens,finalScoring:s.finalScoring,projected:o.publicState.players.find(x=>x.playerId===seat).finalScore,model:values.evaluateStateValue(o,seat).total,envelope:env()};};
function submit(a){const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
function findRecorded(step,exact){const rr=save.replaySteps[step-1],a=menu().find(q=>q.actionId===rr.action.actionId&&q.actorId===rr.actorPlayerId);if(!a)return null;for(const k of exact?['family','phase','target','payload']:['family','phase','target'])assert.deepEqual(a[k],rr.action[k],step+':'+k);return a;}
const {passiveAgent}=load('tools/research-human405-round1');
try{
 const source=process.argv[2],old=read(source),initial=proof.roundStarts[3].envelope;
 const row=old.branches.find(x=>x.earlyTech==='blue1');assert(row);assert(c.lifecycle.restore(row.end.envelope).ok);
 const actions=[];let nativeInputs=0;
 function exec(a){assert(a);submit(a);nativeInputs++;actions.push({id:a.actionId,actor:a.actorId,family:a.family,target:a.target});}
 const doOwn=(family,ok=()=>true)=>{const a=menu().filter(x=>x.actorId===seat&&x.family===family&&ok(x));assert.equal(a.length,1,family+' '+JSON.stringify(menu().map(x=>x.target)));exec(a[0]);};
 doOwn('pass');doOwn('choose_card',a=>a.target.cardId==='b_111.webp');
 for(let i=0;i<12;i++){
  const other=c.inspect().session?.decision?.ownerId||state().turn.currentPlayerId;if(other===seat)break;
  const o=c.projection({role:'player',playerId:other}).state,id=passiveAgent(other).decide({observation:o,legalActions:menu()}).actionId;
  const a=menu().find(a=>a.actionId===id);assert(a.family==='pass'||c.inspect().session?.decision?.ownerId===other);exec(a);
 }
 const before=snapshot();assert.equal(before.round,4);assert.equal(state().turn.currentPlayerId,seat);
 const card=actor().hand.find(c=>c.cardId==='amiba_9.webp');assert(card);doOwn('play_card',a=>a.target.cardInstanceId===card.id);
 const acquired=env(),common=[...actions],choices=menu().filter(a=>a.target?.region==='orange'),outcomes=[];assert.equal(choices.length,3);
 for(const pick of choices){
  assert(c.lifecycle.restore(acquired).ok);actions.length=0;const actual=menu().find(a=>a.actionId===pick.actionId);assert(actual);exec(actual);
  outcomes.push({choice:pick.target,actions:[...actions],after:snapshot(),pending:menu().map(a=>[a.family,a.target])});
 }
 assert(c.lifecycle.restore(initial).ok);assert.deepEqual(env(),initial);
 const out=process.argv[3];fs.writeFileSync(out,JSON.stringify({scope:'First lawful Blue1 next-round turn; pay held Amiba9, observe a real launch and every currently public orange symbol; no whole game or additional policy.',source,sourceSha256:sha(source),common,before,outcomes,nativeInputs,sourceRestored:true,newAutonomousRuns:0})+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,nativeInputs,outcomes:outcomes.map(x=>[x.choice.symbolId,x.after.wallet,x.after.rockets.map(q=>[q.id,q.surface]),x.after.projected])}));
}finally{c.dispose();}
