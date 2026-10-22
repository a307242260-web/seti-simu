"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const cards = require("../cards/deck"), data = require("../data");
const finalScoring = require("../final-scoring");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../adhoc/ai-decision-corpus-20261023-v1/case-011-20261023-v1.json")));
const source = JSON.parse(fixture.compositionEnvelope.committedState), seed = fixture.source.seed, seatId = fixture.seatId;
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition, evaluate = createStateValueEvaluator(seatId);
const ownerOf = state => state.players.players.find(player => player.id === seatId);
function open(state, cache = 0) {
  const restored = comp.lifecycle.restore({ ...fixture.compositionEnvelope, committedState: JSON.stringify(state) });
  assert(restored.ok, JSON.stringify(restored));
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { port, root: port.openRoot(), before };
}
function step(port, node, predicate) {
  const action = node.legalActions.find(predicate); assert(action); return port.expand(node, action.actionId);
}
function place(port, node, target = "computer") {
  return step(port, step(port, node, a => a.family === "place_data"), a => a.target?.target === target);
}
const semanticBudget = { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 };
function run(state, enabled, cache = 0) {
  const { port, root, before } = open(state, cache);
  try {
    const proof = port.postMainPlanSpec(root);
    assert(proof, "实际五数据/三手牌主行动后必须保留数据及收入线并覆盖无收益准备");
    for (const action of root.legalActions.filter(a => a.family === "card_corner" && a.payload?.kind === "resource")) {
      const card = root.observation.selfState.hand.find(c => c.id === action.target.cardInstanceId);
      if (cards.getDiscardActionCodeForCard(card) === 1) assert(proof.retainedActionIds.includes(action.actionId));
    }
    const result = searchDecision({ port, root, evaluate, postMainPruning: enabled, resourceDominance: true,
      budget: semanticBudget });
    assert(result.complete, result.stopReason);
    assert.deepEqual(comp.lifecycle.save().envelope, before);
    return result;
  } finally { port.close(); }
}
const pruned = run(source, true), cached = run(source, true, 256);
assert.equal(cached.actionId, pruned.actionId);
assert.equal(cached.value, pruned.value);
assert.equal(cached.lines[0].distance, pruned.lines[0].distance);
assert.equal(cached.diagnostics.transitions, pruned.diagnostics.transitions);
assert(pruned.lines.some(line => line.status === "information-barrier"), "合法盲抽收入选择仍真实展开到信息边界");

function configure(choices, { round = 1, pool = 1, placed = 3, blue = null } = {}) {
  const state = structuredClone(source), owner = ownerOf(state);
  state.turn.roundNumber = round;
  state.cards.discardPile.push(...owner.hand); owner.hand = []; owner.resources.handSize = 0;
  for (const [corner, income] of choices) {
    const entry = cards.CARD_CATALOG.find(card => card.discard_action_code === corner && card.income_code === income
      && state.cards.drawPileCardIds.includes(card.card_id));
    assert(entry, `${corner}/${income}`);
    state.cards.drawPileCardIds = state.cards.drawPileCardIds.filter(id => id !== entry.card_id);
    cards.addCardToHand(owner, cards.createCommittedCardInstance(state, entry));
  }
  owner.resources.credits = 2; owner.resources.energy = 1; owner.resources.publicity = 0;
  owner.dataState = data.createDefaultDataState(); owner.resources.availableData = 0;
  for (let i = 0; i < placed; i += 1) {
    assert(data.gainData(owner, { root: state }).ok); assert(data.placeDataToComputer(owner).ok);
  }
  for (let i = 0; i < pool; i += 1) assert(data.gainData(owner, { root: state }).ok);
  if (blue) {
    owner.techState.ownedTiles[blue.tileId] = true; owner.techState.blueBoardSlots[blue.tileId] = blue.slot;
    state.tech.stacks[blue.tileId].remaining -= 1;
  }
  return state;
}
const small = [];
for (const state of [configure([[0, 0]]), configure([[0, 0]], { round: 4 }),
  configure([[1, 2], [0, 1]]), configure([[2, 0], [2, 1]], { round: 4 }),
  configure([[1, 2], [0, 0]], { pool: 4, blue: { tileId: "blue2", slot: 4 } })]) {
  const reference = run(state, false), reduced = run(state, true);
  assert.equal(reduced.actionId, reference.actionId);
  assert.equal(reduced.value, reference.value);
  assert.equal(reduced.lines[0].distance, reference.lines[0].distance);
  small.push({ rawInputs: reference.diagnostics.transitions, prunedInputs: reduced.diagnostics.transitions, value: reduced.value });
}

// 所有两张资源支付出口仍精确求值，局部剪枝不能破坏点击续用证据。
const paymentCases = [];
for (const tradeId of ["cards-for-credit", "cards-for-energy"]) {
  function payment(enabled) {
    const { port, root, before } = open(source);
    try {
      const pending = step(port, root, a => a.target?.tradeId === tradeId);
      const result = searchDecision({ port, root: pending, evaluate, postMainPruning: enabled,
        resourceDominance: true, modelKey: `post-income:${tradeId}`, budget: semanticBudget });
      assert(result.complete, result.stopReason); assert(result.selectionContinuation);
      assert.equal(result.lines[0].orderedExitCount, 3);
      assert.deepEqual(comp.lifecycle.save().envelope, before);
      return result;
    } finally { port.close(); }
  }
  const reference = payment(false), reduced = payment(true);
  assert.equal(reduced.actionId, reference.actionId); assert.equal(reduced.value, reference.value);
  assert.equal(reduced.lines[0].distance, reference.lines[0].distance);
  assert.deepEqual(reduced.roots.map(row => row.value), reference.roots.map(row => row.value));
  paymentCases.push({ tradeId, rawInputs: reference.diagnostics.transitions, prunedInputs: reduced.diagnostics.transitions, exits: 3 });
}

