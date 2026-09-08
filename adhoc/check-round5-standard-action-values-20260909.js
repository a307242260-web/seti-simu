"use strict";
// 使用正式只读费用函数验算标准行动替代价值，不执行行动、不改变AI。
const fs = require("node:fs"), assert = require("node:assert/strict");
const rocket = require("../randomizer/game/abilities/rocket");
const planet = require("../randomizer/game/abilities/planet");
const scan = require("../randomizer/game/actions/scan-effects");
const data = require("../randomizer/game/data");
const tech = require("../randomizer/game/tech");
const passives = require("../randomizer/game/industry/passives");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const effects = require("../randomizer/game/cards/effects");
const inputs = require("../reports/iteration/round5-card-value-inputs-20260908.json");
const output = "reports/iteration/round5-standard-action-values-20260909.json";
if (fs.existsSync(output)) { console.log("已有费用检查点：" + output); process.exit(0); }
const value = (cost, round) => Object.entries(cost).reduce((n, [key, count]) => n + count * evaluator.resourceUnitValue(key, round), 0);
function fixture(company, orbit, orange3) {
  const player = { id: "player-blue", initialSelection: { industry: { id: `industry:${company}.png` } },
    techState: { ownedTiles: orange3 ? { orange3: true } : {}, disabledTiles: {} } };
  return { players: { players: [player] }, turn: { currentPlayerId: player.id, roundNumber: 1, turnNumber: 1 },
    planets: { planets: { mars: { orbitMarkers: orbit ? [{ playerId: "player-white" }] : [] } } } };
}
const scenarios = [
  ["普通", "图灵系统", false, false], ["他人已环绕", "图灵系统", true, false],
  ["橙3", "图灵系统", false, true], ["他人环绕加橙3", "图灵系统", true, true],
  ["深空探测", "深空探测", false, false], ["芬威克", "芬威克研究中心", false, false],
  ["异星实验室", "异星实验室", false, false],
].map(([name, company, orbit, orange3]) => {
  const context = fixture(company, orbit, orange3), before = structuredClone(context), player = context.players.players[0];
  const costs = {
    launch: passives.getStandardLaunchCost(player, rocket.DEFAULT_LAUNCH_COST),
    orbit: { ...planet.DEFAULT_ORBIT_COST }, land: { energy: planet.getLandEnergyCost(context, "mars") },
    scan: scan.getStandardScanCost(player), research: { publicity: passives.getResearchPublicityCost(player, tech.RESEARCH_PUBLICITY_COST) },
    analyze: passives.canAnalyzeWithoutEnergy(player) ? {} : { energy: data.ANALYZE_ENERGY_COST },
  };
  assert.deepEqual(context, before, "费用读取不得改变规则状态");
  return { name, company, costs, rounds: [1, 2, 3, 4].map(round => ({ round,
    values: Object.fromEntries(Object.entries(costs).map(([key, cost]) => [key, value(cost, round)])) })) };
});
assert.deepEqual(scenarios[0].rounds[0].values, { launch: 20, orbit: 18, land: 24, scan: 26, research: 24, analyze: 8 });
assert.deepEqual(scenarios.slice(0, 4).map(s => s.costs.land.energy), [3, 2, 2, 1]);
assert.equal(scenarios[4].rounds[0].values.analyze, 0);
assert.equal(scenarios[5].rounds[0].values.research, 20);
assert.deepEqual(scenarios[6].rounds[0].values, { launch: 10, orbit: 18, land: 24, scan: 16, research: 16, analyze: 8 });
const launchCard = inputs.models.find(c => c.cardId === "b_69.webp");
const launchCost = effects.getCardPlayCost({ cardId: launchCard.cardId, price: launchCard.price });
const launchNet = [scenarios[0], scenarios[6]].map(s => ({ company: s.company,
  gross: s.rounds[0].values.launch, cardResourceCost: value(launchCost, 1), cardMean: 6,
  net: s.rounds[0].values.launch - value(launchCost, 1) - 6 }));
assert.deepEqual(launchNet.map(x => x.net), [4, -6]);
const report = { baseCommit: "71f382e1", scope: "正式费用折算设计证据，不是完整卡牌模型或性能验收",
  scenarios, launchNet, ownership: "标准行动替代价值只覆盖被替代行动；同一行动的普通奖励不再另加，卡牌明确额外奖励单列", passed: true };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, launchNet, scenarioCount: scenarios.length, passed: true }));
