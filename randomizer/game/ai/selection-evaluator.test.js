"use strict";

const assert = require("node:assert/strict");
const selection = require("./selection-evaluator");

const openingOffer = {
  industryOptions: [
    { id: "stratus", label: "层云核心" },
    { id: "turing", label: "图灵系统" },
  ],
  initialOptions: [1, 2, 10],
};
const openingBefore = structuredClone(openingOffer);
const opening = selection.evaluateInitialSelection(openingOffer);
assert.equal(opening.industry.id, "turing", "setup 估值必须选择更高的正式公司/初始卡组合");
assert.deepEqual(opening.initialCards, [1, 10]);
assert.deepEqual(selection.evaluateInitialSelection(openingOffer), opening, "setup 估值必须确定性");
assert.deepEqual(openingOffer, openingBefore, "setup 估值不得修改 offer");

const hand = [
  { id: "c0", label: "C" },
  { id: "c1", label: "A" },
  { id: "c2", label: "B" },
];
assert.deepEqual(
  selection.evaluateDiscardIndexes(hand, 1, {
    pendingType: "income",
    incomeGainByIndex: {
      0: { credits: 1 },
      1: { energy: 1 },
      2: { credits: 2 },
    },
  }),
  [2],
  "收入弃牌必须优先收益最高的合法 choice",
);
assert.deepEqual(selection.evaluateDiscardIndexes(hand, 1), [1], "普通弃牌使用稳定业务标签排序");

assert.deepEqual(
  selection.evaluateResearchTechTile([
    { tileId: "blue1" },
    { tileId: "orange4" },
    { tileId: "purple2", bonusId: "bonus_1c" },
    { tileId: "orange1", score: 999, available: false },
  ]),
  { tileId: "purple2", bonusId: "bonus_1c" },
  "科技选择必须忽略 unavailable 并应用类型/bonus 估值",
);
assert.equal(selection.evaluateBlueTechSlot([4, "2", 3]), 2);

assert.deepEqual(
  selection.evaluateMovePaymentIndexes(hand, {
    requiredMovePoints: 2,
    availableEnergy: 4,
    roundNumber: 1,
    moveCardIndexes: [0, 1, 2],
    moveCardOpportunityCosts: { 0: 5, 1: 1, 2: 3 },
  }),
  [1, 2],
  "前期保留能量时必须按机会成本选择支付牌",
);
assert.deepEqual(
  selection.evaluateMovePaymentIndexes(hand, {
    requiredMovePoints: 2,
    availableEnergy: 4,
    roundNumber: 4,
    moveCardIndexes: [0, 1, 2],
  }),
  [],
  "后期能量足够时不得无故弃牌支付",
);

assert.deepEqual(
  selection.evaluateAlienUseOption([
    { choice: "cancel", label: "取消" },
    { choice: "blind", label: "盲抽" },
    { choice: "displayed", label: "展示牌" },
    { choice: "confirm", label: "确认", disabled: true },
  ]),
  { choice: "displayed", label: "展示牌" },
  "外星人选择必须拒绝 disabled 并优先显式高价值选项",
);
assert.equal(selection.evaluateAlienUseOption([]), null);

console.log("selection evaluator behavior tests passed");
