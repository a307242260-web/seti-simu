"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = process.argv[2] || "reports/iteration/alien-card-cancel-471-verification-20260907.json";
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const env = createSimulationEnv();
  const report = { scope: "真实471取消正式状态守恒、随后原根单决策搜索无失败；不重跑全盘" };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/before-choice-471-20260907.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    // 用正式envelope中的working root核对；完整投影冻结共享meta的独立缺陷另行记录。
    const before = fork.lifecycle.save().envelope.session.session.workingState;
    const decision = fork.inspect().session.decision;
    const cancel = decision.choices.find(c => c.target.source === "cancel");
    assert.ok(cancel);
    const result = fork.inputPort.submitDecision({ decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: cancel }, { skipProjection: true });
    report.cancelResult = result;
    assert.equal(result.ok, true, JSON.stringify(result.failure)); assert.equal(result.phase, "completed");
    const committed = fork.lifecycle.save().envelope.committedState;
    const after = typeof committed === "string" ? JSON.parse(committed) : committed;
    for (const key of ["players", "aliens", "cards", "data", "pieces"]) {
      assert.deepEqual(after[key], before[key], `${key}取消前后相同`);
    }
    assert.deepEqual(after.meta.rngState, before.meta.rngState);
    assert.deepEqual(after.meta.sequences, before.meta.sequences);
    assert.ok(!result.journal.events.some(event => event.type === "alien_card_gain"));
    assert.equal(result.irreversibleBarrier, null);
    report.cancelStatePreserved = true;
    const start = performance.now(), searched = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(searched.ok, true);
    report.diagnostics = env.getCounterfactualDiagnostics();
    assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
    assert.equal(report.diagnostics.executedNodeCount, 3);
    assert.equal(report.diagnostics.successfulInputSubmissionCount, 3);
    report.actionId = searched.policyDecision.actionId;
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  }
}
