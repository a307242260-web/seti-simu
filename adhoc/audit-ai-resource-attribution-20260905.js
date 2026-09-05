"use strict";

// 第二轮设计反例；只调用纯估值函数，不运行或续跑固定盘面。
const fs = require("node:fs");
const assert = require("node:assert/strict");
const outcome = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const placement = require("../randomizer/game/data/placement");
const { execFileSync } = require("node:child_process");
const outputPath = "reports/iteration/resource-r2-design-20260905.json";
if (fs.existsSync(outputPath)) {
  console.log(fs.readFileSync(outputPath, "utf8"));
  process.exit(0);
}
const seatId = "resource-audit-seat";
function facts({ resources = {}, blueBonusCount = 0, roundNumber = 1, income = {}, tech = {} } = {}) {
  const observation = outcome.createDecisionObservation({
    publicState: {
      roundNumber,
      players: [{
        id: seatId,
        resources: { score: 0, credits: 0, energy: 0, publicity: 0, availableData: 0, ...resources },
        income,
        techState: { ownedTiles: tech },
        dataProgress: { computerSlots: [1], blueBonusCount },
      }],
      board: {},
    },
    selfState: { id: seatId, hand: [] },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
  return outcome.createStrategicFacts(observation, seatId);
}
const root = facts({ tech: { blue2: true } });
const evaluate = (before, after) => evaluator.evaluateStrategicFactsBreakdown(before, after);
const blueOnly = evaluate(root, facts({ tech: { blue2: true }, blueBonusCount: 1, resources: { energy: 1 } }));
const blueAndOtherGain = evaluate(root, facts({ tech: { blue2: true }, blueBonusCount: 1, resources: { energy: 3 } }));
const blueThenAnalyze = evaluate(root, facts({ tech: { blue2: true }, blueBonusCount: 0, resources: { energy: 1 } }));
const publicity = [1, 4].map((roundNumber) => ({
  roundNumber,
  breakdown: evaluate(facts({ roundNumber }), facts({ roundNumber, resources: { publicity: 6 } })),
}));
const income = ["credits", "energy"].map((resource) => ({
  resource,
  breakdown: evaluate(facts(), facts({ income: { [resource]: 1 } })),
}));
assert.equal(blueOnly.infrastructure.blueBonusPlacementValue, 10);
assert.equal(blueAndOtherGain.infrastructure.blueBonusPlacementValue, 30);
assert.equal(blueThenAnalyze.infrastructure.blueBonusPlacementValue, 0);
assert.deepEqual(publicity.map((entry) => entry.breakdown.publicityResearchValue), [60, 60]);
assert.deepEqual(income.map((entry) => entry.breakdown.infrastructure.incomeValue), [24, 30]);
const result = {
  schemaVersion: "seti-ai-design-counterexamples-v1",
  createdAt: new Date().toISOString(),
  gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  kind: "pure-evaluator-counterexamples-not-fixed-board-validation",
  cases: {
    blueOnly,
    blueAndOtherGain,
    blueThenAnalyze,
    publicity,
    income,
  },
  formalBlueRewards: ["blue1", "blue2", "blue3", "blue4"].map((tileId) => ({
    tileId, reward: placement.getBlueTileDataBonus(tileId),
  })),
  conclusions: [
    "蓝2实际只给1能量，额外2能量的其他来源却让蓝槽分项从10变30。",
    "相同资源终点，仅占用数被分析清空，蓝槽分项从10变0；占用数不能代表历史放置。",
    "无具体科技候选输入时，宣传0到6在第1轮和第4轮均固定获得60研究预期。",
    "新增一格信用/能源收入在第1轮计24/30，与已确认的信用10、能源8单位表方向相反。",
  ],
};
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, conclusions: result.conclusions }, null, 2));
