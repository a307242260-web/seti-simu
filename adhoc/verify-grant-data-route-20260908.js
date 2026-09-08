// 重放B的一条真实完成路线，验证拨款补数据的规则可达性与目录是否收录。
const fs = require('node:fs'), assert = require('node:assert/strict');
const runSearch = process.argv.includes('--search');
const output = `reports/iteration/grant-data-route-${runSearch ? 'search' : 'fixed'}-20260908.json`;
const inputRoot = process.env.SETI_DIAGNOSTIC_INPUT_ROOT || '.';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const env = require('../randomizer/app/simulation-env').createSimulationEnv(); let fork;
const report = { scope: '仅正式输入重放，不运行AI搜索', steps: [] };
try {
  const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
  const save = JSON.parse(fs.readFileSync(inputRoot + '/seti-saves/seti-save-research-trigger-scan-mapping-20260907-aaaed8d0-full-v339.json'));
  env.reset(config);
  for (const s of save.replaySteps.slice(0, 23)) {
    const a = env.legalActions().find(a => a.actionId === s.action.actionId);
    assert.deepEqual(a, s.action); assert.equal(env.step(a).ok, true);
  }
  fork = env.createCounterfactualFork().composition;
  const observe = () => fork.projection({ playerId: 'player-white', role: 'player' }).state;
  const legal = () => { const s = fork.inspect(); return s.phase === 'awaiting_input' ? s.session.decision.choices : fork.inputPort.enumerateActions(); };
  function submit(a) {
    assert.ok(a, '需要正式合法动作');
    const d = fork.inspect().session?.decision;
    const r = a.phase === 'conditional'
      ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a })
      : fork.inputPort.submitAction(a);
    assert.equal(r.ok, true, JSON.stringify(r));
    if (a.family === 'end_turn') assert.equal(fork.counterfactualPort.advanceFocalPlanningTurn('player-white').ok, true);
    report.steps.push({ action: a, result: r, observation: observe() });
  }
  const trace = JSON.parse(fs.readFileSync('reports/iteration/step24-goal-trace-aaaed8d0-20260908.json'));
  const b = trace.diagnostics.goalClusters.find(g => g.path.length === 1 && g.targetId === 'orbit:mars:planet:');
  report.sourceRouteIndex = 9;
  for (const planned of b.routeVariants[9].actions) {
    const match = a => a.family === planned.family && JSON.stringify(a.target || {}) === JSON.stringify(planned.target || {});
    let a = legal().find(match);
    if (!a) {
      assert.equal(planned.family, 'orbit', '聚合路线只允许补回已省略的主行动边界');
      submit(legal().find(a => a.family === 'end_turn')); a = legal().find(match);
    }
    submit(a);
  }
  report.afterOrbit = observe();
  while (observe().dataAnalyzeRequirements.computerPlacedCount < 5) {
    const choices = legal();
    const income = choices.find(a => a.target?.choiceId === 'income:card-15-0');
    submit(income || choices.find(a => a.family === 'place_data') || choices.find(a => a.target?.choiceId === 'data:computer'));
  }
  submit(legal().find(a => a.family === 'end_turn'));
  report.beforeGrant = observe();
  const beforeGrantEnvelope = fork.lifecycle.save().envelope;
  const grant = legal().find(a => a.family === 'play_card' && a.target?.cardInstanceId === 'card-18-0');
  assert.ok(grant, '拨款应可作为正式主行动打出');
  report.acquisitionPlans = report.beforeGrant.dataAnalyzeRequirements.acquisitionPlans;
  report.grantCatalogued = report.acquisitionPlans.some(p => p.kind === 'card' && p.cardInstanceId === 'card-18-0');
  const plan = report.acquisitionPlans.find(p => p.cardInstanceId === 'card-18-0' && p.selection?.cardInstanceId === 'card-19-0');
  assert.ok(plan, '补数据目录须包含拨款及已知轨道加注的成对计划');
  assert.equal(plan.dataCount, 1);
  const evaluator = require('../randomizer/game/ai/expected-score-evaluator');
  assert.ok(evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: 'player-white',
    rootObservation: report.beforeGrant, legalActions: legal(),
  }).some(t => t.planId === plan.planId && t.compatibleActionIds.includes(grant.actionId)));
  submit(grant);
  const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: 'player-white',
    rootObservation: report.beforeGrant, branchObservation: observe(), currentAction: grant,
    routeTargetId: 'data:analyze', routePlanId: plan.planId, legalSuccessors: legal(),
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].target.cardInstanceId, 'card-19-0');
  submit(legal().find(a => a.actionId === selected[0].actionId));
  report.afterGrant = observe();
  assert.equal(report.afterGrant.dataAnalyzeRequirements.availableData - report.beforeGrant.dataAnalyzeRequirements.availableData, 1);
  assert.ok(report.afterGrant.selfState.hand.some(c => c.id === 'card-19-0'));
  assert.equal(report.grantCatalogued, true);
  submit(legal().find(a => a.family === 'place_data'));
  submit(legal().find(a => a.target?.choiceId === 'data:computer'));
  assert.equal(observe().dataAnalyzeRequirements.computerPlacedCount, 6);
  if (runSearch) {
    assert.equal(fork.lifecycle.restore(beforeGrantEnvelope).ok, true);
    const outcomeModel = require('../randomizer/game/ai/outcome-model');
    const decide = require('../randomizer/game/ai/heuristic-decision-function').createHeuristicDecisionFunction({ composition: fork });
    console.log('[拨款缺口单点] 白方 · 计算机5/6 · 数据0 · 2钱0电 · 开始4096预算搜索');
    const started = performance.now();
    const scheme = decide.run({ seatId: 'player-white', legalActions: legal(),
      observation: outcomeModel.createDecisionObservation(observe(), { seatId: 'player-white' }) });
    const outcome = scheme.actionOutcomes.find(o => o.actionId === grant.actionId);
    report.search = { wallMs: performance.now() - started, chosenActionId: scheme.actionId,
      diagnostics: fork.counterfactualPort.getDiagnostics(), grantOutcome: outcome };
    assert.deepEqual(report.search.diagnostics.failedNodeCountByCode, {});
    assert.equal(outcome.status, 'settled');
    assert.ok(outcome.leaves.some(l => (l.planSteps || []).some(s => (
      s.action.family === 'choose_card' && s.action.target?.cardInstanceId === 'card-19-0'
    )) && (l.planSteps || []).some(s => s.action.family === 'analyze')), '真实搜索须保留拨款精选后分析的完整叶');
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, grantCatalogued: report.grantCatalogued }));
}
