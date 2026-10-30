"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const cards = require("../cards/deck");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json")));
const source = JSON.parse(fixture.compositionEnvelope.committedState), seatId = fixture.seatId, seed = fixture.source.seed;
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition, evaluate = createStateValueEvaluator(seatId);
const ownerOf = state => state.players.players.find(p => p.id === seatId);
function open(state, cache = 0) {
  const result = comp.lifecycle.restore({ ...fixture.compositionEnvelope, committedState: JSON.stringify(state) });
  assert(result.ok, JSON.stringify(result));
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { port, root: port.openRoot(), before };
}
const semanticBudget = { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 };
function run(state, enabled, cache = 0) {
  const { port, root, before } = open(state, cache);
  try {
    const proof = port.openingPlanSpec(root);
    assert(proof, "已筹足钱电的三张已审计牌仍保留全部主行动和数据收入线");
    for (const action of root.legalActions.filter(a => a.phase === "main" || a.family === "place_data")) {
      assert(proof.retainedActionIds.includes(action.actionId), `${action.family}不得被准备归约遗漏`);
    }
    for (const action of root.legalActions.filter(a => a.family === "card_corner")) {
      assert.equal(proof.retainedActionIds.includes(action.actionId), action.payload.kind !== "move");
    }
    const native=enabled?port:{...port,postMainValueBound:()=>null,turnTailSummary:()=>null,incomePlanSummary:()=>null};
    const result = searchDecision({ port:native, root, evaluate, ...require('./search-agent').OPTIONS, planReuse:false,
      budget: semanticBudget });
    assert(result.complete, result.stopReason);
    assert.deepEqual(comp.lifecycle.save().envelope, before);
    return result;
  } finally { port.close(); }
}
const full = run(source, true), cached = run(source, true, 256);
assert.equal(cached.actionId, full.actionId); assert.equal(cached.value, full.value);
assert.equal(cached.lines[0].distance, full.lines[0].distance);
assert.equal(cached.diagnostics.transitions, full.diagnostics.transitions);
const small = [];
for (const cardId of [null, "dlc_9.png", "b_86.webp", "b_114.webp"]) {
  const state = structuredClone(source), owner = ownerOf(state);
  state.cards.discardPile.push(...owner.hand.filter(card => card.cardId !== cardId));
  owner.hand = owner.hand.filter(card => card.cardId === cardId); owner.resources.handSize = owner.hand.length;
  owner.resources.credits = 3;
  const raw = run(state, false), reduced = run(state, true);
  assert.equal(reduced.actionId, raw.actionId); assert.equal(reduced.value, raw.value);
  assert.equal(reduced.lines[0].distance, raw.lines[0].distance);
  assert(reduced.diagnostics.transitions <= raw.diagnostics.transitions);
  small.push({ cardId, rawInputs: raw.diagnostics.transitions, prunedInputs: reduced.diagnostics.transitions, value: reduced.value });
}
function declined(mutate) {
  const state = structuredClone(source); mutate(state, ownerOf(state));
  const { port, root } = open(state);
  try { assert.equal(port.openingPlanSpec(root), null); } finally { port.close(); }
}
declined((_s, p) => { p.resources.credits = 2; });
declined((_s, p) => { p.resources.energy = 1; });
declined((_s, p) => { p.hand[0].price += 1; });
declined((s) => { s.turn.passedPlayerIds = s.turn.activePlayerIds.filter(id => id !== seatId); });
declined((s) => { s.cards.passReservePiles[s.turn.roundNumber] = []; });
declined((s, p) => {
  const entry = cards.CARD_CATALOG.find(entry => !p.hand.some(c => c.cardId === entry.card_id)
    && s.cards.drawPileCardIds.includes(entry.card_id));
  s.cards.drawPileCardIds = s.cards.drawPileCardIds.filter(id => id !== entry.card_id);
  cards.addCardToHand(p, cards.createCommittedCardInstance(s, entry));
});
const wrong = open(source);
assert.throws(() => searchDecision({ port: wrong.port, root: wrong.root,
  evaluate: createStateValueEvaluator(seatId, { weights: { credits: 2 } }), openingPruning: true }), /OPENING_MODEL_INVALID/);
wrong.port.close(); comp.dispose();
console.log(JSON.stringify({ alienOpeningPlan: "passed", fullInputs: full.diagnostics.transitions, value: full.value, small }));
