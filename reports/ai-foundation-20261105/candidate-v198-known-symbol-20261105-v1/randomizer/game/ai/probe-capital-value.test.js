'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const values = require('./state-value'), probe = require('./probe-capital'), demand = require('./resource-demand');
const { createSimulationRuleComposition } = require('../../training/simulation-rule-composition');
const { createSeededRandom } = require('../random'), { buildRuleObservation } = require('../../app/rule-observation');
const { createAnalysisPort } = require('./analysis-port');
const read = p => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../..', p)));
const fixture = read('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-035-20261030-v1.json');
const seatId = fixture.seatId, seed = fixture.source.seed;
const k = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s, v) => buildRuleObservation(s, seed, v?.playerId) });
k.newGame({ seed }); const c = k.composition; assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);
const original = c.lifecycle.save().envelope, port = createAnalysisPort({ composition: c, seatId, maxCacheEntries: 0 });
const quote = (obs, weights = values.DEFAULT_WEIGHTS) => {
  const p = obs.publicState.players.find(p => p.playerId === seatId), round = obs.publicState.roundNumber + Number(obs.publicState.passingPlayerIds.includes(seatId));
  return probe.fromObservation(obs, seatId, weights, (hand, publicity, funding) =>
    values.handCapital(hand, p.techState, obs.publicState.board.techSupply, round, weights, funding)
      + values.researchCapital({ hand, publicity, techState: p.techState, supply: obs.publicState.board.techSupply,
        round, researchCost: p.researchPublicityCost, funding }, weights));
};
try {
  port.setCardPickPlanning(true); port.setResourcePlanning(true);
  port.setDecisionPlanning({ scanPlanning: true, finalMarkPlanning: true });
  const root = port.openRoot(), obs = root.observation, saved = structuredClone(obs), forecast = quote(obs);
  assert.equal(forecast.value, 5.5);
  assert.equal(forecast.selected.family, 'orbit');
  assert.equal(forecast.selected.payment.value, 2);
  assert.equal(values.evaluateStateValue(obs, seatId).components.probePotential, 5.5,
    'a deployed funded probe must retain its known mission value across a turn boundary');
  assert.deepEqual(values.evaluateStateValue(port.valueObservation(root), seatId), values.evaluateStateValue(obs, seatId));
  const state = JSON.parse(original.committedState), own = state.players.players.find(p => p.id === seatId);
  const investment = (hand, publicity, funding) => demand.heldAndResearchCapital(state, { ...own, hand, income: funding.income, resources: { ...own.resources, ...funding.resources, publicity } });
  assert.deepEqual(probe.fromState(state, own, values.DEFAULT_WEIGHTS, investment), forecast);
  const beforeValue=values.evaluateStateValue(obs,seatId);
  assert(beforeValue.components.researchIncomePotential>0,'the separately native-verified funded research-income alternative remains represented');
  assert.equal(demand.planningCapital(state, own), values.sumValueParts([demand.heldAndResearchCapital(state, own),forecast.value,beforeValue.components.researchIncomePotential]));

  // Four actual native inputs consume the quoted probe, public card, scan slot
  // and income card. The analysis branch preserves its blind-draw boundary.
  const witness = read('reports/ai-foundation-20261023/human405-v99-native-witness-comparison-step35-20261031-v1.json').rows.find(r => r.name === 'student-best');
  let next = root;
  for (const step of witness.steps) {
    const a = next.legalActions.find(a => a.actionId === step.actionId); assert(a, step.summary);
    next = port.expand(next, a.actionId);
  }
  const completedValue=values.evaluateStateValue(next.observation,seatId);
  assert.equal(values.sumValueParts([completedValue.total,-completedValue.components.researchIncomePotential]),
    values.sumValueParts([beforeValue.total,-beforeValue.components.researchIncomePotential]),
    'the native mission matches its base quote; the independently verified research-income alternative is separate');
  assert.equal(quote(next.observation).value, 0, 'consumed probe must not retain a mission');
  assert.equal(quote({ ...obs, terminal: true }).value, 0);
  const round4 = structuredClone(obs); round4.publicState.roundNumber = 4; delete round4.publicState.board.data;
  assert.equal(quote(round4).value, 0);
  const passed = structuredClone(obs); passed.publicState.roundNumber = 3; passed.publicState.passingPlayerIds.push(seatId);
  assert.equal(quote(passed).value, 0);
  const missing = structuredClone(obs); delete missing.publicState.board.data;
  assert.throws(() => quote(missing), /PROBE_CAPITAL_PUBLIC_FACTS_MISSING: data/);
  const duplicate = structuredClone(obs), ownProbe = duplicate.publicState.board.rockets.find(r => r.playerId === seatId);
  duplicate.publicState.board.rockets.push({ ...ownProbe, id: 999 });
  assert.equal(quote(duplicate).value, forecast.value, 'one mission maximum, never sum probes');
  const empty = structuredClone(obs); empty.publicState.board.rockets = [];
  assert.equal(quote(empty).value, 0);
  const poor = structuredClone(obs), poorPlayer = poor.publicState.players.find(p => p.playerId === seatId);
  poorPlayer.credits = 0; poorPlayer.energy = 0;
  assert.equal(quote(poor).value, 0, 'reward resources cannot prepay their own endpoint costs');
  const secrets = structuredClone(obs); secrets.publicState.board.aliens.slots.forEach(s => { s.assignedAlienId = 'different-secret'; });
  secrets.publicState.board.publicCards.push({ hidden: true, cardId: 'dlc_9.png' });
  secrets.selfState.hand.push({ hidden: true, cardId: 'dlc_9.png' });
  assert.equal(quote(secrets).value, forecast.value, 'unknown identities cannot alter a known mission quote');
  assert.deepEqual(obs, saved); assert.deepEqual(c.lifecycle.save().envelope, original);

  const source = read('reports/ai-foundation-20261023/human405-v99-native-witness-comparison-step36-20261031-v1.json');
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname, '../../..', source.rawPath))));
  const land = raw.find(r => r.name === 'teacher-first').observation;
  const landing = quote(land); assert.equal(landing.value, 7.5 - (values.FORECAST.usefulScansPerLaterRound - 2)); assert.equal(landing.selected.family, 'land');
  assert.equal(landing.selected.ledger.find(e => e.type === 'alien_trace').gain.score, 5);
  const discounted=structuredClone(land),discountOwner=discounted.publicState.players.find(p=>p.playerId===seatId);
  discountOwner.techState.ownedTiles.orange3=true;
  const discountedLand=quote(discounted).candidates.find(c=>c.id===landing.selected.id);
  assert(discountedLand.payment.value<landing.selected.payment.value,'permanent land-cost technology invalidates the endpoint cache');
  discountOwner.techState.disabledTiles.orange3=true;
  assert.deepEqual(quote(discounted).candidates.find(c=>c.id===landing.selected.id).payment,landing.selected.payment,'disabled technology restores the native ordinary fee');
  assert.deepEqual(quote(land).selected.payment,landing.selected.payment,'another technology quote cannot contaminate the original owner');
  const occupied = structuredClone(land);
  occupied.publicState.board.aliens.slots.forEach(s => { s.traces.yellow.firstPlaced = true; });
  const occupiedQuote = quote(occupied), occupiedLand = occupiedQuote.candidates.find(c => c.family === 'land');
  assert.equal(occupiedLand.ledger.find(e => e.type === 'alien_trace').gain.score, 3, 'use the native extra-trace reward');
  const capped = structuredClone(land), cappedPlayer = capped.publicState.players.find(p => p.playerId === seatId);
  cappedPlayer.availableData = 6; cappedPlayer.publicity = 10;
  const cappedLand = quote(capped).candidates.find(c => c.family === 'land');
  assert(cappedLand.ledger.filter(e => e.type === 'gain_data').every(e => e.count === 0));
  assert.equal(cappedLand.ledger.find(e => e.type === 'alien_trace').gain.publicity, 0);

  // Controlled known-card board: keep the deployed Mars probe, move the public
  // blind-income supplier into the hand, and finish the main action. This
  // isolates the scalar proof from a competing blue-first preparation plan.
  const controlled=JSON.parse(original.committedState),recipient=controlled.players.players.find(p=>p.id===seatId);
  const index=controlled.cards.publicCards.findIndex(c=>c?.cardId==='b_2.webp');assert(index>=0);
  recipient.hand.push(controlled.cards.publicCards[index]);controlled.cards.publicCards[index]=null;
  recipient.resources.handSize=recipient.hand.length;recipient.mainActionCompleted=true;
  // With funded research, the known public research-income alternative makes
  // this blind-income plan unprofitable. It must not receive a certificate.
  assert(c.lifecycle.restore({...original,committedState:JSON.stringify(controlled)}).ok);
  const deferred=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{deferred.setResourcePlanning(true);deferred.setCardPickPlanning(true);const root=deferred.openRoot();assert.equal(deferred.incomePlanSummary(root),null);assert.equal(deferred.resourceSpec(root).incomeTail.selected,false);}finally{deferred.close();}
  // Below the research fee, both preparations are positive. The greedy
  // computer prefix preserves the supplier and beats income; independently
  // execute the income counterfactual to retain its shared-wallet obligation.
  recipient.resources.publicity=5;
  assert(c.lifecycle.restore({...original,committedState:JSON.stringify(controlled)}).ok);
  const controlBefore=c.lifecycle.save().envelope,q=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
    q.setResourcePlanning(true);q.setCardPickPlanning(true);const root=q.openRoot(),spec=q.incomePlanSummary(root),policy=q.resourceSpec(root);assert.equal(spec,null,'non-half-unit income gain must execute its native preparation');
    assert(values.evaluateStateValue(root.observation,seatId).components.probePotential>0);
    const requirements=require('../production-kernel').getResourceGoalRequirements(controlled,seatId);
    const goal=demand.catalog({state:controlled,seatId,requirements,actions:root.legalActions}).find(g=>g.kind==='income');assert(goal);
    const first=demand.step({state:controlled,seatId,goal,actions:root.legalActions,status:'stable'});assert(first.actionId);
    const actual=q.expandResourcePlan(root,{id:goal.id,goal,operation:{},firstActionId:first.actionId},()=>null);assert(actual.complete);
    assert.equal(actual.submissions,9);
    assert.equal(values.evaluateStateValue(actual.node.observation,seatId).total,
      values.sumValueParts([values.evaluateStateValue(root.observation,seatId).total,policy.incomeTail.netGain]));
    const preferred=policy.plans.find(p=>p.goal.kind==='computer-prefix');assert(preferred);
    const prefix=q.expandResourcePlan(root,preferred,()=>null);assert(prefix.complete);
    const startValue=values.evaluateStateValue(root.observation,seatId).total,prefixValue=values.evaluateStateValue(prefix.node.observation,seatId).total,incomeValue=values.evaluateStateValue(actual.node.observation,seatId).total;
    assert.equal(prefixValue,values.sumValueParts([startValue,policy.fixedComputerTail.netGain]));
    assert(prefixValue>incomeValue&&prefix.submissions<actual.submissions,'prefer the higher-valued native preparation with fewer fixed inputs');
    console.log(JSON.stringify({controlledComputerPrefixBeatsIncome:true,prefixInputs:prefix.submissions,incomeInputs:actual.submissions,prefixValue,incomeValue}));
    assert.deepEqual(c.lifecycle.save().envelope,controlBefore);
  }finally{q.close();}
} finally { port.close(); c.dispose(); }

