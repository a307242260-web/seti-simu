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
const { PASS_HAND_LIMIT } = require("../effects/probe-turn-session");

const initial = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const state = JSON.parse(initial.committedState), seatId = state.turn.currentPlayerId;
const seed = "funded-opening-plan-v1", evaluate = createStateValueEvaluator(seatId);
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
const own = source => source.players.players.find(player => player.id === seatId);
function open(source = state, cache = 0) {
  const restored = comp.lifecycle.restore({ ...structuredClone(initial), committedState: JSON.stringify(source) });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const before = comp.lifecycle.save().envelope;
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { port, root: port.openRoot(), before };
}
const combined = { resourceDominance: true, moneyCapacityDominance: true, cardTradePruning: true,
  postMainPruning: true, cardChoiceEquivalence: true };
const budget = { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 10000 };
function run(source, openingPruning, cache = 0) {
  const { port, root, before } = open(source, cache);
  const proof = port.openingPlanSpec(root);
  assert(proof && Object.isFrozen(proof));
  assert.equal(port.openingPlanSpec(root), proof);
  const result = searchDecision({ port, root, evaluate, ...combined, openingPruning, budget });
  assert.equal(result.complete, true, result.stopReason);
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
  assert.throws(() => port.openingPlanSpec(root), /ANALYSIS_NODE_INVALID/);
  return result;
}
function subset(ids) {
  const source = structuredClone(state), player = own(source);
  source.cards.discardPile.push(...player.hand.filter(card => !ids.includes(card.cardId)));
  player.hand = player.hand.filter(card => ids.includes(card.cardId));
  player.resources = { ...player.resources, handSize: player.hand.length, credits: 2, energy: 2, publicity: 6 };
  return source;
}
const results = [];
for (const cardId of [null, "dlc_27.png", "b_44.webp", "b_23.webp", "dlc_22.png", "b_48.webp"]) {
  const source = subset(cardId ? [cardId] : []);
  const baseline = run(source, false), pruned = run(source, true), cached = run(source, true, 256);
  for (const actual of [pruned, cached]) {
    assert.equal(actual.actionId, baseline.actionId, cardId);
    assert.equal(actual.value, baseline.value, cardId);
    assert.equal(actual.lines[0].distance, baseline.lines[0].distance, cardId);
    assert(actual.diagnostics.openingExcludedActions > 0);
    assert(actual.diagnostics.transitions < baseline.diagnostics.transitions);
    const omitted = actual.roots.filter(row => row.prunedByPlan);
    assert(omitted.length);
    for (const row of omitted) {
      assert.equal(row.value, null); assert.equal(row.target, null);
      const witness = row.prunedByPlan.witness;
      assert(["information-barrier", "other-owner", "terminal"].includes(actual.lines[witness.node].status));
      assert.equal(actual.lines[witness.node].value, witness.value);
    }
  }
  results.push({ cardId, value: baseline.value, baseline: baseline.diagnostics.transitions,
    pruned: pruned.diagnostics.transitions });
}

