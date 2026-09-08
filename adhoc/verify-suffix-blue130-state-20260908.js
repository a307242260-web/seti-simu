// 正式重放至130前，核对耗尽状态及实际合法集；不运行AI。
const fs = require('node:fs'), assert = require('node:assert/strict');
const source = '/private/tmp/seti-route-suffix-facts-20260908';
const output = 'reports/iteration/suffix-blue130-state-20260908.json';
if (fs.existsSync(output)) { console.log('已有130边界：' + output); process.exit(0); }
const record = JSON.parse(fs.readFileSync('reports/research/3c7e0003.af937808.full.json'));
const steps = JSON.parse(fs.readFileSync(record.savePath)).replaySteps;
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require(source + '/randomizer/app/simulation-env').createSimulationEnv();
const report = { boardRecord: '3c7e0003.af937808.full.json', step: 130 };
try {
  env.reset(config);
  for (const step of steps.slice(0, 129)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(action, step.action); assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  report.legalActions = env.legalActions(); report.state = env.saveBrowserSave();
  assert.ok(report.legalActions.some(a => a.actionId === steps[129].action.actionId));
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error,
    legalActions: report.legalActions?.map(a => ({ family: a.family, summary: a.summary })) }));
}
