// 第24步独立诊断：真实输入重放后搜索一次，记录未知牌面动作与屏障传播。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const inspector = require('node:inspector'), cp = require('node:child_process');
const base = path.resolve(__dirname, '..');
const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: base, encoding: 'utf8' }).trim();
const output = path.join(base, 'reports/iteration/income-boundary-step24-' + head.slice(0, 8) + '-20260908.json');
if (fs.existsSync(output)) { console.log('已有单点证据，跳过：' + output); process.exit(0); }
const save = JSON.parse(fs.readFileSync(path.join(base, 'seti-saves/seti-save-research-trigger-scan-mapping-20260907-aaaed8d0-full-v339.json')));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const report = { head, step: 24, scope: '当前提交真实单点，含断点开销，不作为纯性能成绩', rows: [], errors: [], violations: [] };
const env = require('../randomizer/app/simulation-env').createSimulationEnv();
const debug = new inspector.Session(); debug.connect();
function post(method, params = {}) {
  let done = false, error, result;
  debug.post(method, params, (e, r) => { done = true; error = e; result = r; });
  assert.ok(done); if (error) throw error; return result;
}
let known;
debug.on('Debugger.paused', ({ params }) => {
  try {
    const result = post('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId,
      expression: 'JSON.stringify({ordinal:executedNodeCount,strategic:Boolean(secondaryAgentSearch),action:node.action,origins:node.origins.map(o=>({target:o.routeTargetId,masked:o.informationMasked})),inputs:execution.planSteps?.map(s=>s.action),failed:execution.failed})', returnByValue: true });
    assert.equal(result.exceptionDetails, undefined);
    const row = JSON.parse(result.result.value); report.rows.push(row);
    for (const a of row.inputs || []) {
      const ids = ['card_corner', 'play_card'].includes(a.family) ? [a.target?.cardInstanceId]
        : a.family === 'choose_payment' && a.target?.kind === 'move-payment' ? a.target.cardIds || [] : [];
      if (ids.some(id => id && !known.has(id))) report.violations.push({ ordinal: row.ordinal, action: a });
    }
    if (report.rows.length % 512 === 0) console.log('[收入边界单点] 第24步 · 白方 · 已执行 ' + report.rows.length + ' 节点 · 未知牌面动作 ' + report.violations.length);
  } catch (error) { report.errors.push(error.stack); }
  finally { post('Debugger.resume'); }
});
const started = performance.now();
try {
  env.reset({ ...config, traceCounterfactualGoalClusters: true });
  for (const step of save.replaySteps.slice(0, 23)) {
    const a = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(a, step.action); assert.equal(env.step(a).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  const observation = env.observe('player-white');
  known = new Set([...observation.selfState.hand, ...observation.publicState.board.publicCards].filter(Boolean).map(c => c.id));
  report.knownCardIds = [...known];
  const lines = fs.readFileSync(require.resolve('../randomizer/game/rule-composition'), 'utf8').split('\n');
  const hits = lines.flatMap((line, i) => line.includes('const execution = executeNode(node);') ? [i + 1] : []);
  assert.equal(hits.length, 1);
  post('Debugger.enable'); post('Debugger.setBreakpointByUrl', { urlRegex: 'rule-composition\\.js$', lineNumber: hits[0] });
  const result = env.runHeuristicPolicyDecision();
  report.diagnostics = env.getCounterfactualDiagnostics(); report.selected = result.policyDecision;
  assert.equal(result.ok, true); assert.deepEqual(report.errors, []); assert.deepEqual(report.violations, []);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  post('Debugger.disable'); debug.disconnect(); env.dispose();
  report.wallMs = performance.now() - started;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, nodes: report.rows.length, violations: report.violations.length, error: report.error, wallMs: report.wallMs }));
}
