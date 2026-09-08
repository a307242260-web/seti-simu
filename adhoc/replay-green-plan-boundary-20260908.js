// 对照旧获胜计划在两份真实输入盘面中的第一处正式可执行性差异。不搜索、不替换缺失动作。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/green-plan-boundary-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const root = 'reports/iteration/identity-green-cross-';
const old = JSON.parse(fs.readFileSync(root + 'baseline-candidate-20260908.json'));
const c = old.captures[0], plan = c.ranked.find(x => x.action.actionId === c.chosen.actionId).leaf.planSteps;
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const report = { scope: '正式输入重放至首个缺失动作；未按搜索逐节点重设RNG，不能据随机后继差异认定搜索规则bug', variants: [] };
function state(c) { return JSON.parse(c.lifecycle.save().envelope.committedState); }
for (const board of ['baseline', 'candidate']) {
  const input = JSON.parse(fs.readFileSync(root + board + '-candidate-20260908.json'));
  const env = require('../randomizer/app/simulation-env').createSimulationEnv(); let fork;
  const variant = { board, steps: [] }; report.variants.push(variant);
  try {
    env.reset(config);
    for (const s of input.initialState.replaySteps) {
      const a = env.legalActions().find(a => a.actionId === s.action.actionId);
      assert.deepEqual(a, s.action); assert.equal(env.step(a).ok, true);
    }
    assert.equal(env.saveBrowserSave().committedState, input.initialState.committedState);
    fork = env.createCounterfactualFork().composition;
    variant.initial = state(fork);
    let pendingTurn = false;
    for (const [i, step] of plan.entries()) {
      const view = fork.inspect(), d = view.session?.decision;
      const legal = view.phase === 'awaiting_input' ? d.choices : fork.inputPort.enumerateActions();
      const a = legal.find(a => a.actionId === step.action.actionId);
      if (!a) { variant.boundary = { index: i, expected: step.action, legal, inspection: view, state: state(fork) }; break; }
      const result = a.phase === 'conditional'
        ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a })
        : fork.inputPort.submitAction(a);
      assert.equal(result.ok, true, JSON.stringify(result));
      if (a.family === 'end_turn') pendingTurn = true;
      if (pendingTurn) {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn('player-green');
        if (advanced.ok) pendingTurn = false;
        else assert.equal(advanced.code, 'COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING');
      }
      variant.steps.push({ index: i, action: a, state: state(fork), inspection: fork.inspect() });
    }
    assert.equal(env.saveBrowserSave().committedState, input.initialState.committedState);
    variant.rootUnchanged = true; variant.passed = true;
  } catch (error) { variant.error = error.stack; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); }
}
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report.variants.map(v => ({ board: v.board, passed: v.passed, error: v.error,
  executed: v.steps.length, boundary: v.boundary && { index: v.boundary.index, expected: v.boundary.expected.summary,
    legal: v.boundary.legal.map(a => a.summary) } }))));
