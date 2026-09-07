"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), util = require("node:util");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/brown-roots-from-start-20260907.json";
function differences(a, b, path = "") {
  if (util.isDeepStrictEqual(a, b)) return [];
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return [{ path, previous: a, replayed: b }];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => differences(a[k], b[k], `${path}.${k}`));
}
if (fs.existsSync(output)) console.log("已有开局重放证据");
else {
  const rows = [];
  for (const row of JSON.parse(fs.readFileSync("reports/iteration/brown-income-roots-20260907.json")).rows) {
    const env = createSimulationEnv();
    try {
      env.reset(row.checkpoint.config);
      const record = JSON.parse(fs.readFileSync(`reports/research/${row.recordId}.full.json`));
      const save = JSON.parse(fs.readFileSync(record.savePath));
      for (let i = 0; i < row.step - 1; i++) {
        const expected = save.replaySteps[i], action = env.legalActions().find(a => a.actionId === expected.action.actionId);
        assert.deepEqual(action, expected.action, `第${i + 1}步输入`);
        const result = env.step(action); assert.equal(result.ok, true, JSON.stringify(result.error));
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after, `第${i + 1}步摘要`);
      }
      const checkpoint = env.createCheckpoint(); delete checkpoint.replaySteps;
      rows.push({ step: row.step, recordId: row.recordId, checkpoint,
        stateDifferences: differences(JSON.parse(row.checkpoint.coreState.committedState), JSON.parse(checkpoint.coreState.committedState)),
        sessionDifferences: differences(row.checkpoint.coreState.compositionEnvelope.session, checkpoint.coreState.compositionEnvelope.session) });
    } finally { env.dispose(); }
  }
  fs.writeFileSync(output, JSON.stringify({ scope: "从开局正式重放全部输入及摘要，不运行AI，比较中间checkpoint来源", rows }, null, 2) + "\n");
  console.log(JSON.stringify(rows.map(({ checkpoint, ...row }) => row)));
}
