// 在两份真实根盘面重放同一条旧橙2路线，不搜索、不预测对手、不改资源。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/brown-orange2-route-execution-20260909.json';
if (fs.existsSync(output)) { console.log('已有路线重放：' + output); process.exit(0); }
const config = require('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json').root.config;
const old = require('../reports/iteration/route-leaf-brown107-leaf-20260909.json');
const c = old.captures[0], plan = c.ranked.find(x => x.action.actionId === c.chosen.actionId).leaf.planSteps;
const report = { scope: '旧橙2路线在旧107与新105真实盘面的正式单席位重放；盲抽牌只按身份支付，不读取效果', variants: [] };
for (const step of [107, 105]) {
  const capture = require(`../reports/iteration/route-leaf-brown${step}-leaf-20260909.json`);
  const env = require('/private/tmp/seti-route-leaf-eligibility-20260909/randomizer/app/simulation-env').createSimulationEnv();
  let fork;
  const v = { step, steps: [] }; report.variants.push(v);
  try {
    env.reset(config);
    for (const s of capture.initialState.replaySteps) {
      const a = env.legalActions().find(a => a.actionId === s.action.actionId);
      assert.deepEqual(a, s.action); assert.equal(env.step(a).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, s.after);
    }
    const before = env.saveBrowserSave(); fork = env.createCounterfactualFork().composition;
    const state = () => JSON.parse(fork.lifecycle.save().envelope.committedState);
    const player = () => state().players.players.find(p => p.id === 'player-brown');
    v.initial = player(); let pending = false;
    for (const [index, entry] of plan.entries()) {
      const inspection = fork.inspect(), d = inspection.session?.decision;
      const legal = inspection.phase === 'awaiting_input' ? d.choices : fork.inputPort.enumerateActions();
      let matches = legal.filter(a => a.actionId === entry.action.actionId);
      // 两盘面的盲抽实例序号可不同；原路线支付手中全部两张牌，不根据新牌牌面挑选。
      if (entry.action.target?.cardInstanceId === 'card-42-0') {
        matches = legal.filter(a => a.family === 'choose_payment' && a.target?.kind === 'discard-hand-card'
          && a.target.select === true && a.target.cardInstanceId !== 'card-12-0');
      }
      if (!matches.length) {
        v.unavailable = { index, expected: entry.action, player: player(), legal };
        break;
      }
      assert.equal(matches.length, 1); const a = matches[0], prior = player();
      const result = a.phase === 'conditional'
        ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a })
        : fork.inputPort.submitAction(a);
      assert.equal(result.ok, true, JSON.stringify(result));
      if (a.family === 'end_turn') pending = true;
      if (pending) {
        const advance = fork.counterfactualPort.advanceFocalPlanningTurn('player-brown');
        if (advance.ok) pending = false;
        else assert.equal(advance.code, 'COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING');
      }
      v.steps.push({ index, action: a, before: prior.resources, after: player().resources });
    }
    const { savedAt: ignoredBefore, ...b } = before;
    const { savedAt: ignoredAfter, ...a } = env.saveBrowserSave();
    assert.deepEqual(a, b); v.rootUnchanged = true;
    v.completed = v.steps.length === plan.length;
    if (step === 107) { assert.equal(v.completed, true); assert.equal(player().resources.score, 29); }
    v.passed = true;
  } catch (error) { v.error = error.stack; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); }
}
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report.variants.map(v => ({ step: v.step, passed: v.passed, completed: v.completed,
  unavailable: v.unavailable?.expected.summary, resources: v.unavailable?.player.resources, error: v.error }))));
