'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {createSimulationRuleComposition} = require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom} = require('../randomizer/game/random');
const {buildRuleObservation} = require('../randomizer/app/rule-observation');
const {createAnalysisPort} = require('../randomizer/game/ai/analysis-port');
const {searchDecision} = require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator} = require('../randomizer/game/ai/state-value');
const agent = require('../randomizer/game/ai/search-agent');

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const [source141, source151, output] = process.argv.slice(2);
const f = read(source151), seat = f.seatId, seed = f.source.seed;
const k = createSimulationRuleComposition({seed, random: createSeededRandom(seed), activePlayerCount: 4, trustedProjectionReader: true,
  projectCounterfactualState: (s, w) => buildRuleObservation(s, seed, w?.playerId)});
k.newGame({seed});
const c = k.composition;
const save = () => c.lifecycle.save().envelope;
const restore = e => {assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
const port = () => createAnalysisPort({composition: c, seatId: seat, maxCacheEntries: 0});
const state = () => {const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState);};
const own = () => state().players.players.find(x=>x.id===seat);
function cold(name,e) {
  restore(e);
  const p=port(),value=createStateValueEvaluator(seat),t=performance.now();
  try {
    const root=p.openRoot(),r=searchDecision({port:p,root,evaluate:value,...agent.OPTIONS,modelKey:value.modelKey,budget:agent.BUDGET});
    const milliseconds=performance.now()-t;
    assert(r.complete&&!r.unresolved.length, r.stopReason);
    assert(r.diagnostics.nativeExecutions<=256&&milliseconds<=600);
    assert.deepEqual(save(),e);
    return {name,milliseconds,roots:r.roots,lines:r.lines,actionId:r.actionId,selected:root.legalActions.find(a=>a.actionId===r.actionId),
      selectedPath:r.planEvidence?.path, nativeInputs:r.diagnostics.nativeExecutions, value:r.value,
      supplies:r.lines.flatMap(x=>x.edges.filter(a=>a.resourcePlan?.goal.kind==='blue-landing-supply').map(a=>({from:x.node,...a})))};
  } finally {p.close();}
}
function act(id) {
  const d=c.inspect().session?.decision;
  const a=(d?.choices||c.inputPort.enumerateActions({})).find(x=>x.actionId===id);
  assert(a,id);
  const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
    :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(r.ok,JSON.stringify(r));return a;
}
try {
  const rows=[cold('actual-141',read(source141).compositionEnvelope),cold('actual-151',f.compositionEnvelope)];
  const original=read(source141).compositionEnvelope, perturbed=structuredClone(original);
  const hidden=JSON.parse(perturbed.committedState),pile=hidden.cards.drawPileCardIds;
  assert.notEqual(pile[0],pile[1]);
  [pile[0],pile[1]]=[pile[1],pile[0]];
  perturbed.committedState=JSON.stringify(hidden);
  const masked=cold('actual-141-hidden-draw-order-control',perturbed);
  assert.equal(rows[0].actionId,masked.actionId);
  assert.equal(rows[0].value,masked.value);
  assert.equal(rows[0].lines[0].landingCompanyRetained,1);
  assert.equal(masked.lines[0].landingCompanyRetained,1);
  const key=r=>r.supplies.map(e=>[e.resourcePlan.goal,e.steps,r.lines[e.target].value]);
  assert.deepEqual(key(rows[0]),key(masked));
  rows.push(masked);
  restore(f.compositionEnvelope);
  const p=port();
  let chain;
  try {
    p.setResourcePlanning(true);p.setCardPickPlanning(true);
    const root=p.openRoot(),plan=p.resourceSpec(root).plans.find(x=>x.goal.kind==='blue-landing-supply');
    assert(plan);
    const r=p.expandResourcePlan(root,plan,()=>null);
    assert(r.complete&&r.submissions===4);
    chain=r.prefixes.map(x=>x.action.actionId);
    assert.deepEqual(r.prefixes.map(x=>x.action.family),['card_corner','place_data','choose_target','choose_card']);
    assert.deepEqual(save(),f.compositionEnvelope);
  } finally {p.close();}
  const checkpoints=[];
  for (const [i,id] of chain.entries()) {
    const envelope=save();
    if(i)rows.push(cold('restored-'+i,envelope));
    checkpoints.push({step:i,envelope,action:id});
    act(id);
  }
  const endpoint=save();
  assert(own().hand.some(x=>x.cardId==='dlc_31.png')&&own().hand.some(x=>x.cardId==='b_101.webp'));
  assert.notEqual(own().industryRoundMarkRound,state().turn.roundNumber);
  restore(f.compositionEnvelope);
  for(const row of rows)console.log(JSON.stringify({name:row.name,action:row.actionId,value:row.value,native:row.nativeInputs,ms:row.milliseconds,supplies:row.supplies.map(x=>[x.from,x.target,x.steps])}));
  if(output)fs.writeFileSync(output,JSON.stringify({sources:[source141,source151].map(path=>({path,sha256:sha(path)})),rows,chain,checkpoints,endpoint,rootAndRngRestored:true},null,2)+'\n',{flag:'wx'});
} finally {c.dispose();}
