"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const source = "reports/iteration/trace-reward-outcomes-20260912.json";
const output = "reports/iteration/alien-pick-candidates-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync(source));
const row = input.outcomes.find(row => row.action.target.speciesId === "amiba"
  && row.action.target.traceType === "yellow");
assert(row);
const root = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: row.after, legalActions: row.nextLegal });
const successor = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: "player-white",
  branchObservation: row.after, currentAction: row.action, legalSuccessors: row.nextLegal,
  routeTargetId: "land:saturn:satellite:titan", routePlanId: "probe:rocket:11:land:saturn:satellite:titan" });
assert.equal(successor.length, 2);
assert.deepEqual(successor.map(a => a.target.source).sort(), ["blind", "display"]);
const result = { source, sourceHash: createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
  scope: "读取已有真实阿米巴拿牌观察。前525步与新基线动作/after一致，此路径阿米巴生产未改；不重放、不运行AI、不读取盲抽牌序。",
  legal: row.nextLegal, root, successor };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, root, successor: successor.map(a => a.target) }, null, 2));