// The exact teacher Earth root has a funded one-point route to Mars. Its
// future orbit retains 3.5V after held-card funding opportunity cost, and moving there natively charges that energy.
{
  const f=read('reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-025-20261104-v1.json'),seed=f.source.seed;
  const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
  assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
  const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
  function submit(a){assert(a);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
  try{const root=p.openRoot(),q=quote(root.observation);assert.equal(q.value,3.5-(values.FORECAST.usefulScansPerLaterRound-2));assert.equal(q.selected.planet,'mars');assert.equal(q.selected.route.cost,1);assert.equal(q.selected.route.path.length,1);assert.equal(q.selected.payment.value,3);assert(Object.isFrozen(q.selected.route));
    const s=JSON.parse(original.committedState),own=s.players.players.find(p=>p.id===f.seatId),investment=(hand,publicity,funding)=>demand.heldAndResearchCapital(s,{...own,hand,income:funding.income,resources:{...own.resources,...funding.resources,publicity}});assert.deepEqual(probe.fromState(s,own,values.DEFAULT_WEIGHTS,investment),q);
    assert.deepEqual(values.evaluateStateValue(p.valueObservation(root),f.seatId),values.evaluateStateValue(root.observation,f.seatId));
    const saved=structuredClone(root.observation),poor=structuredClone(saved),player=poor.publicState.players.find(p=>p.playerId===f.seatId);player.credits=0;player.energy=0;player.income.credits=99;player.income.energy=99;assert.equal(quote(poor).value,0,'later income and endpoint rewards cannot prepay the route');assert.deepEqual(quote(saved),q,'a cached route never caches wallet-dependent funding');
    const hidden=structuredClone(saved);hidden.publicState.board.aliens.slots.forEach(s=>s.assignedAlienId='other-hidden-world');assert.deepEqual(quote(hidden),q);
    assert.deepEqual(c.lifecycle.save().envelope,original);submit(legal().find(a=>a.family==='quick_trade'&&a.target.tradeId==='energy-for-move'));const step=q.selected.route.path[0],a=legal().find(a=>a.target?.deltaX===step.deltaX&&a.target?.deltaY===step.deltaY);submit(a);
    const moved=c.projection({role:'player',playerId:f.seatId}).state,after=quote(moved);assert.equal(after.selected.route.cost,0);assert.equal(after.value,5.5);assert.equal(moved.publicState.players.find(p=>p.playerId===f.seatId).energy,1);assert(values.evaluateStateValue(moved,f.seatId).total>=values.evaluateStateValue(saved,f.seatId).total,'the route quote does not invent arrival rewards');
    assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);
  }finally{p.close();c.dispose();}
}

