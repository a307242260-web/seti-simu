// 读取原型已重放的状态；只消去同一已知卡在两侧的位置差异，保留其余弃牌顺序。
const fs = require('node:fs'), assert = require('node:assert/strict'), { isDeepStrictEqual } = require('node:util');
const source = 'reports/iteration/data-demand-pair-prototype-20260908.json';
const completed = process.argv.includes('--completed');
const search = process.argv.includes('--search') || completed;
const searchSource = `step24-data-pair-${completed ? 'completed-' : ''}search-1501ebfd-20260908.json.gz`;
const output = `reports/iteration/data-demand-pair-${completed ? 'completed-' : ''}${search ? 'search-' : ''}comparison-20260908.json`;
if (fs.existsSync(output)) { console.log('已有配对比较：' + output); process.exit(0); }
const r = JSON.parse(fs.readFileSync(source));
assert.equal(r.variants.length, 2);
let [extra, direct] = r.variants;
if (search) {
  const trace = JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync('reports/iteration/' + searchSource)));
  assert.equal(trace.passed, true); assert.ok(Object.values(trace.parity).every(Boolean)); assert.equal(trace.actionMatches, true);
  assert.deepEqual(trace.rows.map(row => row.ordinal), completed ? [15, 21] : [12, 18]);
  if (completed) assert.ok(trace.rows.every(row => row.pairState.origins.every(o => o.chain.at(-1).startsWith('analyze:'))));
  const obligation = o => { const { chain, ...rest } = o; return rest; };
  assert.deepEqual(trace.rows[0].pairState.origins.map(obligation), trace.rows[1].pairState.origins.map(obligation));
  [extra, direct] = trace.rows.map((row, i) => ({ ...r.variants[i],
    state: row.pairState.state, session: row.pairState.session }));
}
const cardId = r.comparison.preservedCardId, playerId = 'player-white';
assert.ok(extra.rootKnownCardIds.includes(cardId)); assert.ok(direct.rootKnownCardIds.includes(cardId));
assert.equal(extra.session, null); assert.equal(direct.session, null);
function normalized(variant, location) {
  const s = structuredClone(variant.state), p = s.players.players.find(p => p.id === playerId);
  assert.equal(p.dataState.placedTokens.length, completed ? 0 : 6);
  assert.ok(p.dataState.placedTokens.every(t => t.placementKind === 'computer'));
  const handMatches = p.hand.filter(c => c.id === cardId), discardMatches = s.cards.discardPile.filter(c => c.id === cardId);
  assert.equal(handMatches.length, location === 'hand' ? 1 : 0);
  assert.equal(discardMatches.length, location === 'discard' ? 1 : 0);
  if (location === 'hand') {
    p.hand = p.hand.filter(c => c.id !== cardId); p.resources.handSize--;
  } else s.cards.discardPile = s.cards.discardPile.filter(c => c.id !== cardId);
  s.meta.stateVersion = 0; s.meta.sequences.dataToken = 0;
  p.resources.availableData = 0; p.dataState.poolTokens = [];
  p.dataState.placedTokens = p.dataState.placedTokens.map(({ id, index, ...placement }) => placement);
  return s;
}
const a = normalized(extra, 'discard'), b = normalized(direct, 'hand');
const equalIncludingRng = isDeepStrictEqual(a, b);
if (search) { a.meta.rngState.state = 0; b.meta.rngState.state = 0; }
assert.deepEqual(a, b, '其余完整已提交状态必须相同，不排序或忽略其他弃牌');
// 明确的否定门禁：规则收益不同、其他弃牌顺序/内容不同，不得通过这项配对。
const changedScore = structuredClone(b); changedScore.players.players[3].resources.score++;
assert.equal(isDeepStrictEqual(a, changedScore), false);
const changedDiscard = structuredClone(b);
// 本例只剩一张弃牌，改该真实牌的身份检查内容不得被忽略。
changedDiscard.cards.discardPile[0].id += '-different';
assert.equal(isDeepStrictEqual(a, changedDiscard), false);
const report = { source, passed: true, preservedKnownCardId: cardId,
  searchSource: search ? searchSource : null, goalCompleted: completed,
  equalIncludingRng, comparisonIgnoresSamplingRng: search,
  surplusData: extra.state.players.players[3].resources.availableData - direct.state.players.players[3].resources.availableData,
  discardedCardOrderPreserved: true, sessionsNull: true,
  boundary: '仅实例配对原型。需求外1数据与保留已知牌的取舍来自用户要求，不是严格全状态支配。没有修改生产身份、随机采样、来源或预算。' };
assert.equal(report.surplusData, 1);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
