"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const cards = require("../cards/deck");
const data = require("../data");
const aliens = require("../aliens/state");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");

const initial = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const seed = "quiet-post-main-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
assert.equal(comp.lifecycle.restore(initial).ok, true);
const source = JSON.parse(initial.committedState), seatId = source.turn.currentPlayerId;
const solarId = source.players.players.find(player => player.id === seatId).hand[0].id;
assert.equal(comp.inputPort.submitAction(comp.inputPort.enumerateActions({}).find(action =>
  action.family === "play_card" && action.target?.cardInstanceId === solarId)).ok, true);
const post = comp.lifecycle.save().envelope;
const evaluate = createStateValueEvaluator(seatId);
function fixture(cornerCode, poolCount, blue, handCount = 1) {
  const state = JSON.parse(post.committedState), owner = state.players.players.find(player => player.id === seatId);
  state.cards.discardPile.push(...owner.hand);
  owner.hand = [];
  for (let i = 0; i < handCount; i += 1) {
    const entry = cards.CARD_CATALOG.find(card => card.discard_action_code === cornerCode
      && state.cards.drawPileCardIds.includes(card.card_id));
    assert(entry);
    state.cards.drawPileCardIds = state.cards.drawPileCardIds.filter(id => id !== entry.card_id);
    cards.addCardToHand(owner, cards.createCommittedCardInstance(state, entry));
  }
  owner.resources = { ...owner.resources, credits: 2, energy: 2, publicity: 1, availableData: 0 };
  owner.dataState.poolTokens = [];
  for (let i = 0; i < poolCount; i += 1) assert(data.gainData(owner, { root: state }).ok);
  if (blue) {
    owner.techState.ownedTiles.blue2 = true;
    owner.techState.blueBoardSlots.blue2 = 1;
    state.tech.stacks.blue2.remaining -= 1;
  }
  return state;
}
function open(state, cache = 0) {
  const restored = comp.lifecycle.restore({ ...post, committedState: JSON.stringify(state) });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const before = comp.lifecycle.save().envelope;
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { port, root: port.openRoot(), before };
}
function run(state, enabled, cache = 0) {
  const { port, root, before } = open(state, cache);
  const proof = port.postMainPlanSpec(root);
  assert(proof && Object.isFrozen(proof));
  assert.equal(port.postMainPlanSpec(root), proof);
  const result = searchDecision({ port, root, evaluate, postMainPruning: enabled,
    budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 10000 } });
  assert.equal(result.complete, true, result.stopReason);
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
  assert.throws(() => port.postMainPlanSpec(root), /ANALYSIS_NODE_INVALID/);
  return result;
}
const prepared = fixture(0, 2, true);
const raw = run(prepared, false), pruned = run(prepared, true), cached = run(prepared, true, 256);
assert.equal(pruned.actionId, raw.actionId);
assert.equal(pruned.value, raw.value);
assert.equal(pruned.lines[0].distance, raw.lines[0].distance);
assert.equal(pruned.lines[0].distance, 5, "保留计算机首位、蓝色附加位和全部条件输入的最优准备链");
assert.equal(cached.actionId, pruned.actionId);
assert.equal(cached.value, pruned.value);
assert.equal(cached.diagnostics.transitions, pruned.diagnostics.transitions);
assert.equal(pruned.diagnostics.postMainProofNodes,0,"Round1 capital model declines this linear normal form");
assert(pruned.diagnostics.transitions <= raw.diagnostics.transitions);
assert.deepEqual(pruned.unresolved, []);
for (const line of pruned.lines) for (const exclusion of line.excludedActions || []) {
  assert(exclusion.retainedActionIds.length);
  const witness = pruned.lines[exclusion.witness.node];
  assert(["terminal", "information-barrier", "other-owner"].includes(witness.status));
  assert.equal(witness.value, exclusion.witness.value);
}
assert(!pruned.roots.some(root=>root.prunedByPlan),"model-incompatible local theorem cannot omit native roots");

