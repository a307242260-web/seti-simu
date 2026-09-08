// 同一正式状态比较填数跨回合顺序，不执行 AI，不预测其他玩家。
const fs = require('node:fs'), assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const sourceRoot = '/private/tmp/seti-grant-data-route-20260908';
const req = createRequire(sourceRoot + '/adhoc/diagnostic.js');
const output = 'reports/iteration/grant-quick-order-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const evidence = JSON.parse(fs.readFileSync(sourceRoot + '/reports/iteration/grant-data-route-fixed-20260908.json'));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-trigger-scan-mapping-20260907-aaaed8d0-full-v339.json'));
const env = req('../randomizer/app/simulation-env').createSimulationEnv();
const forks = [];
const report = { sourceCommit: 'b30cc80f', scope: '正式输入顺序对照；全状态差异如实列出，不将资源相同视作全状态等价' };
function legal(c) { const s = c.inspect(); return s.phase === 'awaiting_input' ? s.session.decision.choices : c.inputPort.enumerateActions(); }
function submit(c, a) {
  assert.ok(a, '动作必须正式可用');
  const d = c.inspect().session?.decision;
  const result = a.phase === 'conditional'
    ? c.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a })
    : c.inputPort.submitAction(a);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (a.family === 'end_turn') assert.equal(c.counterfactualPort.advanceFocalPlanningTurn('player-white').ok, true);
}
function differences(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => differences(a[k], b[k], path + '/' + k));
  }
  return [{ path, beforeOrder: a, afterOrder: b }];
}
try {
  env.reset(config);
  for (const step of save.replaySteps.slice(0, 23)) assert.equal(env.step(step.action).ok, true);
  const c = env.createCounterfactualFork().composition; forks.push(c);
  let grantPlayed = false, stopped = false;
  for (const step of evidence.steps) {
    const a = legal(c).find(a => a.family === step.action.family && JSON.stringify(a.target || {}) === JSON.stringify(step.action.target || {}));
    submit(c, a);
    if (a.family === 'play_card' && a.target.cardInstanceId === 'card-18-0') grantPlayed = true;
    if (grantPlayed && a.family === 'choose_card' && a.target.cardInstanceId === 'card-19-0') { stopped = true; break; }
  }
  assert.ok(stopped);
  const envelope = c.lifecycle.save().envelope;
  const finalStates = [];
  for (const order of ['fill-before-end', 'fill-after-end']) {
    const branch = env.createCounterfactualFork(envelope).composition; forks.push(branch);
    const log = [];
    const run = predicate => { const a = legal(branch).find(predicate); submit(branch, a); log.push(a); };
    if (order === 'fill-after-end') run(a => a.family === 'end_turn');
    run(a => a.family === 'place_data');
    run(a => a.target?.choiceId === 'data:computer');
    if (order === 'fill-before-end') run(a => a.family === 'end_turn');
    assert.ok(legal(branch).some(a => a.family === 'analyze'));
    finalStates.push(JSON.parse(branch.lifecycle.save().envelope.committedState));
    report[order] = { actions: log, analysisAvailable: true };
  }
  report.stateDifferences = differences(...finalStates);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  for (const c of forks) c.dispose(); env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, differences: report.stateDifferences }));
}
