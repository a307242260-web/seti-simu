"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const step = Number(process.argv[2]);
assert.ok([24, 42, 49, 52].includes(step), "仅取四席首个已记录的高节点边界");
const output = `reports/iteration/node-types-baseline-step-${step}-20260906.json`;
const read = file => JSON.parse(fs.readFileSync(file));
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const record = read("reports/research/2848eba2.213f34db.full.json");
  const save = read(record.savePath), env = createSimulationEnv();
  const report = { scope: "从已有存档正式重放至单个高节点决策，冷计划采集；不是新全盘实验或历史缓存日志",
    step, source: record.savePath, sourceCommit: record.gitCommit,
    auditedHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
  try {
    execFileSync("git", ["diff", "--exit-code", record.gitCommit, "--", "randomizer", "assets", "tools"]);
    const initial = read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
    delete initial.replaySteps;
    env.loadCheckpoint(initial);
    for (let index = 23; index < step - 1; index += 1) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.checkpointPath = `reports/iteration/node-types-before-step-${step}-20260906.json`;
    const checkpoint = env.createCheckpoint();
    fs.writeFileSync(report.checkpointPath, JSON.stringify(checkpoint));
    report.inputHash = hash(checkpoint.coreState);
    report.expectedAction = save.replaySteps[step - 1].action;
    const start = performance.now();
    const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(result.ok, true);
    report.chosen = result.policyDecision.actionId;
    report.matchesRecordedAction = report.chosen === report.expectedAction.actionId;
    report.plan = result.plan;
    report.policyDecision = result.policyDecision;
    report.outcomes = result.actionOutcomes.map(({ leaves, ...outcome }) => ({
      actionId: outcome.actionId, metadataHash: hash(outcome),
      status: outcome.status, code: outcome.code, message: outcome.message,
      searchCompleteness: outcome.searchCompleteness,
      leaves: leaves.map(leaf => ({ leafId: leaf.leafId, hash: hash(leaf) })),
    }));
    report.diagnostics = env.getCounterfactualDiagnostics();
    report.afterHash = hash(env.createCheckpoint().coreState);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, step, passed: report.passed, wallMs: report.wallMs,
      matchesRecordedAction: report.matchesRecordedAction, nodes: report.diagnostics?.executedNodeCount,
      families: report.diagnostics?.executedNodeCountByFamily,
      topChoices: Object.entries(report.diagnostics?.executedNodeCountByActionSummary || {}).slice(0, 10),
      error: report.error }, null, 2));
  }
}