const cases = [fixture(2, 0, false), fixture(0, 1, true, 2)];
for (const tileId of ["blue1", "blue3", "blue4"]) {
  const state = fixture(0, 2, true), player = state.players.players.find(player => player.id === seatId);
  delete player.techState.ownedTiles.blue2;
  delete player.techState.blueBoardSlots.blue2;
  state.tech.stacks.blue2.remaining += 1;
  player.techState.ownedTiles[tileId] = true;
  player.techState.blueBoardSlots[tileId] = 1;
  state.tech.stacks[tileId].remaining -= 1;
  if (tileId === "blue4") player.resources.publicity = 10;
  cases.push(state);
}
for (const state of cases) {
  const reference = run(state, false), reduced = run(state, true);
  assert.equal(reduced.actionId, reference.actionId);
  assert.equal(reduced.value, reference.value);
  assert.equal(reduced.lines[0].distance, reference.lines[0].distance);
  assert(reduced.diagnostics.transitions <= reference.diagnostics.transitions);
}
const selectionState = fixture(0, 2, true, 2);
function runSelection(enabled) {
  const { port, root, before } = open(selectionState);
  const payment = step(port, root, action => action.target?.tradeId === "cards-for-credit");
  const result = searchDecision({ port, root: payment, evaluate, postMainPruning: enabled,
    resourceDominance: true, cardTradePruning: true, modelKey: "post-main-exit-test",
    budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 10000 } });
  assert.equal(result.complete, true);
  assert(result.selectionContinuation);
  assert.equal(result.diagnostics.resourceDominance, "disabled-for-selection-certificate");
  assert.equal(result.diagnostics.cardTradePruning, "disabled-for-selection-certificate");
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
  return result;
}
const selectionRaw = runSelection(false), selectionPruned = runSelection(true);
assert.equal(selectionPruned.actionId, selectionRaw.actionId);
assert.equal(selectionPruned.value, selectionRaw.value);
assert.equal(selectionPruned.lines[0].distance, selectionRaw.lines[0].distance);
assert.deepEqual(selectionPruned.roots.map(row => row.value), selectionRaw.roots.map(row => row.value));
assert.equal(selectionPruned.diagnostics.postMainProofNodes,0,"capital-model selection exits retain full native evidence");

function declined(state) {
  const { port, root } = open(state);
  assert.equal(port.postMainPlanSpec(root), null);
  port.close();
}
// 达到金标阈值后保留正式标记选择，不把结束回合当成估值不变的一步。
const threshold = fixture(0, 1, true);
let owner = threshold.players.players.find(player => player.id === seatId);
threshold.cards.discardPile.push(...owner.hand); owner.hand = []; owner.resources.handSize = 0;
owner.resources.score = 49; owner.income.credits = 7;
owner.resources.credits = 2; owner.resources.energy = 0; owner.resources.publicity = 0;
declined(threshold);
function step(port, node, predicate) {
  const action = node.legalActions.find(predicate); assert(action); return port.expand(node, action.actionId);
}
// 在真实提交后的新决策根比较，避免把放数据前的根观察当成取牌信息屏障的基线。
assert.equal(comp.inputPort.submitAction(comp.inputPort.enumerateActions({})
  .find(action => action.family === "place_data")).ok, true);
const placement = comp.inspect().session.decision;
assert.equal(comp.inputPort.submitDecision({ decisionId: placement.decisionId, decisionVersion: placement.decisionVersion,
  ownerId: placement.ownerId, choice: placement.choices.find(action => action.target?.target === "computer") }).ok, true);
const thresholdPort = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
const thresholdRoot = { port: thresholdPort }, atTwoMarks = thresholdPort.openRoot();
assert.equal(thresholdRoot.port.postMainPlanSpec(atTwoMarks), null);
const thresholdResult = searchDecision({ port: thresholdRoot.port, root: atTwoMarks, evaluate, postMainPruning: true,
  budget: { transitions: 512, nodes: 513, frontier: 512, milliseconds: 3000 } });