// PASS真实例外：5手牌的一次宣传角标替换强制弃牌，数值增加0.5且输入数相同。
const audit = open(), { port, root } = audit;
assert.equal(PASS_HAND_LIMIT, 4);
assert.equal(root.observation.selfState.hand.length, PASS_HAND_LIMIT + 1);
const plan = port.openingPlanSpec(root);
function passLeaves(start, prefix = 0) {
  const pass = start.legalActions.find(action => action.family === "pass"); assert(pass);
  const queue = [{ node: port.expand(start, pass.actionId), inputs: prefix + 1 }], leaves = [];
  for (let i = 0; i < queue.length; i += 1) {
    const row = queue[i];
    if (["information-barrier", "other-owner", "terminal"].includes(row.node.status)) {
      leaves.push({ value: evaluate(row.node.observation), inputs: row.inputs }); continue;
    }
    assert.equal(row.node.status, "decision");
    assert(row.node.legalActions.every(action => action.target?.kind === "pass-hand-limit"), "PASS前只能处理已知弃牌，不能展开尚未公开的预留牌");
    for (const action of row.node.legalActions) queue.push({ node: port.expand(row.node, action.actionId), inputs: row.inputs + 1 });
  }
  return leaves;
}
const direct = passLeaves(root), best = leaves => Math.max(...leaves.map(leaf => leaf.value));
assert.equal(direct.length, 5, "5种正式弃牌目标全部保留，随后停在预留牌公开边界");
assert(direct.every(leaf => leaf.inputs === 2));
const corners = root.legalActions.filter(action => action.family === "card_corner");
const publicityCorners = corners.filter(action => action.payload.kind === "resource");
assert.equal(publicityCorners.length, 4);
for (const corner of publicityCorners) {
  assert(plan.retainedActionIds.includes(corner.actionId), "不能误删5手牌时有收益的PASS准备");
  const after = port.expand(root, corner.actionId), leaves = passLeaves(after, 1);
  const pass = after.legalActions.find(action => action.family === "pass");
  const directChild = port.expand(after, pass.actionId), macro = port.expandOpeningPass(root, corner.actionId);
  assert.equal(macro.submissions, 2);
  assert.deepEqual(macro.actions.map(action => action.actionId), [corner.actionId, pass.actionId]);
  assert.equal(port.identity(macro.node), port.identity(directChild));
  assert.deepEqual(macro.node.observation, directChild.observation);
  assert.deepEqual(macro.node.legalActions, directChild.legalActions);
  assert.equal(best(leaves), best(direct) + 0.5);
  assert(leaves.every(leaf => leaf.inputs === 2));
  const afterPlan = port.openingPlanSpec(after);
  for (const second of after.legalActions.filter(action => action.family === "card_corner")) {
    assert(afterPlan.excludedActionIds.includes(second.actionId), "降至4手牌后额外角标不再替换强制弃牌");
    if (second.payload.kind !== "resource") continue;
    assert.equal(best(passLeaves(port.expand(after, second.actionId), 2)), best(direct));
  }
}
const moveCorner = corners.find(action => action.payload.kind === "move");
assert.throws(() => port.expandOpeningPass(root, moveCorner.actionId), /OPENING_PASS_INVALID/);
assert(plan.excludedActionIds.includes(moveCorner.actionId));
const moving = port.expand(root, moveCorner.actionId);
assert.equal(moving.status, "decision");
assert(moving.legalActions.length === 1 && moving.legalActions[0].target.skip);
const moved = passLeaves(port.expand(moving, moving.legalActions[0].actionId), 2);
assert.equal(best(moved), best(direct));
assert(moved.every(leaf => leaf.inputs === 3), "空移动必须多一次结束移动输入，不能用V平分掩盖最短路径");
let paymentExits = 0;
for (const tradeId of ["cards-for-credit", "cards-for-energy"]) {
  const trade = root.legalActions.find(action => action.target?.tradeId === tradeId);
  assert(plan.excludedActionIds.includes(trade.actionId));
  const pending = port.expand(root, trade.actionId), choices = [...port.selectionPlans(pending)];
  assert.equal(choices.length, 10);
  for (const choice of choices) {
    const paid = port.expandSelection(pending, choice.selectedIds);
    assert.equal(paid.submissions, 3, "两次点选加确认，不能按一次宏步计费");
    const leaves = passLeaves(paid.node, 1 + paid.submissions);
    assert.equal(best(leaves), best(direct));
    assert(leaves.every(leaf => leaf.inputs === 5));
    paymentExits += 1;
  }
}
assert.deepEqual(comp.lifecycle.save().envelope, audit.before);
assert.throws(() => searchDecision({ port, root, evaluate: createStateValueEvaluator(seatId, { weights: { handSize: 2 } }),
  openingPruning: true }), /OPENING_MODEL_INVALID/);
assert.throws(() => searchDecision({ port, root, evaluate: createStateValueEvaluator("player-blue"),
  openingPruning: true }), /OPENING_MODEL_INVALID/);
port.close();

for (const [key, value] of [["credits", 1], ["energy", 1], ["publicity", 5]]) {
  const source = structuredClone(state); own(source).resources[key] = value;
  const { port, root } = open(source);
  assert.equal(port.openingPlanSpec(root), null, `${key}不足以支付所有生产性行动，继续完整准备搜索`);
  port.close();
}
// 根为支付选择时仍保留每个实际支付出口的局部精确值和复用证据。
const selectionSource = subset(["dlc_27.png", "b_44.webp", "b_23.webp"]);
const selection = open(selectionSource);
const paying = selection.port.expand(selection.root, selection.root.legalActions.find(action => action.target?.tradeId === "cards-for-credit").actionId);
const selectionRaw = searchDecision({ port: selection.port, root: paying, evaluate, ...combined, budget });
const selectionPruned = searchDecision({ port: selection.port, root: paying, evaluate, ...combined, openingPruning: true,
  modelKey: evaluate.modelKey, budget });
