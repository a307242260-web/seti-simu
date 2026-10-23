"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const cards = require("../cards/deck");
const data = require("../data");
const rockets = require("../rockets");
const solar = require("../../solar-system/core");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator, evaluateHandCountDelta } = require("./state-value");

const initial = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const seed = "inert-visit-reservation-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
assert.equal(comp.lifecycle.restore(initial).ok, true);
const source = JSON.parse(initial.committedState), seatId = source.turn.currentPlayerId;
const b44 = source.players.players.find(player => player.id === seatId).hand.find(card => card.cardId === "b_44.webp");
assert.equal(comp.inputPort.submitAction(comp.inputPort.enumerateActions({}).find(action => action.family === "play_card"
  && action.target?.cardInstanceId === b44.id)).ok, true);
const post = comp.lifecycle.save().envelope, postState = JSON.parse(post.committedState);
assert.equal(postState.players.players.find(player => player.id === seatId).reservedCards[0].cardId, "b_44.webp");
const evaluate = createStateValueEvaluator(seatId);
const fractional = createStateValueEvaluator(seatId, { weights: { credits: 0.1, energy: 0.2, handSize: 0.07 } });
function open(state, cache = 0) {
  const restored = comp.lifecycle.restore({ ...post, committedState: JSON.stringify(state) });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const before = comp.lifecycle.save().envelope;
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { port, root: port.openRoot(), before };
}
const prepared = structuredClone(postState), player = prepared.players.players.find(player => player.id === seatId);
prepared.cards.discardPile.push(...player.hand.splice(1));
player.resources = { ...player.resources, credits: 2, energy: 2, publicity: 1, handSize: 1, availableData: 0 };
player.dataState = { poolTokens: [], placedTokens: [], discardedCount: 0 };
for (let i = 0; i < 2; i += 1) assert(data.gainData(player, { root: prepared }).ok);
player.techState.ownedTiles.blue2 = true;
player.techState.blueBoardSlots.blue2 = 1;
prepared.tech.stacks.blue2.remaining -= 1;
function run(enabled, cache = 0) {
  const { port, root, before } = open(prepared, cache);
  assert(port.postMainPlanSpec(root), "无本席探测器的B44不能在主行动后产生访问行星事件");
  const result = searchDecision({ port, root, evaluate, postMainPruning: enabled,
    budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 10000 } });
  assert.equal(result.complete, true, result.stopReason);
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
  return result;
}
const raw = run(false), pruned = run(true), cached = run(true, 256);
for (const result of [pruned, cached]) {
  assert.equal(result.actionId, raw.actionId);
  assert.equal(result.value, raw.value);
  assert.equal(result.lines[0].distance, raw.lines[0].distance);
  assert(result.diagnostics.transitions < raw.diagnostics.transitions);
}

function step(port, node, predicate) {
  const action = node.legalActions.find(predicate); assert(action); return port.expand(node, action.actionId);
}
// 有本席探测器时B44的木星数据会解锁蓝列得分，整条移动准备链不能删除。
const active = structuredClone(prepared), owner = active.players.players.find(player => player.id === seatId);
owner.dataState.poolTokens = []; owner.resources.availableData = 0;
const jupiter = solar.createSolarSnapshot(active.solarSystem).planetLocations.find(planet => planet.planetId === "jupiter");
const launched = rockets.launchRocketAtSector(active.pieces, { x: jupiter.x - 1, y: jupiter.y },
  { root: active, playerId: seatId, color: owner.color });
assert(launched.ok);
const visit = open(active);
assert.equal(visit.port.postMainPlanSpec(visit.root), null);
const payment = step(visit.port, visit.root, action => action.family === "move" && action.target?.rocketId === launched.rocket.id
  && action.target?.deltaX === 1 && action.target?.deltaY === 0);
