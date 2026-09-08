"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/turing-options.js");
const cards = req("../randomizer/game/cards/effects");
const output = "/Users/bilibili/code/seti-simu/reports/iteration/turing-consumer-options-81ee9ed6-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const directLand = [], limitIgnoringLaunch = [];
const before = JSON.stringify(cards.MODELS);
for (const cardId of Object.keys(cards.MODELS)) {
  for (const effect of cards.buildPlayEffects({ cardId })) {
    const row = { cardId, effect };
    if (effect.type === cards.EFFECT_TYPES.CARD_LAND) directLand.push(row);
    if (effect.type === cards.REWARD_TYPES.LAUNCH && effect.options.ignoreRocketLimit) limitIgnoringLaunch.push(row);
  }
}
assert.equal(JSON.stringify(cards.MODELS), before, "建效果不得修改正式卡表");
assert.equal(Object.keys(cards.MODELS).length, 254);
assert.equal(directLand.length, 6);
assert.ok(directLand.every(row => row.effect.options.skipCost === true));
assert.deepEqual(directLand.filter(row => row.effect.options.allowSatelliteWithoutTech).map(row => row.cardId), ["b_34.webp"]);
assert.deepEqual(limitIgnoringLaunch.map(row => row.cardId), ["b_37.webp", "b_37.webp"]);
const report = { passed: true, codeHead: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope: "静态正式直接效果参数，不覆盖动态奖励、触发任务或回合后继；不是完整搜索、可达性或节点收益证明",
  modelCount: 254, directLand, limitIgnoringLaunch };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, output, directFreeLandCount: directLand.length, limitIgnoringLaunchCount: limitIgnoringLaunch.length }));
