// 只读当前固定第24步追踪，按实际链前缀区分填数跨回合顺序。
const fs = require('node:fs'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const source = 'reports/iteration/step24-entry-states-1501ebfd-20260908.json.gz';
const output = 'reports/iteration/step24-quick-duplicates-1501ebfd-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const r = JSON.parse(zlib.gunzipSync(fs.readFileSync(source)));
assert.equal(r.passed, true); assert.ok(Object.values(r.parity).every(Boolean));
const entries = r.rows.filter(row => row.entryState?.entryOrigins.some(o =>
  o.entry && o.target === 'data:analyze' && o.paths.some(p => p[0] === 'orbit:mars:planet:')));
const playerKey = row => { const p = { ...row.entryState.player }; delete p.mainActionCompleted; return JSON.stringify(p); };
const beforeRows = entries.filter(row => row.entryState.player.mainActionCompleted);
const afterRows = entries.filter(row => !row.entryState.player.mainActionCompleted);
const starts = (chain, prefix) => prefix.every((id, i) => chain[i] === id);
const pairs = [];
for (const after of afterRows) {
  for (const ao of after.node.origins.filter(o => o.target === 'data:analyze')) {
    if (!ao.chain.at(-1)?.startsWith('end_turn:')) continue;
    const prefix = ao.chain.slice(0, -1);
    const before = beforeRows.find(row => playerKey(row) === playerKey(after)
      && row.node.action.family === after.node.action.family
      && row.node.origins.some(o => JSON.stringify(o.chain) === JSON.stringify(prefix)));
    if (!before) continue;
    if (pairs.some(p => p.beforeOrdinal === before.ordinal && p.afterOrdinal === after.ordinal)) continue;
    const bp = [...prefix, before.node.action.actionId], ap = [...ao.chain, after.node.action.actionId];
    const descendants = p => r.rows.filter(row => row.node.origins.some(o => starts(o.chain, p))).map(row => row.ordinal);
    pairs.push({ beforeOrdinal: before.ordinal, afterOrdinal: after.ordinal,
      beforeTargetPlans: before.node.origins.map(o => ({ target: o.target, plan: o.plan })),
      afterTargetPlans: after.node.origins.map(o => ({ target: o.target, plan: o.plan })),
      resources: before.entryState.player.resources,
      hand: before.entryState.player.hand.map(c => ({ id: c.id, cardId: c.cardId })),
      beforePrefix: bp, afterPrefix: ap,
      beforeDescendantOrdinals: descendants(bp), afterDescendantOrdinals: descendants(ap) });
  }
}
const union = key => [...new Set(pairs.flatMap(p => p[key]))];
const before = union('beforeDescendantOrdinals'), after = union('afterDescendantOrdinals');
const report = { source, sourceCommit: r.source, codeHead: r.codeHead, parity: r.parity,
  sourceRows: r.rows.length, exactPrefixPairs: pairs.length,
  descendantPhysicalNodes: { before: before.length, after: after.length,
    overlap: before.filter(n => after.includes(n)).length },
  search: { nodes: r.diagnostics.executedNodeCount, inputs: r.diagnostics.successfulInputSubmissionCount,
    beamPrunedOrigins: r.diagnostics.beamPrunedOriginCount, executionLimitReached: r.diagnostics.executionLimitReached },
  scope: '配对要求同玩家状态（仅去mainActionCompleted）及精确相同动作链，后者只多一个末尾end_turn。未比较完整盘面，不据此独立证明状态等价；后继计数为已记录链的物理节点并集，不是保证能节省的节点数。',
  pairs };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, pairs: pairs.length, descendants: report.descendantPhysicalNodes }));
