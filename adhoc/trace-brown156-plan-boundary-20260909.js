// 使用已捕获的156/182优胜计划检查后续正式输入；不重新搜索、不重跑整局。
const fs = require('node:fs'), assert = require('node:assert/strict');
const source = '/private/tmp/seti-route-leaf-eligibility-20260909';
const targetStep = Number(process.argv[2] || 156);
assert.ok([156, 182].includes(targetStep));
const output = `reports/iteration/brown${targetStep}-plan-boundary-20260909-v2.json`;
if (fs.existsSync(output)) { console.log('已有计划边界检查点：' + output); process.exit(0); }
const capture = require(`../reports/iteration/route-leaf-brown${targetStep}-leaf-20260909.json`);
const record = require('../reports/research/4a694948.ad676add.full.json');
const steps = JSON.parse(fs.readFileSync(record.savePath)).replaySteps;
const config = require('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json').root.config;
const continuation = require(source + '/randomizer/game/ai/plan-continuation');
const coordinator = require(source + '/randomizer/game/ai/machine-player-coordinator');
const env = require(source + '/randomizer/app/simulation-env').createSimulationEnv();
const report = { sourceCommit: capture.sourceCommit, capture: `route-leaf-brown${targetStep}-leaf-20260909.json`,
  correction: 'v1未初始化计划制定回合，将同回合157误判为跨回合控制动作；v2从捕获根观察初始化，不修改生产逻辑。', checks: [], intervening: [] };
try {
  env.reset(config);
  for (const s of steps.slice(0, targetStep)) {
    const a = env.legalActions().find(a => a.actionId === s.action.actionId);
    assert.deepEqual(a, s.action); assert.equal(env.step(a).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, s.after);
  }
  assert.deepEqual(capture.captures[0].chosen, steps[targetStep - 1].action);
  const rootPublic = capture.captures[0].snapshot.rootObservation.publicState;
  let plan = continuation.buildPlanFromSnapshot(capture.captures[0].snapshot),
    priorTurn = `${rootPublic.roundNumber}/${rootPublic.turnNumber}`;
  for (let i = targetStep; i < 245; i++) {
    const action = env.legalActions().find(a => a.actionId === steps[i].action.actionId);
    assert.deepEqual(action, steps[i].action);
    if (action.actorId === 'player-brown') {
      const fork = env.createCounterfactualFork().composition;
      try {
        const boundary = coordinator.createMachinePlayerCoordinator({ composition: fork,
          execute: () => { throw new Error('只读诊断不可提交'); } }).readBoundary('player-brown');
        const p = boundary.observation.publicState, turn = `${p.roundNumber}/${p.turnNumber}`;
        const result = continuation.planReuseCheck(plan, boundary.observation, boundary.legalActions,
          { sameTurn: priorTurn === turn });
        const { nextPlan, ...detail } = result;
        report.checks.push({ step: i + 1, actual: action, expected: plan?.steps?.[0], result: detail,
          facts: result.hit ? null : continuation.capturePlanStep({ observation: boundary.observation, action }).facts });
        if (!result.hit) { report.firstMiss = { step: i + 1, reason: result.reason, affected: result.affected }; break; }
        assert.equal(result.action.actionId, action.actionId); plan = nextPlan; priorTurn = turn;
      } finally { fork.dispose(); }
    } else report.intervening.push({ step: i + 1, action });
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, steps[i].after);
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, firstMiss: report.firstMiss,
    checks: report.checks.map(c => ({ step: c.step, hit: c.result.hit })) }));
}
