// 同盘面交叉核验：只重放到白方首处分歧前，采集一次正式决策，不运行整局。
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), inspector = require('node:inspector');
const root = path.resolve(__dirname, '..');
const [board, policy] = process.argv.slice(2);
const track = process.argv.includes('--track-old-plan');
const beam = process.argv.includes('--track-beam');
assert.ok(!beam || track);
assert.ok(!track || (board === 'candidate' && policy === 'candidate'));
assert.ok(['baseline', 'candidate'].includes(board));
assert.ok(['baseline', 'candidate'].includes(policy));
const source = policy === 'baseline' ? root : '/private/tmp/seti-quick-turn-order-20260908';
const output = path.join(root, `reports/iteration/quick-turn-white-cross-${board}-${policy}${beam ? '-beam-trace' : track ? '-old-plan-trace' : ''}-20260908.json`);
if (fs.existsSync(output) || fs.existsSync(output + '.gz')) { console.log('已有交叉证据，跳过：' + output); process.exit(0); }
const comparison = JSON.parse(fs.readFileSync(path.join(root, 'reports/iteration/quick-turn-full-comparison-20260908.json')));
const save = JSON.parse(fs.readFileSync(comparison[board].savePath));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const req = require('node:module').createRequire(path.join(source, 'adhoc/diagnostic.js'));
const env = req('../randomizer/app/simulation-env').createSimulationEnv();
const report = { board, policy, commit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  decisionStep: board === 'baseline' ? 189 : 175, captures: [], errors: [],
  scope: '冷启动同盘面交叉；先与对应整局计划核对，不能直接外推终局差值因果。' };
const debug = new inspector.Session(); debug.connect();
const traceBreakpoints = new Map();
function post(method, params = {}) {
  let done = false, error, result;
  debug.post(method, params, (e, r) => { done = true; error = e; result = r; });
  assert.ok(done); if (error) throw error; return result;
}
debug.on('Debugger.paused', ({ params }) => {
  try {
    const traceExpression = traceBreakpoints.get(params.hitBreakpoints?.[0]);
    if (traceExpression) {
      const r = post('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId,
        expression: traceExpression, returnByValue: true });
      assert.equal(r.exceptionDetails, undefined);
      const event = JSON.parse(r.result.value);
      report.trace.push(event);
      if (event.kind === 'beam-frontier') post('Debugger.removeBreakpoint', { breakpointId: params.hitBreakpoints[0] });
      return;
    }
    const r = post('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId,
      expression: `JSON.stringify({chosen:action,snapshot,ranked:legalActions.map(a=>{const e=expectedScoreEvaluator.evaluateOutcome({seatId,observation,actionOutcomes},a,{});const o=actionOutcomes.find(o=>o.actionId===a.actionId);const l=o?.leaves?.find(l=>l.leafId===e.selectedLeafId);return {action:a,evaluation:e,completeness:o?.searchCompleteness,leaf:l};})})`, returnByValue: true });
    assert.equal(r.exceptionDetails, undefined); report.captures.push(JSON.parse(r.result.value));
  } catch (error) { report.errors.push(error.stack); }
  finally { post('Debugger.resume'); }
});
const started = performance.now();
try {
  env.reset(config);
  for (const step of save.replaySteps.slice(0, report.decisionStep - 1)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(action, step.action); assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  report.initialState = env.saveBrowserSave();
  const lines = fs.readFileSync(path.join(source, 'randomizer/game/ai/heuristic-decision-function.js'), 'utf8').split('\n');
  const hits = lines.flatMap((l, i) => l.includes('const plan = planContinuation.buildPlanFromSnapshot(snapshot);') ? [i] : []);
  assert.equal(hits.length, 1);
  post('Debugger.enable'); post('Debugger.setBreakpointByUrl', { urlRegex: 'heuristic-decision-function\\.js$', lineNumber: hits[0] });
  if (track) {
    const old = JSON.parse(fs.readFileSync(path.join(root, 'reports/iteration/quick-turn-white-cross-candidate-baseline-20260908.json')));
    report.trackedChain = old.captures[0].ranked.find(x => x.action.family === 'scan').leaf.actionChain;
    report.trace = [];
    const chain = JSON.stringify(report.trackedChain);
    const prefix = `o=>o.chain.length>0&&o.chain.length<=${chain}.length&&o.chain.every((a,i)=>a===${chain}[i])`;
    const ruleLines = fs.readFileSync(path.join(source, 'randomizer/game/rule-composition.js'), 'utf8').split('\n');
    function traceAt(needle, condition, expression) {
      const positions = ruleLines.flatMap((l, i) => l.includes(needle) ? [i] : []);
      assert.equal(positions.length, 1, needle);
      const bp = post('Debugger.setBreakpointByUrl', { urlRegex: 'rule-composition\\.js$', lineNumber: positions[0], condition });
      traceBreakpoints.set(bp.breakpointId, expression);
    }
    traceAt('const quickBeforeTurn = !execution.awaitingDecision', `(${prefix})(origin)`,
      'JSON.stringify({kind:"executed",chain:nextChain,routeTargetId:origin.routeTargetId,routePlanId:origin.routePlanId,quickBeforeTurn:origin.quickBeforeTurn,awaiting:execution.awaitingDecision})');
    traceAt('markIncomplete(origins, reason);', `origins.some(${prefix})`,
      `JSON.stringify({kind:"pruned",reason,origins:origins.filter(${prefix}).map(o=>({chain:o.chain,routeTargetId:o.routeTargetId,routePlanId:o.routePlanId}))})`);
    traceAt('quickTurnOrderPrunedOriginCount += 1;', `(${prefix})(origin)`,
      'JSON.stringify({kind:"order-pruned",chain:nextChain,action:route.action,routeTargetId:route.routeTargetId,routePlanId:route.routePlanId})');
    if (beam) traceAt('markPruned(node.origins, "beam-budget");',
      `node.action.actionId===${JSON.stringify(report.trackedChain[20])}&&node.origins.some(o=>o.chain.length===20&&(${prefix})(o))`,
      `JSON.stringify({kind:"beam-frontier",droppedKey:node.key,maxFrontierNodes,nodes:ordered.map((n,index)=>({index,retained:retained.has(n.key),key:n.key,action:n.action,depth:n.depth,priority:n.priority,state:getTrustedState(n.envelope),origins:n.origins.map(o=>({rootActionId:o.rootAction.actionId,chain:o.chain,proxyDepth:o.proxyDepth,routeTargetId:o.routeTargetId,routePlanId:o.routePlanId,quickBeforeTurn:o.quickBeforeTurn}))}))})`);
  }
  console.log(`[白方首差交叉] 盘面=${board} 搜索=${policy} · 第2轮 第4回合 · 4096节点上限`);
  assert.equal(env.runHeuristicPolicyDecision().ok, true);
  report.diagnostics = env.getCounterfactualDiagnostics();
  assert.deepEqual(report.errors, []); assert.equal(report.captures.length, 1); report.passed = true;
  if (beam) assert.equal(report.trace.filter(e => e.kind === 'beam-frontier').length, 1);
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  post('Debugger.disable'); debug.disconnect(); env.dispose(); report.wallMs = performance.now() - started;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, wallMs: report.wallMs,
    actions: report.captures[0]?.ranked.map(x => ({ family: x.action.family, score: x.evaluation.score, leaf: x.evaluation.selectedLeafId })) }));
}
