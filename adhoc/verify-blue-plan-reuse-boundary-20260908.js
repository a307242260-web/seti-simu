// 重放真实动作，使用第49步已有计划检查其首次失效。不调用AI搜索。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/blue-plan-reuse-boundary-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const continuation = require('../randomizer/game/ai/plan-continuation');
const coordinator = require('../randomizer/game/ai/machine-player-coordinator');
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const variants = [
  { policy: 'candidate', save: 'seti-save-research-quick-turn-order-20260908-438305b4-full-v300.json', nextSearch: 116 },
  { policy: 'identity', save: 'seti-save-research-counterfactual-identity-20260908-0b01af15-full-v319.json', nextSearch: 114 },
];
const report = { scope: '单条已保存计划的首次重搜原因，不代表全部新增17次搜索', variants: [] };
for (const item of variants) {
  const env = require('../randomizer/app/simulation-env').createSimulationEnv();
  const v = { ...item, checks: [] }; report.variants.push(v);
  try {
    const capture = JSON.parse(fs.readFileSync(`reports/iteration/identity-blue-cross-baseline-${item.policy}-20260908.json`));
    const steps = JSON.parse(fs.readFileSync('seti-saves/' + item.save)).replaySteps;
    let plan = continuation.buildPlanFromSnapshot(capture.captures[0].snapshot), priorTurn;
    assert.ok(plan?.nextActionId); env.reset(config);
    for (let i = 0; i < item.nextSearch; i++) {
      const action = env.legalActions().find(a => a.actionId === steps[i].action.actionId);
      assert.deepEqual(action, steps[i].action);
      if (i >= 48 && action.actorId === 'player-blue') {
        const fork = env.createCounterfactualFork().composition;
        try {
          const boundary = coordinator.createMachinePlayerCoordinator({ composition: fork,
            execute: () => { throw new Error('诊断只允许读取协调器边界'); } }).readBoundary('player-blue');
          const p = boundary.observation.publicState, turn = `${p.roundNumber}/${p.turnNumber}`;
          if (i > 48) {
            const result = continuation.planReuseCheck(plan, boundary.observation, boundary.legalActions, { sameTurn: priorTurn === turn });
            v.checks.push({ step: i + 1, turn, actual: action, expected: plan?.steps?.[0], result: { ...result, nextPlan: undefined },
              facts: result.hit ? undefined : continuation.capturePlanStep({ observation: boundary.observation, action }).facts });
            if (!result.hit) { v.firstMiss = { step: i + 1, reason: result.reason, affected: result.affected }; break; }
            assert.equal(result.action.actionId, action.actionId); plan = result.nextPlan;
          }
          priorTurn = turn;
        } finally { fork.dispose(); }
      }
      assert.equal(env.step(action).ok, true);
    }
    assert.equal(v.firstMiss?.step, item.nextSearch); v.passed = true;
  } catch (error) { v.error = error.stack; process.exitCode = 1; }
  finally { env.dispose(); }
}
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report.variants.map(v => ({ policy: v.policy, passed: v.passed, firstMiss: v.firstMiss, error: v.error }))));
