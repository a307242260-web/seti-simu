"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const cards = require("../cards/deck");
const data = require("../data");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");

const initial = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const seed = "quiet-post-main-movement-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
assert.equal(comp.lifecycle.restore(initial).ok, true);
const launch = comp.inputPort.enumerateActions({}).find(action => action.family === "launch");
assert(launch);
const seatId = launch.actorId, evaluate = createStateValueEvaluator(seatId);
assert.equal(comp.inputPort.submitAction(launch).ok, true);
const launched = comp.lifecycle.save().envelope;
function fixture(pool = 0, energy = 1, moveCards = 1) {
  const state = JSON.parse(launched.committedState), owner = state.players.players.find(player => player.id === seatId);
  state.cards.discardPile.push(...owner.hand);
  owner.hand = [];
  for (let i = 0; i < moveCards; i += 1) {
    const entry = cards.CARD_CATALOG.find(card => card.discard_action_code === 2
      && state.cards.drawPileCardIds.includes(card.card_id));
    assert(entry);
    state.cards.drawPileCardIds = state.cards.drawPileCardIds.filter(id => id !== entry.card_id);
    cards.addCardToHand(owner, cards.createCommittedCardInstance(state, entry));
  }
  owner.resources = { ...owner.resources, credits: 0, energy, publicity: 2, availableData: 0, handSize: owner.hand.length };
  owner.dataState = { poolTokens: [], placedTokens: [], discardedCount: 0 };
  for (let i = 0; i < pool; i += 1) assert(data.gainData(owner, { root: state }).ok);
  if (pool) {
    owner.techState.ownedTiles.blue2 = true;
    owner.techState.blueBoardSlots.blue2 = 1;
    state.tech.stacks.blue2.remaining -= 1;
  }
  return state;
}
function open(state, cache = 0) {
  const restored = comp.lifecycle.restore({ ...launched, committedState: JSON.stringify(state) });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const before = comp.lifecycle.save().envelope;
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { port, root: port.openRoot(), before };
}
function run(state, enabled, cache = 0) {
  const { port, root, before } = open(state, cache);
  assert(port.postMainPlanSpec(root), "有普通探测器时也可证明本次移动/交易净损失");
  const result = searchDecision({ port, root, evaluate, postMainPruning: enabled,
    budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 10000 } });
  assert.equal(result.complete, true, result.stopReason);
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
  return result;
}
const plain = fixture(), prepared = fixture(1);
const raw = run(prepared, false), pruned = run(prepared, true), cached = run(prepared, true, 256);
for (const result of [pruned, cached]) {
  assert.equal(result.actionId, raw.actionId);
  assert.equal(result.value, raw.value);
  assert.equal(result.lines[0].distance, raw.lines[0].distance);
  assert(result.diagnostics.transitions < raw.diagnostics.transitions);
  assert.deepEqual(result.unresolved, []);
}
const noDataRaw = run(plain, false), noDataPruned = run(plain, true);
assert.equal(noDataPruned.actionId, noDataRaw.actionId);
assert.equal(noDataPruned.value, noDataRaw.value);
assert.equal(noDataPruned.lines[0].distance, 1);
assert(noDataPruned.roots.some(row => row.prunedByPlan && row.actionId.startsWith("move:")));
const beforeMain = structuredClone(plain);
beforeMain.players.players.find(player => player.id === seatId).mainActionCompleted = false;
const originalWindow = open(beforeMain);
assert.equal(originalWindow.port.postMainPlanSpec(originalWindow.root), null,
  "主行动前移动可以解锁环绕或登陆，不能套用主行动后的路径删除");
originalWindow.port.close();
const orange = fixture(0, 1, 0);
orange.players.players.find(player => player.id === seatId).techState.ownedTiles.orange2 = true;
orange.tech.stacks.orange2.remaining -= 1;
const orangeRaw = run(orange, false), orangePruned = run(orange, true);
assert.equal(orangePruned.actionId, orangeRaw.actionId);
assert.equal(orangePruned.value, orangeRaw.value);
assert.equal(orangePruned.lines[0].distance, orangeRaw.lines[0].distance);

