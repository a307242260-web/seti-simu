"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const output = "reports/iteration/probe-source-full-comparison-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重算：${output}`);
else {
  const names = ["22cf8cea.cf4280fd.full.json", "c9b29e5a.d969b727.full.json"];
  const sources = names.map((name) => {
    const record = JSON.parse(fs.readFileSync(`reports/research/${name}`));
    const raw = fs.readFileSync(record.savePath);
    const save = JSON.parse(raw);
    const final = JSON.parse(save.committedState).match.finalScores;
    assert.equal(record.terminal, true);
    assert.equal(final.reduce((sum, row) => sum + row.totalScore, 0) / 4, record.summary.avgScore);
    return { record: name, savePath: record.savePath,
      sha256: crypto.createHash("sha256").update(raw).digest("hex"), final, steps: save.replaySteps };
  });
  let prefix = 0;
  while (prefix < Math.min(...sources.map((source) => source.steps.length))) {
    const [a, b] = sources.map((source) => source.steps[prefix]);
    if (a.action.actionId !== b.action.actionId || JSON.stringify(a.after) !== JSON.stringify(b.after)) break;
    prefix += 1;
  }
  const quick = JSON.parse(fs.readFileSync("seti-saves/seti-save-research-probe-source-r3p1-20260906-d969b727-quick-200-v99.json"));
  assert.deepEqual(sources[1].steps.slice(0, 200), quick.replaySteps);
  const report = { createdAt: new Date().toISOString(),
    scope: "只读已有完整存档及快速存档；前缀差异是定位线索，不是因果证明。",
    identicalPrefix: prefix, quickPrefixEqual: true,
    firstDivergence: sources.map((source) => source.steps[prefix]),
    sources: sources.map(({ steps, ...source }) => ({ ...source, steps: steps.length })) };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, prefix, firstDivergence: report.firstDivergence.map((step) => step.action) }, null, 2));
}
