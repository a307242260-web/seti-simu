"use strict";
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../app/simulation-env");
const { createSimulationRuleComposition } = require("../training/simulation-rule-composition");
const { createSeededRandom } = require("./random");
const { buildRuleObservation } = require("../app/rule-observation");
const { createAnalysisPort } = require("./ai/analysis-port");

const seed = "seti-free-analyze-v1", env = createSimulationEnv();
env.reset({ seed, agentType: "completion", compactReplay: true });
const beforeStart = env.createCheckpoint().coreState.compositionEnvelope;
let beforeLastConfirm, beforeEarlyConfirm, income;
for (let guard = 0; guard < 64; guard += 1) {
  const checkpoint = env.createCheckpoint(), envelope = checkpoint.coreState.compositionEnvelope;
  const state = envelope.session?.session?.workingState || JSON.parse(envelope.committedState);
  const actions = env.legalActions();
  if (actions.some(action => action.target?.kind === "discard-hand-cards")) { income = envelope; break; }
  if (actions.some(action => action.target?.kind === "confirm_initial_setup")) {
    if (state.match.initialSetup.confirmedPlayerIds.length === 3) beforeLastConfirm = envelope;
    else beforeEarlyConfirm = envelope;
  }
  env.runAgentDecision();
}
assert(income && beforeLastConfirm && beforeEarlyConfirm);
env.dispose();
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
const runtimeVersion = JSON.parse(comp.lifecycle.save().envelope.committedState).meta.rulesetVersion;
function restore(envelope) {
  const result = comp.lifecycle.restore(envelope);
  assert.equal(result.ok, true, JSON.stringify(result));
}
function submit(action) {
  const decision = comp.inspect().session.decision;
  const result = comp.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId, choice: action });
  assert.equal(result.ok, true, JSON.stringify(result.failure || result));
  return result;
}
const working = envelope => envelope.session?.session?.workingState || JSON.parse(envelope.committedState);
const seatId = income.session.session.queue[0].ownerId;
const incomeOwner = working(income).players.players.find(player => player.id === seatId);
const drawingCard = incomeOwner.hand.find(card => card.incomeCode === 2);
const moneyCards = incomeOwner.hand.filter(card => card.incomeCode === 0).slice(0, 2);
assert(drawingCard && moneyCards.length === 2);
function incomeAction(node, cardId) {
  const action = node.legalActions.find(action => action.target?.cardIds?.includes(cardId));
  assert(action, cardId); return action;
}
let referenceObservation;
for (const deck of ["original", "reversed", "empty"]) {
  const envelope = structuredClone(income), state = working(envelope);
  if (deck === "reversed") state.cards.drawPileCardIds.reverse();
  if (deck === "empty") state.cards.drawPileCardIds = [];
  restore(envelope);
  const before = comp.lifecycle.save().envelope, oldBarrier = comp.inspect().session.irreversibleBarrier;
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 }), root = port.openRoot();
  const action = incomeAction(root, drawingCard.cardId), child = port.expand(root, action.actionId);
  if (deck === "empty") assert.notEqual(child.status, "information-barrier", "空堆收入没有实际盲抽，不虚构新信息");
  else {
    assert.equal(child.status, "information-barrier", "初始收入的实际盲抽必须停止搜索");
    assert.equal(child.boundary, "hidden_card_draw");
    assert.deepEqual(child.legalActions, []);
    assert(child.observation.selfState.hand.some(card => card.hidden));
    assert(child.observation.selfState.hand.every(card => card.hidden || card.id !== drawingCard.id));
    if (!referenceObservation) referenceObservation = child.observation;
    else assert.deepEqual(child.observation, referenceObservation, "替换隐藏未来牌序后边界输入不能泄漏新收入牌身份");
    assert.throws(() => port.expand(child, action.actionId), /BOUNDARY_CLOSED/);
  }
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
  submit(action);
  const after = comp.lifecycle.save().envelope, player = working(after).players.players.find(player => player.id === seatId);
  assert.equal(player.income.handSize, incomeOwner.income.handSize + 1);
  assert.equal(player.hand.length, incomeOwner.hand.length - (deck === "empty" ? 1 : 0));
  if (deck === "empty") assert.deepEqual(comp.inspect().session.irreversibleBarrier, oldBarrier);
  else assert.notDeepEqual(comp.inspect().session.irreversibleBarrier, oldBarrier, "已有同类屏障也要记录这一次新抽牌");
  restore(after); assert.deepEqual(comp.lifecycle.save().envelope, after);
  restore(before); submit(action); assert.deepEqual(comp.lifecycle.save().envelope, after, "收入选择恢复重放含相同屏障与journal");
}
// 非盲抽收入继续原Decision，不清除已有屏障，也不制造一次新信息事件。
restore(income);
const cashBefore = comp.lifecycle.save().envelope, cashBarrier = comp.inspect().session.irreversibleBarrier;
const cashPort = createAnalysisPort({ composition: comp, seatId }), cashRoot = cashPort.openRoot();
const cash = incomeAction(cashRoot, moneyCards[0].cardId);
assert.notEqual(cashPort.expand(cashRoot, cash.actionId).status, "information-barrier");
assert.deepEqual(comp.lifecycle.save().envelope, cashBefore); cashPort.close();
submit(cash); assert.deepEqual(comp.inspect().session.irreversibleBarrier, cashBarrier);

