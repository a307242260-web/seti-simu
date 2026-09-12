"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const model = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/trace-score-greedy-choices-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step506-20260912.json"));
const save = JSON.parse(fs.readFileSync(input.source));
const env = createSimulationEnv();
try {
  env.loadCheckpoint(input.checkpoint);
  for (let index = 505; index < 513; index += 1) {
    const action = env.legalActions().find(a => a.actionId === save.replaySteps[index].action.actionId);
    assert(action);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, save.replaySteps[index].after);
  }
  const legal = env.legalActions();
  const observation = model.createDecisionObservation(env.observe("player-white"), { seatId: "player-white" });
  const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: "player-white",
    branchObservation: observation, currentAction: save.replaySteps[512].action,
    routeTargetId: "land:saturn:satellite:titan", routePlanId: "land:saturn:satellite:titan", legalSuccessors: legal });
  const previous = JSON.parse(fs.readFileSync("reports/iteration/step506-reward-choices-20260912.json")).rows[0].searchSelected;
  assert.equal(previous.length, 5);
  assert.equal(selected.length, 4);
  const removed = previous.filter(a => !selected.some(b => b.actionId === a.actionId));
  assert.equal(removed.length, 1);
  assert.equal(removed[0].target.speciesId, "chong");
  assert.equal(removed[0].target.position, 2);
  assert.deepEqual(env.legalActions(), legal);
  fs.writeFileSync(output, JSON.stringify({ source: input.source, step: 514, legalCount: legal.length,
    previous, selected, removed, scope: "原路径规则重放及正式候选筛选，无AI搜索；只证明此节点5→4" }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ legal: legal.length, before: previous.length, after: selected.length,
    removed: removed.map(a => a.target.choiceId), output }, null, 2));
} finally { env.dispose(); }
