'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const {createSimulationRuleComposition} = require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom} = require('../randomizer/game/random');
const {buildRuleObservation} = require('../randomizer/app/rule-observation');
const {createAnalysisPort} = require('../randomizer/game/ai/analysis-port');
const {createSearchAgent} = require('../randomizer/game/ai/search-agent');
const {passiveAgent} = require('../tools/research-human405-round1');

const [fixture, output] = process.argv.slice(2);
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const f = JSON.parse(fs.readFileSync(fixture)), seat = f.seatId, seed = f.source.seed;
const make = () => {
  const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
    projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
  k.newGame({seed});return k.composition;
};
const c = make();
const restore = () => {assert(c.lifecycle.restore(f.compositionEnvelope).ok);assert.deepEqual(c.lifecycle.save().envelope,f.compositionEnvelope);};
restore();
const p = createAnalysisPort({composition:c,seatId:seat}), agent = createSearchAgent({seatId:seat,analysisPort:p});
const state = () => {const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);};
const own = () => state().players.players.find(x=>x.id===seat);
function input(comp,id){
  const d=comp.inspect().session?.decision,menu=d?.choices||comp.inputPort.enumerateActions({});
  const a=menu.find(x=>x.actionId===id);assert(a,id);
  const r=d?comp.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
    :a.phase==='quick'?comp.inputPort.submitQuickAction(a):comp.inputPort.submitAction(a);
  assert(r.ok,JSON.stringify(r));return a;
}
const opponents=new Map();
const path=[];
try {
  for(let i=0;i<38;i++){
    const d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({});
    const actor=d?.ownerId||state().turn.currentPlayerId;
    if(!d&&actor===seat&&state().turn.actionCycleNumber===4)break;
    let choice;
    if(actor===seat)choice=agent.decide({seatId:seat,legalActions:actions});
    else {
      if(!opponents.has(actor))opponents.set(actor,passiveAgent(actor));
      choice=opponents.get(actor).decide({observation:c.projection({role:'player',playerId:actor}).state,legalActions:actions});
    }
    const r=choice.search;
    if(r)assert(r.complete&&r.diagnostics.nativeExecutions<=256&&r.rootAndSearchMilliseconds<=600);
    const a=input(c,choice.actionId);
    path.push({actor,action:a.actionId,family:a.family,target:a.target,native:r?.diagnostics.nativeExecutions,
      milliseconds:r?.rootAndSearchMilliseconds,reused:r?.reusedCoverage?.sourceNode,valued:r?.value});
  }
  const end=own(),envelope=c.lifecycle.save().envelope,cycle=state().turn.actionCycleNumber;
  const pickAt=path.findIndex(a=>a.action==='choose_card:2db479c6');
  assert.equal(path[pickAt+1].family,'end_turn','re-evaluate refill without spending B101 on movement');
  const incomeAt=path.findIndex(a=>a.action==='choose_card:49c9e29c');
  const useDlc19=path.findIndex(a=>a.action==='play_card:38489727');
  assert(pickAt>0&&incomeAt>pickAt&&useDlc19>incomeAt);
  assert.equal(cycle,4);assert.equal(end.resources.score,74);
  assert.equal(end.income.handSize,2);assert.equal(end.industryRoundMarkRound,0);
  const next=make();
  try {
    assert(next.lifecycle.restore(f.compositionEnvelope).ok);
    for(const a of path)assert.equal(input(next,a.action).actorId,a.actor);
    assert.deepEqual(next.lifecycle.save().envelope,envelope);
  } finally {next.dispose();}
  restore();
  const proof={source:fixture,sourceSha256:sha(fixture),cycle,path,end:{wallet:end.resources,income:end.income,
    hand:end.hand.map(x=>[x.id,x.cardId]),reserved:end.reservedCards.map(x=>[x.id,x.cardId]),companyRound:end.industryRoundMarkRound},
    envelope,endpointAndRngExact:true,first3AutonomousRuns:0};
  if(output)fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({...proof,envelope:undefined}));
} finally {p.close();c.dispose();}
