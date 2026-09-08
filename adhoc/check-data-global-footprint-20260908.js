// 正式重放已有动作，不调用搜索；补齐玩家对象之外的前置准备副作用检查。
const fs = require('node:fs'), assert = require('node:assert/strict'), { isDeepStrictEqual } = require('node:util');
const output = 'reports/iteration/data-global-footprint-20260908.json';
if (fs.existsSync(output)) { console.log('已有全局差异证据：' + output); process.exit(0); }
const prior = JSON.parse(fs.readFileSync('reports/iteration/known-data-preparation-v2-20260908.json'));
const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-grant-data-route-20260908-1501ebfd-full-v316.json'));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require('../randomizer/app/simulation-env').createSimulationEnv();
const report = { source: 'known-data-preparation-v2-20260908.json', snapshots: {}, inputCount: 0 };
function state() {
  const value = env.saveBrowserSave().committedState;
  return typeof value === 'string' ? JSON.parse(value) : value;
}
function diff(a, b, path = '') {
  if (isDeepStrictEqual(a, b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object'
    || Array.isArray(a) !== Array.isArray(b)) return [{ path, before: a, after: b }];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => diff(a[k], b[k], path + '/' + k));
}
try {
  env.reset(config);
  for (const step of save.replaySteps.slice(0, 23)) {
    assert.equal(env.step(step.action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  for (const step of prior.variants[0].steps) {
    if (step.action.family === 'scan') { report.snapshots.beforeScan = state(); break; }
    if (step.action.family === 'card_corner') report.snapshots.beforeCorner = state();
    const legal = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.ok(legal); assert.deepEqual(legal, step.action);
    assert.equal(env.step(legal).ok, true); report.inputCount++;
    assert.deepEqual(state().players.players.find(p => p.id === 'player-white'), step.player);
  }
  assert.ok(report.snapshots.beforeCorner); assert.ok(report.snapshots.beforeScan);
  report.differences = diff(report.snapshots.beforeCorner, report.snapshots.beforeScan);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally { env.dispose(); }
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: report.passed, error: report.error, differences: report.differences }));
