"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/search-result-retention-s1-profile-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const report = {
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    productionDiffSha256: crypto.createHash("sha256").update(execFileSync("git", ["diff", "HEAD", "--", "randomizer"])).digest("hex"),
    scope: "独立搜索结果保留修复：三份已有盘面各执行一次真实协调器；不作为第二轮估值或全盘成绩",
    cases: [],
  };
  try {
    for (const name of ["brown-pass", "opening", "baseline-step73"]) {
      const env = createSimulationEnv();
      try {
        if (name === "brown-pass") {
          const saved = JSON.parse(fs.readFileSync("reports/iteration/resource-r2c-brown-pass-canonical-20260905.json"));
          const before = saved.before;
          env.loadCheckpoint({ schemaVersion: "seti-rl-checkpoint-v1",
            coreState: { version: 2, committedState: before.committedState, compositionEnvelope: {
              schemaVersion: "seti-rule-composition-save-v1", committedState: before.committedState,
              session: before.session ?? null } },
            config: { seed: before.seed, activePlayerCount: 4, aiDifficulty: "laughable" },
            replayCursor: { seed: before.seed, stepIndex: 0 }, replaySteps: null,
            browserReplaySteps: before.replaySteps });
        } else if (name === "opening") {
          env.loadCheckpoint(JSON.parse(fs.readFileSync("reports/iteration/resource-r2b-opening-scan-20260905.json")).before);
        } else {
          const record = JSON.parse(fs.readFileSync("reports/research/16bce41e.d9283ce5.full.json"));
          const saved = JSON.parse(fs.readFileSync(record.savePath));
          env.reset({ seed: saved.seed, activePlayerCount: 4, aiDifficulty: "weak_start" });
          for (let i = 0; i < 72; i += 1) assert.equal(env.step(saved.replaySteps[i].action).ok, true);
        }
        const start = performance.now();
        const result = env.runHeuristicPolicyDecision();
        const wallMs = performance.now() - start;
        assert.equal(result.ok, true);
        const diag = env.getCounterfactualDiagnostics();
        const item = { name, wallMs, chosen: result.policyDecision.actionId,
          nodes: diag.executedNodeCount, limitReached: diag.executionLimitReached,
          opponents: diag.opponentExecutedNodeCount,
          outcomes: result.actionOutcomes.map((outcome) => ({ actionId: outcome.actionId, status: outcome.status,
            code: outcome.code, leafCount: outcome.leaves.length,
            completedGoalCount: outcome.leaves.filter((leaf) => leaf.terminalReason === "goal-completed").length })),
        };
        report.cases.push(item);
        assert.ok(wallMs <= 10000, `${name}单步超过10秒`);
        assert.equal(diag.opponentExecutedNodeCount, 0);
        assert.equal(diag.executedNodeCount, { "brown-pass": 4096, opening: 704, "baseline-step73": 178 }[name],
          "结果保留不应改变这些对照盘面的搜索执行数");
        if (name === "brown-pass") {
          assert.ok(item.outcomes.some((outcome) => outcome.completedGoalCount > 0));
          assert.ok(!item.chosen.startsWith("pass:"), "真实完成目标现在应参与选择，不能只剩PASS");
          item.selectedOutcome = result.actionOutcomes.find((outcome) => outcome.actionId === item.chosen);
        } else {
          const scan = result.actionOutcomes.find((outcome) => outcome.actionId.startsWith("scan:"));
          assert.ok(scan?.leaves.length > 0);
        }
      } finally { env.dispose(); }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ passed: report.passed, cases: report.cases.map(({ selectedOutcome, ...item }) => item) }));
  }
}
