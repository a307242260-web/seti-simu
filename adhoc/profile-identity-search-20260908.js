// 对已有绿方旧盘面执行一次CPU采样；不重新运行完整局，不覆盖交叉验收记录。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const inspector = require('node:inspector'), cp = require('node:child_process');
const policy = process.argv[2]; assert.ok(['candidate', 'identity'].includes(policy));
const output = `reports/iteration/identity-cpu-${policy}-20260908.json`;
if (fs.existsSync(output)) { console.log('已有CPU采样：' + output); process.exit(0); }
const source = policy === 'candidate' ? '/private/tmp/seti-quick-turn-order-20260908' : '/private/tmp/seti-counterfactual-identity-20260908';
const req = require('node:module').createRequire(path.join(source, 'adhoc/diagnostic.js'));
const env = req('../randomizer/app/simulation-env').createSimulationEnv();
const input = JSON.parse(fs.readFileSync(`reports/iteration/identity-green-cross-baseline-${policy}-20260908.json`));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const debug = new inspector.Session(); debug.connect();
function post(method) { let result, error, done = false; debug.post(method, (e, r) => { error = e; result = r; done = true; });
  assert.ok(done); if (error) throw error; return result; }
const report = { policy, source, commit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  scope: '绿方旧盘面第101步，CPU采样含决策评估但不含根重放；采样是开销定位，不作为性能验收成绩' };
let profiling = false;
try {
  env.reset(config);
  for (const s of input.initialState.replaySteps) {
    const a = env.legalActions().find(a => a.actionId === s.action.actionId);
    assert.deepEqual(a, s.action); assert.equal(env.step(a).ok, true);
  }
  assert.equal(env.saveBrowserSave().committedState, input.initialState.committedState);
  post('Profiler.enable'); post('Profiler.start'); profiling = true;
  console.log(`[CPU采样] 绿方 第1轮 第14回合 · 第101步 · ${policy} · 4096上限`);
  const result = env.runHeuristicPolicyDecision();
  report.profile = post('Profiler.stop').profile; profiling = false;
  assert.equal(result.ok, true);
  const action = env.saveBrowserSave().replaySteps.at(-1).action;
  assert.equal(action.actionId, input.captures[0].chosen.actionId);
  report.action = action; report.diagnostics = env.getCounterfactualDiagnostics();
  assert.equal(report.diagnostics.executedNodeCount, input.diagnostics.executedNodeCount);
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  const nodes = new Map(report.profile.nodes.map(n => [n.id, n])), costs = new Map();
  for (let i = 0; i < report.profile.samples.length; i++) {
    const f = nodes.get(report.profile.samples[i]).callFrame;
    const key = `${f.url}:${f.lineNumber + 1} ${f.functionName}`;
    costs.set(key, (costs.get(key) || 0) + report.profile.timeDeltas[i]);
  }
  report.selfCpuMicroseconds = [...costs].sort((a, b) => b[1] - a[1]); report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  if (profiling) report.profile = post('Profiler.stop').profile;
  debug.disconnect(); env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, hotspots: report.selfCpuMicroseconds?.slice(0, 12) }));
}
