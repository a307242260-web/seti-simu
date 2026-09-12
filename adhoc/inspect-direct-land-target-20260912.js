"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/direct-land-target-before-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step506-20260912.json"));
const source = "seti-saves/seti-save-research-overflow-trace-greedy-20260912-126ed66e-full-v285.json";
const save = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
try {
  env.loadCheckpoint(input.checkpoint);
  for (let i = 505; i < 512; i += 1) {
    const expected = save.replaySteps[i];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
  }
  const observation = env.observe("player-white"), legal = env.legalActions();
  assert(legal.every(a => a.target.landTarget));
  const rows = ["land:saturn:satellite:titan", "land:saturn:satellite:enceladus"].map(routeTargetId => ({
    routeTargetId,
    selected: evaluator.selectSecondaryAgentSuccessors({ focalSeatId: "player-white",
      branchObservation: observation, currentAction: save.replaySteps[511].action,
      routeTargetId, routePlanId: routeTargetId, legalSuccessors: legal }),
  }));
  fs.writeFileSync(output, JSON.stringify({ source, step: 513,
    scope: "真实506至512动作与after验证；513节点调用原生后继筛选，无AI，不代表整个搜索来源归因。",
    observation, currentAction: save.replaySteps[511].action, legal, rows }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(rows.map(r => ({ target: r.routeTargetId,
    selected: r.selected.map(a => a.target) })), null, 2));
} finally { env.dispose(); }