assert(selectionRaw.complete && selectionPruned.complete);
assert.equal(selectionPruned.value, selectionRaw.value);
assert.equal(selectionPruned.actionId, selectionRaw.actionId);
assert.equal(selectionPruned.lines[0].orderedExitCount, 3);
assert(selectionPruned.selectionContinuation);
assert(selectionPruned.diagnostics.openingProofNodes > 0);
assert.deepEqual(comp.lifecycle.save().envelope, selection.before);
selection.port.close();
// 首数据放置不追补将来取得的蓝列奖励；最大公共扫描也不能使保留池数据溢出。
const dataSource = structuredClone(state); own(dataSource).resources.additionalPublicScan = 2;
const dataAudit = open(dataSource), dataPort = dataAudit.port, dataRoot = dataAudit.root;
const place = dataRoot.legalActions.find(action => action.family === "place_data");
assert(dataPort.openingPlanSpec(dataRoot).excludedActionIds.includes(place.actionId));
const placing = dataPort.expand(dataRoot, place.actionId);
assert.equal(placing.legalActions.length, 1);
const placed = dataPort.expand(placing, placing.legalActions[0].actionId);
assert.equal(placed.status, "stable");
assert.equal(evaluate(dataRoot.observation) - evaluate(placed.observation), 0.5);
const semantic = action => JSON.stringify([action.family, action.target, action.payload]);
const pairs = [];
let dataAuditInputs = 2;
function pairedStep(upper, lower, action) {
  assert(dataAuditInputs < 1024, "成对主行动验证预算耗尽");
  const match = lower.legalActions.find(candidate => semantic(candidate) === semantic(action));
  assert(match, semantic(action)); dataAuditInputs += 2;
  return { upper: dataPort.expand(upper, action.actionId), lower: dataPort.expand(lower, match.actionId) };
}
for (const action of dataRoot.legalActions.filter(action => ["launch", "scan", "research_tech", "play_card", "pass"].includes(action.family))) {
  pairs.push(pairedStep(dataRoot, placed, action));
}
let dataAuditLeaves = 0;
for (let i = 0; i < pairs.length; i += 1) {
  const { upper, lower } = pairs[i];
  assert.equal(upper.status, lower.status);
  if (upper.status !== "decision") {
    assert.equal(evaluate(upper.observation) - evaluate(lower.observation), 0.5,
      "同一真实主行动全部已结算/边界出口保持半分差，蓝科技不追补已放首数据");
    dataAuditLeaves += 1; continue;
  }
  assert.equal(upper.legalActions.length, lower.legalActions.length);
  for (const action of upper.legalActions) pairs.push(pairedStep(upper, lower, action));
}
assert(dataAuditLeaves > 50);
assert.deepEqual(comp.lifecycle.save().envelope, dataAudit.before);
dataPort.close();
// 同一最终源码下分别保留/归约5手牌角标后的全部继续路线，父节点最优保持。
const full = open();
const noPassMacros = { ...full.port, openingPlanSpec: node => {
  const spec = full.port.openingPlanSpec(node);
  const dataIds = node.legalActions.filter(action => action.family === "place_data").map(action => action.actionId);
  return spec && { ...spec, passPreparationActionIds: [], dataPlacementPruned: false,
    retainedActionIds: [...spec.retainedActionIds, ...dataIds.filter(id => spec.excludedActionIds.includes(id))],
    excludedActionIds: spec.excludedActionIds.filter(id => !dataIds.includes(id)) };
} };
const expanded = searchDecision({ port: noPassMacros, root: full.root, evaluate, ...combined, openingPruning: true, budget });
const normalized = searchDecision({ port: full.port, root: full.root, evaluate, ...combined, openingPruning: true, budget });
assert(expanded.complete && normalized.complete);
assert.equal(normalized.actionId, expanded.actionId);
assert.equal(normalized.value, expanded.value);
assert.equal(normalized.lines[0].distance, expanded.lines[0].distance);
assert(normalized.diagnostics.openingPassMacros > 0);
assert(normalized.diagnostics.transitions < expanded.diagnostics.transitions);
for (const row of normalized.roots.filter(row => row.normalForm)) {
  assert.equal(row.valueType, "attained-lower-bound", "不能把只保留PASS后的角标分支值当成原分支精确最优");
  assert.equal(row.completion, "covered-by-opening-normal-form");
}
assert.deepEqual(comp.lifecycle.save().envelope, full.before);
full.port.close();
const cachedFull = run(state, true, 256);
assert.equal(cachedFull.actionId, normalized.actionId);
assert.equal(cachedFull.value, normalized.value);
assert.equal(cachedFull.lines[0].distance, normalized.lines[0].distance);
assert.equal(cachedFull.diagnostics.transitions, normalized.diagnostics.transitions);
const cachedMacro = open(state, 2);
const cachedCorner = cachedMacro.root.legalActions.find(action => action.family === "card_corner" && action.payload.kind === "resource");
const firstMacro = cachedMacro.port.expandOpeningPass(cachedMacro.root, cachedCorner.actionId);
const repeatedMacro = cachedMacro.port.expandOpeningPass(cachedMacro.root, cachedCorner.actionId);
assert.equal(firstMacro.node, repeatedMacro.node, "两步缓存命中仍是同一正式后继节点");
assert.equal(cachedMacro.port.getDiagnostics().submissionCount, 2);
assert.equal(cachedMacro.port.getDiagnostics().cacheHits, 2);
assert.deepEqual(comp.lifecycle.save().envelope, cachedMacro.before);
cachedMacro.port.close();
comp.dispose();
console.log(JSON.stringify({ openingPlan: "passed", results, passPaymentExits: paymentExits,
  directPassValue: best(direct), directPassInputs: 2, publicityPassValue: best(direct) + 0.5,
  dataAuditInputs, dataAuditLeaves,
  fullHandBeforePassMacros: expanded.diagnostics.transitions, fullHandAfterPassMacros: normalized.diagnostics.transitions,
  fullHandCachedInputs: cachedFull.diagnostics.transitions, passMacroCacheHits: 2 }));
