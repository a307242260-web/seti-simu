// 从既有4096节点trace统计确切的多余准备前缀及其后继，不执行新搜索。
const fs = require('node:fs'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const output = 'reports/iteration/data-preparation-descendants-20260908.json';
if (fs.existsSync(output)) { console.log('已有统计：' + output); process.exit(0); }
const source = 'reports/iteration/step24-entry-states-1501ebfd-20260908.json.gz';
const trace = JSON.parse(zlib.gunzipSync(fs.readFileSync(source)));
assert.equal(trace.passed, true);
const rows = trace.rows.filter(r => r.strategic), scans = rows.filter(r => r.node.action.family === 'scan');
const scansByChain = new Map();
for (const row of scans) for (const origin of row.node.origins) {
  const key = JSON.stringify(origin.chain);
  if (!scansByChain.has(key)) scansByChain.set(key, new Set());
  scansByChain.get(key).add(row.ordinal);
}
const matches = new Map();
for (const row of scans) for (const origin of row.node.origins) {
  const chain = origin.chain;
  if (origin.target !== 'data:analyze' || chain.length < 2
    || !chain.at(-2).startsWith('card_corner:') || !chain.at(-1).startsWith('place_data:')) continue;
  const direct = scansByChain.get(JSON.stringify(chain.slice(0, -2)));
  if (!direct?.size) continue;
  const prefix = [...chain, row.node.action.actionId], key = JSON.stringify(prefix);
  if (matches.has(key)) continue;
  const hasPrefix = o => prefix.every((id, i) => o.chain[i] === id);
  const descendants = rows.filter(r => r.node.origins.some(hasPrefix));
  matches.set(key, { scanOrdinal: row.ordinal, directScanOrdinals: [...direct], prefix,
    descendantOrdinals: descendants.map(r => r.ordinal),
    exclusiveDescendantOrdinals: descendants.filter(r => r.node.origins.every(hasPrefix)).map(r => r.ordinal),
    descendantFamilies: descendants.reduce((a, r) => { a[r.node.action.family] = (a[r.node.action.family] || 0) + 1; return a; }, {}) });
}
const report = { source, physicalNodes: rows.length, scans: scans.length, pairs: [...matches.values()],
  scope: '只匹配紧邻扫描前的card_corner/place_data二步，与相同其余前缀的直接扫描配对；不是所有准备重复的全量上界',
  caveats: ['后继数量包括未必全部可删除的扫描奖励分支与后续目标，不能直接宣称实际可节省数量',
    '同一物理节点的多个目标来源去重后计数；不同物理节点不会因摘要相似合并',
    '需要在具体扫描收益足够且前置奖励非必要时才能收敛该来源，当前未修改搜索'] };
assert.equal(rows.length, 4096); assert.equal(report.pairs.length, 1);
assert.equal(report.pairs[0].scanOrdinal, 9); assert.deepEqual(report.pairs[0].directScanOrdinals, [7]);
assert.equal(report.pairs[0].descendantOrdinals.length, 54);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, physicalNodes: rows.length, pairs: report.pairs.map(p => ({ scan: p.scanOrdinal,
  direct: p.directScanOrdinals, descendants: p.descendantOrdinals.length, exclusive: p.exclusiveDescendantOrdinals.length })) }));
