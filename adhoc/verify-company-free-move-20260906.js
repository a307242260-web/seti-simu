"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/company-free-move-contract-20260906.json";
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "真实605全部公司选择及pending恢复；无AI搜索", choices: [] };
  const clean = cp => { delete cp.replaySteps; return cp; };
  try {
    env.loadCheckpoint(clean(JSON.parse(fs.readFileSync("reports/iteration/card-trace-before-step-605-20260906.json"))));
    assert.equal(env.step(env.legalActions().find(a => a.family === "industry")).ok, true);
    const pending = clean(env.createCheckpoint()), choices = env.legalActions();
    assert.equal(choices.filter(a => !a.target.skip).length, 4);
    for (const selected of choices) {
      env.loadCheckpoint(pending);
      const before = env.createCheckpoint();
      const result = env.step(selected);
      assert.equal(result.ok, true, JSON.stringify(result.failure));
      const after = clean(env.createCheckpoint()), next = env.legalActions();
      assert.ok(!next.some(a => a.target?.kind === "residual-domain" && a.target?.choiceId?.startsWith("move:")));
      env.loadCheckpoint(clean(before));
      assert.equal(env.step(selected).ok, true);
      assert.deepEqual(clean(env.createCheckpoint()), after);
      assert.deepEqual(env.legalActions(), next);
      report.choices.push({ selected, ok: true, restoreParity: true, nextFamilies: [...new Set(next.map(a => a.family))] });
    }
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
