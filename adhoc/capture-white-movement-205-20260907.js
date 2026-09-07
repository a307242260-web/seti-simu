"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/white-movement-205-20260907.json";
if (fs.existsSync(output)) console.log("已有白方盘面证据，不重放");
else {
  const env = createSimulationEnv(), report = { scope: "正式重放77d既有对局到白方免费移动选择，不运行AI", entries: [] };
  try {
    const record = JSON.parse(fs.readFileSync("reports/research/14114d45.77d36854.full.json"));
    report.source = record.savePath;
    const save = JSON.parse(fs.readFileSync(record.savePath));
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    for (let index = 41; index <= 204; index++) {
      if ([183, 204].includes(index)) {
        const checkpoint = env.createCheckpoint(); delete checkpoint.replaySteps;
        report.entries.push({ step: index + 1, checkpoint, legal: env.legalActions() });
      }
      if (index === 204) break;
      const expected = save.replaySteps[index], action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action, `正式输入${index + 1}一致`);
      const result = env.step(action); assert.equal(result.ok, true, JSON.stringify(result.error));
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.passed = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; report.passed = false; process.exitCode = 1; }
  finally { env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); }
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error,
    legal: report.entries.at(-1)?.legal.map(a => ({ id: a.actionId, summary: a.summary, target: a.target, payload: a.payload })) }));
}
