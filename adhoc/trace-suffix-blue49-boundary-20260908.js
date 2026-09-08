// 仅冷搜索已记录第49步，并沿既有正式输入检查蓝方计划；不重跑完整局。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const inspector = require('node:inspector'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..'), source = '/private/tmp/seti-route-suffix-facts-20260908';
const output = path.join(root, 'reports/iteration/suffix-blue49-boundary-20260908.json');
if (fs.existsSync(output)) { console.log('已有蓝方计划证据：' + output); process.exit(0); }
const record = JSON.parse(fs.readFileSync(path.join(root, 'reports/research/3c7e0003.af937808.full.json')));
const steps = JSON.parse(fs.readFileSync(path.resolve(root, record.savePath))).replaySteps;
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const continuation = require(source + '/randomizer/game/ai/plan-continuation');
const coordinator = require(source + '/randomizer/game/ai/machine-player-coordinator');
const env = require(source + '/randomizer/app/simulation-env').createSimulationEnv();
const report = { sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(),
  boardRecord: '3c7e0003.af937808.full.json', checks: [], captures: [], errors: [] };
const debug = new inspector.Session(); debug.connect();
function post(method, params = {}) {
  let error, result, done = false;
  debug.post(method, params, (e, r) => { error = e; result = r; done = true; });
  assert.equal(done, true); if (error) throw error; return result;
}
debug.on('Debugger.paused', ({ params }) => {
  try {
    const r = post('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId,
      expression: 'JSON.stringify({chosen:action,snapshot})', returnByValue: true });
    assert.equal(r.exceptionDetails, undefined); report.captures.push(JSON.parse(r.result.value));
  } catch (error) { report.errors.push(error.stack); }
  finally { post('Debugger.resume'); }
});
try {
  env.reset(config);
  for (const step of steps.slice(0, 48)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert.deepEqual(action, step.action); assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
  }
  const lines = fs.readFileSync(source + '/randomizer/game/ai/heuristic-decision-function.js', 'utf8').split('\n');
  const hits = lines.flatMap((line, i) => line.includes('const plan = planContinuation.buildPlanFromSnapshot(snapshot);') ? [i] : []);
  assert.equal(hits.length, 1); post('Debugger.enable');
  post('Debugger.setBreakpointByUrl', { urlRegex: 'heuristic-decision-function\\.js$', lineNumber: hits[0] });
  const start = performance.now(); assert.equal(env.runHeuristicPolicyDecision().ok, true);
  report.searchMs = performance.now() - start; post('Debugger.disable');
  assert.deepEqual(report.errors, []); assert.equal(report.captures.length, 1);
  report.diagnostics = env.getCounterfactualDiagnostics();
  assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
  assert.deepEqual(report.captures[0].chosen, steps[48].action);
  assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, steps[48].after);
  let plan = continuation.buildPlanFromSnapshot(report.captures[0].snapshot), priorTurn;
  for (let i = 49; i < 99; i++) {
    const action = env.legalActions().find(a => a.actionId === steps[i].action.actionId);
    assert.deepEqual(action, steps[i].action);
    if (action.actorId === 'player-blue') {
      const fork = env.createCounterfactualFork().composition;
      try {
        const boundary = coordinator.createMachinePlayerCoordinator({ composition: fork,
          execute: () => { throw new Error('只读诊断不可提交'); } }).readBoundary('player-blue');
        const p = boundary.observation.publicState, turn = `${p.roundNumber}/${p.turnNumber}`;
        const result = continuation.planReuseCheck(plan, boundary.observation, boundary.legalActions,
          { sameTurn: priorTurn === turn });
        report.checks.push({ step: i + 1, actual: action, expected: plan?.steps?.[0],
          result: { ...result, nextPlan: undefined },
          facts: result.hit ? undefined : continuation.capturePlanStep({ observation: boundary.observation, action }).facts });
        if (!result.hit) { report.firstMiss = { step: i + 1, reason: result.reason, affected: result.affected }; break; }
        assert.equal(result.action.actionId, action.actionId); plan = result.nextPlan; priorTurn = turn;
      } finally { fork.dispose(); }
    }
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, steps[i].after);
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  debug.disconnect(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error,
    searchMs: report.searchMs, firstMiss: report.firstMiss, checks: report.checks.map(c => ({ step: c.step, result: c.result.hit })) }));
}
