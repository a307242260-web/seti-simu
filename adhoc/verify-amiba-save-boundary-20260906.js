"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/amiba-save-boundary-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = { scope: "真实绿210橙区奖励链：可信引用保存与独立保存后的继续提交", cases: [] };
  const env = createSimulationEnv();
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/round-income-green-before-search-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const example = JSON.parse(fs.readFileSync("reports/iteration/amiba-choice-profile-210-20260906.json")).examples[1];
    for (const actionId of example.actionChain) {
      const action = env.legalActions().find(a => a.actionId === actionId);
      assert.ok(action, actionId); assert.equal(env.step(action).ok, true);
    }
    for (const trustedFork of [true, false]) {
      const fork = env.createCounterfactualFork(null, { branchKey: "amiba-save-proof" });
      try {
        const c = fork.composition;
        const saved = c.lifecycle.save({ trustedFork }); assert.equal(saved.ok, true);
        const decision = c.inspect().session.decision;
        assert.equal(decision.choices.length, 1);
        let result;
        try { result = c.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: decision.choices[0] }); }
        catch (error) { result = { ok: false, message: error.message }; }
        report.cases.push({ trustedFork, choice: decision.choices[0], result });
      } finally { fork.composition.dispose(); }
    }
    assert.equal(report.cases[0].result.ok, false);
    assert.equal(report.cases[1].result.ok, true);
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, cases: report.cases.map(c => ({ trustedFork: c.trustedFork, ok: c.result.ok, message: c.result.message })), error: report.error }, null, 2)); }
}
