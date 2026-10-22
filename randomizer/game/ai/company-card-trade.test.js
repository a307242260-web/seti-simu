"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const industry = require("../industry"), effects = require("../cards/effects");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator, evaluateHandCountDelta } = require("./state-value");
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json")));
const seed = fixture.source.seed, seatId = fixture.seatId, source = JSON.parse(fixture.compositionEnvelope.committedState);
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition, ownerOf = state => state.players.players.find(player => player.id === seatId);
const evaluators = [createStateValueEvaluator(seatId), createStateValueEvaluator(seatId,
  { weights: { credits: 0.1, energy: 0.2, publicity: 0.3, availableData: 0.4, handSize: 0.07 } })];
const budget = { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 };
function restore(envelope) { const result = comp.lifecycle.restore(envelope); assert(result.ok, JSON.stringify(result)); }
function envelopeFor(label, original = source) {
  const state = structuredClone(original), owner = ownerOf(state);
  owner.initialSelection.industry = { id: `industry:${label}.png` };
  industry.ensurePlayerIndustryState(owner); industry.initializeHeliosPassiveMarkers(owner); industry.clearStrategyPassiveSlots(owner);
  owner.resources = { ...owner.resources, credits: 4, energy: 3, publicity: 3 };
  return { ...fixture.compositionEnvelope, committedState: JSON.stringify(state) };
}
let leaves = 0;
const rows = [];
function check(envelope, label) {
  let count = 0;
  for (const tradeId of ["credits-for-card", "energy-for-card", "publicity-for-card", "cards-for-pick-card"]) {
    restore(envelope); const before = comp.lifecycle.save().envelope;
    const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
    try {
      const root = port.openRoot(), action = root.legalActions.find(action => action.target?.tradeId === tradeId);
      assert(action, `${label}/${tradeId}`);
      const pending = port.expand(root, action.actionId), bound = port.cardTradeBound(pending);
      assert(bound, `${label}真实取牌待选应有公司/任务不变的数量界`);
      const values = evaluators.map(evaluate => evaluateHandCountDelta(evaluate, pending.observation, bound.handDelta));
      const exits = [];
      if (tradeId === "cards-for-pick-card") {
        const ids = port.selectionSpec(pending).cardIds;
        for (const a of ids) for (const b of ids) if (a !== b) exits.push(port.expandSelection(pending, [a, b]).node);
      } else exits.push(pending);
      for (const exit of exits) {
        assert.equal(port.cardTradeBound(exit)?.handDelta, 1);
        for (const choice of exit.legalActions) {
          const leaf = port.expand(exit, choice.actionId); assert.equal(leaf.status, "information-barrier");
          evaluators.forEach((evaluate, index) => assert.equal(evaluate(leaf.observation), values[index], `${label}/${tradeId}`));
          count += 1;
        }
        for (const evaluate of evaluators) {
          const raw = searchDecision({ port, root: exit, evaluate, budget });
          const reduced = searchDecision({ port, root: exit, evaluate, budget, cardChoiceEquivalence: true });
          assert(raw.complete && reduced.complete); assert.equal(reduced.diagnostics.transitions, 1);
          assert.equal(reduced.actionId, raw.actionId); assert.equal(reduced.value, raw.value);
          assert.equal(reduced.lines[0].distance, raw.lines[0].distance);
        }
      }
      assert.deepEqual(comp.lifecycle.save().envelope, before);
    } finally { port.close(); }
  }
  rows.push({ label, physicalLeaves: count }); leaves += count;
}
for (const label of Object.keys(industry.INDUSTRY_DEFINITIONS)) check(envelopeFor(label), label);
for (const cardId of ["b_114.webp", "dlc_9.png"]) {
  restore(fixture.compositionEnvelope);
  const id = ownerOf(source).hand.find(card => card.cardId === cardId).id;
  assert(comp.inputPort.submitAction(comp.inputPort.enumerateActions({}).find(action => action.family === "play_card"
    && action.target?.cardInstanceId === id)).ok);
  for (let guard = 0; guard < 24 && comp.inspect().phase === "awaiting_input"; guard += 1) {
    const d = comp.inspect().session.decision;
    assert(comp.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
      ownerId: d.ownerId, choice: d.choices[0] }).ok);
  }
  assert.notEqual(comp.inspect().phase, "awaiting_input");
  const actual = JSON.parse(comp.lifecycle.save().envelope.committedState);
  check(envelopeFor("异星实验室", actual), cardId);
  const ready = structuredClone(actual);
  ready.data.sectorSettlements.winsByPlayerId[seatId] = ["sector-2-a", "sector-1-a", "sector-3-a"].map(sectorId => ({ sectorId }));
  assert(effects.getCardModel(ownerOf(ready).reservedCards.find(card => card.id === id)).tasks.some(task =>
    effects.taskConditionMet(task, ownerOf(ready), { data: ready.data })));
  restore(envelopeFor("异星实验室", ready));
  const port = createAnalysisPort({ composition: comp, seatId });
  const root = port.openRoot(), pending = port.expand(root, root.legalActions.find(action => action.target?.tradeId === "credits-for-card").actionId);
  assert.equal(port.cardTradeBound(pending), null, "已可完成的任务不能使用不活动任务的界"); port.close();
}
const extra = structuredClone(source);
extra.turn.cardTurnEventBonuses = [{ id: "trade-reward", playerId: seatId, duration: "turn", eventType: "quick_trade_card_selected",
  rewards: [{ id: "trade-credit", type: "gain_resources", options: { gain: { credits: 5 } } }] }];
