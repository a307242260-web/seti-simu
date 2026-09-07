"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const baselinePath = process.argv[2], currentPath = process.argv[3], output = process.argv[4];
assert.ok(baselinePath && currentPath && output, "需要基线、当前证据和输出路径");
if (fs.existsSync(output)) console.log(`已有对照：${output}`);
else {
  const read = path => JSON.parse(fs.readFileSync(path));
  const baseline = read(baselinePath), current = read(currentPath);
  const excluded = ["totalMilliseconds", "identityMilliseconds", "forkMilliseconds", "executionMilliseconds",
    "projectionMilliseconds", "checkpointMilliseconds", "frontierMilliseconds", "orchestrationMilliseconds",
    "executedNodeCountByDecisionKind", "executedOriginCountByTargetAndDecisionKind"];
  const trim = diagnostics => Object.fromEntries(Object.entries(diagnostics).filter(([key]) => !excluded.includes(key)));
  const counts = current.diagnostics.executedNodeCountByDecisionKind;
  const report = { baselinePath, currentPath, excluded, counts, verified: false };
  try {
    assert.deepEqual(current.plan, baseline.plan);
    assert.deepEqual(current.steps, baseline.steps);
    assert.equal(current.actionId, baseline.actionId);
    assert.deepEqual(trim(current.diagnostics), trim(baseline.diagnostics));
    assert.deepEqual(current.diagnostics.failedNodeCountByCode, {});
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), current.diagnostics.executedNodeCount);
    assert.ok(Object.keys(counts).every(key => !/undefined|<none>/.test(key)));
    assert.ok(counts["choose_target:conditional/decision=choose_target/effect=residual_company_decision/step=free_move/ability=huanyu_free_moves"] > 0);
    report.verified = true;
  } catch (error) {
    report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
