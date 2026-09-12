"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/trace-reward-outcomes-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step506-20260912.json"));
const source = "seti-saves/seti-save-research-overflow-trace-greedy-20260912-126ed66e-full-v285.json";
const save = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
try {
  env.loadCheckpoint(input.checkpoint);
  for (let i = 505; i < 513; i += 1) {
    const expected = save.replaySteps[i];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
  }
  const before = env.observe("player-white"), legal = env.legalActions();
  const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: "player-white",
    branchObservation: before, currentAction: save.replaySteps[512].action,
    routeTargetId: "land:saturn:satellite:titan",
    routePlanId: "probe:rocket:11:land:saturn:satellite:titan", legalSuccessors: legal });
  assert.equal(selected.length, 4);
  const checkpoint = env.createCheckpoint();
  // 中途恢复的后缀不是完整重放日志；使用正式 core/envelope 恢复契约。
  delete checkpoint.replaySteps;
  delete checkpoint.effectSessionJournals;
  delete checkpoint.browserReplaySteps;
  const outcomes = [];
  for (const candidate of selected) {
    env.loadCheckpoint(checkpoint);
    const action = env.legalActions().find(a => a.actionId === candidate.actionId);
    assert(action);
    assert.equal(env.step(action).ok, true);
    const after = env.observe("player-white");
    outcomes.push({ action, after, nextLegal: env.legalActions() });
  }
  fs.writeFileSync(output, JSON.stringify({ source, step: 514,
    scope: "当前存档506至513完整动作及after一致；四个正式候选各执行一次。只记录公开/己方观察，不以真实盲抽结果决定策略，不代表完成奖励链或全局等价。",
    before, selected, outcomes }, null, 2) + "\n", { flag: "wx" });
  const publicPlayer = observation => {
    const player = observation.publicState.players.find(row => row.playerId === "player-white");
    assert(player, "公开观察必须包含当前席位");
    return player;
  };
  console.log(JSON.stringify({ output, beforeResources: publicPlayer(before),
    outcomes: outcomes.map(row => ({ action: row.action.summary,
      resources: publicPlayer(row.after),
      next: row.nextLegal.map(a => a.summary) })) }, null, 2));
} finally { env.dispose(); }
