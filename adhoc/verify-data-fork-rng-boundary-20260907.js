"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/data-fork-rng-boundary-20260907.json";
if (fs.existsSync(output)) console.log(`已有记录：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "复用旧棕52完整正式输入，核对新建fork首次写回RNG；不运行AI、不恢复P2补丁", inputs: [], rows: [], passed: false };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/node-types-before-step-52-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const evidence = JSON.parse(fs.readFileSync("reports/iteration/data-choice-routes-52-20260906-verified.json"));
    const chain = evidence.groups.find(g => g.key === evidence.divergentGroups[0]).selections[0].chain;
    function submit(action) {
      assert.ok(action); assert.equal(env.step(action).ok, true); report.inputs.push(action);
    }
    for (const id of chain) submit(env.legalActions().find(a => a.actionId === id));
    const first = env.legalActions().find(a => a.target?.target === "computer");
    assert.equal(first.summary, "第一排放置位 1"); submit(first);
    submit(env.legalActions().find(a => a.family === "place_data"));
    const choices = env.legalActions();
    const initial = env.createCheckpoint();
    function seedHash(text) {
      let hash = 2166136261;
      for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
      return hash >>> 0 || 1;
    }
    const expectedSeed = seedHash(`${cp.config.seed}:composition-fork:root`);
    report.expectedBranchSeed = expectedSeed;
    for (const choice of choices) {
      const outcomes = [];
      for (let repeat = 0; repeat < 2; repeat += 1) {
        const fork = env.createCounterfactualFork();
        try {
          const c = fork.composition, before = c.lifecycle.save().envelope;
          const d = c.inspect().session.decision;
          const formal = d.choices.find(a => a.actionId === choice.actionId); assert.ok(formal);
          const result = c.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
            ownerId: d.ownerId, choice: formal });
          assert.equal(result.ok, true);
          const after = c.lifecycle.save().envelope;
          const rngBefore = JSON.parse(before.committedState).meta.rngState;
          const rngAfter = JSON.parse(after.committedState).meta.rngState;
          assert.equal(rngAfter.state, expectedSeed, "首次提交只写回未消耗的fork种子，不是从主局RNG继续");
          outcomes.push(after);
          if (!repeat) report.rows.push({ action: formal, rngBefore, rngAfter,
            phaseAfter: c.inspect().phase, decisionAfter: c.inspect().session?.decision?.kind || null });
        } finally { fork.composition.dispose(); }
      }
      assert.deepEqual(outcomes[0], outcomes[1], "同envelope与分支身份的完整正式提交可复现");
    }
    assert.deepEqual(env.createCheckpoint(), initial, "fork未污染根状态/RNG");
    report.passed = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { env.dispose(); }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, expectedSeed: report.expectedBranchSeed,
    rows: report.rows, error: report.error }, null, 2));
}
