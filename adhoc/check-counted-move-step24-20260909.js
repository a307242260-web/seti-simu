// 固定盘面第24步单点门禁：重放既有前缀后仅调用一次当前候选AI。
const fs = require('node:fs'), cp = require('node:child_process'), assert = require('node:assert/strict');
const source = '/private/tmp/seti-counted-card-move-20260909';
const output = 'reports/iteration/counted-card-move-step24-4bc44eb2-20260909.json';
if (fs.existsSync(output)) { console.log('已有单点检查点：' + output); process.exit(0); }
const commit = cp.execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
assert.equal(commit, '4bc44eb2');
assert.equal(cp.execFileSync('git', ['status', '--porcelain'], { cwd: source, encoding: 'utf8' }), '');
const record = JSON.parse(fs.readFileSync('reports/research/c43c1f88.70043d34.full.json'));
const save = JSON.parse(fs.readFileSync(record.savePath));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require(source + '/randomizer/app/simulation-env').createSimulationEnv();
const report = { commit, step: 24, sourceRecord: 'c43c1f88.70043d34.full.json', config };
try {
  env.reset(config);
  for (const step of save.replaySteps.slice(0, 23)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(action, step.action); assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  console.log('[单点] 第24步 · 白方 · 4096执行/256队列上限保持不变');
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  report.result = { ok: result.ok, code: result.code, action: result.action };
  report.searchMs = performance.now() - start;
  assert.equal(report.result.ok, true);
  report.diagnostics = env.getCounterfactualDiagnostics();
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  assert.ok(report.searchMs < 30000, '单点必须低于30秒');
  report.after = env.saveBrowserSave().replaySteps.at(-1);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, searchMs: report.searchMs,
    nodes: report.diagnostics?.executedNodeCount, action: report.after?.action }));
}
