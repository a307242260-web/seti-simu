"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const output = "reports/iteration/r3-first-divergence-20260906.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重复分析：${output}`);
} else {
  const paths = [
    "seti-saves/seti-save-research-blue-future-r2e-20260905-20feca27-full-v313.json",
    "seti-saves/seti-save-research-plan-steps-r3-20260906-d7a78140-full-v299.json",
  ];
  const sources = paths.map((path) => {
    const raw = fs.readFileSync(path);
    return { path, sha256: crypto.createHash("sha256").update(raw).digest("hex"),
      steps: JSON.parse(raw).replaySteps };
  });
  const [baseline, candidate] = sources;
  let index = 0;
  while (index < Math.min(baseline.steps.length, candidate.steps.length)
    && baseline.steps[index].action.actionId === candidate.steps[index].action.actionId
    && JSON.stringify(baseline.steps[index].after) === JSON.stringify(candidate.steps[index].after)) index += 1;
  const report = { createdAt: new Date().toISOString(),
    scope: "对照已有完整存档动作与after摘要，不重跑搜索；不是全状态因果证明",
    identicalPrefixSteps: index,
    sources: sources.map(({ path, sha256, steps }) => ({ path, sha256, count: steps.length })),
    baseline: baseline.steps.slice(Math.max(0, index - 1), index + 1),
    candidate: candidate.steps.slice(Math.max(0, index - 1), index + 1),
  };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(output);
}
