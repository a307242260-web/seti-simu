// 从已有节点日志确认扫描结算边界及可收敛的后续规模；不把来源数当物理节点数。
const fs = require('node:fs'), z = require('node:zlib'), assert = require('node:assert/strict');
const output = 'reports/iteration/data-scan-boundaries-20260908.json';
if (fs.existsSync(output)) { console.log('已有扫描边界：' + output); process.exit(0); }
const source = 'reports/iteration/step24-entry-states-1501ebfd-20260908.json.gz';
const trace = JSON.parse(z.gunzipSync(fs.readFileSync(source)));
assert.equal(trace.passed, true);
const rows = trace.rows.filter(r => r.strategic);
const pair = JSON.parse(fs.readFileSync('reports/iteration/data-preparation-descendants-20260908.json')).pairs[0];
const starts = (chain, prefix) => prefix.every((id, i) => chain[i] === id);
const scan = rows.find(r => r.ordinal === pair.scanOrdinal);
const direct = rows.find(r => r.ordinal === pair.directScanOrdinals[0]);
const prefix = pair.prefix;
const directPrefix = [...direct.node.origins[0].chain, direct.node.action.actionId];
function boundaries(prefix) {
  return rows.filter(row => row.node.action.phase !== 'conditional' && row.node.origins.some(o =>
    starts(o.chain, prefix) && o.chain.slice(prefix.length).every(id => /^(choose_|accept_optional)/.test(id))))
    .map(row => ({ ordinal: row.ordinal, action: row.node.action,
      resources: row.entryState.player.resources, dataState: row.entryState.player.dataState,
      scanInputs: row.node.origins.filter(o => starts(o.chain, prefix)).map(o => o.chain.slice(prefix.length)) }));
}
const extraBoundaries = boundaries(prefix), directBoundaries = boundaries(directPrefix);
assert.equal(extraBoundaries.length, 1);
const extra = extraBoundaries[0];
// 一个已结算状态可排入填数据和交易等不同后继；不能将后继节点数当状态数。
const matches = directBoundaries.filter(b => b.action.actionId === extra.action.actionId);
assert.equal(matches.length, 1);
const normal = matches[0];
assert.equal(extra.resources.availableData, 2); assert.equal(normal.resources.availableData, 2);
assert.equal(extra.dataState.placedTokens.length, 5); assert.equal(normal.dataState.placedTokens.length, 4);
assert.deepEqual(extra.scanInputs[0], normal.scanInputs[0]);
const closedPrefix = [...prefix, ...extra.scanInputs[0]];
const descendants = rows.filter(row => row.node.origins.some(o => starts(o.chain, closedPrefix)));
const report = { source, extraScanOrdinal: scan.ordinal, directScanOrdinal: direct.ordinal,
  extraBoundaries, directBoundaries,
  originalGap: 6 - direct.entryState.player.dataState.placedTokens.length - direct.entryState.player.resources.availableData,
  scanDataGain: extra.resources.availableData - scan.entryState.player.resources.availableData,
  postScanNodes: descendants.map(r => r.ordinal),
  exclusivePostScanNodes: descendants.filter(row => row.node.origins.every(o => starts(o.chain, closedPrefix))).map(r => r.ordinal),
  scope: '仅这份4096节点日志的已执行分支；扫描结算后才确认2数据。剪掉此前准备属于用户指定的需求式取舍，不是全状态等价；本记录不声称已实施或已节省这些节点。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, originalGap: report.originalGap, scanDataGain: report.scanDataGain,
  extraBoundary: extra.ordinal, directBoundary: normal.ordinal, postScanNodes: descendants.length,
  exclusive: report.exclusivePostScanNodes.length }));
