"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const cards = require("../cards/deck");

const initial = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const seed = "opening-money-proof-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
const state = JSON.parse(initial.committedState), seatId = state.turn.currentPlayerId;
const evaluate = createStateValueEvaluator(seatId);
assert.equal(comp.lifecycle.restore(initial).ok, true);
const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
const root = port.openRoot();
assert(port.openingResourceOrder(root));
assert.equal(port.postMainResourceOrder(root), null);
function trade(node, tradeId) {
  const action = node.legalActions.find(action => action.target?.tradeId === tradeId);
  assert(action);
  return port.expand(node, action.actionId);
}
const first = trade(root, "credits-for-energy");
const upper = trade(first, "energy-for-credit");
const lower = trade(trade(upper, "credits-for-energy"), "energy-for-credit");
const a = port.openingResourceOrder(upper), b = port.openingResourceOrder(lower);
assert.equal(a.group, b.group);
assert.equal(a.credits - b.credits, 1);
assert.equal(a.energy - b.energy, 1);
assert.equal(b.energy, 0, "真实钱电循环必须覆盖零钱电条件点");
const actionKey = action => JSON.stringify([action.family, action.target, action.payload]);
function otherFacts(observation) {
  const copy = structuredClone(observation);
  for (const key of Object.keys(copy)) if (key.endsWith("Requirements")) delete copy[key];
  const owner = copy.publicState.players.find(player => player.playerId === seatId);
  delete owner.credits;
  delete owner.energy;
  return copy;
}
for (const action of lower.legalActions) {
  const match = upper.legalActions.find(candidate => actionKey(candidate) === actionKey(action));
  assert(match, actionKey(action));
  const high = port.expand(upper, match.actionId), low = port.expand(lower, action.actionId);
  assert.equal(high.status, low.status);
  assert.equal(high.boundary, low.boundary);
  assert.deepEqual(otherFacts(high.observation), otherFacts(low.observation), actionKey(action));
  assert.equal(evaluate(high.observation) - evaluate(low.observation), 2);
}
assert.deepEqual(comp.lifecycle.save().envelope, initial);
port.close();

// 非空反例：有两枚本席探测器时，零电 dlc27 会多得2电，较富者反而只剩1电。
const probes = structuredClone(state);
const owner = probes.players.players.find(player => player.id === seatId);
for (const rocket of probes.pieces.rockets) {
  rocket.playerId = seatId;
  rocket.color = owner.color;
}
probes.pieces.playerRocketSequences[seatId] = probes.pieces.rockets.map(rocket => rocket.playerSequence);
function playSolar(energy) {
  const changed = structuredClone(probes);
  changed.players.players.find(player => player.id === seatId).resources.energy = energy;
  const envelope = { ...structuredClone(initial), committedState: JSON.stringify(changed) };
  const restored = comp.lifecycle.restore(envelope);
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const analysis = createAnalysisPort({ composition: comp, seatId });
  const node = analysis.openRoot();
  assert.equal(analysis.openingResourceOrder(node), null);
  const solar = node.legalActions.find(action => action.family === "play_card"
    && action.target?.cardInstanceId === owner.hand[0].id);
  const after = analysis.expand(node, solar.actionId);
  const result = after.observation.publicState.players.find(player => player.playerId === seatId).energy;
  analysis.close();
  return result;
}
assert.equal(playSolar(0), 2);
assert.equal(playSolar(1), 1);

function openingFacet(source) {
  const envelope = { ...structuredClone(initial), committedState: JSON.stringify(source) };
  const restored = comp.lifecycle.restore(envelope);
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const analysis = createAnalysisPort({ composition: comp, seatId });
  const descriptor = analysis.openingResourceOrder(analysis.openRoot());
  analysis.close();
  return descriptor;
}
const unreviewed = structuredClone(state);
const unreviewedId = unreviewed.cards.drawPileCardIds.find(id => !state.players.players
  .find(player => player.id === seatId).hand.some(card => card.cardId === id));
const unreviewedEntry = cards.CARD_CATALOG.find(card => card.card_id === unreviewedId);
cards.addCardToHand(unreviewed.players.players.find(player => player.id === seatId),
  cards.createCommittedCardInstance(unreviewed, unreviewedEntry));
