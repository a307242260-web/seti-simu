// 用当前正确基线正式重放：已知卡的额外数据角标是否仍是不必要准备。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/known-data-preparation-v2-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-grant-data-route-20260908-1501ebfd-full-v316.json'));
const report = { sourceCommit: '1501ebfd', scope: '正式输入对照，不运行AI；弃牌来源card-15-0为第24步根时已知牌，不使用新盲抽牌效果', variants: [] };
try {
  for (const discard of [true, false]) {
    const env = require('../randomizer/app/simulation-env').createSimulationEnv();
    const v = { discard, steps: [] }; report.variants.push(v);
    const state = () => {
      const s = env.saveBrowserSave();
      const root = typeof s.committedState === 'string' ? JSON.parse(s.committedState) : s.committedState;
      return root.players.players.find(p => p.id === 'player-white');
    };
    const run = predicate => {
      const a = env.legalActions().find(predicate); assert.ok(a, '需要正式合法输入');
      const r = env.step(a); assert.equal(r.ok, true, JSON.stringify(r));
      v.steps.push({ action: a, player: state() });
    };
    const fill = () => {
      run(a => a.family === 'place_data');
      run(a => a.target?.choiceId === 'data:computer');
    };
    try {
      env.reset(config);
      for (const step of save.replaySteps.slice(0, 23)) assert.equal(env.step(step.action).ok, true);
      assert.ok(state().hand.some(c => c.id === 'card-15-0'));
      assert.equal(state().dataState.placedTokens.length, 0);
      // 第4格等待收入选择时尚未提交，不以committed计数重复发起第4格。
      for (let slot = 0; slot < 4; slot++) fill();
      run(a => a.target?.choiceId === 'income:card-13-0');
      v.afterIncome = state();
      if (discard) {
        run(a => a.family === 'card_corner' && a.target?.cardInstanceId === 'card-15-0');
        fill();
      }
      v.beforeScan = state();
      run(a => a.family === 'scan');
      run(a => a.target?.choiceId === 'nebula:sector-1-a');
      run(a => a.target?.choiceId === 'public:card-18-0:sector-3-a');
      v.afterScan = state();
      while (state().dataState.placedTokens.length < 6) fill();
      v.final = state();
    } finally { env.dispose(); }
  }
  const [a, b] = report.variants;
  assert.equal(a.final.dataState.placedTokens.length, 6);
  assert.equal(b.final.dataState.placedTokens.length, 6);
  assert.ok(!a.final.hand.some(c => c.id === 'card-15-0'));
  assert.ok(b.final.hand.some(c => c.id === 'card-15-0'));
  assert.equal(a.afterScan.resources.availableData - a.beforeScan.resources.availableData, 2);
  assert.equal(b.afterScan.resources.availableData - b.beforeScan.resources.availableData, 2);
  report.passed = true;
  report.conclusion = { bothComputerFull: true, dataWithDiscard: a.final.resources.availableData,
    dataWithoutDiscard: b.final.resources.availableData, preservedKnownCard: 'card-15-0',
    note: '额外弃牌产生1剩余数据，但不是本次填满计算机的需求；两侧资源不完全相同，不称严格全状态支配。' };
} catch (error) { report.error = error.stack; process.exitCode = 1; }
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: report.passed, error: report.error, conclusion: report.conclusion }));
