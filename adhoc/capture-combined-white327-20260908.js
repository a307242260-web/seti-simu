// 只重放组合版前326个正式输入，再分别冷搜索一次dev/组合策略；不运行完整局。
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), inspector = require('node:inspector');
const root = path.resolve(__dirname, '..');
const policy = process.argv[2];
assert.ok(['baseline', 'combined'].includes(policy));
const source = policy === 'baseline' ? root : '/private/tmp/seti-alien-pick-disabled-tech-20260908';
const output = path.join(root, `reports/iteration/combined-white327-${policy}-20260908.json`);
if (fs.existsSync(output)) { console.log('已有白方交叉证据：' + output); process.exit(0); }
const record = JSON.parse(fs.readFileSync(path.join(root, 'reports/research/80437cef.5d17835f.full.json')));
const save = JSON.parse(fs.readFileSync(path.resolve(root, record.savePath)));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require(path.join(source, 'randomizer/app/simulation-env')).createSimulationEnv();
const report = { step: 327, policy, seat: 'player-white', sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'],
  { cwd: source, encoding: 'utf8' }).trim(), boardRecord: '80437cef.5d17835f.full.json', captures: [], errors: [] };
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
  for (const step of save.replaySteps.slice(0, 326)) {
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
  if (policy === 'combined') assert.equal(report.captures[0].chosen.actionId, save.replaySteps[326].action.actionId);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  post('Debugger.disable'); debug.disconnect(); env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, searchMs: report.searchMs,
    nodes: report.diagnostics?.executedNodeCount, chosen: report.captures[0]?.chosen.summary,
    ranked: report.captures[0]?.ranked.map(r => ({ action: r.action.summary, score: r.evaluation.score })) }));
}
