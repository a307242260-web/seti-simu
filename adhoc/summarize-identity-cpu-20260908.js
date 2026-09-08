// 汇总采样时间（并非确定性函数计时），不运行搜索。
const fs = require('node:fs'), assert = require('node:assert/strict');
const output = 'reports/iteration/identity-cpu-summary-20260908.json';
if (fs.existsSync(output)) { console.log('已有CPU汇总：' + output); process.exit(0); }
const variants = ['candidate', 'identity'].map(policy => {
  const file = `reports/iteration/identity-cpu-${policy}-20260908.json`;
  const r = JSON.parse(fs.readFileSync(file)); assert.equal(r.passed, true);
  const p = r.profile, nodes = new Map(p.nodes.map(n => [n.id, n])), parents = new Map();
  for (const n of p.nodes) for (const c of n.children || []) parents.set(c, n.id);
  const sampledMicroseconds = { total: 0, normalizationInclusive: 0, structuredCloneSelf: 0, garbageCollectionSelf: 0 };
  for (let i = 0; i < p.samples.length; i++) {
    let n = nodes.get(p.samples[i]); const us = p.timeDeltas[i]; sampledMicroseconds.total += us;
    if (n.callFrame.functionName === 'structuredClone') sampledMicroseconds.structuredCloneSelf += us;
    if (n.callFrame.functionName === '(garbage collector)') sampledMicroseconds.garbageCollectionSelf += us;
    while (n) {
      if (n.callFrame.functionName === 'sampledForkEnvelope') { sampledMicroseconds.normalizationInclusive += us; break; }
      n = nodes.get(parents.get(n.id));
    }
  }
  return { policy, file: file + '.gz', commit: r.commit, sampledMicroseconds, action: r.action,
    measuredPhases: Object.fromEntries(Object.entries(r.diagnostics).filter(([k]) => k.endsWith('Milliseconds'))),
    topSelf: r.selfCpuMicroseconds.slice(0, 12) };
});
const report = { scope: '同一绿方第101步根，两版均4096节点且动作与已有交叉记录一致；CPU采样只用于热点定位',
  caveats: ['含决策后估值与正式提交开销，不等于搜索totalMilliseconds',
    '规范化是包含子调用的采样时间，复制和GC是自身时间，不能直接相加；采样抖动及搜索分支不同不能排除',
    '不能将该单点比例外推659435ms完整局，完整局同时增加了搜索次数和物理节点'], variants };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, variants: variants.map(v => ({ policy: v.policy, sampledMicroseconds: v.sampledMicroseconds })) }));
