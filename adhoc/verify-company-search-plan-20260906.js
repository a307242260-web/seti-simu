"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/company-search-plan-prefix-553e19c6-20260906.json";
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const report = { scope: "复用已完成搜索，正式提交当前回合计划前缀；不代替未来回合依赖复核", steps: [] };
  const env = createSimulationEnv();
  try {
    const search = JSON.parse(fs.readFileSync("reports/iteration/company-free-move-search-605-553e19c6-20260906.json"));
    const cp = JSON.parse(fs.readFileSync("reports/iteration/card-trace-before-step-605-20260906.json"));
    delete cp.replaySteps;
    env.loadCheckpoint(cp);
    for (const actionId of [search.policyDecision.actionId, ...search.plan.steps.map(s => s.actionId)]) {
      const selected = env.legalActions().find(a => a.actionId === actionId);
      assert.ok(selected, `计划动作失效：${actionId}`);
      const result = env.step(selected);
      assert.equal(result.ok, true, JSON.stringify(result.failure));
      report.steps.push({ actionId, summary: selected.summary, family: selected.family, ok: true });
      if (selected.family === "end_turn") break;
    }
    assert.equal(report.steps.at(-1).family, "end_turn");
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
