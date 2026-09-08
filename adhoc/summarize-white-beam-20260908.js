// 只读裁剪时完整队列；不将committedState相同外推为恢复session等价。
const fs = require('node:fs'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const identity = process.argv.includes('--identity');
const source = `reports/iteration/quick-turn-white-cross-candidate-${identity ? 'identity' : 'candidate'}-beam-trace-20260908.json.gz`;
const output = `reports/iteration/white-beam-distribution-${identity ? 'identity-' : ''}20260908.json`;
if (fs.existsSync(output)) { console.log('已有队列统计：' + output); process.exit(0); }
const r = JSON.parse(zlib.gunzipSync(fs.readFileSync(source)));
assert.equal(r.passed, true);
const beam = r.trace.find(e => e.kind === 'beam-frontier');
assert.ok(beam);
const kept = beam.nodes.filter(n => n.retained);
assert.equal(kept.length, beam.maxFrontierNodes);
const stable = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const groups = new Map(), families = {}, depths = {};
for (const n of kept) {
  families[n.action.family] = (families[n.action.family] || 0) + 1;
  const depth = Math.min(...n.origins.map(o => o.proxyDepth || 0));
  depths[depth] = (depths[depth] || 0) + 1;
  const state = structuredClone(n.state);
  assert.equal(typeof state.meta.rngState.state, 'number');
  state.meta.rngState.state = 0;
  const key = stable([state, n.action, n.depth]);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(n);
}
const dropped = beam.nodes.find(n => n.key === beam.droppedKey);
const report = { source, total: beam.nodes.length, retained: kept.length, families, depths,
  fullStateAndFullActionGroupsIgnoringOnlyRng: groups.size,
  duplicateEntriesIgnoringOnlyRng: kept.length - groups.size,
  groups: [...groups.values()].filter(g => g.length > 1).map(g => ({ indexes: g.map(n => n.index),
    action: g[0].action, origins: g.map(n => n.origins), rngStates: g.map(n => n.state.meta.rngState.state) })),
  dropped: { index: dropped.index, action: dropped.action, priority: dropped.priority, origins: dropped.origins },
  boundary: identity
    ? '身份候选已规范采样输入；此处仍按完整committedState（仅忽略RNG）、完整Action和物理depth统计。零重复只排除此类重复，未证明所有语义重复均已消除；排名为0起算。'
    : '仅证明完整committedState除RNG外相同、完整Action和物理depth相同；未比较envelope恢复session。当前branchKey包含envelopeHash，RNG差异会反馈到后续样本，不能直接删字段宣称严格转置等价。下一步先冻结采样与恢复身份契约。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, retained: report.retained, families, depths,
  groups: groups.size, duplicates: report.duplicateEntriesIgnoringOnlyRng, droppedIndex: dropped.index }));