// 两种真钱收入顺序只改变移出游戏集合的历史顺序，正式状态和搜索身份应等价。
restore(income);
const orderPort = createAnalysisPort({ composition: comp, seatId }), orderRoot = orderPort.openRoot();
function branchIncomeOrder(ids) {
  let node = orderRoot;
  for (const id of ids) node = orderPort.expand(node, incomeAction(node, id).actionId);
  return node;
}
const ids = moneyCards.map(card => card.cardId), a = branchIncomeOrder(ids), b = branchIncomeOrder([...ids].reverse());
assert.equal(orderPort.identity(a), orderPort.identity(b), "移出游戏集合顺序不能制造重复收入搜索状态");
orderPort.close();
function actualIncomeOrder(order) {
  restore(income);
  for (const cardId of order) submit(comp.inspect().session.decision.choices.find(action => action.target?.cardIds?.includes(cardId)));
  return comp.lifecycle.save().envelope;
}
const actualA = structuredClone(working(actualIncomeOrder(ids))), actualB = structuredClone(working(actualIncomeOrder([...ids].reverse())));
assert.notDeepEqual(actualA.cards.removedFromGameCardIds, actualB.cards.removedFromGameCardIds, "正式存档仍保留实际顺序");
actualA.cards.removedFromGameCardIds.sort(); actualB.cards.removedFromGameCardIds.sort();
assert.deepEqual(actualA, actualB);

// 开始发初始选项也是新信息；分析输入不保留刚发出的公司/资源牌身份。
restore(beforeStart);
const startBefore = comp.lifecycle.save().envelope, firstSeat = comp.inspect().session.decision.ownerId;
const startPort = createAnalysisPort({ composition: comp, seatId: firstSeat }), startRoot = startPort.openRoot();
const start = startRoot.legalActions.find(action => action.target?.kind === "start_initial_setup");
const dealt = startPort.expand(startRoot, start.actionId);
assert.equal(dealt.status, "information-barrier"); assert.equal(dealt.boundary, "hidden_initial_offer");
assert.deepEqual(dealt.legalActions, []);
assert.equal(dealt.observation.publicState.resident.initialSetup.offer, null);
assert.equal(dealt.observation.publicState.resident.initialSetup.offerHidden, true);
assert.deepEqual(comp.lifecycle.save().envelope, startBefore); startPort.close();
submit(start);
const known = buildRuleObservation(working(comp.lifecycle.save().envelope), seed, firstSeat);
assert(known.publicState.resident.initialSetup.offer.industryOptions.length === 2, "真实发牌后宿主仍可读取已知选项");

// 非末位确认没有结算盲抽；末位确认批量结算时保留实际抽牌屏障。
restore(beforeEarlyConfirm);
const earlyBarrier = comp.inspect().session.irreversibleBarrier;
submit(comp.inspect().session.decision.choices.find(action => action.target?.kind === "confirm_initial_setup"));
assert.deepEqual(comp.inspect().session.irreversibleBarrier, earlyBarrier);
let settlementReference;
for (const reversed of [false, true]) {
  const envelope = structuredClone(beforeLastConfirm);
  if (reversed) working(envelope).cards.drawPileCardIds.reverse();
  restore(envelope);
  const before = comp.lifecycle.save().envelope, lastSeat = comp.inspect().session.decision.ownerId;
  const port = createAnalysisPort({ composition: comp, seatId: lastSeat }), root = port.openRoot();
  const confirm = root.legalActions.find(action => action.target?.kind === "confirm_initial_setup");
  const child = port.expand(root, confirm.actionId);
  assert.equal(child.status, "information-barrier"); assert.equal(child.boundary, "hidden_card_draw");
  assert.deepEqual(child.legalActions, []);
  if (!settlementReference) settlementReference = child.observation;
  else assert.deepEqual(child.observation, settlementReference);
  assert.deepEqual(comp.lifecycle.save().envelope, before); port.close();
  submit(confirm); const after = comp.lifecycle.save().envelope;
  assert.equal(comp.inspect().session.irreversibleBarrier.code, "hidden_card_draw");
  restore(before); submit(confirm); assert.deepEqual(comp.lifecycle.save().envelope, after);
}
assert.equal(runtimeVersion, "seti-runtime-v1.2");
comp.dispose();
console.log("initial offer, settlement and income information boundaries, removal equivalence and recovery passed");
