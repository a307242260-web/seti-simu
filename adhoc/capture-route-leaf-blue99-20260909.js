// 只重放新候选前98个正式输入并冷搜索第99步；不运行完整局。
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), inspector = require('node:inspector');
const root = path.resolve(__dirname, '..');
const policy = 'suffix';
assert.ok(['baseline', 'combined', 'suffix'].includes(policy));
const source = policy === 'baseline' ? root : policy === 'suffix'
  ? '/private/tmp/seti-route-leaf-eligibility-20260909' : '/private/tmp/seti-alien-pick-disabled-tech-20260908';
const output = path.join(root, `reports/iteration/route-leaf-blue99-20260909.json`);
if (fs.existsSync(output)) { console.log('已有蓝方重搜证据：' + output); process.exit(0); }
const record = JSON.parse(fs.readFileSync(path.join(root, 'reports/research/3c7e0003.af937808.full.json')));
const save = JSON.parse(fs.readFileSync(path.resolve(root, record.savePath)));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require(path.join(source, 'randomizer/app/simulation-env')).createSimulationEnv();
const report = { step: 99, policy, seat: 'player-blue', sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'],
  { cwd: source, encoding: 'utf8' }).trim(), sourceDirty: cp.execFileSync('git', ['status', '--porcelain'],
    { cwd: source, encoding: 'utf8' }), boardRecord: '3c7e0003.af937808.full.json', captures: [], errors: [] };
const debug = new inspector.Session(); debug.connect();
function post(method, params = {}) {
  let error, result, done = false;
  debug.post(method, params, (e, r) => { error = e; result = r; done = true; });
  assert.equal(done, true); if (error) throw error; return result;
}
debug.on('Debugger.paused', ({ params }) => {
  try {
    const r = post('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId,
      expression: 'JSON.stringify({chosen:action,snapshot,ranked:legalActions.map(a=>{const e=expectedScoreEvaluator.evaluateOutcome({seatId,observation,actionOutcomes},a,{});const o=actionOutcomes.find(o=>o.actionId===a.actionId);return {action:a,evaluation:e,completeness:o?.searchCompleteness,leaf:o?.leaves?.find(l=>l.leafId===e.selectedLeafId)};})})', returnByValue: true });
    assert.equal(r.exceptionDetails, undefined); report.captures.push(JSON.parse(r.result.value));
  } catch (error) { report.errors.push(error.stack); }
  finally { post('Debugger.resume'); }
});
try {
  env.reset(config);
  for (const step of save.replaySteps.slice(0, 98)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(action, step.action); assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  report.initialState = env.saveBrowserSave();
  const lines = fs.readFileSync(path.join(source, 'randomizer/game/ai/heuristic-decision-function.js'), 'utf8').split('\n');
  const hits = lines.flatMap((line, i) => line.includes('const plan = planContinuation.buildPlanFromSnapshot(snapshot);') ? [i] : []);
  assert.equal(hits.length, 1);
  post('Debugger.enable'); post('Debugger.setBreakpointByUrl', { urlRegex: 'heuristic-decision-function\\.js$', lineNumber: hits[0] });
  const start = performance.now(), result = env.runHeuristicPolicyDecision();
  report.searchMs = performance.now() - start;
  assert.equal(result.ok, true); report.diagnostics = env.getCounterfactualDiagnostics();
  assert.deepEqual(report.errors, []); assert.equal(report.captures.length, 1);
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  assert.notEqual(report.captures[0].chosen.family, "launch", "不得继续执行已知无法完成的准备路线");
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  post('Debugger.disable'); debug.disconnect(); env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, searchMs: report.searchMs,
    nodes: report.diagnostics?.executedNodeCount, chosen: report.captures[0]?.chosen.summary,
    ranked: report.captures[0]?.ranked.map(r => ({ action: r.action.summary, score: r.evaluation.score })) }));
}
