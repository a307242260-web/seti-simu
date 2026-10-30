"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const cards = require("../cards/deck"), data = require("../data");
const read = id => JSON.parse(fs.readFileSync(path.resolve(__dirname,
  `../../../adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`)));
const original = read("062"), alien = read("008"), rows = [], passRows = [];
function configure(fixture, ids, { round, energy = 0 } = {}) {
  const state = JSON.parse(fixture.compositionEnvelope.committedState), owner = state.players.players.find(p => p.id === fixture.seatId);
  state.cards.discardPile.push(...owner.hand.filter(c => !ids.includes(c.cardId)));
  owner.hand = owner.hand.filter(c => ids.includes(c.cardId)); assert.equal(owner.hand.length, ids.length);
  if (round) state.turn.roundNumber = round;
  owner.industryRoundMarkRound = state.turn.roundNumber; owner.industryRoundMarkTurn = state.turn.turnNumber;
  Object.assign(owner.resources, { credits: 0, energy, publicity: 0, availableData: 0, handSize: owner.hand.length });
  owner.dataState = data.createDefaultDataState(); owner.blueBonusResources = { credits: 0, energy: 0 };
  for (let i = 0; i < 4; i += 1) assert(data.gainData(owner, { root: state }).ok);
  return { ...fixture, compositionEnvelope: { ...fixture.compositionEnvelope, committedState: JSON.stringify(state) } };
}
function open(fixture, cache = 0) {
  const seed = fixture.source.seed, k = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (s, v) => buildRuleObservation(s, seed, v?.playerId) });
  k.newGame({ seed }); const restored = k.composition.lifecycle.restore(fixture.compositionEnvelope); assert(restored.ok, JSON.stringify(restored));
  const before = k.composition.lifecycle.save().envelope, port = createAnalysisPort({ composition: k.composition, seatId: fixture.seatId, maxCacheEntries: cache });
  return { k, port, root: port.openRoot(), before };
}
const budget = { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 };
function run(fixture, enabled, cache = 0) {
  const { k, port, root, before } = open(fixture, cache);
  try {
    const proof = port.preMainDataPlanSpec(root); assert(proof);
    const out = searchDecision({ port: enabled ? port : { ...port, preMainDataPlanSpec: () => null }, root,
      evaluate: createStateValueEvaluator(fixture.seatId), openingPruning: true, postMainPruning: true,
      resourceDominance: true, cardTradePruning: true, cardChoiceEquivalence: true, budget });
    assert(out.complete, out.stopReason); assert.deepEqual(k.composition.lifecycle.save().envelope, before);
    if (enabled&&root.observation.publicState.roundNumber===4) { assert(out.diagnostics.preMainDataProofNodes > 0);
      for (const id of proof.excludedActionIds) { const excluded = out.roots.find(r => r.actionId === id);
        assert.equal(excluded.valueType, "not-executed"); assert.equal(excluded.value, null); assert(excluded.prunedByPlan.witness); }
    }
    return out;
  } finally { port.close(); k.composition.dispose(); }
}
const cases = [["one-cash-round2", configure(original, ["dlc_40.png"])],
  ["one-cash-round4", configure(original, ["dlc_40.png"], { round: 4 })],
  ["cash-and-move", configure(original, ["dlc_40.png", "b_10.webp"], { energy: 1 })],
  ["main-return", configure(original, ["dlc_40.png", "dlc_5.png"])],
  ["alien-composed", configure(alien, ["b_86.webp"])]];