// 全部普通移动方向及支付出口；另执行正式小行星前缀检查两点费用。
const routes = open(fixture(0, 4, 2));
let payments = 0, arrivals = 0, twoPointPayments = 0;
function publicPlayer(node) { return node.observation.publicState.players.find(player => player.playerId === seatId); }
function ordinary(node) {
  const outcomes = [];
  for (const action of node.legalActions.filter(action => action.family === "move")) {
    const payment = routes.port.expand(node, action.actionId);
    assert.equal(payment.status, "decision");
    for (const choice of payment.legalActions) {
      const next = routes.port.expand(payment, choice.actionId);
      assert.equal(next.status, "stable");
      const before = publicPlayer(node), after = publicPlayer(next);
      const paid = before.energy - after.energy + node.observation.selfState.hand.length - next.observation.selfState.hand.length;
      assert.equal(paid, choice.payload.requiredMovePoints);
      assert(paid >= 1);
      assert(after.publicity - before.publicity >= 0 && after.publicity - before.publicity <= 1);
      assert(evaluate(next.observation) <= evaluate(node.observation) - 0.5);
      payments += 1;
      if (after.publicity > before.publicity) arrivals += 1;
      if (paid === 2) twoPointPayments += 1;
      outcomes.push(next);
    }
  }
  return outcomes;
}
const first = ordinary(routes.root);
for (const node of first) ordinary(node);
let atAsteroid = routes.root;
for (let i = 0; i < 2; i += 1) {
  const move = atAsteroid.legalActions.find(action => action.family === "move"
    && action.target?.deltaX === 0 && action.target?.deltaY === 1);
  assert(move);
  const pending = routes.port.expand(atAsteroid, move.actionId);
  atAsteroid = routes.port.expand(pending, pending.legalActions.find(action => action.target?.choiceId === "energy").actionId);
}
ordinary(atAsteroid);
assert(payments > 0 && arrivals > 0 && twoPointPayments > 0);
for (const action of routes.root.legalActions.filter(action => action.target?.tradeId === "energy-for-move"
  || action.family === "card_corner")) {
  const pending = routes.port.expand(routes.root, action.actionId);
  assert.equal(pending.status, "decision");
  for (const choice of pending.legalActions) {
    const next = routes.port.expand(pending, choice.actionId);
    assert.equal(next.status, "stable");
    assert(evaluate(next.observation) <= evaluate(routes.root.observation) - 0.5,
      "快速移动、角标移动及结束移动均不能在默认V下赚取净收益");
  }
}
assert.deepEqual(comp.lifecycle.save().envelope, routes.before);
routes.port.close();

// 移动事件的真实额外奖励会推翻该结论，必须拒绝而非删去这条有收益的线。
const bonus = fixture();
bonus.turn.cardTurnEventBonuses = [{ id: "move-credit-test", playerId: seatId, duration: "turn", eventType: "move",
  rewards: [{ id: "move-credit", type: "gain_resources", options: { gain: { credits: 5 } } }] }];
const observed = open(bonus);
assert.equal(observed.port.postMainPlanSpec(observed.root), null);
const move = observed.root.legalActions.find(action => action.family === "move");
const payment = observed.port.expand(observed.root, move.actionId);
const rewarded = observed.port.expand(payment, payment.legalActions[0].actionId);
assert(evaluate(rewarded.observation) > evaluate(observed.root.observation));
observed.port.close();
const unusual = fixture();
unusual.pieces.rockets.find(rocket => rocket.playerId === seatId).kind = "fossil";
const rejected = open(unusual);
assert.equal(rejected.port.postMainPlanSpec(rejected.root), null);
rejected.port.close();
comp.dispose();
console.log(JSON.stringify({ postMainMovement: "passed", rawInputs: raw.diagnostics.transitions,
  prunedInputs: pruned.diagnostics.transitions, payments, arrivals, twoPointPayments }));
