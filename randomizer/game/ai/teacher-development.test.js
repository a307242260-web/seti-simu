'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),values=require('./state-value'),search=require('./decision-search'),agent=require('./search-agent');
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/human405-v158-native-20261105-v1/ai-step-055-20261105-v1.json'))),seed=fixture.source.seed,seatId=fixture.seatId;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,rootState=JSON.parse(original.committedState),own=s=>s.players.players.find(p=>p.id===seatId),known=new Set([...own(rootState).hand,...rootState.cards.publicCards].filter(Boolean).map(c=>c.id));
const state=()=>{const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);},legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function submit(a){assert(a);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
function knownValue(){const o=structuredClone(c.projection({role:'player',playerId:seatId}).state);o.selfState.hand=o.selfState.hand.map(c=>known.has(c.id)?c:{id:c.id,hidden:true});o.publicState.board.publicCards=o.publicState.board.publicCards.map(c=>c&&known.has(c.id)?c:null);return values.evaluateStateValue(o,seatId);}
let nativeInputs=0;
try{
 const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});let decision;
 try{const root=p.openRoot(),evaluate=values.createStateValueEvaluator(seatId);decision=search.searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:{transitions:256,nodes:2048,frontier:512,milliseconds:5000}});assert(decision.complete);assert.equal(root.legalActions.find(a=>a.actionId===decision.actionId).family,'pass','do not burn a known next-income-funded technology card for a small current analysis payoff');assert.deepEqual(c.lifecycle.save().envelope,original);}finally{p.close();}
 submit(legal().find(a=>a.actionId===decision.actionId));nativeInputs++;
 while(!(state().turn.roundNumber===2&&state().turn.currentPlayerId===seatId&&!c.inspect().session?.decision)){
  assert(nativeInputs<40,'fixed PASS/mandatory continuation is bounded');const d=c.inspect().session?.decision;
  const a=d?legal().find(a=>a.family==='choose_card'&&['pass-hand-limit','pass-reserve-card'].includes(a.target.kind)):legal().find(a=>a.family==='pass');submit(a);nativeInputs++;
 }
 const before=knownValue(),player=own(state());assert(player.hand.some(c=>c.id==='card-15-0'&&c.cardId==='dlc_9.png'));assert(player.resources.credits>=3,'only the already-known permanent income funds the preserved card');
 submit(legal().find(a=>a.family==='play_card'&&a.target.cardInstanceId==='card-15-0'));nativeInputs++;
 submit(legal().find(a=>a.target.tileId==='purple4'));nativeInputs++;
 assert(own(state()).techState.ownedTiles.purple4);assert(!own(state()).hand.some(c=>c.id==='card-15-0'));const after=knownValue();assert.equal(after.total,before.total,'current native acquisition realizes the same funded-card forecast without using new draw identities');
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);
 console.log(JSON.stringify({teacherDevelopment:'passed',knownFreeResearchPreserved:true,nativePassAndIncomeInputs:nativeInputs,unknownDrawIdentitiesUnused:true,nativeFundingContinuity:true,rootAndRngRestored:true}));
}finally{c.dispose();}
