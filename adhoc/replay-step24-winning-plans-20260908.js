// 正式规则重放新获胜计划，逐步核对得分与资源；不调用搜索。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/step24-winning-plan-execution-20260908-v2.json';
if (fs.existsSync(output)) { console.log('已有正式重放：' + output); process.exit(0); }
const capture = JSON.parse(fs.readFileSync('reports/iteration/step24-winning-plans-income-fixed-20260908.json'));
const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-trigger-scan-mapping-20260907-aaaed8d0-full-v339.json'));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const report = { scope: '反事实单席位正式输入重放，无对手预测，不运行AI',
  correction: 'v1的完整存档比较误将savedAt生成时间当成状态；仅排除该时间字段，其余字段仍全部比较，旧证据保留。', variants: [] };
for (const choice of capture.captures[0].ranked.filter(x => ['launch', 'place_data'].includes(x.action.family))) {
  const env = require('../randomizer/app/simulation-env').createSimulationEnv(); let fork;
  const variant = { family: choice.action.family, expected: choice.evaluation.leafValue, steps: [] };
  report.variants.push(variant);
  try {
    env.reset(config);
    for (const s of save.replaySteps.slice(0, 23)) {
      const a = env.legalActions().find(a => a.actionId === s.action.actionId);
      assert.deepEqual(a, s.action); assert.equal(env.step(a).ok, true);
    }
    const before = env.saveBrowserSave(); fork = env.createCounterfactualFork().composition;
    let pending = false;
    for (const s of choice.leaf.planSteps) {
      const inspection = fork.inspect(), d = inspection.session?.decision;
      const legal = inspection.phase === 'awaiting_input' ? d.choices : fork.inputPort.enumerateActions();
      const a = legal.find(a => a.actionId === s.action.actionId);
      assert.ok(a, `正式动作缺失：${s.action.summary}`);
      const result = a.phase === 'conditional'
        ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a })
        : fork.inputPort.submitAction(a);
      assert.equal(result.ok, true, JSON.stringify(result));
      if (a.family === 'end_turn') pending = true;
      if (pending) {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn('player-white');
        if (advanced.ok) pending = false;
        else assert.equal(advanced.code, 'COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING');
      }
      const state = JSON.parse(fork.lifecycle.save().envelope.committedState);
      const projection = fork.projection({ playerId: 'player-white', role: 'player' }).state;
      variant.steps.push({ action: a, result, player: state.players.players.find(p => p.id === 'player-white'), projection });
    }
    const { savedAt: beforeSavedAt, ...beforeState } = before;
    const { savedAt: afterSavedAt, ...afterState } = env.saveBrowserSave();
    assert.deepEqual(afterState, beforeState, '独立fork不得改变真实根状态');
    variant.rootUnchanged = true;
    variant.final = variant.steps.at(-1).player;
    assert.equal(variant.final.resources.score, variant.expected.realizedScore);
    variant.passed = true;
  } catch (error) { variant.error = error.stack; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); }
}
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report.variants.map(v => ({ family: v.family, passed: v.passed, score: v.final?.resources.score, error: v.error }))));
