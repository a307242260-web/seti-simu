"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/reorganization-fixed-real-20260907.json";
const sourceDir = "/private/tmp/seti-resource-cache-fix-20260907";
if (fs.existsSync(output)) console.log("已有重组修复真实盘面验证，不重跑");
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/white-gap-roots-20260907.json")).rows[0];
  const record = JSON.parse(fs.readFileSync(`${sourceDir}/reports/research/${source.recordId}.full.json`));
  const save = JSON.parse(fs.readFileSync(path.resolve(sourceDir, record.savePath)));
  const env = createSimulationEnv();
  const state = () => JSON.parse(env.createCheckpoint().coreState.committedState);
  const player = () => state().players.players.find(p => p.id === "player-white");
  try {
    env.loadCheckpoint(source.checkpoint);
    for (let index = source.step - 1; index < 284; index++) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    const beforeCheckpoint = env.createCheckpoint();
    delete beforeCheckpoint.replaySteps;
    const before = player();
    const chosen = [];
    const act = (family, id) => {
      const action = env.legalActions().find(a => a.family === family && a.target.cardInstanceId === id);
      assert.ok(action, `${family}:${id}`);
      assert.equal(env.step(action).ok, true);
      chosen.push(action);
    };
    act("play_card", "card-50-0");
    act("choose_card", "card-59-0");
    const pending = env.createCheckpoint();
    delete pending.replaySteps;
    const finish = () => {
      act("choose_card", "card-58-0");
      act("choose_card", "card-26-pass-2-2");
    };
    finish();
    const after = player();
    assert.deepEqual(after.income, before.income);
    assert.equal(after.resources.energy, before.resources.energy + 2);
    assert.equal(after.hand.length, 1);
    assert.equal(after.hand[0].cardId, "dlc_10.png");
    assert.equal(env.legalActions().some(a => a.family === "choose_card" && a.target.cardInstanceId === after.hand[0].id), false,
      "奖励抽到的DLC10不再进入重组弃牌选择");
    const afterCheckpoint = env.createCheckpoint();
    env.loadCheckpoint(pending);
    finish();
    assert.deepEqual(env.createCheckpoint().coreState, afterCheckpoint.coreState);
    const result = { scope: "真实基线285打牌前态；正式输入复现并核对修复、pending恢复，不运行AI",
      beforeCheckpoint, before, after, chosen: chosen.slice(0, 4), passed: true,
      correction: "原四次弃牌中第四张DLC10是即时奖励新抽牌；合法先弃后奖只弃原手牌三张，获得2电和1张牌，永久收入不变" };
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ passed: true, income: after.income, energy: after.resources.energy,
      hand: after.hand.map(c => c.cardId), inputs: 4 }));
  } finally { env.dispose(); }
}
