"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/resource-r2b-final-profile-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const report = {
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    workingDiffSha256: crypto.createHash("sha256").update(execFileSync("git", ["diff", "HEAD", "--", "randomizer"])).digest("hex"),
    scope: "两份已保存盘面的单次真实协调器决策；不作为全盘成绩", cases: [],
  };
  try {
    for (const name of ["opening", "baseline-step73"]) {
      const env = createSimulationEnv();
      try {
        if (name === "opening") {
          const source = JSON.parse(fs.readFileSync("reports/iteration/resource-r2b-opening-scan-20260905.json"));
          env.loadCheckpoint(source.before);
        } else {
          const record = JSON.parse(fs.readFileSync("reports/research/16bce41e.d9283ce5.full.json"));
          const save = JSON.parse(fs.readFileSync(record.savePath));
          env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "weak_start" });
          for (let index = 0; index < 72; index += 1) assert.equal(env.step(save.replaySteps[index].action).ok, true);
        }
        const started = performance.now();
        const result = env.runHeuristicPolicyDecision();
        const wallMs = performance.now() - started;
        assert.equal(result.ok, true);
        const scan = result.actionOutcomes.find((item) => item.actionId.startsWith("scan:"));
        const diagnostics = env.getCounterfactualDiagnostics();
        report.cases.push({ name, wallMs, chosen: result.policyDecision.actionId,
          nodes: diagnostics.executedNodeCount, limitReached: diagnostics.executionLimitReached,
          opponents: diagnostics.opponentExecutedNodeCount,
          scan: { status: scan?.status, leaves: scan?.leaves.length,
            analysisLeaves: scan?.leaves.filter((leaf) => leaf.actionChain.some((id) => id.startsWith("analyze:"))).length },
        });
        assert.ok(wallMs <= 10000, `${name}超过10秒`);
        assert.equal(diagnostics.opponentExecutedNodeCount, 0);
        assert.ok(scan?.leaves.length > 0, `${name}扫描无叶`);
        if (name === "baseline-step73") assert.ok(report.cases.at(-1).scan.analysisLeaves > 0);
      } finally { env.dispose(); }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error.message;
    throw error;
  } finally {
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  }
}
