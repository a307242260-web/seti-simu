"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const model = require("../randomizer/game/ai/outcome-model");
const output = "reports/iteration/blue-future-r2e-profile-20260905.json";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const evaluatorPath = "randomizer/game/ai/expected-score-evaluator.js";
  const oldSource = execFileSync("git", ["show", `5d43a4b5:${evaluatorPath}`], { encoding: "utf8" });
  const previous = { exports: {} };
  new vm.Script(oldSource).runInNewContext({ module: previous,
    require: createRequire(path.resolve(evaluatorPath)), structuredClone });
  const report = { createdAt: new Date().toISOString(),
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    oldEvaluatorSha256: hash(oldSource), evaluatorSha256: hash(fs.readFileSync(evaluatorPath)),
    scope: "同输入纯估值对照和已有真实开局盘面单次决策；不是固定盘面终局", values: [] };
  try {
    for (const round of [1, 2, 3, 4]) {
      for (const tile of ["blue1", "blue2", "blue3", "blue4"]) {
        const seatId = "value-seat";
        const input = model.createDecisionObservation({ publicState: { roundNumber: round,
          board: {}, players: [{ id: seatId, resources: { score: 0, publicity: 6 },
            techState: { ownedTiles: { [tile]: true } } }] }, selfState: { id: seatId, hand: [] },
        }, { seatId, stateVersion: 1, decisionVersion: 1 });
        const oldValue = previous.exports.evaluateStateValue(input, seatId).components.techEfficiencyValue;
        const value = evaluator.evaluateStateValue(input, seatId).components.techEfficiencyValue;
        const expectedRemoval = (4 - round) * ({ blue1: 10, blue2: 10, blue3: 5, blue4: 5 }[tile]);
        assert.ok(Math.abs(oldValue - value - expectedRemoval) < 1e-9);
        report.values.push({ round, tile, oldValue, value, removed: oldValue - value });
      }
    }
    const sourcePath = "reports/iteration/resource-r2b-opening-scan-20260905.json";
    const source = fs.readFileSync(sourcePath);
    const env = createSimulationEnv();
    try {
      env.loadCheckpoint(JSON.parse(source).before);
      const started = performance.now();
      const result = env.runHeuristicPolicyDecision();
      const wallMs = performance.now() - started;
      assert.equal(result.ok, true);
      const diagnostics = env.getCounterfactualDiagnostics();
      report.profile = { sourcePath, sourceSha256: hash(source), wallMs,
        chosen: result.policyDecision.actionId, nodes: diagnostics.executedNodeCount,
        opponents: diagnostics.opponentExecutedNodeCount, limitReached: diagnostics.executionLimitReached,
        outcomes: result.actionOutcomes.map((item) => ({ actionId: item.actionId,
          status: item.status, code: item.code, leaves: item.leaves.length })) };
      assert.ok(wallMs <= 10000, "单次决策超过10秒，不能直接运行完整实验");
      assert.equal(diagnostics.opponentExecutedNodeCount, 0);
    } finally { env.dispose(); }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
}
