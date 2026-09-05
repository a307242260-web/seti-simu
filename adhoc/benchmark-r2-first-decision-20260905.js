"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const checkpoint = path.resolve(__dirname, "../reports/iteration/resource-r2-first-decision-20260905.json");
if (fs.existsSync(checkpoint)) {
  console.log(fs.readFileSync(checkpoint, "utf8"));
} else {
  const env = createSimulationEnv();
  try {
    env.reset({ seed: "seti-free-analyze-v1", activePlayerCount: 4, aiDifficulty: "weak_start", offlineTeacher: true });
    let openingDecisions = 0;
    while (env.legalActions()[0]?.family.startsWith("choose_")) {
      assert.ok(openingDecisions++ < 60, "开局必须有限结束");
      const result = env.runHeuristicPolicyDecision();
      assert.equal(result.ok, true);
    }
    const before = env.createCheckpoint();
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    const milliseconds = performance.now() - started;
    const diagnostics = env.getCounterfactualDiagnostics();
    const report = {
      date: "2026-09-05", scope: "第二轮工作树单次主行动性能诊断，非快速/全盘验证",
      gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      trackedDiffSha256: crypto.createHash("sha256").update(execFileSync("git", ["diff", "HEAD", "--", "randomizer"])).digest("hex"),
      openingDecisions, milliseconds, passed: result.ok === true && diagnostics?.secondaryAgentSearch === true && milliseconds <= 10000,
      actionId: result.policyDecision?.actionId, diagnostics, before,
    };
    fs.writeFileSync(checkpoint, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ checkpoint, openingDecisions, milliseconds, passed: report.passed,
      executedNodeCount: diagnostics?.executedNodeCount, actionId: report.actionId }));
    assert.equal(report.passed, true, "必须真实搜索且单次决策不超过10秒；失败记录已保存");
  } finally {
    env.dispose();
  }
}
