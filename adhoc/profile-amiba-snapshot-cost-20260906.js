"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/amiba-snapshot-cost-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = { scope: "真实橙区唯一奖励，100对独立保存与可信保存恢复的交错测量；不含搜索或branchKey哈希", samples: [] };
  const env = createSimulationEnv();
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/round-income-green-before-search-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const example = JSON.parse(fs.readFileSync("reports/iteration/amiba-choice-profile-210-20260906.json")).examples[1];
    for (const actionId of example.actionChain) {
      const action = env.legalActions().find(a => a.actionId === actionId);
      assert.ok(action); assert.equal(env.step(action).ok, true);
    }
    for (let pair = 0; pair < 100; pair++) {
      const finals = [];
      for (const mode of pair % 2 ? ["owned", "restore"] : ["restore", "owned"]) {
        const fork = env.createCounterfactualFork(null, { branchKey: "snapshot-cost" });
        try {
          const c = fork.composition, t0 = performance.now();
          const saved = c.lifecycle.save({ trustedFork: mode === "restore" });
          assert.equal(saved.ok, true);
          const t1 = performance.now();
          fork.resetBranch(`snapshot-cost:${pair}`);
          if (mode === "restore") assert.equal(c.lifecycle.restore(saved.envelope,
            { trustedFork: true, inPlace: true, silent: true, skipProjection: true }).ok, true);
          const t2 = performance.now(), d = c.inspect().session.decision;
          assert.equal(d.choices.length, 1);
          assert.equal(c.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
            ownerId: d.ownerId, choice: d.choices[0] }, { skipProjection: true }).ok, true);
          const t3 = performance.now();
          report.samples.push({ pair, mode, saveMs: t1 - t0, restoreMs: t2 - t1, inputMs: t3 - t2, totalMs: t3 - t0 });
          finals.push(c.lifecycle.save().envelope);
        } finally { fork.composition.dispose(); }
      }
      assert.deepEqual(finals[0], finals[1]);
    }
    report.summary = Object.fromEntries(["owned", "restore"].map(mode => {
      const rows = report.samples.filter(s => s.mode === mode);
      return [mode, Object.fromEntries(["saveMs", "restoreMs", "inputMs", "totalMs"].map(k => [k, rows.reduce((n, r) => n + r[k], 0) / rows.length]))];
    }));
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, summary: report.summary, error: report.error }, null, 2)); }
}
