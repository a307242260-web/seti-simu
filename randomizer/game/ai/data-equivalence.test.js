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

const checkpoint = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json")));
const seed = "analysis-data-equivalence-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
const base = checkpoint.coreState.compositionEnvelope;
const state = JSON.parse(base.committedState);
const seatId = state.turn.currentPlayerId;
const owner = state.players.players.find(player => player.id === seatId);
const entry = cards.CARD_CATALOG.find(card => card.discard_action_code === 1
  && state.cards.drawPileCardIds.includes(card.card_id));
assert(entry);
state.cards.drawPileCardIds = state.cards.drawPileCardIds.filter(id => id !== entry.card_id);
const cornerCard = cards.createCommittedCardInstance(state, entry);
cards.addCardToHand(owner, cornerCard);

function open(source) {
  const envelope = { ...structuredClone(base), committedState: JSON.stringify(source) };
  assert.equal(comp.lifecycle.restore(envelope).ok, true);
  const before = comp.lifecycle.save().envelope;
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
  return { port, root: port.openRoot(), before };
}
function step(port, node, predicate) {
  const action = node.legalActions.find(predicate);
  assert(action, JSON.stringify(node.legalActions.map(action => action.target)));
  return port.expand(node, action.actionId);
}
function place(port, node, target = "computer") {
  let next = step(port, node, action => action.family === "place_data");
  next = step(port, next, action => action.target?.target === target);
  return next;
}
function compareAllSuccessors(port, left, right) {
  assert.equal(port.identity(left), port.identity(right));
  assert.deepEqual(left, right, "等价节点的完整分析观察和合法集相同");
  for (const action of left.legalActions) {
    const a = port.expand(left, action.actionId), b = port.expand(right, action.actionId);
    assert.equal(port.identity(a), port.identity(b), action.actionId);
    assert.deepEqual(a, b, action.actionId);
  }
}

// 同一真实根，先取数据再放与先放再取：数据池物理空位不同，规则数量和后续选择相同。
const first = open(state);
const isCorner = action => action.family === "card_corner" && action.target?.cardInstanceId === cornerCard.id;
const gainThenPlace = place(first.port, step(first.port, first.root, isCorner));
const placeThenGain = step(first.port, place(first.port, first.root), isCorner);
compareAllSuccessors(first.port, gainThenPlace, placeThenGain);
assert.deepEqual(comp.lifecycle.save().envelope, first.before);
first.port.close();

// 蓝色附加位与计算机4号位的放置可交换：实体编号、显示序号和 placedTokens 顺序不同。
const blue = structuredClone(state);
const blueOwner = blue.players.players.find(player => player.id === seatId);
blueOwner.techState.ownedTiles.blue2 = true;
blueOwner.techState.blueBoardSlots.blue2 = 2;
blue.tech.stacks.blue2.remaining -= 1;
while (blueOwner.dataState.poolTokens.length < 5) assert(data.gainData(blueOwner, { root: blue }).ok);
for (let i = 0; i < 3; i += 1) assert(data.placeDataToComputer(blueOwner).ok);
const incomeCard = blueOwner.hand.find(card => cards.getIncomeGainForCard(card)?.credits === 1);
assert(incomeCard);
const second = open(blue);
function computerIncome(node) {
  const pending = place(second.port, node);
  return step(second.port, pending, action => action.target?.cardInstanceId === incomeCard.id);
}
const blueThenComputer = computerIncome(place(second.port, second.root, "blueBonus"));
const computerThenBlue = place(second.port, computerIncome(second.root), "blueBonus");
compareAllSuccessors(second.port, blueThenComputer, computerThenBlue);
assert.notEqual(second.port.identity(second.root), second.port.identity(blueThenComputer),
  "实际数据池数量、已放槽位和奖励变化必须保留，不能将所有数据状态合并");
assert.deepEqual(comp.lifecycle.save().envelope, second.before);
second.port.close();

// 合法重命名与展示重排不改变根观察、所有正式输入及其后继；未来分配沿各自合法序列继续。
const renamed = structuredClone(blue);
for (const player of renamed.players.players) {
  for (const [kind, tokens] of Object.entries(player.dataState).filter(([, value]) => Array.isArray(value))) {
    tokens.reverse();
    for (const [index, token] of tokens.entries()) {
      token.id = `data-token-${Number(token.id.match(/[0-9]+$/)[0]) + 10000}`;
      token.index += 100;
      if (kind === "poolTokens") token.slotIndex = 6 - index;
    }
  }
}
renamed.meta.sequences.dataToken += 10000;
const originalPort = open(blue), renamedPort = open(renamed);
assert.deepEqual(originalPort.root, renamedPort.root);
for (const action of originalPort.root.legalActions) {
  const a = originalPort.port.expand(originalPort.root, action.actionId);
  const b = renamedPort.port.expand(renamedPort.root, action.actionId);
  assert.deepEqual(a, b, action.actionId);
}
assert.deepEqual(comp.lifecycle.save().envelope, renamedPort.before);
originalPort.port.close();
renamedPort.port.close();
comp.dispose();
console.log("data token fungibility, real placement diamonds and every immediate successor passed");
