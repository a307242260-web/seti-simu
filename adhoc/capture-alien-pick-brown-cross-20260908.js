// 第186步两盘面×两搜索及独立修复：冷决策取证，不运行完整局。
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), inspector = require('node:inspector');
const root = path.resolve(__dirname, '..'), [board, policy] = process.argv.slice(2);
assert.ok(['baseline', 'candidate'].includes(board));
assert.ok(['baseline', 'candidate', 'fixed'].includes(policy));
const source = policy === 'baseline' ? root : policy === 'fixed'
  ? '/private/tmp/seti-disabled-tech-value-20260908' : '/private/tmp/seti-alien-card-pick-greedy-20260908';
const output = path.join(root, `reports/iteration/alien-pick-brown-cross-${board}-${policy}-20260908.json`);
if (fs.existsSync(output)) { console.log('已有交叉证据：' + output); process.exit(0); }
const file = board === 'baseline' ? 'c43c1f88.70043d34.full.json' : 'b6c44201.aa277dac.full.json';
const record = JSON.parse(fs.readFileSync(path.join(root, 'reports/research', file)));
const save = JSON.parse(fs.readFileSync(path.resolve(root, record.savePath)));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const env = require(path.join(source, 'randomizer/app/simulation-env')).createSimulationEnv();
const report = { board, policy, sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  sourceDirty: cp.execFileSync('git', ['status', '--porcelain'], { cwd: source, encoding: 'utf8' }),
  boardRecord: file, step: 186, seat: 'player-brown', captures: [], errors: [],
  boundary: '同盘面冷决策交叉；先与原局根动作核对，不将单点变更自动当作14分终局因果。' };
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
  for (const step of save.replaySteps.slice(0, 185)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(action, step.action); assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  report.initialState = env.saveBrowserSave();
  const lines = fs.readFileSync(path.join(source, 'randomizer/game/ai/heuristic-decision-function.js'), 'utf8').split('\n');
  const hits = lines.flatMap((line, i) => line.includes('const plan = planContinuation.buildPlanFromSnapshot(snapshot);') ? [i] : []);
  assert.equal(hits.length, 1);
  post('Debugger.enable'); post('Debugger.setBreakpointByUrl', { urlRegex: 'heuristic-decision-function\\.js$', lineNumber: hits[0] });
  console.log(`[第186步交叉] 棕方 · 盘面=${board} 搜索=${policy} · 保持4096/256预算`);
  const start = performance.now(); const result = env.runHeuristicPolicyDecision();
  report.searchMs = performance.now() - start;
  assert.equal(result.ok, true); report.diagnostics = env.getCounterfactualDiagnostics();
  assert.deepEqual(report.errors, []); assert.equal(report.captures.length, 1);
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  if (board === policy) assert.equal(report.captures[0].chosen.actionId, save.replaySteps[185].action.actionId);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  post('Debugger.disable'); debug.disconnect(); env.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, searchMs: report.searchMs,
    chosen: report.captures[0]?.chosen.summary,
    scores: report.captures[0]?.ranked.map(r => ({ action: r.action.summary, score: r.evaluation.score })) }));
}
