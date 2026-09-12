"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const chong = require("../randomizer/game/aliens/chong");
const { createHash } = require("node:crypto");
const commit = execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/chong-trace-reward-repro-${commit}-20260912.json`;
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
  const before = env.observe("player-white");
  // 规则诊断读取完整状态验证面板化石；此数据不得输入机器人估值或候选筛选。
  const state = JSON.parse(env.createCheckpoint().coreState.committedState);
  const fossilId = state.aliens.chong.panelFossilSlots[7];
  const expectedReward = chong.getFossilReward(fossilId);
  assert.equal(fossilId, "fossil_04");
  assert.equal(expectedReward.drawCards, 2);
  const action = env.legalActions().find(a => a.target?.choiceId === "trace:2:blue:chong:7");
  assert(action);
  assert.equal(env.step(action).ok, true);
  const after = env.observe("player-white");
  const actualDrawCount = after.selfState.hand.length - before.selfState.hand.length;
  const testedFiles = ["randomizer/game/aliens/chong.js", "randomizer/game/effects/science-session.js"];
  const result = { commit, source, step: 514, fossilId, expectedReward,
    codeHashes: Object.fromEntries(testedFiles.map(file => [file,
      createHash("sha256").update(fs.readFileSync(file)).digest("hex")])),
    productionDirty: Boolean(execFileSync("git", ["diff", "HEAD", "--", ...testedFiles], { encoding: "utf8" }).trim()),
    beforeHandCount: before.selfState.hand.length, afterHandCount: after.selfState.hand.length,
    actualDrawCount, pass: actualDrawCount === 2,
    scope: "真实规则输入的单次蓝7放置，非AI搜索或全盘实验；断言失败显式退出。" };
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(actualDrawCount, 2, "蓝7面板fossil_04必须发放两张普通盲抽牌");
} finally { env.dispose(); }