restore(envelopeFor("异星实验室", extra));
const observed = createAnalysisPort({ composition: comp, seatId }), root = observed.openRoot();
const pending = observed.expand(root, root.legalActions.find(action => action.target?.tradeId === "credits-for-card").actionId);
assert.equal(observed.cardTradeBound(pending), null);
assert.equal(evaluators[0](observed.expand(pending, pending.legalActions[0].actionId).observation),
  evaluateHandCountDelta(evaluators[0], pending.observation, 1) + 5);
observed.close();
const other = structuredClone(source);
other.players.players.find(player => player.id !== seatId).reservedCards = [ownerOf(other).hand.shift()];
ownerOf(other).resources.handSize = ownerOf(other).hand.length;
restore(envelopeFor("异星实验室", other));
const blocked = createAnalysisPort({ composition: comp, seatId }), blockedRoot = blocked.openRoot();
assert.equal(blocked.cardTradeBound(blocked.expand(blockedRoot, blockedRoot.legalActions.find(action =>
  action.target?.tradeId === "credits-for-card").actionId)), null); blocked.close();

function paymentRun(equivalence, reuse, cache = 0) {
  restore(envelopeFor("异星实验室"));
  assert(comp.inputPort.submitQuickAction(comp.inputPort.enumerateActions({}).find(action => action.target?.tradeId === "cards-for-pick-card")).ok);
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache }), actions = [], counts = [];
  let continuation = null, hits = 0;
  for (let step = 0; step < 4; step += 1) {
    const root = port.openRoot(), result = searchDecision({ port, root, evaluate: evaluators[0], budget,
      cardChoiceEquivalence: equivalence, cardTradePruning: true, continuation: reuse ? continuation : null, modelKey: evaluators[0].modelKey });
    assert(result.complete); if (step === 0) assert.equal(result.lines[0].edges.length, 3, "全部三个实体付款集合保留");
    if (result.diagnostics.continuation === "hit") { hits += 1; assert.equal(result.diagnostics.transitions, 0); }
    continuation = result.selectionContinuation; counts.push(result.diagnostics.transitions); actions.push(result.actionId); port.close();
    const d = comp.inspect().session.decision;
    assert(comp.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
      ownerId: d.ownerId, choice: d.choices.find(action => action.actionId === result.actionId) }).ok);
  }
  port.close(); return { actions, counts, hits, envelope: comp.lifecycle.save().envelope };
}
const rawPayment = paymentRun(false, false), equivalent = paymentRun(true, false), reused = paymentRun(true, true), cached = paymentRun(true, true, 256);
for (const result of [equivalent, reused, cached]) {
  assert.deepEqual(result.actions, rawPayment.actions); assert.deepEqual(result.envelope, rawPayment.envelope);
}
assert.equal(reused.hits, 2); assert.deepEqual(cached.counts, reused.counts);
assert(reused.counts.reduce((a, b) => a + b) < rawPayment.counts.reduce((a, b) => a + b));
comp.dispose();
console.log(JSON.stringify({ companyCardTrade: "passed", rows, physicalLeaves: leaves,
  paymentInputs: { raw: rawPayment.counts, equivalence: equivalent.counts, reused: reused.counts }, reuseHits: reused.hits }));
