"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = process.argv[2] || "reports/iteration/resource-cache-seat-order-20260907.json";
// 仅隔离诊断暴露现有纯函数，不改变函数体、共享模块或生产文件。
function isolatedEvaluator() {
  const filename = path.resolve("randomizer/game/ai/expected-score-evaluator.js");
  const source = fs.readFileSync(filename, "utf8"), marker = "    EVALUATION_MODEL,\n    PARAMETER_VERSION,";
  assert.equal(source.split(marker).length, 2);
  const sandbox = { module: { exports: {} }, require: createRequire(filename) };
  vm.runInNewContext(source.replace(marker, "    diagnosticSelect: selectMinimumCostResourcePreparation,\n" + marker), sandbox, { filename });
  return sandbox.module.exports.diagnosticSelect;
}
if (fs.existsSync(output)) console.log("已有缓存顺序证据");
else {
  const brown = JSON.parse(fs.readFileSync("reports/iteration/brown-income-roots-20260907.json")).rows[0];
  const env = createSimulationEnv(); let green;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); green = env.legalActions().filter(a => a.family === "quick_trade");
  } finally { env.dispose(); }
  const brownTrades = brown.legal.filter(a => a.family === "quick_trade");
  const ids = new Set(brownTrades.map(a => a.target.tradeId)); green = green.filter(a => ids.has(a.target.tradeId));
  assert.deepEqual(green.map(a => a.target.tradeId).sort(), [...ids].sort());
  const cold = isolatedEvaluator(), warmed = isolatedEvaluator(), differences = [];
  const baseline = JSON.parse(fs.readFileSync("reports/iteration/resource-cache-seat-order-20260907.json"));
  for (let credits = 0; credits <= 8; credits++) for (let energy = 0; energy <= 8; energy++) for (let handSize = 0; handSize <= 4; handSize++) {
    const required = { credits, energy, handSize };
    const select = (fn, actions) => Array.from(fn(brown.observation, required, actions, "player-brown"), a => a.target.tradeId);
    const expected = select(cold, brownTrades), primer = select(warmed, green), actual = select(warmed, brownTrades);
    if (process.argv.includes("--fixed")) {
      assert.deepEqual(actual, expected, "其他席位预热不改变当前候选");
      assert.deepEqual(select(warmed, [...brownTrades].reverse()), expected, "输入顺序不改变结果");
      const renewed = brownTrades.map(a => ({ ...a, stateVersion: a.stateVersion + 1 }));
      const refreshed = Array.from(warmed(brown.observation, required, renewed, "player-brown"));
      assert.ok(refreshed.every(a => renewed.includes(a)), "命中后只返回当前descriptor");
      const old = baseline.differences.find(d => JSON.stringify(d.required) === JSON.stringify(required));
      if (old) assert.deepEqual(expected, old.cold, "已记录反例的冷计算排序不变");
    }
    if (JSON.stringify(expected) !== JSON.stringify(actual)) differences.push({ required, cold: expected, primedByGreenActionIds: primer, warm: actual });
  }
  fs.writeFileSync(output, JSON.stringify({ scope: "纯资源准备函数控制变量试验：真实棕方资源与真实两席交易descriptor；绿方descriptor仅用于改变动作编号排序，不代表绿方实际盘面或历史搜索复现",
    source: "brown-income-roots-20260907.json rows[0] / company-movement-input-42-20260906.json",
    cases: 405, brownTrades, greenTrades: green, differences }, null, 2) + "\n");
  console.log(JSON.stringify({ differences: differences.length, examples: differences.slice(0, 3) }));
}