// 第4轮现金收入的立即收益恰好补偿多插入的一张手牌；额外选择仍真实执行。
const cash = open(configure([[0, 0]], { round: 4 }));
const forcedCash = place(cash.port, cash.root);
assert(forcedCash.legalActions.every(a => a.family === "choose_card"));
const paidCash = cash.port.expand(forcedCash, forcedCash.legalActions[0].actionId);
assert.equal(paidCash.status, "stable", "现金收入不生成盲抽信息边界");
const cashLeaf = step(cash.port, paidCash, a => a.family === "end_turn");
let cashDiscarded = step(cash.port, cash.root, a => a.family === "card_corner");
cashDiscarded = place(cash.port, cashDiscarded);
assert.equal(cashDiscarded.status, "stable", "无手牌的原路径没有强制收入输入");
cashDiscarded = step(cash.port, cashDiscarded, a => a.family === "end_turn");
assert.equal(evaluate(cashLeaf.observation) - evaluate(cashDiscarded.observation), 0.5);
cash.port.close();

// 支付两张现金牌后只剩数据角标；保留支付牌时可插现金收入并继续同一数据路径。
const replacement = open(source);
const cashIds = ownerOf(source).hand.filter(card => [0, 1].includes(cards.getIncomeCodeForCard(card))).map(card => card.id);
const dataId = ownerOf(source).hand.find(card => cards.getIncomeCodeForCard(card) === 2).id;
const paymentRoot = step(replacement.port, replacement.root, a => a.target?.tradeId === "cards-for-credit");
let poorer = replacement.port.expandSelection(paymentRoot, cashIds).node;
poorer = step(replacement.port, poorer, a => a.family === "card_corner" && a.target?.cardInstanceId === dataId);
let richer = step(replacement.port, replacement.root, a => a.family === "card_corner" && a.target?.cardInstanceId === dataId);
for (let i = 0; i < 4; i += 1) { poorer = place(replacement.port, poorer); richer = place(replacement.port, richer); }
assert.equal(poorer.status, "stable"); assert.equal(richer.status, "decision");
richer = step(replacement.port, richer, a => a.target?.cardInstanceId === cashIds[0]);
assert.equal(richer.status, "stable");
for (let i = 0; i < 2; i += 1) { poorer = place(replacement.port, poorer); richer = place(replacement.port, richer); }
poorer = step(replacement.port, poorer, a => a.family === "end_turn");
richer = step(replacement.port, richer, a => a.family === "end_turn");
assert(evaluate(richer.observation) > evaluate(poorer.observation));
replacement.port.close();

// 反例：只剩盲抽收入的额外牌会提前停止，丢掉第6格蓝列与后续蓝奖励。
const blindOnly = configure([[0, 2]], { round: 4, pool: 4, blue: { tileId: "blue2", slot: 4 } });
const blind = open(blindOnly);
assert.equal(blind.port.postMainPlanSpec(blind.root), null);
const atIncome = place(blind.port, blind.root);
assert(atIncome.legalActions.every(a => a.family === "choose_card"));
const early = blind.port.expand(atIncome, atIncome.legalActions[0].actionId);
assert.equal(early.status, "information-barrier");
let continued = step(blind.port, blind.root, a => a.family === "card_corner");
continued = place(blind.port, continued); assert.equal(continued.status, "stable", "没有手牌时正式跳过收入输入");
continued = place(blind.port, continued); continued = place(blind.port, continued);
continued = place(blind.port, continued, "blueBonus");
continued = step(blind.port, continued, a => a.family === "end_turn");
assert(evaluate(continued.observation) > evaluate(early.observation), "提前盲抽的正收入不能覆盖后续奖励路径");
blind.port.close();
for (const state of [configure([[1, 2], [1, 2]])]) {
  const { port, root } = open(state);
  assert.equal(port.postMainPlanSpec(root), null); port.close();
}
const marked = configure([[0, 0]]), markedOwner = ownerOf(marked), previousScore = markedOwner.resources.score;
markedOwner.resources.score = 25;
assert(finalScoring.markTile(marked.finalScoring, "a", markedOwner, { root: marked }).ok);
markedOwner.resources.score = previousScore;
const markCase = open(marked);
assert.equal(markCase.port.postMainPlanSpec(markCase.root), null, "收入改变a板公式时不使用当前数值增益界");
markCase.port.close();
const wrong = open(source);
assert.throws(() => searchDecision({ port: wrong.port, root: wrong.root,
  evaluate: createStateValueEvaluator(seatId, { weights: { handSize: 2 } }), postMainPruning: true }), /POST_MAIN_MODEL_INVALID/);
wrong.port.close();
comp.dispose();
console.log(JSON.stringify({ postMainIncome: "passed",
  prunedInputs: pruned.diagnostics.transitions, value: pruned.value, small, paymentCases }));
