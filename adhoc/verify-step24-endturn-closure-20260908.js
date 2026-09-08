// 从当前追踪的第一组重复入口正式重放，检查结束回合到底改变哪些状态字段。
const fs = require('node:fs'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const output = 'reports/iteration/step24-endturn-closure-v2-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const trace = JSON.parse(zlib.gunzipSync(fs.readFileSync('reports/iteration/step24-entry-states-1501ebfd-20260908.json.gz')));
const pair = JSON.parse(fs.readFileSync('reports/iteration/step24-quick-duplicates-1501ebfd-20260908.json')).pairs[0];
const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-grant-data-route-20260908-1501ebfd-full-v316.json'));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require('../randomizer/app/simulation-env').createSimulationEnv();
let c; const report = { sourcePair: [pair.beforeOrdinal, pair.afterOrdinal], actions: [] };
const legal = () => { const s = c.inspect(); return s.phase === 'awaiting_input' ? s.session.decision.choices : c.inputPort.enumerateActions(); };
function submit(a) {
  assert.ok(a, '正式动作必须可用'); const d = c.inspect().session?.decision;
  const r = a.phase === 'conditional'
    ? c.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a })
    : c.inputPort.submitAction(a);
  assert.equal(r.ok, true, JSON.stringify(r));
  if (a.family === 'end_turn') assert.equal(c.counterfactualPort.advanceFocalPlanningTurn('player-white').ok, true);
  report.actions.push(a);
}
function differences(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => differences(a[k], b[k], path + '/' + k));
  return [{ path, before: a, after: b }];
}
try {
  env.reset(config); for (const s of save.replaySteps.slice(0, 23)) assert.equal(env.step(s.action).ok, true);
  c = env.createCounterfactualFork().composition;
  const prefix = pair.beforePrefix.slice(0, -1);
  for (let i = 0; i < prefix.length; i++) {
    const row = trace.rows.find(r => r.node.action.actionId === prefix[i]
      && r.node.origins.some(o => JSON.stringify(o.chain) === JSON.stringify(prefix.slice(0, i))));
    assert.ok(row, '追踪中须有当前链节点 ' + prefix[i]);
    // 搜索节点中的自动支付也必须通过正式输入重放；节点链不是完整输入日志。
    for (const expected of row.execution.inputs) {
      const a = legal().find(a => a.family === expected.family && JSON.stringify(a.target || {}) === JSON.stringify(expected.target || {}));
      assert.ok(a, '正式输入缺失：' + JSON.stringify(expected));
      submit(a);
    }
  }
  report.beforeActions = legal();
  const before = JSON.parse(c.lifecycle.save().envelope.committedState);
  submit(legal().find(a => a.family === 'end_turn'));
  const after = JSON.parse(c.lifecycle.save().envelope.committedState);
  report.afterActions = legal(); report.stateDifferences = differences(before, after);
  report.beforePlayer = before.players.players.find(p => p.id === 'player-white');
  report.afterPlayer = after.players.players.find(p => p.id === 'player-white');
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  c?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, differences: report.stateDifferences }));
}
