"use strict";
const fs = require("node:fs");
const source = "reports/iteration/movement-decision-42-20260906.cpuprofile";
const output = "reports/iteration/observation-cost-42-20260907.json";
if (fs.existsSync(output)) console.log(`已有统计，跳过：${output}`);
else {
  const p = JSON.parse(fs.readFileSync(source)), nodes = new Map(p.nodes.map(n=>[n.id,n]));
  const parent = new Map(), inclusiveMs = {};
  for(const n of p.nodes) for(const c of n.children||[]) parent.set(c,n.id);
  for(let i=0;i<p.samples.length;i++) {
    const names = new Set();
    for(let id=p.samples[i];id;id=parent.get(id)) names.add(nodes.get(id).callFrame.functionName);
    for(const name of ["projectionInner","fullLeafObservation","captureStep","inspect"])
      if(names.has(name)) inclusiveMs[name]=(inclusiveMs[name]||0)+p.timeDeltas[i]/1000;
  }
  const report = { source, scope: "旧42原生CPU证据复算；每样本同名递归只计一次，inclusive不可相加，不是可节省时间或当前版本新计时", inclusiveMs };
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify(report));
}
