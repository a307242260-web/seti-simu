"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const output = "reports/iteration/sector-directory-full-comparison-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const paths = [
    "seti-saves/seti-save-research-tile-dependency-r3t1-20260906-5ebc336e-full-v307.json",
    "seti-saves/seti-save-research-sector-directory-s2-20260906-904acf13-full-v307.json",
  ];
  const raw = paths.map((path) => fs.readFileSync(path));
  const saves = raw.map((value) => JSON.parse(value));
  const finals = saves.map((save) => JSON.parse(save.committedState).match.finalScores);
  const differences = [];
  for (let index = 0; index < Math.max(...saves.map((save) => save.replaySteps.length)); index += 1) {
    const [a, b] = saves.map((save) => save.replaySteps[index]);
    if (a?.action?.actionId !== b?.action?.actionId || JSON.stringify(a?.after) !== JSON.stringify(b?.after)) {
      differences.push({ index, before: a, after: b });
    }
  }
  const report = { createdAt: new Date().toISOString(), scope: "只读完整存档动作与状态摘要、正式终局明细，不运行搜索",
    sources: paths.map((path, i) => ({ path, sha256: crypto.createHash("sha256").update(raw[i]).digest("hex"), steps: saves[i].replaySteps.length })),
    differences, finals, formalScoresEqual: JSON.stringify(finals[0]) === JSON.stringify(finals[1]) };
  fs.writeFileSync(output, JSON.stringify(report));
  assert.equal(differences.length, 0);
  assert.deepEqual(finals[0], finals[1]);
  console.log(JSON.stringify({ output, steps: report.sources.map((s) => s.steps), differences: differences.length, finals: finals[1] }));
}
