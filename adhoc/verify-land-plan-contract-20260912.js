"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/direct-land-target-contract-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/direct-land-target-before-20260912.json"));
const prior = JSON.parse(fs.readFileSync("reports/iteration/trace-score-greedy-step506-dbceef73-20260912.json"));
const routePlanIds = [...new Set(prior.plan.steps.map(s => s.routePlanId))];
assert(routePlanIds.includes("probe:rocket:11:land:saturn:satellite:titan"));
const rows = ["titan", "enceladus"].map(satelliteId => {
  const routeTargetId = `land:saturn:satellite:${satelliteId}`;
  const routePlanId = `probe:rocket:11:${routeTargetId}`;
  const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: "player-white",
    branchObservation: input.observation, currentAction: input.currentAction,
    routeTargetId, routePlanId, legalSuccessors: input.legal });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].target.landTarget.satelliteId, satelliteId);
  return { routeTargetId, routePlanId, selected };
});
fs.writeFileSync(output, JSON.stringify({ scope: "同一真实决策输入，使用正式probe路线契约；无AI。原直接land计划ID由调查脚本手填，不代表生产路径。",
  priorPlanSource: "trace-score-greedy-step506-dbceef73-20260912.json", routePlanIds, rows,
  conclusion: "当前生产目标筛选正常，不实施直接land补丁" }, null, 2) + "\n", { flag: "wx" });
console.log(output);
