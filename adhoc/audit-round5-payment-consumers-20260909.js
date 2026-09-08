// 只读历史第24步：区分独立支付节点和同节点内自动结算，不重跑搜索。
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = 'reports/iteration/step24-goal-trace-aaaed8d0-20260908.json';
const output = 'reports/iteration/round5-payment-consumers-20260909.json';
if (fs.existsSync(output)) { console.log('已有检查点：' + output); process.exit(0); }
const trace = JSON.parse(fs.readFileSync(source, 'utf8'));
assert.equal(trace.passed, true);
const groups = {};
for (const row of trace.rows) {
  if (!row.strategic) continue;
  for (const [index, action] of row.execution.inputs.entries()) {
    if (!['choose_payment', 'choose_card'].includes(action.family)) continue;
    const key = action.family + '/' + (action.target?.kind || '无kind');
    const group = groups[key] ||= { physicalInputs: 0, nodeRootInputs: 0, drainedInputs: 0, examples: [] };
    group.physicalInputs++;
    if (index === 0) {
      assert.equal(action.actionId, row.node.action.actionId);
      group.nodeRootInputs++;
    } else group.drainedInputs++;
    if (group.examples.length < 3) group.examples.push({ ordinal: row.ordinal, inputIndex: index,
      nodeAction: row.node.action.actionId, action, origins: row.node.origins });
  }
}
for (const g of Object.values(groups)) assert.equal(g.physicalInputs, g.nodeRootInputs + g.drainedInputs);
const report = { source, sourceCommit: 'aaaed8d0', step: 24,
  scope: '历史搜索已记录的实际提交位置；非当前dev计数，不推断未保存的选择器候选',
  groups, passed: true };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, {
  physicalInputs: g.physicalInputs, nodeRootInputs: g.nodeRootInputs, drainedInputs: g.drainedInputs,
} ])), null, 2));