assert.equal(thresholdResult.complete, true);
assert.equal(atTwoMarks.legalActions.find(action => action.actionId === thresholdResult.actionId).family, "end_turn");
assert.equal(atTwoMarks.observation.publicState.players.find(player => player.playerId === seatId).finalScore, 51);
assert(thresholdResult.value > thresholdResult.roots.find(row => atTwoMarks.legalActions
  .find(action => action.actionId === row.actionId)?.target?.tradeId === "credits-for-card").value);
assert(thresholdResult.lines.some(line => line.status === "decision" && line.edges.length > 1),
  "范围外的多个金标选择仍逐项展开");
thresholdRoot.port.close();

// 收入4号位仍保留真实强制选择；正常形不能把它虚构成无选择的同一步。
const income = fixture(0, 4, false);
const incomeRoot = open(income);
function placeFour(node) {
  for (let i = 0; i < 4; i += 1) {
    node = step(incomeRoot.port, node, action => action.family === "place_data");
    node = step(incomeRoot.port, node, action => action.target?.target === "computer");
  }
  return node;
}
const retainedHand = placeFour(incomeRoot.root);
const noHand = placeFour(step(incomeRoot.port, incomeRoot.root, action => action.family === "card_corner"));
assert.equal(retainedHand.status, "decision");
assert(retainedHand.legalActions.every(action => action.family === "choose_card"));
assert.equal(noHand.status, "stable");
incomeRoot.port.close();

const ready = structuredClone(prepared);
for (const trace of Object.values(ready.aliens.aliens[1].traces)) {
  trace.firstPlaced = true;
  trace.ownerPlayerColor = "white";
}
assert(aliens.isAlienReadyToReveal(ready.aliens.aliens[1]));
declined(ready);
const needsData = fixture(1, 0, true);
const dataRoot = open(needsData);
const dataPlan = dataRoot.port.postMainPlanSpec(dataRoot.root);
assert(dataPlan && dataRoot.root.legalActions.filter(action => action.family === "card_corner")
  .every(action => dataPlan.retainedActionIds.includes(action.actionId)), "数据准备是保留路线，不能省略");
const dataResult = searchDecision({ port: dataRoot.port, root: dataRoot.root, evaluate, postMainPruning: true,
  budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 10000 } });
assert.equal(dataResult.complete, true);
assert.equal(dataRoot.root.legalActions.find(action => action.actionId === dataResult.actionId).family, "card_corner",
  "数据角标可解锁蓝列得分，必须保留这条有收益的准备线");
dataRoot.port.close();
const industry = structuredClone(prepared);
owner = industry.players.players.find(player => player.id === seatId);
owner.techState.ownedTiles.orange1 = true;
industry.tech.stacks.orange1.remaining -= 1;
declined(industry);
const withProbe = structuredClone(prepared);
owner = withProbe.players.players.find(player => player.id === seatId);
withProbe.pieces.rockets[0].playerId = seatId;
withProbe.pieces.rockets[0].color = owner.color;
withProbe.pieces.rockets[0].kind = "fossil";
withProbe.pieces.playerRocketSequences[seatId] = [withProbe.pieces.rockets[0].playerSequence];
declined(withProbe);
const fractional = structuredClone(prepared);
fractional.players.players.find(player => player.id === seatId).resources.credits = 2.5;
declined(fractional);
const wrongModel = open(prepared);
assert.throws(() => searchDecision({ port: wrongModel.port, root: wrongModel.root,
  evaluate: createStateValueEvaluator(seatId, { weights: { publicity: 3 } }), postMainPruning: true }), /POST_MAIN_MODEL_INVALID/);
wrongModel.port.close();
comp.dispose();
console.log(JSON.stringify({ postMainPlan: "passed", rawInputs: raw.diagnostics.transitions,
  prunedInputs: pruned.diagnostics.transitions, excludedActions: pruned.diagnostics.postMainExcludedActions }));
