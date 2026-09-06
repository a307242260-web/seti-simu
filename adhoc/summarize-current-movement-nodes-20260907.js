"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const source = "reports/research/7f66d3e1.c555bc33.full.json";
const output = "reports/iteration/current-movement-nodes-20260907.json";
if (fs.existsSync(output)) console.log(`已有统计：${output}`);
else {
  const bytes = fs.readFileSync(source), record = JSON.parse(bytes);
  assert.equal(record.terminal, true);
  function summarize(searches) {
    const families = {}, freeMoveChoices = {};
    let nodes = 0, failures = 0;
    for (const search of searches) {
      const d = search.diagnostics;
      nodes += d.executedNodeCount;
      for (const [code, n] of Object.entries(d.failedNodeCountByCode)) failures += n;
      for (const [family, n] of Object.entries(d.attemptedNodeCountByFamily)) families[family] = (families[family] || 0) + n;
      for (const [label, n] of Object.entries(d.executedNodeCountByActionSummary)) {
        // 精确对应residual-domain-session free_move的两个文案模板；不等于寰宇专属。
        if (label === "choose_target:结束移动" || /^choose_target:移动 \d+ (向内|向外|顺时针|逆时针)$/.test(label)) {
          freeMoveChoices[label] = (freeMoveChoices[label] || 0) + n;
        }
      }
    }
    assert.equal(Object.values(families).reduce((a,b)=>a+b,0), nodes);
    const freeMoveNodes = Object.values(freeMoveChoices).reduce((a,b)=>a+b,0);
    return { searches: searches.length, nodes, failures, families, freeMoveChoices, freeMoveNodes,
      freeMovePercent: 100 * freeMoveNodes / nodes,
      chooseTargetPercent: 100 * (families.choose_target || 0) / nodes };
  }
  const full = record.metrics.searches.filter(s=>s.kind === "strategic" && s.diagnostics.executedNodeCount === 4096);
  const report = { source, sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    scope: "当前固定局物理节点统计；free_move由正式文案模板辨认，含其他公司及残余移动来源，非寰宇专属，不把origin引用计为物理节点",
    all: summarize(record.metrics.searches), full: summarize(full),
    hotspots: full.map(s=>({step:s.step,seat:s.seat,...summarize([s])})).sort((a,b)=>b.freeMoveNodes-a.freeMoveNodes),
    limits: ["旧记录缺少每节点effect/ability来源，无法从摘要把free_move准确再拆到具体公司/卡牌", "未分类none仍保留，没有改生产分类或清除异常", "只读统计，不运行AI、不证明分支可删除"], verified: true };
  fs.writeFileSync(output, JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,all: {nodes:report.all.nodes,freeMoveNodes:report.all.freeMoveNodes,freeMovePercent:report.all.freeMovePercent},
    full:{nodes:report.full.nodes,freeMoveNodes:report.full.freeMoveNodes,freeMovePercent:report.full.freeMovePercent},
    hotspots:report.hotspots.slice(0,6).map(s=>({step:s.step,seat:s.seat,nodes:s.freeMoveNodes,percent:s.freeMovePercent}))},null,2));
}
