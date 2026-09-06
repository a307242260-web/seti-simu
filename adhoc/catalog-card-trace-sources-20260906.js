"use strict";
const fs = require("node:fs");
const effects = require("../randomizer/game/cards/effects");
const output = "reports/iteration/card-trace-source-catalog-20260906-v2.json";
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const entries = [];
  function visit(value, path, cardId) {
    if (!value || typeof value !== "object") return;
    if (value.type === effects.REWARD_TYPES.ALIEN_TRACE) entries.push({ cardId, path, effect: value });
    for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`, cardId);
  }
  for (const cardId of Object.keys(effects.MODELS).sort()) visit(effects.getCardModel(cardId), "model", cardId);
  const report = { scope: "当前卡牌模型递归痕迹效果目录；另需核对运行期生成及初始牌，不冒充全仓调用闭包",
    count: entries.length, cards: [...new Set(entries.map(e => e.cardId))],
    optionKeys: [...new Set(entries.flatMap(e => Object.keys(e.effect.options || {})))].sort(), entries };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, count: report.count, cards: report.cards, optionKeys: report.optionKeys }, null, 2));
}
