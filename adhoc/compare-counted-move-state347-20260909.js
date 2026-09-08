// 正式重放两条已记录前缀，不调用AI。比较完整committed state而非分数摘要。
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { isDeepStrictEqual: equal } = require('node:util');
const output = 'reports/iteration/counted-card-move-state347-20260909.json';
if (fs.existsSync(output)) { console.log('已有检查点：' + output); process.exit(0); }
const config = require('../reports/iteration/counted-card-move-step24-4bc44eb2-20260909.json').config;
const entries = [{ name: 'baseline', source: '/Users/bilibili/code/seti-simu', record: 'c43c1f88.70043d34.full.json' },
  { name: 'candidate', source: '/private/tmp/seti-counted-card-move-20260909', record: 'f14a863e.4bc44eb2.full.json' }];
const states = {}, evidence = {};
for (const entry of entries) {
  const record = JSON.parse(fs.readFileSync('reports/research/' + entry.record));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const env = require(entry.source + '/randomizer/app/simulation-env').createSimulationEnv();
  try {
    env.reset(config);
    for (const step of save.replaySteps.slice(0, 347)) {
      const action = env.legalActions().find(a => a.actionId === step.action.actionId);
      assert.deepEqual(action, step.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
    }
    const checkpoint = env.createCheckpoint();
    assert.equal(checkpoint.coreState.compositionEnvelope.session, null, '第347步应结束正式事务');
    states[entry.name] = JSON.parse(checkpoint.coreState.committedState);
    evidence[entry.name] = { record: entry.record, actionsVerified: 347,
      stateHash: crypto.createHash('sha256').update(checkpoint.coreState.committedState).digest('hex') };
  } finally { env.dispose(); }
}
const differences = [];
function diff(a, b, path) {
  if (equal(a, b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], path + '.' + key);
  } else differences.push({ path, baseline: a, candidate: b });
}
diff(states.baseline, states.candidate, '$');
const report = { evidence, exactStateEqual: equal(states.baseline, states.candidate), differences,
  equalDomains: Object.keys(states.baseline).filter(key => equal(states.baseline[key], states.candidate[key])),
  scope: '第347步正式状态及全部前缀输入验证；不证明规划排序原因或未来所有状态等价', passed: true };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
