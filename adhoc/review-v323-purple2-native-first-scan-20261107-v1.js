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
 const row=old.branches.find(x=>x.earlyTech==='purple2');assert(row);assert(c.lifecycle.restore(row.end.envelope).ok);
 const actions=[];let nativeInputs=0;
 function exec(a){assert(a);submit(a);nativeInputs++;actions.push({id:a.actionId,actor:a.actorId,family:a.family,target:a.target});}
 const doOwn=(family,ok=()=>true)=>{const a=menu().filter(x=>x.actorId===seat&&x.family===family&&ok(x));assert.equal(a.length,1,family+' '+JSON.stringify(menu().map(x=>x.target)));exec(a[0]);};
 doOwn('pass');doOwn('choose_card',a=>a.target.cardId==='b_111.webp');
 for(let i=0;i<12;i++){
  const other=c.inspect().session?.decision?.ownerId||state().turn.currentPlayerId;if(other===seat)break;
  const o=c.projection({role:'player',playerId:other}).state,id=passiveAgent(other).decide({observation:o,legalActions:menu()}).actionId;
  const a=menu().find(a=>a.actionId===id);assert(a.family==='pass'||c.inspect().session?.decision?.ownerId===other);exec(a);
 }
 const next=env(),before=snapshot(),common=[...actions],outcomes=[];assert.equal(before.round,4);assert.equal(state().turn.currentPlayerId,seat);assert.equal(before.wallet.publicity,0);
 for(const use of [false,true]){
  assert(c.lifecycle.restore(next).ok);actions.length=0;
  if(use){const card=actor().hand.find(c=>c.cardId==='b_16.webp');assert(card);doOwn('card_corner',a=>a.target.cardInstanceId===card.id);}
  doOwn('scan');doOwn('choose_target',a=>a.target.choiceId==='nebula:sector-4-b');
  doOwn('choose_card',a=>a.target.choiceId==='public:card-60-0:sector-2-b');doOwn('choose_card',a=>a.target.choiceId==='public:done');
  doOwn('choose_target',a=>a.target.choiceId==='scan4:skip');
  const head=env().session?.session?.queue?.[0],options=menu();
  if(use){const extra=options.find(a=>!a.target?.skip&&a.target?.mode!=='skip');assert(extra&&head.type==='science_domain_scan_step'&&head.payload.options?.label==='水星扇区扫描',JSON.stringify({head:head&&{type:head.type,payload:head.payload},options:options.map(a=>a.target)}));exec(extra);}
  else{const skip=options.find(a=>a.target?.skip===true||a.target?.mode==='skip');if(skip&&head.payload.options?.label==='水星扇区扫描')exec(skip);}
  const after=snapshot();outcomes.push({use,actions:[...actions],after,available:menu().map(x=>[x.family,x.target])});
 }
 assert(c.lifecycle.restore(initial).ok);assert.deepEqual(env(),initial);
 const out=process.argv[3];fs.writeFileSync(out,JSON.stringify({scope:'Same lawful Purple2 next-round root. Two fixed identical scans; only one uses an already drawn B16 to fund the optional Mercury signal. No R3 projection reads this draw, no autonomous play.',source,sourceSha256:sha(source),common,before,outcomes,nativeInputs,sourceRestored:true,newAutonomousRuns:0})+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,nativeInputs,outcomes:outcomes.map(x=>[x.use,x.after.wallet,x.after.scan,x.after.trace,x.actions.at(-1)])}));
}finally{c.dispose();}
