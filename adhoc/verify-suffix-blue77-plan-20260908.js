// 用已有77冷搜索计划逐步核对正式回放，不调用AI搜索。
const fs = require('node:fs'), assert = require('node:assert/strict');
const source = '/private/tmp/seti-route-suffix-facts-20260908';
const output = 'reports/iteration/suffix-blue77-plan-boundary-20260908.json';
if (fs.existsSync(output)) { console.log('已有计划边界：' + output); process.exit(0); }
const continuation = require(source + '/randomizer/game/ai/plan-continuation');
const coordinator = require(source + '/randomizer/game/ai/machine-player-coordinator');
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const raw = JSON.parse(fs.readFileSync('reports/research/3c7e0003.af937808.full.json'));
const steps = JSON.parse(fs.readFileSync(raw.savePath)).replaySteps;
const capture = JSON.parse(fs.readFileSync('reports/iteration/suffix-blue77-ranking-20260908.json'));
const env = require(source + '/randomizer/app/simulation-env').createSimulationEnv();
const report = { sourceCommit: capture.sourceCommit, checks: [], scope: '77获胜计划首次失效，不代表后继重搜计划仍相同' };
try {
  let plan = continuation.buildPlanFromSnapshot(capture.captures[0].snapshot), priorTurn;
  assert.ok(plan?.nextActionId); env.reset(config);
  for (let i = 0; i < 99; i++) {
    const action = env.legalActions().find(a => a.actionId === steps[i].action.actionId);
    assert.deepEqual(action, steps[i].action);
    if (i >= 76 && action.actorId === 'player-blue') {
      const fork = env.createCounterfactualFork().composition;
      try {
        const boundary = coordinator.createMachinePlayerCoordinator({ composition: fork,
          execute: () => { throw new Error('诊断只读，不允许提交'); } }).readBoundary('player-blue');
        const p = boundary.observation.publicState, turn = `${p.roundNumber}/${p.turnNumber}`;
        if (i > 76) {
          const result = continuation.planReuseCheck(plan, boundary.observation, boundary.legalActions, { sameTurn: priorTurn === turn });
          report.checks.push({ step: i + 1, turn, actual: action, expected: plan?.steps?.[0],
            result: { ...result, nextPlan: undefined },
            facts: result.hit ? undefined : continuation.capturePlanStep({ observation: boundary.observation, action }).facts });
          if (!result.hit) {
            report.firstMiss = { step: i + 1, reason: result.reason, affected: result.affected };
            report.interveningActions = steps.slice(78, i); break;
          }
          assert.equal(result.action.actionId, action.actionId); plan = result.nextPlan;
        }
        priorTurn = turn;
      } finally { fork.dispose(); }
    }
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, steps[i].after);
  }
  assert.equal(report.checks.find(c => c.step === 78)?.result.hit, true);
  assert.equal(report.firstMiss?.step, 99); report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, firstMiss: report.firstMiss, error: report.error }));
}
