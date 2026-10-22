"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { isHiddenInformationBarrier } = require("../rule-composition");
const { createAnalysisPort } = require("../ai/analysis-port");
const cards = require("./deck");

const initial = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const source = JSON.parse(initial.committedState), seatId = source.turn.currentPlayerId;
const seed = "public-pick-information-boundary-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
assert.equal(JSON.parse(comp.lifecycle.save().envelope.committedState).meta.rulesetVersion, "seti-runtime-v1.3");
function submitChoice(choice) {
  const decision = comp.inspect().session.decision;
  const result = comp.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId, choice });
  assert.equal(result.ok, true, JSON.stringify(result.failure || result.code));
  return result;
}
const masked = new Map();
let cases = 0;
for (const cardId of ["b_48.webp", "b_122.webp"]) for (const deck of ["original", "reversed", "empty"]) {
  const state = structuredClone(source), owner = state.players.players.find(player => player.id === seatId);
  let card = owner.hand.find(card => card.cardId === cardId);
  if (!card) {
    const entry = cards.CARD_CATALOG.find(card => card.card_id === cardId);
    assert(state.cards.drawPileCardIds.includes(cardId));
    state.cards.drawPileCardIds = state.cards.drawPileCardIds.filter(id => id !== cardId);
    card = cards.createCommittedCardInstance(state, entry);
    cards.addCardToHand(owner, card);
  }
  if (deck === "reversed") state.cards.drawPileCardIds.reverse();
  if (deck === "empty") state.cards.drawPileCardIds = [];
  const restored = comp.lifecycle.restore({ ...initial, committedState: JSON.stringify(state) });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const action = comp.inputPort.enumerateActions({}).find(action => action.family === "play_card"
    && action.target?.cardInstanceId === card.id);
  assert(action);
  assert.equal(comp.inputPort.submitAction(action).ok, true);
  const before = comp.lifecycle.save().envelope;
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 }), root = port.openRoot();
  const known = new Set(root.observation.publicState.board.publicCards.filter(Boolean).map(card => card.id));
  const pickedId = state.cards.publicCards[0].id;
  const pick = root.legalActions.find(action => action.target?.cardInstanceId === pickedId
    || (action.target?.source === "public" && action.target.slotIndex === 0));
  assert(pick, `${cardId} public choice`);
  const child = port.expand(root, pick.actionId);
  if (deck === "empty") {
    assert.notEqual(child.status, "information-barrier", "未补出牌就没有新的隐藏牌身份");
  } else {
    assert.equal(child.status, "information-barrier", "公共牌补出新牌后，搜索必须停在信息边界");
    assert.equal(child.boundary, "hidden_card_reveal");
    assert.deepEqual(child.legalActions, []);
    assert(child.observation.publicState.board.publicCards.every(card => !card || card.hidden || known.has(card.id)),
      "保留已知公共牌，遮蔽未知补牌");
    assert(child.observation.selfState.hand.some(card => card.id === state.cards.publicCards[0].id),
      "取得的牌原本已公开，不能误当作未知手牌遮掉");
    if (deck === "original") masked.set(cardId, child.observation);
    else assert.deepEqual(child.observation, masked.get(cardId), "未来牌堆顺序不能进入当前边界估值输入");
    assert.throws(() => port.expand(child, pick.actionId), /ANALYSIS_BOUNDARY_CLOSED/);
  }
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
  const result = submitChoice(pick);
  const after = comp.lifecycle.save().envelope;
  const working = after.session?.session?.workingState || JSON.parse(after.committedState);
  assert(working.players.players.find(player => player.id === seatId).hand.some(entry => entry.id === pickedId));
  assert.equal(Boolean(working.cards.publicCards[0]), deck !== "empty");
  assert.equal(isHiddenInformationBarrier(result.irreversibleBarrier || comp.inspect().session?.irreversibleBarrier), deck !== "empty");
  assert.equal(comp.lifecycle.restore(after).ok, true);
  assert.deepEqual(comp.lifecycle.save().envelope, after, "屏障和未完成奖励队列可以恢复");
  assert.equal(comp.lifecycle.restore(before).ok, true);
  submitChoice(pick);
  assert.deepEqual(comp.lifecycle.save().envelope, after, "确认输入后重放得到相同工作状态、屏障和journal");
  if (cardId === "b_48.webp") {
    assert.equal(comp.inspect().phase, "awaiting_input", "B48移动角标奖励仍保留正式输入");
    const skip = comp.inspect().session.decision.choices.find(action => action.target?.skip);
    assert(skip);
    submitChoice(skip);
    assert.notEqual(comp.inspect().phase, "awaiting_input");
  }
  cases += 1;
}
// 公司精选后只拿资源角标时，也不能用“没有额外盲抽”清掉公共补牌屏障。
for (const empty of [false, true]) {
  const state = structuredClone(source), owner = state.players.players.find(player => player.id === seatId);
  owner.initialSelection.industry = { id: "industry:任务中继站.png" };
  owner.resources.publicity = 5;
  if (empty) state.cards.drawPileCardIds = [];
  const restored = comp.lifecycle.restore({ ...initial, committedState: JSON.stringify(state) });
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const industry = comp.inputPort.enumerateActions({}).find(action => action.family === "industry");
  assert(industry);
  assert.equal(comp.inputPort.submitQuickAction(industry).ok, true);
  const index = state.cards.publicCards.findIndex(card => card && card.incomeCode !== 2);
  assert(index >= 0);
  const before = comp.lifecycle.save().envelope;
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 }), root = port.openRoot();
  const pick = root.legalActions.find(action => action.target?.slotIndex === index);
  assert(pick);
  const child = port.expand(root, pick.actionId);
  assert.equal(child.status === "information-barrier", !empty);
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  port.close();
  const result = submitChoice(pick);
  assert.equal(isHiddenInformationBarrier(result.irreversibleBarrier || comp.inspect().session?.irreversibleBarrier), !empty);
  cases += 1;
}
comp.dispose();
console.log(`public picks preserve hidden-refill boundaries, known cards and recovery across ${cases} cases`);
