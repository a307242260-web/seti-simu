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
  return probe.fromObservation(obs, seatId, weights, (hand, publicity) =>
    values.handCapital(hand, p.techState, obs.publicState.board.techSupply, round, weights)
      + values.researchCapital({ hand, publicity, techState: p.techState, supply: obs.publicState.board.techSupply,
        round, researchCost: p.researchPublicityCost }, weights));
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
  const investment = (hand, publicity) => demand.heldAndResearchCapital(state, { ...own, hand, resources: { ...own.resources, publicity } });
  assert.deepEqual(probe.fromState(state, own, values.DEFAULT_WEIGHTS, investment), forecast);
  assert.equal(demand.planningCapital(state, own), demand.heldAndResearchCapital(state, own) + forecast.value);

  // Four actual native inputs consume the quoted probe, public card, scan slot
  // and income card. The analysis branch preserves its blind-draw boundary.
  const witness = read('reports/ai-foundation-20261023/human405-v99-native-witness-comparison-step35-20261031-v1.json').rows.find(r => r.name === 'student-best');
  let next = root;
  for (const step of witness.steps) {
    const a = next.legalActions.find(a => a.actionId === step.actionId); assert(a, step.summary);
    next = port.expand(next, a.actionId);
  }
  assert.equal(values.evaluateStateValue(next.observation, seatId).total, values.evaluateStateValue(obs, seatId).total);
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
  const landing = quote(land); assert.equal(landing.value, 8.5); assert.equal(landing.selected.family, 'land');
  assert.equal(landing.selected.ledger.find(e => e.type === 'alien_trace').gain.score, 5);
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
  assert(c.lifecycle.restore({...original,committedState:JSON.stringify(controlled)}).ok);
  const controlBefore=c.lifecycle.save().envelope,q=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
    q.setResourcePlanning(true);q.setCardPickPlanning(true);const root=q.openRoot(),spec=q.incomePlanSummary(root);assert(spec);
    assert(values.evaluateStateValue(root.observation,seatId).components.probePotential>0);
    const actual=q.expandResourcePlan(root,q.resourceSpec(root).plans[0],()=>null);assert(actual.complete);
    assert.equal(actual.submissions,spec.requiredNativeInputs);
    assert.equal(values.evaluateStateValue(actual.node.observation,seatId).total,
      values.evaluateStateValue(root.observation,seatId).total+spec.netGain);
    assert.deepEqual(c.lifecycle.save().envelope,controlBefore);
  }finally{q.close();}
} finally { port.close(); c.dispose(); }

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
