"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const source = "reports/iteration/movement-decision-42-20260906.cpuprofile";
const output = "reports/iteration/movement-cpu-summary-42-20260906.json";
if (fs.existsSync(output)) console.log(`已有汇总，跳过：${output}`);
else {
  const profile = JSON.parse(fs.readFileSync(source));
  assert.equal(profile.samples.length, profile.timeDeltas.length);
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map(), rows = new Map();
  for (const node of profile.nodes) for (const child of node.children || []) parents.set(child, node.id);
  const frameKey = node => JSON.stringify([node.callFrame.url, node.callFrame.functionName, node.callFrame.lineNumber]);
  let totalMs = 0;
  for (const [index, id] of profile.samples.entries()) {
    const ms = profile.timeDeltas[index] / 1000;
    totalMs += ms;
    let current = id;
    const seen = new Set();
    while (current != null) {
      const node = nodes.get(current), key = frameKey(node);
      if (!rows.has(key)) rows.set(key, { functionName: node.callFrame.functionName,
        url: node.callFrame.url, line: node.callFrame.lineNumber + 1, selfMs: 0, inclusiveMs: 0 });
      const row = rows.get(key);
      if (current === id) row.selfMs += ms;
      if (!seen.has(key)) row.inclusiveMs += ms;
      seen.add(key); current = parents.get(current);
    }
  }
  const all = [...rows.values()];
  const report = { source, scope: "单次冷决策CPU采样；self可加，inclusive含子调用不可相加；含启动和结果写盘，不是各节点耗时占比",
    totalMs, self: [...all].sort((a,b) => b.selfMs-a.selfMs).slice(0,30),
    inclusive: all.filter(r => r.url.includes("/randomizer/")).sort((a,b) => b.inclusiveMs-a.inclusiveMs).slice(0,35) };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, totalMs, self: report.self.slice(0,12), inclusive: report.inclusive.slice(0,12) }, null, 2));
}
