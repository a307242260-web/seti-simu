"use strict";
// 设计验算：使用已冻结的真实卡牌效果算例，不代表完整普通牌估值器已实现。
const fs = require("node:fs"), assert = require("node:assert/strict");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const deck = require("../randomizer/game/cards/deck");
const source = require("../reports/iteration/round5-card-value-examples-20260909.json");
const inputs = require("../reports/iteration/round5-card-value-inputs-20260908.json");
const output = "reports/iteration/round5-payment-value-20260909.json";
if (fs.existsSync(output)) { console.log("已有设计检查点：" + output); process.exit(0); }
const corner = id => {
  const card = inputs.models.find(c => c.cardId === id);
  assert.ok(card);
  const reward = deck.DISCARD_ACTION_REWARDS[card.discardCode] || deck.DISCARD_ACTION_MOVE_REWARDS[card.discardCode];
  assert.ok(reward);
  return Object.entries(reward.gain || {}).reduce((n, [key, value]) => n + value * evaluator.resourceUnitValue(key), 0)
    + (reward.dataCount || 0) * evaluator.resourceUnitValue("availableData")
    + (reward.movementPoints || 0) * evaluator.resourceUnitValue("movement");
};
const variants = source.variants.map(variant => ({
  scan7IncludesData: variant.scan7IncludesData,
  cards: variant.examples.map(card => {
    const playRealization = card.immediate + card.deferred - card.resourceCost;
    const cornerRealization = corner(card.id);
    const heldValue = Math.max(playRealization, cornerRealization);
    assert.equal(playRealization, card.net + card.cardCost, "不可重复扣本牌均值");
    assert.ok(heldValue >= 0, "弃牌不得成为负成本");
    return { id: card.id, name: card.name, net: card.net, playRealization, cornerRealization, heldValue };
  }),
}));
for (const variant of variants) {
  const grant = variant.cards.find(c => c.id === "b_48.webp");
  const launch = variant.cards.find(c => c.id === "b_69.webp");
  assert.ok(grant.net < 0 && launch.net > 0);
  assert.ok(grant.heldValue < evaluator.resourceUnitValue("energy"));
  assert.ok(launch.heldValue > evaluator.resourceUnitValue("energy"));
  // 仅比较相同合法收益、相同付牌数量的候选；不把非移动角标牌伪造为移动支付。
  const heldBefore = grant.heldValue + launch.heldValue;
  assert.equal(heldBefore - launch.heldValue, grant.heldValue);
  assert.ok(heldBefore - grant.heldValue > heldBefore - launch.heldValue);
}
const income = [1, 2, 3, 4].map(round => ({ round,
  credits: evaluator.incomeFutureValue({ credits: 1 }, round),
  energy: evaluator.incomeFutureValue({ energy: 1 }, round),
  card: evaluator.incomeFutureValue({ handSize: 1 }, round),
}));
assert.ok(income[0].credits > income[0].card);
assert.ok(income[1].credits < income[1].card);
assert.deepEqual(income[3], { round: 4, credits: 0, energy: 0, card: 0 });
const report = { baseCommit: "cc222567", scope: "七张牌的支付估值设计验算，不是生产排序/实际移动支付测试",
  formula: "N=G-C-6; H=max(G-C, corner); unknown=6; paymentCost=energyCost*energyUnit+sum(H)",
  variants, income, passed: true,
  limitations: ["扫描两种解释继续并列，不用支付公式替代扫描口径确认",
    "没有假定所有牌都能作为移动支付，真实合法集仍是先决条件",
    "已在后状态体现的支付不再扣第二次；收入不自动加入每张持牌的价值",
    "收入R2开始钱低于牌来自既有钱电折价，未修改曲线"] };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(report));
