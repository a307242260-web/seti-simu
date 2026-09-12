"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const sources = [
  "/tmp/seti-public-card-greedy-20260913.87etUF/seti-saves/seti-save-research-public-card-trade-greedy-20260913-a5e6170c-full-v300.json",
  "seti-saves/seti-save-research-public-card-runezu-greedy-20260913-3544e2df-full-v300.json",
];
const saves = sources.map(file => JSON.parse(fs.readFileSync(file)));
assert.equal(saves[0].replaySteps.length, saves[1].replaySteps.length);
const differences = [];
for (let i = 0; i < saves[0].replaySteps.length; i += 1) {
  for (const field of ["action", "after"]) {
    if (JSON.stringify(saves[0].replaySteps[i][field]) !== JSON.stringify(saves[1].replaySteps[i][field])) {
      differences.push({ step: i + 1, field });
    }
  }
}
const result = { sources: sources.map(file => ({ file,
  sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") })),
  steps: saves[1].replaySteps.length, differences,
  scope: "逐步完整action/after比较，不比较反事实节点，不运行AI或规则重放。" };
const output = "adhoc/public-card-rules-trajectory-comparison-20260913.json";
const text = JSON.stringify(result, null, 2) + "\n";
if (fs.existsSync(output)) assert.equal(fs.readFileSync(output, "utf8"), text);
else fs.writeFileSync(output, text, { flag: "wx" });
console.log(text);
