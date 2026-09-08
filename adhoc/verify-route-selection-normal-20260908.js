// 新错误传播机制的真实单点正常路径验证；不重跑完整局。
const fs = require('node:fs'), assert = require('node:assert/strict'), cp = require('node:child_process');
const output = 'reports/iteration/route-selection-normal-20260908.json';
if (fs.existsSync(output)) { console.log('已有单点：' + output); process.exit(0); }
const base = '/Users/bilibili/code/seti-simu/';
const save = JSON.parse(fs.readFileSync(base + 'seti-saves/seti-save-research-grant-data-route-20260908-1501ebfd-full-v316.json'));
const record = JSON.parse(fs.readFileSync(base + 'reports/research/1a061690.1501ebfd.full.json'));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require('../randomizer/app/simulation-env').createSimulationEnv();
const report = { commit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  baseline: '1a061690.1501ebfd.full.json', step: 24 };
try {
  env.reset(config);
  for (const s of save.replaySteps.slice(0, 23)) {
    const a = env.legalActions().find(a => a.actionId === s.action.actionId);
    assert.deepEqual(a, s.action); assert.equal(env.step(a).ok, true);
  }
  console.log('[单点验证] 第1轮 第1回合 · 决策#24 · 白方 · 4096节点上限');
  const start = performance.now(); assert.equal(env.runHeuristicPolicyDecision().ok, true);
  report.wallMs = performance.now() - start;
  assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1), save.replaySteps[23]);
  report.diagnostics = env.getCounterfactualDiagnostics();
  const old = record.metrics.searches.find(s => s.step === 24 && s.kind === 'strategic').diagnostics;
  for (const field of ['executedNodeCount', 'successfulInputSubmissionCount', 'failedNodeCountByCode',
    'executedNodeCountByFamily', 'executedNodeCountByDecisionKind', 'executionLimitReached']) {
    assert.deepEqual(report.diagnostics[field], old[field], field);
  }
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {}); report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs, error: report.error }));
}
