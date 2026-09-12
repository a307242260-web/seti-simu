"use strict";
const fs = require("node:fs"), path = require("node:path"), { createRequire } = require("node:module"), assert = require("node:assert/strict");
const output = "adhoc/mars-continuation-20260913.json";
if (fs.existsSync(output)) { console.log(`已有诊断不重跑：${output}`); process.exit(0); }
const file = path.resolve("randomizer/app/simulation-counterfactual-outcome.test.js");
const source = fs.readFileSync(file, "utf8"), end = source.indexOf("const env = createSimulationEnv();");
assert(end > 0);
const { createSimulationEnv, createMarsOrbitCheckpoint } = new Function("require", source.slice(0, end)
  + "\nreturn { createSimulationEnv, createMarsOrbitCheckpoint };")(createRequire(file));
const env = createSimulationEnv(), report = {};
try {
  env.reset({ seed: "seti-mars-orbit-counterfactual", activePlayerCount: 4 });
  const { checkpoint, playerId } = createMarsOrbitCheckpoint(env);
  env.loadCheckpoint(checkpoint);
  const actions = env.legalActions(), orbit = actions.find(a => a.family === "orbit" && a.target?.planetId === "mars");
  assert(orbit);
  report.playerId = playerId;
  report.observation = env.observe(playerId);
  console.log("[火星续搜诊断] 单独运行既有fixture");
  const result = env.runHeuristicPolicyDecision(); assert.equal(result.ok, true);
  report.action = result.policyDecision.actionId;
  report.diagnostics = env.getCounterfactualDiagnostics();
  report.outcomes = result.actionOutcomes.map(o => ({ actionId: o.actionId, status: o.status, code: o.code,
    completeness: o.searchCompleteness, leaves: o.leaves.map(l => ({ id: l.leafId, chain: l.actionChain,
      depth: l.secondaryAgentDepth, rootTarget: l.rootRouteTargetId, reason: l.terminalReason })) }));
  report.orbit = report.outcomes.find(o => o.actionId === orbit.actionId);
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, orbit: report.orbit, budget: report.diagnostics?.budgetLimits,
    frontier: report.diagnostics?.frontierNodeBreakdown?.slice(0, 8), error: report.error }, null, 2));
}
