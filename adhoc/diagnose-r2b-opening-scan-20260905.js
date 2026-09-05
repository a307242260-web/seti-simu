"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/resource-r2b-opening-scan-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有诊断，未重跑：${output}`);
} else {
  const env = createSimulationEnv();
  try {
    env.reset({ seed: "seti-104-official-v1", activePlayerCount: 4, traceCounterfactualGoalClusters: true });
    const progressBySeat = new Map();
    let count = 0;
    while (env.legalActions()[0]?.family?.startsWith("choose_")) {
      const legal = env.legalActions();
      const seatId = legal[0].actorId;
      const progress = progressBySeat.get(seatId) || { industry: false, initialIds: new Set() };
      let action = legal.find((item) => item.target?.kind === "start_initial_setup")
        || legal.find((item) => item.target?.kind === "confirm_initial_setup");
      if (!action && !progress.industry) {
        action = legal.find((item) => item.target?.kind === "select_initial_card" && item.target.selectionKind === "industry");
        if (action) progress.industry = true;
      }
      if (!action && progress.initialIds.size < 2) {
        action = legal.find((item) => item.target?.kind === "select_initial_card"
          && item.target.selectionKind === "initial" && !progress.initialIds.has(item.target.cardId));
        if (action) progress.initialIds.add(action.target.cardId);
      }
      progressBySeat.set(seatId, progress);
      assert.equal(env.step(action || legal[0]).ok, true);
      assert.ok(++count < 50);
    }
    const before = env.createCheckpoint();
    const scan = env.legalActions().find((action) => action.family === "scan");
    assert.ok(scan);
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    const scanOutcome = result.actionOutcomes.find((item) => item.actionId === scan.actionId);
    const report = {
      gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      workingDiffSha256: crypto.createHash("sha256").update(execFileSync("git", ["diff", "HEAD", "--", "randomizer"])).digest("hex"),
      scope: "复现simulation-counterfactual-outcome.test.js扫描无叶失败的单次开局决策，不是全盘实验",
      before, wallMs, scanOutcome, diagnostics: env.getCounterfactualDiagnostics(),
    };
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ output, wallMs, status: scanOutcome.status, code: scanOutcome.code,
      leaves: scanOutcome.leaves?.length, executed: report.diagnostics.executedNodeCount,
      remaining: report.diagnostics.remainingFrontierNodeCount }));
  } finally { env.dispose(); }
}