// 同时存在原异星实验室准备证明时，保留两份证明的完整归属。
const combined = JSON.parse(cases.at(-1)[1].compositionEnvelope.committedState);
Object.assign(combined.players.players.find(p => p.id === alien.seatId).resources, { credits: 3, energy: 2 });
cases.at(-1)[1].compositionEnvelope.committedState = JSON.stringify(combined);
for (const [label, fixture] of cases) {
  const raw = run(fixture, false), pruned = run(fixture, true), cached = run(fixture, true, 256);
  for (const out of [pruned, cached]) { assert.equal(out.actionId, raw.actionId); assert.equal(out.value, raw.value);
    assert.equal(out.lines[0].distance, raw.lines[0].distance); assert(out.diagnostics.transitions <= raw.diagnostics.transitions); }
  if(label==="alien-composed")assert.equal(pruned.diagnostics.preMainDataProofNodes,0,"Round1 capital model does not compose a linear-only theorem");
  rows.push({ label, raw: raw.diagnostics.transitions, pruned: pruned.diagnostics.transitions, value: pruned.value });
}
function step(port, node, predicate) { const action = node.legalActions.find(predicate); assert(action); return port.expand(node, action.actionId); }
function income(port, root, id) {
  let node = root;
  for (let i = 0; i < 4; i += 1) { node = step(port, node, a => a.family === "place_data"); node = step(port, node, a => a.target?.target === "computer"); }
  return step(port, node, a => a.target?.cardInstanceId === id && String(a.target?.choiceId).startsWith("income:"));
}
for (const round of [2, 3, 4]) {
  const f = configure(original, ["dlc_23.png", "dlc_40.png", "dlc_5.png", "dlc_30.png", "b_10.webp"], { round });
  const { k, port, root, before } = open(f), evaluate = createStateValueEvaluator(f.seatId);
  assert.equal(Boolean(port.preMainDataPlanSpec(root)), round === 2);
  const corner = step(port, root, a => a.family === "card_corner" && a.target?.cardInstanceId === "card-40-0");
  const oldPass = step(port, corner, a => a.family === "pass"), cash = income(port, root, "card-40-0");
  const newPass = step(port, cash, a => a.family === "pass");
  assert(["other-owner", "information-barrier"].includes(oldPass.status)); assert.equal(newPass.status, oldPass.status);
  const delta = evaluate(newPass.observation) - evaluate(oldPass.observation);
  if (round === 2) assert(delta > 0);
  if (round === 3) assert.equal(delta, 0, "同值但原角标+PASS只有2输入，现金替代10输入，不能删除最短路径");
  if (round === 4) assert(delta < 0, "第4轮不能把插收入假定为优于用角标避免强制弃牌");
  assert.deepEqual(k.composition.lifecycle.save().envelope, before); passRows.push({ round, delta, oldInputs: 2, replacementInputs: 10 });
  port.close(); k.composition.dispose();
}
function reject(fixture) { const { k, port, root } = open(fixture); assert.equal(port.preMainDataPlanSpec(root), null); port.close(); k.composition.dispose(); }
function changed(fixture, mutate) { const f = structuredClone(fixture), state = JSON.parse(f.compositionEnvelope.committedState); mutate(state, state.players.players.find(p => p.id === f.seatId)); f.compositionEnvelope.committedState = JSON.stringify(state); return f; }
const one = cases[0][1];
reject(changed(one, (_s, p) => { p.mainActionCompleted = true; }));
reject(changed(one, (s, p) => { p.techState.ownedTiles.blue1 = true; p.techState.blueBoardSlots.blue1 = 1; s.tech.stacks.blue1.remaining -= 1; }));
const analysis = changed(one, (s, p) => { assert(data.gainData(p, { root: s }).ok); p.resources.energy = 2; }); reject(analysis);
const window = open(analysis); let n = step(window.port, window.root, a => a.family === "card_corner");
for (let i = 0; i < 6; i += 1) { n = step(window.port, n, a => a.family === "place_data"); n = step(window.port, n, a => a.target?.target === "computer"); }
assert(n.legalActions.some(a => a.family === "analyze"), "多出的第六数据确实可解锁主行动，必须保留"); window.port.close(); window.k.composition.dispose();
// 真实卡牌实体从原位置搬入；不创建重复的已占用卡。
function reserveOrReplace(fixture, cardId, reserve) { return changed(fixture, (s, p) => {
  const lists = [s.cards.discardPile, s.cards.publicCards, ...Object.values(s.cards.passReservePiles), ...s.players.players.flatMap(p => [p.hand, p.reservedCards])];
  let card;
  for (const list of lists) { const index = list.findIndex(c => c?.cardId === cardId); if (index >= 0) { card = list[index]; if (list === s.cards.publicCards) list[index] = null; else list.splice(index, 1); break; } }
  if (!card) { assert(s.cards.drawPileCardIds.includes(cardId)); card = cards.createCommittedCardInstance(s, cards.CARD_CATALOG.find(c => c.card_id === cardId)); s.cards.drawPileCardIds = s.cards.drawPileCardIds.filter(id => id !== cardId); }
  if (reserve) p.reservedCards.push(card); else p.hand.push(card); p.resources.handSize = p.hand.length;
}); }
for (const [id, reserve] of [["dlc_16.png", false], ["dlc_35.png", true], ["dlc_8.png", false], ["b_26.webp", true], ["b_10.webp", true]]) reject(reserveOrReplace(one, id, reserve));
const limited = open(one), proof = limited.port.preMainDataPlanSpec(limited.root);
const stopped = searchDecision({ port: limited.port, root: limited.root, evaluate: createStateValueEvaluator(one.seatId), openingPruning: true,
  budget: { transitions: 1, nodes: 4097, frontier: 4096, milliseconds: 15000 } });
assert(!stopped.complete); assert.equal(stopped.actionId, null);
const pending=stopped.roots.find(r=>proof.excludedActionIds.includes(r.actionId));assert(pending);
if(limited.root.observation.publicState.roundNumber===4)assert.equal(pending.prunedByPlan.witness,null);else assert.equal(pending.prunedByPlan,undefined,"an incompatible theorem cannot fabricate pending exclusion evidence");assert.equal(stopped.planContinuation,null);
limited.port.close(); limited.k.composition.dispose();
console.log(JSON.stringify({ preMainDataPlan: "passed", rows, passRows }));
