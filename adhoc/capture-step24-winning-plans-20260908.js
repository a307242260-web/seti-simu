// 补采既有追踪缺失的根动作估值和获胜计划；只跑第24步，不重跑完整局。
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), inspector = require('node:inspector');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2]; assert.ok(['baseline', 'income-fixed'].includes(mode));
const source = mode === 'baseline' ? '/private/tmp/seti-white-income-baseline-20260907' : root;
const output = path.join(root, `reports/iteration/step24-winning-plans-${mode}-20260908.json`);
if (fs.existsSync(output)) { console.log('已有获胜计划证据，跳过：' + output); process.exit(0); }
const req = require('node:module').createRequire(path.join(source, 'adhoc/diagnostic.js'));
const commit = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const save = JSON.parse(fs.readFileSync(path.join(root, 'seti-saves/seti-save-research-trigger-scan-mapping-20260907-aaaed8d0-full-v339.json')));
const report = { mode, commit, scope: '新增根动作估值与获胜叶证据，不修改生产，不运行整局', captures: [], errors: [] };
const env = req('../randomizer/app/simulation-env').createSimulationEnv();
const debug = new inspector.Session(); debug.connect();
function post(method, params = {}) {
  let done = false, error, result;
  debug.post(method, params, (e, r) => { done = true; error = e; result = r; });
  assert.ok(done); if (error) throw error; return result;
}
debug.on('Debugger.paused', ({ params }) => {
  try {
    const r = post('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId,
      expression: `JSON.stringify({chosen:action,snapshot,ranked:legalActions.map(a=>{const e=expectedScoreEvaluator.evaluateOutcome({seatId,observation,actionOutcomes},a,{});const o=actionOutcomes.find(o=>o.actionId===a.actionId);const l=o?.leaves?.find(l=>l.leafId===e.selectedLeafId);return {action:a,evaluation:e,completeness:o?.searchCompleteness,leaf:l};})})`, returnByValue: true });
    assert.equal(r.exceptionDetails, undefined); report.captures.push(JSON.parse(r.result.value));
  } catch (error) { report.errors.push(error.stack); }
  finally { post('Debugger.resume'); }
});
const started = performance.now();
try {
  env.reset(config);
  for (const step of save.replaySteps.slice(0, 23)) {
    const a = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(a, step.action); assert.equal(env.step(a).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  const lines = fs.readFileSync(path.join(source, 'randomizer/game/ai/heuristic-decision-function.js'), 'utf8').split('\n');
  const hits = lines.flatMap((l, i) => l.includes('const plan = planContinuation.buildPlanFromSnapshot(snapshot);') ? [i] : []);
  assert.equal(hits.length, 1);
  post('Debugger.enable'); post('Debugger.setBreakpointByUrl', { urlRegex: 'heuristic-decision-function\\.js$', lineNumber: hits[0] });
  console.log(`[第24步获胜计划] ${mode} · 白方 · 开始一次4096节点诊断`);
  assert.equal(env.runHeuristicPolicyDecision().ok, true);
  report.diagnostics = env.getCounterfactualDiagnostics();
  assert.deepEqual(report.errors, []); assert.equal(report.captures.length, 1); report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  post('Debugger.disable'); debug.disconnect(); env.dispose(); report.wallMs = performance.now() - started;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, wallMs: report.wallMs,
    actions: report.captures[0]?.ranked.map(x => ({ family: x.action.family, score: x.evaluation.score, leaf: x.evaluation.selectedLeafId })) }));
}
