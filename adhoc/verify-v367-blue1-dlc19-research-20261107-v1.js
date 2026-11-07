'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const source=process.argv[2],control=JSON.parse(fs.readFileSync(source)).fixed.find(x=>x.signalTail&&x.mode==='swap'),e=control.signalTail.envelope,seat='player-white',seed=JSON.parse(e.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,restore=e=>assert(c.lifecycle.restore(e).ok),menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),path=[];
const snap=()=>{const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(p=>p.id===seat),o=c.projection({role:'player',playerId:seat}).state;return {score:p.resources.score,wallet:p.resources,income:p.income,tech:p.techState,hand:p.hand.map(c=>[c.id,c.cardId]),reserve:p.reservedCards.map(c=>[c.id,c.cardId,c.cardEffectState]),data:p.dataState,rockets:s.pieces.rockets.filter(r=>r.playerId===seat),scan:Object.entries(s.data.nebulae).map(([id,b])=>[id,b.tokens.filter(t=>t.replacedByPlayerColor==='white').map(t=>t.slotIndex)]).filter(([,ns])=>ns.length),completedSectors:s.data.completedSectors,trace:o.selfState.traceCounts,aliens:o.publicState.board.aliens,finalScoring:s.finalScoring,round:s.turn.roundNumber,turn:s.turn.turnNumber,projected:o.publicState.players.find(x=>x.playerId===seat).finalScore};};
const act=(family,predicate=()=>true)=>{const a=menu().filter(x=>x.family===family&&x.actorId===seat&&predicate(x));assert.equal(a.length,1,JSON.stringify(menu().map(x=>x.target)));const choice=a[0],d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice}):choice.phase==='quick'?c.inputPort.submitQuickAction(choice):c.inputPort.submitAction(choice);assert(r.ok,JSON.stringify(r));path.push({id:choice.actionId,family:choice.family,target:choice.target,after:snap()});};
try{
 restore(e);const before=save(),initial=snap();
 assert.equal(initial.round,3);assert.equal(initial.wallet.publicity,4);assert.equal(initial.score,93);
 act('choose_target',a=>a.target.choiceId==='trace:1:pink:state-extra');
 assert.equal(snap().score,96);
 act('end_turn');
 act('accept_optional_effect',a=>a.target.choiceId==='confirm:task:card-15-0:dlc9-three-sector-wins');
 const funded=snap();assert.equal(funded.wallet.publicity,7);
 act('research_tech');
 act('choose_target',a=>a.target.tileId==='purple2');
 act('end_turn');
 assert(menu().some(a=>a.family==='pass'&&a.actorId===seat));const end=snap(),final=save();
 assert.equal(end.round,3);assert.equal(end.tech.ownedTiles.purple2,true);assert.equal(end.tech.ownedTiles.blue1,true);assert.equal(Object.values(end.tech.ownedTiles).filter(Boolean).length,5);
 assert.equal(end.wallet.publicity,2);assert(end.score>=96);assert.deepEqual(end.income,initial.income);
 restore(before);assert.deepEqual(save(),before);assert.equal(path.length,6);
 const result={scope:'At actual Blue1 fixed replay endpoint, use root-public DLC19 by company swap, finish only attainable sector, claim held DLC9, then fund Purple2 in the next white turn before round-end PASS. No future draw identity used.',source,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),root:before,rootAndRngRestored:true,knownPrefix:control.path,steps:path,funded,end,endEnvelope:final,newNativeInputs:path.length,newAiQueries:0,newAutonomousRuns:0};
 fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({score:end.score,tech:end.tech,wallet:end.wallet,income:end.income,scan:end.scan,trace:end.trace,projected:end.projected,usedNativeInputs:path.length,heldDlc9FundedPublicity:funded.wallet.publicity}));
}finally{c.dispose();}
