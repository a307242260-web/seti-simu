"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const checkpointPath = "reports/iteration/executor-root-610-20260907.json";
const output = "reports/iteration/executor-failure-610-646858ac-20260907.json";
if (fs.existsSync(output)) console.log("已有610冷搜索诊断，不重跑");
else {
  const env = createSimulationEnv();
  try {
    if (!fs.existsSync(checkpointPath)) {
      const record = JSON.parse(fs.readFileSync("reports/research/78020346.646858ac.full.json"));
      const save = JSON.parse(fs.readFileSync(record.savePath));
      const { checkpoint } = JSON.parse(fs.readFileSync("reports/iteration/alien-trace-root-318-20260907.json"));
      env.reset(checkpoint.config);
      for (let i = 0; i < 609; i++) {
        const step = save.replaySteps[i];
        const action = env.legalActions().find(a => a.actionId === step.action.actionId);
        assert.deepEqual(action, step.action, `第${i + 1}步动作一致`);
        assert.equal(env.step(action).ok, true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, step.after);
      }
      fs.writeFileSync(checkpointPath, JSON.stringify({ source: record.gitCommit, step: 610, checkpoint: env.createCheckpoint() }) + "\n");
    }
    const { checkpoint } = JSON.parse(fs.readFileSync(checkpointPath));
    env.loadCheckpoint(checkpoint);
    const before = env.createCheckpoint().coreState;
    const started = performance.now(), result = env.runHeuristicPolicyDecision(), wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    const diagnostics = env.getCounterfactualDiagnostics();
    // 先落原始结果，再汇总；未评估outcome可不携带reasonCodes。
    fs.writeFileSync(output, JSON.stringify({ source: "646858ac", wallMs, diagnostics,
      outcomeMetadata: result.actionOutcomes.map(({ leaves, rootObservation, ...metadata }) => metadata) }, null, 2) + "\n");
    const failures = result.actionOutcomes.filter(o => o.reasonCodes?.includes("counterfactual-branch-failed"))
      .map(o => ({ actionId: o.actionId, code: o.code, message: o.message, reasonCodes: o.reasonCodes }));
    fs.writeFileSync(output, JSON.stringify({ source: "646858ac", scope: "609正式输入恢复后，610独立冷搜索一次", wallMs,
      diagnostics, failures, selected: result.policyDecision }, null, 2) + "\n");
    assert.deepEqual(env.createCheckpoint().coreState, before);
    console.log(JSON.stringify({ wallMs, failed: diagnostics.failedNodeCountByCode, failures }));
  } finally { env.dispose(); }
}