unreviewed.cards.drawPileCardIds = unreviewed.cards.drawPileCardIds.filter(id => id !== unreviewedId);
assert.equal(openingFacet(unreviewed), null, "未逐张审计的手牌不能使用首窗口证明");
const withTech = structuredClone(state);
const techOwner = withTech.players.players.find(player => player.id === seatId);
techOwner.techState.ownedTiles.blue2 = true;
techOwner.techState.blueBoardSlots.blue2 = 1;
withTech.tech.stacks.blue2.remaining -= 1;
assert.equal(openingFacet(withTech), null, "主行动前的科技与公司能力组合未进入首窗口证明");

// 小型完整主行动窗口：不以预算截断或仅比较已找到叶替代完整对照。
const small = structuredClone(state), smallOwner = small.players.players.find(player => player.id === seatId);
small.cards.discardPile.push(...smallOwner.hand);
smallOwner.hand = [];
smallOwner.resources = { ...smallOwner.resources, credits: 4, energy: 2, publicity: 0, availableData: 0, handSize: 0 };
smallOwner.dataState = { poolTokens: [], placedTokens: [], discardedCount: 0 };
const smallEnvelope = { ...structuredClone(initial), committedState: JSON.stringify(small) };
assert.equal(comp.lifecycle.restore(smallEnvelope).ok, true);
const smallBefore = comp.lifecycle.save().envelope;
function run(enabled, pruneCardTrades = false) {
  const beforeSearch = comp.lifecycle.save().envelope;
  const analysis = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
  const node = analysis.openRoot();
  assert(analysis.openingResourceOrder(node));
  const result = searchDecision({ port: analysis, root: node, evaluate, resourceDominance: enabled, cardTradePruning: pruneCardTrades,
    budget: { transitions: 2048, nodes: 2049, frontier: 2048, milliseconds: 6000 } });
  analysis.close();
  assert.equal(result.complete, true, result.stopReason);
  assert.deepEqual(comp.lifecycle.save().envelope, beforeSearch);
  return result;
}
const raw = run(false), pruned = run(true);
assert.equal(pruned.value, raw.value);
assert.equal(pruned.actionId, raw.actionId);
assert(pruned.diagnostics.dominancePrunes > 0);
assert(pruned.lines.some(line => line.prunedBy?.proof === "seti-helios-opening-money-simulation-v1"),
  "完整小窗口必须实际使用主行动前证明，不能只测到已有主行动后剪枝");
assert(pruned.diagnostics.transitions < raw.diagnostics.transitions);
const bounded = run(true, true);
assert.equal(bounded.value, raw.value);
assert.equal(bounded.actionId, raw.actionId);
assert(bounded.diagnostics.cardTradePrunes > 0);
assert(bounded.diagnostics.transitions < pruned.diagnostics.transitions,
  "已完成真实竞争线严格胜过上界时才省略取牌子树，完整窗口最优不变");
for (const line of bounded.lines.filter(line => line.prunedByBound)) {
  const witness = bounded.lines[line.prunedByBound.node];
  assert(["other-owner", "information-barrier", "terminal"].includes(witness.status));
  assert.equal(witness.value, line.prunedByBound.value);
  assert(witness.value > line.prunedByBound.upperBound);
  assert.equal(line.value, null, "真实被省略分支的值不能用竞争叶填充");
}
const hiddenSwap = structuredClone(smallBefore);
const swapped = JSON.parse(hiddenSwap.committedState);
swapped.cards.drawPileCardIds.reverse();
hiddenSwap.committedState = JSON.stringify(swapped);
assert.equal(comp.lifecycle.restore(hiddenSwap).ok, true);
const hiddenBounded = run(true, true);
assert.equal(hiddenBounded.actionId, bounded.actionId);
assert.equal(hiddenBounded.value, bounded.value);
assert.equal(hiddenBounded.diagnostics.transitions, bounded.diagnostics.transitions);
assert.equal(hiddenBounded.diagnostics.cardTradePrunes, bounded.diagnostics.cardTradePrunes,
  "替换隐藏未来牌序不改变完整窗口的选择、值或上界剪枝");
comp.dispose();
console.log(JSON.stringify({ openingMoney: "passed", rawInputs: raw.diagnostics.transitions,
  prunedInputs: pruned.diagnostics.transitions, boundedInputs: bounded.diagnostics.transitions,
  proofPrunes: pruned.diagnostics.dominancePrunes, cardTradePrunes: bounded.diagnostics.cardTradePrunes }));