const afterMove = step(visit.port, payment, action => action.target?.choiceId === "energy");
const arrived = step(visit.port, afterMove, action => action.target?.ruleId === "b44-jupiter-data");
const self = node => node.observation.publicState.players.find(player => player.playerId === seatId);
assert.equal(self(arrived).availableData, 1, "真实访问木星获得B44数据，未伪造额外资源");
const skipped = step(visit.port, afterMove, action => action.target?.choiceId === "skip:visitPlanet");
assert.equal(self(skipped).availableData, 0, "接受与跳过是不同正式输入，必须分别保留");
const placement = step(visit.port, arrived, action => action.family === "place_data");
const scored = step(visit.port, placement, action => action.target?.target === "computer");
assert(evaluate(scored.observation) > evaluate(visit.root.observation), "移动连带的数据准备链确实有净收益");
assert.deepEqual(comp.lifecycle.save().envelope, visit.before);
visit.port.close();

// 同一张B44在取牌交易内不能收到访问事件；即使有探测器，全部数值出口仍相同。
let leaves = 0;
for (const state of [postState, active]) {
  const { port, root, before } = open(state);
  for (const tradeId of ["credits-for-card", "energy-for-card", "publicity-for-card", "cards-for-pick-card"]) {
    const action = root.legalActions.find(action => action.target?.tradeId === tradeId);
    if (!action) continue;
    const pending = port.expand(root, action.actionId), bound = port.cardTradeBound(pending);
    assert(bound, "取牌不产生访问事件，B44不能破坏该数值界");
    const choices = bound.handDelta === 1 ? [pending] : [...port.selectionPlans(pending)]
      .map(plan => port.expandSelection(pending, plan.selectedIds).node);
    for (const choice of choices) {
      const expected = evaluateHandCountDelta(evaluate, choice.observation, 1);
      const fractionalExpected = evaluateHandCountDelta(fractional, choice.observation, 1);
      for (const action of choice.legalActions) {
        const leaf = port.expand(choice, action.actionId);
        assert.equal(leaf.status, "information-barrier");
        assert.equal(evaluate(leaf.observation), expected);
        assert.equal(fractional(leaf.observation), fractionalExpected);
        leaves += 1;
      }
      const reduced = searchDecision({ port, root: choice, evaluate, cardChoiceEquivalence: true });
      assert.equal(reduced.complete, true);
      assert.equal(reduced.value, expected);
      assert.equal(reduced.diagnostics.transitions, 1);
    }
  }
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
}
assert.equal(leaves, 40, "无探测器34个组合出口及有探测器6个出口均实际提交");
function declinedPostMain(state) {
  const { port, root, before } = open(state);
  assert.equal(port.postMainPlanSpec(root), null);
  const draw = root.legalActions.find(action => action.target?.tradeId === "credits-for-card");
  if (draw) {
    const pending = port.expand(root, draw.actionId), bound = port.cardTradeBound(pending);
    assert.equal(bound?.handDelta, 1, "主行动后证明仍拒绝，但交易窗口内无额外事件或手牌计分变化");
    for (const choice of pending.legalActions) {
      const leaf = port.expand(pending, choice.actionId);
      assert.equal(leaf.status, "information-barrier");
      for (const model of [evaluate, fractional]) assert.equal(model(leaf.observation), evaluateHandCountDelta(model, pending.observation, 1));
    }
  }
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
}
const opponent = structuredClone(prepared);
opponent.players.players.find(player => player.id !== seatId).reservedCards.push(
  opponent.players.players.find(player => player.id === seatId).reservedCards.pop());
declinedPostMain(opponent);
const unknown = structuredClone(prepared), unknownOwner = unknown.players.players.find(player => player.id === seatId);
const entry = cards.CARD_CATALOG.find(card => card.card_id === "b_45.webp");
assert(unknown.cards.drawPileCardIds.includes(entry.card_id));
unknown.cards.drawPileCardIds = unknown.cards.drawPileCardIds.filter(id => id !== entry.card_id);
unknownOwner.reservedCards.push(cards.createCommittedCardInstance(unknown, entry));
declinedPostMain(unknown);
comp.dispose();
console.log(JSON.stringify({ inertReservation: "passed", rawInputs: raw.diagnostics.transitions,
  prunedInputs: pruned.diagnostics.transitions, boundLeaves: leaves }));
