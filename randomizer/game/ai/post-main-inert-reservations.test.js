"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const data = require("../data"), effects = require("../cards/effects"), cards = require("../cards/deck");
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../adhoc/ai-decision-corpus-20261023-v1/case-152-20261023-v1.json")));
const seed = fixture.source.seed, seatId = fixture.seatId, rows = [];
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s, viewer) => buildRuleObservation(s, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);
const played = comp.inputPort.enumerateActions({}).find(a => a.family === "play_card" && a.target?.cardInstanceId === "card-41-0");
assert(played && comp.inputPort.submitAction(played).ok);
const movement = comp.inspect().session.decision, skip = movement.choices.find(a => a.target?.skip);
assert(skip && comp.inputPort.submitDecision({ decisionId: movement.decisionId, decisionVersion: movement.decisionVersion,
  ownerId: movement.ownerId, choice: skip }).ok);
assert.notEqual(comp.inspect().phase, "awaiting_input");
const actualEnvelope = comp.lifecycle.save().envelope, actual = JSON.parse(actualEnvelope.committedState);
function open(state, cache = 0) {
  assert(comp.lifecycle.restore({ ...actualEnvelope, committedState: JSON.stringify(state) }).ok);
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { port, root: port.openRoot(), before };
}
const initial = open(actual);
assert(initial.port.postMainPlanSpec(initial.root), "真实152打出DLC39后的不活动保留牌不能迫使所有亏损准备继续展开");
initial.port.close();
const evaluate = createStateValueEvaluator(seatId);
const budget = { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 };
function run(state, enabled, cache = 0) {
  const { port, root, before } = open(state, cache);
  try {
    assert(port.postMainPlanSpec(root));
    const out = searchDecision({ port, root, evaluate, postMainPruning: enabled, budget });
    assert(out.complete, out.stopReason);
    assert.deepEqual(comp.lifecycle.save().envelope, before);
    if (enabled) for (const exclusion of out.roots.filter(row => row.prunedByPlan)) {
      assert.equal(exclusion.valueType, "not-executed"); assert.equal(exclusion.value, null);
      const witness = out.lines[exclusion.prunedByPlan.witness.node];
      assert(["other-owner", "information-barrier"].includes(witness.status));
    }
    return out;
  } finally { port.close(); }
}
function controlled(ids, { pool = 0, placed = 0, energy = 0, noProbe = false } = {}) {
  const state = structuredClone(actual), p = state.players.players.find(p => p.id === seatId);
  state.cards.discardPile.push(...p.hand.filter(c => !ids.includes(c.cardId)));
  p.hand = p.hand.filter(c => ids.includes(c.cardId)); assert.equal(p.hand.length, ids.length);
  Object.assign(p.resources, { credits: 0, energy, publicity: 0, availableData: 0, handSize: p.hand.length });
  p.blueBonusResources = { credits: 0, energy: 0 }; p.dataState = data.createDefaultDataState();
  for (let i = 0; i < placed; i += 1) { assert(data.gainData(p, { root: state }).ok); assert(data.placeDataToComputer(p).ok); }
  for (let i = 0; i < pool; i += 1) assert(data.gainData(p, { root: state }).ok);
  if (noProbe) state.pieces.rockets = state.pieces.rockets.filter(r => ![r.playerId, r.color, r.playerColor].some(id => [seatId, p.color].includes(id)));
  return state;
}
function transfer(state, cardId) {
  const owner = state.players.players.find(p => p.id === seatId), source = state.players.players.find(p => p.reservedCards.some(c => c.cardId === cardId));
  assert(source && source !== owner); const card = source.reservedCards.find(c => c.cardId === cardId);
  source.reservedCards = source.reservedCards.filter(c => c !== card); owner.reservedCards.push(card); return card;
}
const income = controlled(["b_109.webp", "dlc_12.png"], { pool: 1, placed: 3 });
const moving = controlled(["b_65.webp", "b_62.webp"], { energy: 1 });
const exhausted = structuredClone(moving), used = transfer(exhausted, "b_71.webp");
for (const trigger of effects.getCardModel(used).triggers) assert(effects.consumeTrigger(used, trigger.id));
const inactive = structuredClone(moving); transfer(inactive, "dlc_23.png");
const noProbe = controlled(["b_65.webp", "b_62.webp"], { noProbe: true }); transfer(noProbe, "b_71.webp");
for (const [label, state] of [["cash-data-income", income], ["cash-move", moving], ["consumed-visits", exhausted],
  ["unreachable-launch-orbit-land", inactive], ["no-probe-visits", noProbe]]) {
  const raw = run(state, false), pruned = run(state, true), cached = run(state, true, 256);
  for (const out of [pruned, cached]) { assert.equal(out.actionId, raw.actionId); assert.equal(out.value, raw.value);
    assert.equal(out.lines[0].distance, raw.lines[0].distance); assert(out.diagnostics.transitions < raw.diagnostics.transitions); }
  rows.push({ label, raw: raw.diagnostics.transitions, pruned: pruned.diagnostics.transitions, value: pruned.value });
}
function reject(state) { const { port, root } = open(state); assert.equal(port.postMainPlanSpec(root), null); port.close(); }
const beforeMain = structuredClone(moving); beforeMain.players.players.find(p => p.id === seatId).mainActionCompleted = false; reject(beforeMain);
const availableVisit = structuredClone(moving); transfer(availableVisit, "b_71.webp"); reject(availableVisit);
const stale = structuredClone(exhausted); stale.players.players.find(p => p.id === seatId).reservedCards.find(c => c.cardId === "b_71.webp").cardEffectState.modelCardId = "old-model"; reject(stale);
const historical = structuredClone(inactive); historical.turn.type1TriggerEvents = [{ type: "launch", playerId: seatId, rocketId: 4 }]; reject(historical);
const past = open(historical), end = past.root.legalActions.find(a => a.family === "end_turn"), pending = past.port.expand(past.root, end.actionId);
assert.equal(pending.status, "decision", "历史发射事件必须在正式回合末产生待选奖励"); past.port.close();
const ready = structuredClone(moving), owner = ready.players.players.find(p => p.id === seatId), blue = ready.aliens.aliens["1"].traces.blue;
Object.assign(blue, { firstPlaced: true, ownerPlayerColor: owner.color, extraCount: 2, extraMarkers: [{ ownerPlayerColor: owner.color }, { ownerPlayerColor: owner.color }] });
ready.aliens.aliens["1"].traces.pink.firstPlaced = false;
const task = effects.getCardModel(owner.reservedCards.find(c => c.cardId === "b_12.webp")).tasks[0];
assert(effects.taskConditionMet(task, owner, { data: ready.data, aliens: ready.aliens })); reject(ready);
const scoring = structuredClone(moving), entry = cards.CARD_CATALOG.find(c => scoring.cards.drawPileCardIds.includes(c.card_id)
  && effects.getCardModel(c.card_id)?.endGameScoring?.kind === "probeLocation");
assert(entry); scoring.cards.drawPileCardIds = scoring.cards.drawPileCardIds.filter(id => id !== entry.card_id);
scoring.players.players.find(p => p.id === seatId).reservedCards.push(cards.createCommittedCardInstance(scoring, entry)); reject(scoring);
const actualResult = run(actual, true);
rows.push({ label: "actual152-after-dlc39", pruned: actualResult.diagnostics.transitions, value: actualResult.value,
  actionId: actualResult.actionId, distance: actualResult.lines[0].distance, scope: "Actual formal continuation; no unpruned complete-graph comparison claimed." });
comp.dispose();
console.log(JSON.stringify({ postMainInertReservations: "passed", rows }));
