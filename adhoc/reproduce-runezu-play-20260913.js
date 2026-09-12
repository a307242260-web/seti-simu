"use strict";
const fs = require("node:fs"), path = require("node:path");
const { createRequire } = require("node:module");
const fixture = path.resolve("randomizer/game/cards/play-domain.test.js");
const source = fs.readFileSync(fixture, "utf8");
const boundary = source.indexOf("function runFixedScan()");
if (boundary < 0) throw new Error("正式卡牌测试fixture边界缺失");
const output = process.argv[2] || "adhoc/runezu-play-baseline-detail-20260913.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
// 同一JS realm复用fixture，避免跨VM原型影响deepStrictEqual；不改变任何断言。
const results = new Function("require", source.slice(0, boundary) + `
  return ["runezu_0.webp", "runezu_1.webp", "runezu_7.webp", "runezu_8.webp", "runezu_9.webp"].map(cardId => {
    const { composition } = createIntegratedComposition(cardId);
    try {
      const result = composition.inputPort.submitAction(getOnlyPlayAction(composition));
      return { cardId, result };
    } finally { composition.dispose(); }
  });
`)(createRequire(fixture));
fs.writeFileSync(output, JSON.stringify(results, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(results.map(({ cardId, result }) => ({ cardId, ok: result.ok,
  failure: result.failure, code: result.code, message: result.message })), null, 2));
