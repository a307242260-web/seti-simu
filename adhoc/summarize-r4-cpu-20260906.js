"use strict";
const fs = require("node:fs");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const source = "reports/iteration/search-budget-r4-20260906.cpuprofile.gz";
const output = "reports/iteration/search-budget-r4-cpu-summary-20260906.json";
if (fs.existsSync(output)) console.log(`已有分析：${output}`);
else {
  const bytes = fs.readFileSync(source);
  const profile = JSON.parse(zlib.gunzipSync(bytes));
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) for (const child of node.children || []) parents.set(child, node.id);
  const phases = new Map(), self = new Map();
  for (let index = 0; index < profile.samples.length; index++) {
    const id = profile.samples[index];
    const milliseconds = profile.timeDeltas[index] / 1000;
    const stack = [];
    for (let cursor = id; cursor != null; cursor = parents.get(cursor)) stack.push(nodes.get(cursor).callFrame);
    const has = (name) => stack.some((frame) => frame.functionName === name);
    const phase = has("evaluateCounterfactualOutcomes") ? "search"
      : has("projectOutcomeObservations") ? "outcome-projection"
        : has("createDecisionContext") ? "policy-context"
          : has("extractPlanSnapshot") ? "plan-extraction"
            : stack.some((frame) => frame.functionName === "decide" && frame.url.includes("heuristic-policy")) ? "policy-decide"
              : "other-including-startup-and-report";
    phases.set(phase, (phases.get(phase) || 0) + milliseconds);
    const frame = nodes.get(id).callFrame;
    const key = JSON.stringify([frame.functionName, frame.url, frame.lineNumber + 1]);
    const row = self.get(key) || { name: frame.functionName, file: frame.url, line: frame.lineNumber + 1, milliseconds: 0 };
    row.milliseconds += milliseconds;
    self.set(key, row);
  }
  const report = { source, sourceSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    scope: "同一次CPU采样按调用栈归类；采样时间不是精确墙钟分项，GC和启动/末尾诊断包含在other，不与阶段时间简单相减。",
    phaseMilliseconds: Object.fromEntries(phases),
    topSelf: [...self.values()].sort((left, right) => right.milliseconds - left.milliseconds).slice(0, 25) };
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
