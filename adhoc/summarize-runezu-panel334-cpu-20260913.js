"use strict";
const fs = require("node:fs"), crypto = require("node:crypto");
const source = "adhoc/runezu-panel334-f599b974-20260913.cpuprofile";
const output = "adhoc/runezu-panel334-cpu-summary-f599b974-20260913.json";
if (fs.existsSync(output)) { console.log(fs.readFileSync(output, "utf8")); process.exit(0); }
const bytes = fs.readFileSync(source), profile = JSON.parse(bytes);
const nodes = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map(), own = new Map(), inclusive = new Map();
for (const node of nodes.values()) for (const child of node.children || []) parents.set(child, node.id);
for (let i = 0; i < profile.samples.length; i++) {
  let id = profile.samples[i];
  const ms = profile.timeDeltas[i] / 1000;
  own.set(id, (own.get(id) || 0) + ms);
  for (; id !== undefined; id = parents.get(id)) inclusive.set(id, (inclusive.get(id) || 0) + ms);
}
const rows = [...nodes.values()].map(n => ({ id: n.id, function: n.callFrame.functionName,
  file: n.callFrame.url, line: n.callFrame.lineNumber + 1, selfMs: own.get(n.id) || 0,
  inclusiveMs: inclusive.get(n.id) || 0 }));
const report = { source, sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  durationMs: (profile.endTime - profile.startTime) / 1000,
  note: "V8统计采样估计，包含基准脚本在决策后额外一次赢家评分及落盘；inclusive有嵌套不可求和，不替代冷门槛时间",
  topSelf: [...rows].sort((a, b) => b.selfMs - a.selfMs).slice(0, 25),
  topProjectInclusive: rows.filter(r => r.file.includes("/randomizer/"))
    .sort((a, b) => b.inclusiveMs - a.inclusiveMs).slice(0, 35) };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(report, null, 2));