// Independent exhaustive small-wallet control for the constant-size native
// 2:1 funding calculation, including nondefault nonnegative resource weights.
let controls = 0;
for (const weights of [values.DEFAULT_WEIGHTS, { ...values.DEFAULT_WEIGHTS, credits: 0, energy: 3 },
  { ...values.DEFAULT_WEIGHTS, credits: 3, energy: 0 }, { ...values.DEFAULT_WEIGHTS, credits: 0.25, energy: 2 }]) {
  for (let credits = 0; credits <= 8; credits++) for (let energy = 0; energy <= 8; energy++) {
    for (let c = 0; c <= 1; c++) for (let e = 0; e <= 4; e++) {
      let best = Infinity;
      for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
        const dc = c - x + 2 * y, de = e - y + 2 * x;
        if (dc < 0 || de < 0 || dc > credits || de > energy) continue;
        best = Math.min(best, dc * weights.credits + de * weights.energy);
      }
      const actual = probe.funding({ credits, energy }, { credits: c, energy: e }, weights);
      assert.equal(actual?.value ?? Infinity, best, JSON.stringify({ credits, energy, c, e, weights })); controls++;
    }
  }
}
console.log(JSON.stringify({ missionRewardContinuity: true, adapterParity: true, hiddenIdentityIsolation: true,
  firstAndExtraTraces: true, dataAndPublicityCaps: true, fundingControls: controls, originalAndRngUnchanged: true }));
