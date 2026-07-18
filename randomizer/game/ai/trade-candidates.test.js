"use strict";
const assert = require("node:assert/strict");
const { createTradeCandidates } = require("./trade-candidates");
const domain = createTradeCandidates({
  getAiCardDisplayLabel: () => "测试牌",
  getCurrentPlayer: () => ({ id: "p1" }),
  getCardPrice: () => 2,
  getCardTypeCode: () => 1,
  roundAiScore: (value) => Number(value) || 0,
});
const summary = domain.summarizeAiTradeDiscardCardEntry({ handIndex: 0, card: { id: "c1" }, opportunityCost: 3 });
assert.equal(summary.cardLabel, "测试牌");
assert.equal(summary.opportunityCost, 3);
console.log("game/ai/trade-candidates.test.js ok");
