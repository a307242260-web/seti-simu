// 用已有正式动作前缀验证：一次数据来源完成后，分析目标是否重新枚举其他来源。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/data-source-reselection-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const evidence = JSON.parse(fs.readFileSync('reports/iteration/known-data-preparation-v2-20260908.json'));
const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-grant-data-route-20260908-1501ebfd-full-v316.json'));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const evaluator = require('../randomizer/game/ai/expected-score-evaluator');
const coordinator = require('../randomizer/game/ai/machine-player-coordinator');
const report = { scope: '正式前缀与纯后继选择，不进行搜索；不把来源目录dataCount当成扫描完整收益', variants: [] };
for (const previous of evidence.variants) {
  const env = require('../randomizer/app/simulation-env').createSimulationEnv(); let fork;
  const v = { discard: previous.discard }; report.variants.push(v);
  try {
    env.reset(config);
    const prefix = [...save.replaySteps.slice(0, 23).map(s => s.action),
      ...previous.steps.slice(0, previous.steps.findIndex(s => s.action.family === 'scan')).map(s => s.action)];
    for (const expected of prefix) {
      const a = env.legalActions().find(a => a.actionId === expected.actionId);
      assert.deepEqual(a, expected); assert.equal(env.step(a).ok, true);
    }
    fork = env.createCounterfactualFork().composition;
    const b = coordinator.createMachinePlayerCoordinator({ composition: fork,
      execute: () => { throw new Error('只允许读取'); } }).readBoundary('player-white');
    v.requirements = b.observation.dataAnalyzeRequirements || b.observation.outcomeProjection?.progress?.dataAnalyzeRequirements;
    v.targets = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: 'player-white',
      rootObservation: b.observation, legalActions: b.legalActions }).filter(t => t.targetId === 'data:analyze');
    v.successors = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: 'player-white',
      branchObservation: b.observation, legalSuccessors: b.legalActions,
      routeTargetId: 'data:analyze', routePlanId: 'data:corner:card-15-0' });
    assert.equal(v.requirements.dataNeeded, previous.discard ? 1 : 2);
    assert.equal(v.requirements.acquisitionPlans.find(p => p.kind === 'scan').dataCount, 1);
    assert.ok(v.successors.some(a => a.family === (previous.discard ? 'scan' : 'card_corner')));
    v.passed = true;
  } catch (error) { v.error = error.stack; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); }
}
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report.variants.map(v => ({ discard: v.discard, passed: v.passed, error: v.error,
  dataNeeded: v.requirements?.dataNeeded, successors: v.successors?.map(a => ({ family: a.family, plan: a.routePlanId })) }))));
