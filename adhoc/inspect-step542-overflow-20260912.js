"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/step542-overflow-choices-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step542-20260912.json"));
const save = JSON.parse(fs.readFileSync(input.source));
const env = createSimulationEnv();
try {
  env.loadCheckpoint(input.checkpoint);
  for (let i = 541; i < 586; i += 1) {
    const expected = save.replaySteps[i];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
  }
  const observation = env.observe("player-green");
  const legal = env.legalActions();
  assert.equal(legal.length, 2);
  assert(legal.every(a => a.target.stateExtra));
  const selected = evaluator.selectSecondaryAgentSuccessors({ branchObservation: observation,
    focalSeatId: "player-green", currentAction: save.replaySteps[585].action,
    routeTargetId: "data:analyze", routePlanId: "data:analyze", legalSuccessors: legal });
  const checkpoint = env.createCheckpoint();
  // 本输入从中途恢复，当前replaySteps只是542起的后缀，不能作为初始盘面的完整日志重放。
  // 与542输入checkpoint一样直接加载coreState/envelope，不携带后缀日志。
  delete checkpoint.replaySteps;
  delete checkpoint.effectSessionJournals;
  delete checkpoint.browserReplaySteps;
  const outcomes = [];
  for (const action of legal) {
    env.loadCheckpoint(checkpoint);
    assert.equal(env.step(action).ok, true);
    outcomes.push({ action, observation: env.observe("player-green") });
  }
  const differences = [];
  function compare(a, b, path = "") {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === "object" && typeof b === "object") {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) compare(a[key], b[key], `${path}.${key}`);
    } else differences.push({ path, left: a, right: b });
  }
  compare(outcomes[0].observation, outcomes[1].observation);
  fs.writeFileSync(output, JSON.stringify({ source: input.source, checkpointSource: "budget-before-step542-20260912.json",
    scope: "真实存档542至586完整动作与after重放；587两合法额外痕迹各执行一次，无AI。仅观察差异，不证明完整状态等价。",
    before: observation, legal, selected, outcomes, differences }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, legal: legal.length, selected: selected.length, differences }, null, 2));
} finally { env.dispose(); }
