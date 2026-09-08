// 原型：用实际完成准备的两条路线配对，不预测扫描收益，不修改生产搜索。
const fs = require('node:fs'), assert = require('node:assert/strict'), { isDeepStrictEqual } = require('node:util');
const output = 'reports/iteration/data-demand-pair-prototype-20260908.json';
if (fs.existsSync(output)) { console.log('已有配对原型证据：' + output); process.exit(0); }
const source = JSON.parse(fs.readFileSync('reports/iteration/known-data-preparation-v2-20260908.json'));
const save = JSON.parse(fs.readFileSync('seti-saves/seti-save-research-grant-data-route-20260908-1501ebfd-full-v316.json'));
const config = JSON.parse(fs.readFileSync('/private/tmp/seti-trigger-scan-mapping-20260907/reports/iteration/data-root-53-aaaed8d0-20260907.json')).root.config;
const report = { source: 'known-data-preparation-v2-20260908.json', variants: [] };
function readState(env) {
  const value = env.saveBrowserSave().committedState;
  return typeof value === 'string' ? JSON.parse(value) : value;
}
function comparisonState(state, playerId, retainedCardId) {
  const copy = structuredClone(state);
  const player = copy.players.players.find(p => p.id === playerId);
  if (retainedCardId) {
    const card = player.hand.find(c => c.id === retainedCardId);
    assert.ok(card);
    player.hand = player.hand.filter(c => c.id !== retainedCardId);
    player.resources.handSize -= 1;
    copy.cards.discardPile.push(card);
  }
  // 仅用于检测给定两状态的差异，不能据此直接声称未来严格等价或修改物理状态键。
  copy.meta.stateVersion = 0;
  copy.meta.sequences.dataToken = 0;
  player.resources.availableData = 0;
  player.dataState.poolTokens = [];
  player.dataState.placedTokens = player.dataState.placedTokens.map(token => {
    const { id, index, ...placement } = token;
    return placement;
  });
  return copy;
}
try {
  for (const variant of source.variants) {
    const env = require('../randomizer/app/simulation-env').createSimulationEnv();
    try {
      env.reset(config);
      for (const step of save.replaySteps.slice(0, 23)) {
        assert.equal(env.step(step.action).ok, true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
      }
      const rootKnownCardIds = readState(env).players.players.find(p => p.id === 'player-white').hand.map(c => c.id);
      for (const step of variant.steps) {
        const legal = env.legalActions().find(a => a.actionId === step.action.actionId);
        assert.deepEqual(legal, step.action); assert.equal(env.step(legal).ok, true);
        assert.deepEqual(readState(env).players.players.find(p => p.id === 'player-white'), step.player);
      }
      report.variants.push({ discarded: variant.discard, state: readState(env),
        session: env.saveBrowserSave().session, rootKnownCardIds, legal: env.legalActions() });
    } finally { env.dispose(); }
  }
  const [extra, direct] = report.variants;
  const player = variant => variant.state.players.players.find(p => p.id === 'player-white');
  const a = player(extra), b = player(direct);
  const preserved = b.hand.filter(c => !a.hand.some(other => other.id === c.id));
  assert.equal(preserved.length, 1);
  assert.ok(direct.rootKnownCardIds.includes(preserved[0].id));
  assert.equal(a.dataState.placedTokens.length, 6); assert.equal(b.dataState.placedTokens.length, 6);
  assert.equal(a.resources.availableData - b.resources.availableData, 1);
  assert.equal(extra.session, null); assert.equal(direct.session, null);
  const comparable = isDeepStrictEqual(comparisonState(extra.state, 'player-white'),
    comparisonState(direct.state, 'player-white', preserved[0].id));
  report.comparison = { comparable, preservedCardId: preserved[0].id, surplusData: 1,
    boundary: '双方已真实填满6格、session为空；仅为已知卡与需求外数据的用户指定取舍提供实例证据。未实现搜索撤销，不将字段规范化外推为全局转置键。' };
  assert.equal(comparable, true);
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, passed: report.passed, error: report.error, comparison: report.comparison }));
