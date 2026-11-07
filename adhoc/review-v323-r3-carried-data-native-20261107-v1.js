'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const work=process.cwd(),load=n=>require(path.join(work,n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),value=load('randomizer/game/ai/state-value');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',input=D+'v323-r3-first-scan-r2-carryover-native-20261107-v1.json',pair=read(input),prior=read(pair.r2Control),record=read(pair.record),save=read(record.savePath),seat='player-white';
assert.equal(sha(pair.record),pair.recordSha256);assert.equal(sha(pair.r2Control),pair.r2ControlSha256);
assert.equal(sha(record.savePath),read(prior.nativeVerification).saveSha256);
const preflight=read(D+'autonomous-first3-runtime-preflight-20261107-v1.json'),admission=read(preflight.sourceAdmission),m=read(admission.manifest);
assert.equal(sha(preflight.sourceAdmission),preflight.sourceAdmissionSha256);assert.equal(sha(admission.manifest),admission.manifestSha256);
for(const [file,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(file),h,file);
const seed=record.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const [a,b]=pair.routes.map(r=>r.envelope);let actions=[];
const env=()=>c.lifecycle.save().envelope,state=(e=env())=>e.session?.session?.workingState||JSON.parse(e.committedState),restore=e=>assert(c.lifecycle.restore(e).ok);
function assets(){
 const s=state(),p=s.players.players.find(p=>p.id===seat),view=c.projection({role:'player',playerId:seat}).state;
 return {round:s.turn.roundNumber,turn:s.turn.turnNumber,active:s.turn.currentPlayerId,passed:s.turn.passedPlayerIds,
  wallet:p.resources,income:p.income,hand:p.hand.map(c=>[c.id,c.cardId]),reserve:p.reservedCards.map(c=>[c.id,c.cardId]),tech:p.techState,
  computer:p.dataState.placedTokens.filter(q=>q.placementKind==='computer').map(q=>q.placementSlot),blue:p.dataState.placedTokens.filter(q=>q.placementKind==='blueBonus').map(q=>q.blueSlot),
  probes:s.pieces.rockets.filter(q=>q.playerId===seat),trace:view.selfState.traceCounts,alien:view.publicState.board.aliens,marks:s.finalScoring.tiles,
  model:value.evaluateStateValue(view,seat).total,finalProjection:view.publicState.players.find(x=>x.playerId===seat).finalScore};
}
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function choose(label,predicate){
 const legal=menu().filter(predicate);assert.equal(legal.length,1,label+': '+JSON.stringify(menu().map(x=>[x.family,x.actorId,x.target])));
 const x=legal[0],d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:x}):x.phase==='quick'?c.inputPort.submitQuickAction(x):c.inputPort.submitAction(x);
 assert(r.ok,label+': '+JSON.stringify(r));actions.push({label,id:x.actionId,actor:x.actorId,family:x.family,target:x.target});return x;
}
const rec=i=>{const {action,actorPlayerId}=save.replaySteps[i-1];return choose('recorded '+i,a=>a.actionId===action.actionId&&a.actorId===actorPlayerId&&JSON.stringify(a.target)===JSON.stringify(action.target));};
const own=(label,family,when=()=>true)=>choose(label,a=>a.actorId===seat&&a.family===family&&when(a));
const computer=n=>{for(let i=0;i<n;i++){own('place computer data','place_data');own('choose computer','choose_target',x=>x.target.target==='computer');}};
function end(tile){
 own('end own turn','end_turn');
 if(tile)own('recorded final mark '+tile,'choose_target',x=>x.target?.kind==='residual-domain'&&x.target.tileId===tile);
}
function snapshot(){return{assets:assets(),envelope:env(),submitted:actions.length};}
function start(e){restore(e);actions=[];}
try{
 start(a);for(let i=145;i<=158;i++)rec(i);const actualBeforeLand=snapshot();for(let i=159;i<=170;i++)rec(i);
 const actualAfterLand=snapshot(),actual={beforeLand:actualBeforeLand,afterLand:actualAfterLand,actions:[...actions]};
 // After R2 PASS, delay that exact unrevealed-blue analysis until R3,
 // before taking the same known landing. A passed table cannot insert an
 // opponent main action; we replay its recorded mandatory choices exactly.
 start(b);end();for(let i=156;i<=158;i++)rec(i);computer(2);
 own('free analysis before reveal','analyze');
 own('the same R2 blue trace at unrevealed slot 2','choose_target',x=>x.target.choiceId==='trace:2:blue');
 const analysisBeforeRefill=snapshot();
 for(let i=145;i<=155;i++)rec(i);
 const postponedBeforeLand=snapshot();for(let i=159;i<=170;i++)rec(i);
 const postponed={analysisBeforeRefill,beforeLand:postponedBeforeLand,afterLand:snapshot(),actions:[...actions]};
 // Pay for the same landing while the retained blue slot is still occupied;
 // continue to free analysis only after the known landing has revealed Amiba.
 start(b);end();for(let i=156;i<=158;i++)rec(i);
 rec(159);own('extra energy required because blue 1 remains occupied','quick_trade',x=>x.target.tradeId==='credits-for-energy');
 for(let i=160;i<=163;i++)rec(i);
 const landFirst=snapshot();
 computer(2);end('a');own('free analysis after Amiba reveal','analyze');
 const postRevealRoot=snapshot(),revealedChoices=menu().filter(x=>x.actorId===seat&&x.family==='choose_target').map(x=>x.target);
 const lateBaseActions=[...actions],late=[];
 // Enumerate the three meaningful, now-public outcomes by explicit Native
 // descriptor once each, never resimulate the search or optimize hidden draws.
 for(const option of revealedChoices){
  restore(postRevealRoot.envelope);actions=[];
  own('known analysis option','choose_target',x=>x.target.choiceId===option.choiceId);
  late.push({option,actions:[...actions],...snapshot(),remainingForced:menu().filter(x=>x.actorId===seat).map(x=>[x.family,x.target]).filter(([k])=>['choose_target','choose_card'].includes(k))});
 }
 restore(a);assert.deepEqual(env(),a);
 const result={scope:'Three fixed R3 schedules from paired real Native carryover roots, through the same Jupiter landing or one subsequently legal Amiba analysis. No white policy queries, no opponent main actions, no new autonomous result. Amiba trace outcomes are enumerated only after Native reveal.',sourceCommit:preflight.sourceCommit,record:pair.record,recordSha256:pair.recordSha256,source:input,sourceSha256:sha(input),actual,postponed,landFirst,postRevealRoot,lateBaseActions,late,newAiQueries:0,newAutonomousRuns:0};
 const output=D+'v323-r3-carried-data-native-20261107-v1.json';fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 const brief=x=>{const y=x.assets;return{score:y.wallet.score,wallet:[y.wallet.credits,y.wallet.energy,y.wallet.publicity,y.wallet.availableData],income:y.income,hand:y.hand.map(c=>c[1]),computer:y.computer,blue:y.blue,turn:y.turn,trace:y.trace,model:y.model,final:y.finalProjection};};
 console.log(JSON.stringify({actual:brief(actual.afterLand),postponed:brief(postponed.afterLand),landFirst:brief(landFirst),late:late.map(r=>[r.option.choiceId,brief(r),r.remainingForced.length])}));
}finally{c.dispose();}
