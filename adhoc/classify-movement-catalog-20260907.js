"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const cards = require("../randomizer/game/cards/effects");
const input = "reports/iteration/movement-demand-catalog-20260907.json";
const output = "reports/iteration/movement-purpose-classification-20260907.json";
const classification = {
  card_free_move: ["means", "正式免费移动额度，不单独产生目的"],
  card_move: ["means", "正式卡牌移动额度，包括触发奖励中的移动"],
  card_earth_sector_content_move: ["means", "按当前地球扇区内容生成移动额度，不改变目的地"],
  card_count_hand_corner_move: ["means", "按手牌移动角标生成额度，不能预支未获得额度"],
  card_remove_planet_marker: ["not-movement-purpose", "移除参考图标记，不由太阳系移动达成"],
  card_count_rockets_reward: ["not-movement-purpose", "棋子数量奖励，移动位置本身不增加棋子数量"],
  card_probe_sector_scan: ["spatial-purpose", "卡牌扫描源位置准备；正式owner为Science SCAN_STEP"],
  card_probe_location_reward: ["spatial-purpose", "位置数据奖励；复用Card Play getProbeLocationReward"],
  card_probe_stack_reward: ["spatial-purpose", "同格条件奖励；复用getProbeStackRewardMatch"],
  probeLocation: ["spatial-purpose", "复用buildProbeLocationData与taskConditionMet"],
  probeAdjacentEarthAsteroid: ["spatial-purpose", "复用buildProbeLocationData与taskConditionMet"],
  probeDistanceFromEarth: ["spatial-purpose", "复用buildProbeLocationData与taskConditionMet"],
  probeAdjacentEarth: ["spatial-purpose", "复用buildProbeLocationData与taskConditionMet"],
  probesOnDifferentPlanets: ["spatial-purpose", "多探测器联合条件；复用taskConditionMet，不拆成独立已完成目标"],
};
if (fs.existsSync(output)) console.log(`已有分类证据：${output}`);
else {
  const catalog = JSON.parse(fs.readFileSync(input));
  const report = { scope: "有限普通/DLC模型检索项的逐项职责分类，不把静态映射当作完整动态执行覆盖；不运行AI", input,
    inputSha256: crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex"), counts: {}, entries: [], optionalAbsences: [] };
  assert.equal(Object.keys(cards.CARD_REFERENCE_MAP).length, catalog.cardCount);
  for (const item of catalog.movementEffects) {
    const model = cards.getCardModel(item.cardId);
    const current = item.path.split(".").slice(1).reduce((value, part) => value[part], model);
    const checkAbsence = (value, path) => {
      if (value === undefined) {
        assert.equal(path, "options.returnToHandIfSignalCount", `未解释的模型缺失：${item.cardId}:${path}`);
        report.optionalAbsences.push({ cardId: item.cardId, path: `${item.path}.${path}`,
          contract: "probeSectorScanEffect未声明回手条件时保留可选undefined；历史JSON省略该字段，不代表模型变更；非生产零异常通过证明" });
      } else if (value && typeof value === "object") {
        for (const [field, child] of Object.entries(value)) checkAbsence(child, path ? `${path}.${field}` : field);
      }
    };
    checkAbsence(current, "");
    assert.deepEqual(JSON.parse(JSON.stringify(current)), item.value, `历史JSON路径必须仍等于当前正式模型序列化值：${item.cardId}:${item.path}`);
    assert.ok(Object.hasOwn(classification, current.type), `未归类类型：${current.type}`);
    const [role, contract] = classification[current.type];
    report.counts[role] = (report.counts[role] || 0) + 1;
    report.entries.push({ cardId: item.cardId, path: item.path, type: current.type, role, contract });
  }
  assert.equal(report.entries.length, 56);
  assert.deepEqual(report.counts, { means: 36, "not-movement-purpose": 3, "spatial-purpose": 17 });
  report.additionalSources = [
    { source: "基础到达宣传", owner: "abilities/rocket.applyArrivalRewards", requirement: "正式到达事件与实际资源变化，不从地名另建奖励表" },
    { source: "已打出1型卡访问槽", owner: "cards/effects.collectMatchingTriggers", requirement: "剩余槽、来源排除、包含/排除行星、requiresOwnOrbit；读取不得修改冻结卡牌" },
    { source: "当回合移动/访问奖励", owner: "residual-domain-session.augmentEffectResult", requirement: "owner、usedKeys、distinctBy、minCount、claimedKeys、付宣传移动followup" },
    { source: "虫族运输", owner: "aliens/chong.listTransportArrivalEvents", requirement: "按fossilId关联运输棋子与原任务key，未送达与已送达分开" },
    { source: "b82终局位置", owner: "end-game-scoring与rockets.buildProbeLocationData", requirement: "只在实际保留终局卡时形成位置准备，不提前兑现终局分" },
    { source: "otherProbeAtPlanet", owner: "cards/effects.taskConditionMet", requirement: "对手条件，不生成己方可控制移动目的" },
  ];
  report.openContractChecks = [
    "PROBE_SECTOR_SCAN经Card Play转为Science mode=probe，owner/maxTargets/includeAdjacent/returnToHandIfSignalCount与固定探测器多次扫描的执行契约待行为验证",
    "visitPlanet要求hasOwnOrbit的触发槽：匹配器消费该字段，已检查到达事件和任务转发未填入；需正式触发反例，不能只按源码声明bug已复现",
  ];
  report.verified = true;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, counts: report.counts, openContractChecks: report.openContractChecks }, null, 2));
}
