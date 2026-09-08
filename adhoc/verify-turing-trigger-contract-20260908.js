"use strict";
// 验证正式匹配契约，不模拟未来事件可达性，不执行AI搜索。
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/trigger-contract.js");
const effects = req("../randomizer/game/cards/effects");
const output = "/Users/bilibili/code/seti-simu/reports/iteration/turing-trigger-contract-20260908.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重复执行：${output}`);
  process.exit(0);
}
const cases = [
  ["b_2.webp", { type: "visitPlanet", planetId: "mars" }, { type: "visitPlanet", planetId: "earth" }, 3],
  ["b_20.webp", { type: "launch" }, { type: "scanAction" }, 3],
  ["b_25.webp", { type: "signalMarked", nebulaId: effects.NEBULA_IDS_BY_COLOR.yellow[0] }, { type: "launch" }, 1],
  ["b_26.webp", { type: "cardCorner", cornerKind: "move" }, { type: "cardCorner", cornerKind: "energy" }, 1],
  ["dlc_24.png", { type: "researchTech", techType: "orange" }, { type: "researchTech", techType: "blue" }, 2],
  ["dlc_33.png", { type: "pass" }, { type: "endTurn" }, 1],
];
const rows = [];
for (const [cardId, event, negativeEvent, count] of cases) {
  const source = { id: "player-blue", reservedCards: [{ id: `source:${cardId}`, cardId }] };
  const before = structuredClone(source);
  const scratch = structuredClone(source);
  const matches = effects.collectMatchingTriggers(scratch, event);
  assert.equal(matches.length, count);
  assert.deepEqual(source, before, "需求读取只能修改私有副本");
  assert.ok(scratch.reservedCards[0].cardEffectState, "正式匹配会初始化状态");
  assert.deepEqual(scratch.reservedCards[0].cardEffectState.consumedTriggerIds, []);
  assert.equal(effects.collectMatchingTriggers(scratch, negativeEvent).length, 0);
  assert.equal(effects.collectMatchingTriggers(scratch, { ...event, sourceCardInstanceId: scratch.reservedCards[0].id }).length, 0);
  const selected = matches[0];
  assert.equal(effects.consumeTrigger(scratch.reservedCards[0], selected.trigger.id), true);
  const remaining = effects.collectMatchingTriggers(scratch, event);
  assert.equal(remaining.length, count - 1);
  assert.ok(remaining.every(match => match.trigger.id !== selected.trigger.id));
  const otherInstance = { id: `second:${cardId}`, cardId };
  scratch.reservedCards.push(otherInstance);
  const distinct = effects.collectMatchingTriggers(scratch, event);
  assert.equal(distinct.length, (count - 1) + count);
  const keys = distinct.map(match => `${match.card.id}:${match.trigger.id}`);
  assert.equal(new Set(keys).size, distinct.length, "相同卡牌类型的不同实体不能合并");
  rows.push({ cardId, event, negativeEvent, matching: matches.map(match => ({
    cardInstanceId: match.card.id, ruleId: match.trigger.id, effect: match.effect,
  })), matchingCount: count, afterConsumingOne: remaining.length,
  withSecondInstance: distinct.length, initializesState: true,
  negativeRejected: true, selfTriggerRejected: true, sourceUnchanged: true });
}
const report = {
  codeHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope: "正式collectMatchingTriggers契约检查；事件为显式测试输入，不证明其在盘面可达，不代表所有匹配可以同时领奖。没有运行完整规则事务、PASS过期顺序或AI搜索。",
  rows,
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ verifiedCards: rows.length, assertions: "匹配、负例、来源排除、消费后排除、实体隔离、私有副本初始化", output }));
