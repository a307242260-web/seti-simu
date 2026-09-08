// 正式重放旧局到401，核对拿牌后连带结算的分数来源；不调用搜索。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/brown-amiba401-score-source-20260909-v2.json';
if (fs.existsSync(output)) { console.log('已有分数来源证据：' + output); process.exit(0); }
const source = '/private/tmp/seti-route-suffix-facts-20260908';
const record = require('../reports/research/3c7e0003.af937808.full.json');
const steps = JSON.parse(fs.readFileSync(record.savePath)).replaySteps;
const config = require('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json').root.config;
const env = require(source + '/randomizer/app/simulation-env').createSimulationEnv();
const report = { scope: '唯一旧局正式前401输入与after校验；399/400/401分数来源和外星人状态',
  correction: 'v1把尚未完整提交的400 committedState与可见after混比；v2分别核对完整399→401事务7分和可见400/401的1+6分，不修改规则。', states: [] };
try {
  env.reset(config);
  for (const [i, s] of steps.slice(0, 401).entries()) {
    const a = env.legalActions().find(a => a.actionId === s.action.actionId);
    assert.deepEqual(a, s.action); assert.equal(env.step(a).ok, true);
    const save = env.saveBrowserSave(); assert.deepEqual(save.replaySteps.at(-1).after, s.after);
    if (i >= 398) {
      const state = JSON.parse(save.committedState), player = state.players.players.find(p => p.id === 'player-brown');
      report.states.push({ step: i + 1, action: a, publicScore: s.after.p['player-brown'][0], resources: player.resources, scoreSources: player.scoreSources, aliens: state.aliens });
    }
  }
  const before = report.states[0], after = report.states[2];
  report.sourceDelta = Object.fromEntries([...new Set([...Object.keys(before.scoreSources), ...Object.keys(after.scoreSources)])]
    .map(k => [k, (after.scoreSources[k] || 0) - (before.scoreSources[k] || 0)]).filter(([, v]) => v));
  assert.equal(after.resources.score - before.resources.score, 7);
  assert.deepEqual(report.sourceDelta, { alienEffectScore: 6, alienTracePinkScore: 1 });
  assert.equal(report.states[1].publicScore - before.publicScore, 1);
  assert.equal(after.publicScore - report.states[1].publicScore, 6);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally { env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); }
console.log(JSON.stringify({ output, passed: report.passed, error: report.error, sourceDelta: report.sourceDelta }));
