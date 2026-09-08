// 重放B的一条真实完成路线，验证拨款补数据的规则可达性与目录是否收录。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/grant-data-route-evidence-20260908-v2.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const env = require('../randomizer/app/simulation-env').createSimulationEnv(); let fork;
const report = { scope: '仅正式输入重放，不运行AI搜索', steps: [] };
try {
  const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
  const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-trigger-scan-mapping-20260907-aaaed8d0-full-v339.json'));
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
  const grant = legal().find(a => a.family === 'play_card' && a.target?.cardInstanceId === 'card-18-0');
  assert.ok(grant, '拨款应可作为正式主行动打出');
  report.acquisitionPlans = report.beforeGrant.dataAnalyzeRequirements.acquisitionPlans;
  report.grantCatalogued = report.acquisitionPlans.some(p => p.kind === 'card' && p.cardInstanceId === 'card-18-0');
  submit(grant);
  submit(legal().find(a => a.family === 'choose_card' && a.target?.cardInstanceId === 'card-19-0'));
  report.afterGrant = observe();
  assert.equal(report.afterGrant.dataAnalyzeRequirements.availableData - report.beforeGrant.dataAnalyzeRequirements.availableData, 1);
  assert.ok(report.afterGrant.selfState.hand.some(c => c.id === 'card-19-0'));
  assert.equal(report.grantCatalogued, false, '本诊断应复现目录漏项');
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, grantCatalogued: report.grantCatalogued }));
}
