"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/fangzhou-undo.js");
const { createSimulationRuleComposition } = req("../randomizer/training/simulation-rule-composition");
const { createSeededRandom, RNG_ALGORITHM } = req("../randomizer/game/random");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "fangzhou-undo-4d3711c5-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const envelope = structuredClone(JSON.parse(fs.readFileSync(base + "fangzhou-play-missing-reward-v2-20260908.json")).fixture);
const root = JSON.parse(envelope.committedState);
// 高级奖励0：两电后等待黄痕迹选位，保留活动事务以检查正式撤销边界。
root.aliens.fangzhou.card1Deck = [0, 1, 2, 3, 4, 5, 6, 7, 8];
envelope.committedState = JSON.stringify(root);
const random = createSeededRandom(root.meta.seed);
const report = { passed: false, scope: "派生正式规则fixture；验证翻牌后撤销边界，不运行AI", undo: [] };
let composition;
try {
  composition = createSimulationRuleComposition({ seed: root.meta.seed, activePlayerCount: 4, random,
    rngState: { algorithm: RNG_ALGORITHM, state: random.getState() } }).composition;
  assert.equal(composition.lifecycle.restore(envelope, { silent: true }).ok, true);
  const action = composition.inputPort.enumerateActions().find(a => a.family === "play_card"
    && a.target?.cardInstanceId === "fixture-fangzhou-pink1");
  assert.ok(action);
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  report.afterPlay = composition.lifecycle.save().envelope;
  let blocked = false;
  for (let i = 0; i < 20; i += 1) {
    const session = composition.inspect().session;
    assert.ok(session, "黄痕迹选择应保留活动事务");
    assert.equal(session.irreversibleBarrier.code, "fangzhou_reward_reveal");
    const before = composition.lifecycle.save().envelope;
    const result = composition.inputPort.undo({ sessionId: session.sessionId, revision: session.revision });
    report.undo.push({ ok: result.ok, code: result.code, controls: session.controls });
    if (!result.ok) {
      assert.equal(result.code, "EFFECT_UNDO_IRREVERSIBLE_BARRIER");
      assert.deepEqual(composition.lifecycle.save().envelope, before, "被拒绝的撤销不得改变状态/RNG/牌堆");
      blocked = true;
      break;
    }
  }
  assert.equal(blocked, true, "撤销必须在翻牌屏障停止");
  report.atBarrier = composition.lifecycle.save().envelope;
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  composition?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, error: report.error, undo: report.undo, output }, null, 2));
}
