"use strict";
const fs = require("node:fs");
const cards = require("../randomizer/game/cards/effects");
const output = "reports/iteration/movement-demand-catalog-20260907.json";
if (fs.existsSync(output)) console.log(`已有需求目录：${output}`);
else {
  const report = { scope: "遍历当前正式卡牌模型的全部condition/event与移动相关效果；用于闭合设计，不冒充运行状态已满足或已实现搜索支持", cardCount: 0, conditions: {}, events: {}, movementEffects: [] };
  for (const cardId of Object.keys(cards.CARD_REFERENCE_MAP)) {
    const model = cards.getCardModel({ cardId });
    if (!model) throw new Error(`卡牌模型缺失：${cardId}`);
    report.cardCount += 1;
    const record = (table, key, path, value) => {
      if (!table[key]) table[key] = [];
      table[key].push({ cardId, path, value });
    };
    const walk = (value, path) => {
      if (!value || typeof value !== "object") return;
      if (value.condition?.type) record(report.conditions, value.condition.type, `${path}.condition`, value.condition);
      if (value.event?.type) record(report.events, value.event.type, `${path}.event`, value.event);
      for (const type of value.event?.types || []) record(report.events, type, `${path}.event`, value.event);
      if (value.eventType) record(report.events, value.eventType, path, value);
      if (typeof value.type === "string" && /move|probe|rocket/.test(value.type)) report.movementEffects.push({ cardId, path, value });
      for (const [key, child] of Object.entries(value)) if (key !== "source") walk(child, `${path}.${key}`);
    };
    walk(model, "model");
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, cardCount: report.cardCount,
    conditions: Object.fromEntries(Object.entries(report.conditions).map(([key, values]) => [key, values.length])),
    events: Object.fromEntries(Object.entries(report.events).map(([key, values]) => [key, values.length])),
    movementEffects: report.movementEffects.length }, null, 2));
}
