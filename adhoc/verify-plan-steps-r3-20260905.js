"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");

const sourcePath = "reports/iteration/resource-r2b-opening-scan-20260905.json";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const fileSha256 = Object.fromEntries([
  "randomizer/game/rule-composition.js",
  "randomizer/game/ai/plan-continuation.js",
  "randomizer/game/ai/heuristic-decision-function.js",
  "randomizer/game/ai/machine-player-coordinator.js",
  "randomizer/app/simulation-contract.js",
].map((file) => [file, hash(fs.readFileSync(file))]));
const fingerprint = hash(JSON.stringify(fileSha256));
const output = `reports/iteration/plan-steps-r3-profile-20260905-${fingerprint.slice(0, 8)}.json`;
const originalOutput = "reports/iteration/plan-steps-r3-profile-20260905.json";
const originalMatches = fs.existsSync(originalOutput)
  && JSON.stringify(JSON.parse(fs.readFileSync(originalOutput)).fileSha256) === JSON.stringify(fileSha256);
if (fs.existsSync(output) || originalMatches) {
  console.log(`已有 checkpoint，未重跑：${originalMatches ? originalOutput : output}`);
} else {
  const source = fs.readFileSync(sourcePath);
  const report = {
    createdAt: new Date().toISOString(),
    scope: "已有真实开局盘面的一次生产决策：逐步证据完整性与性能；不是终局验收",
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourcePath, sourceSha256: hash(source),
    fileSha256, fingerprint,
  };
  const env = createSimulationEnv();
  try {
    env.loadCheckpoint(JSON.parse(source).before);
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    const diagnostics = env.getCounterfactualDiagnostics();
    report.chosen = result.policyDecision.actionId;
    report.nodes = diagnostics.executedNodeCount;
    report.opponents = diagnostics.opponentExecutedNodeCount;
    report.limitReached = diagnostics.executionLimitReached;
    report.outcomes = result.actionOutcomes.map((outcome) => ({
      actionId: outcome.actionId, status: outcome.status, code: outcome.code,
      leaves: outcome.leaves.length,
    }));
    report.steps = { leaves: 0, foldedLeaves: 0, atoms: 0, invalidReasons: {}, families: {}, invalidTargets: {} };
    for (const outcome of result.actionOutcomes) {
      for (const leaf of outcome.leaves) {
        if (leaf.secondaryAgentDepth == null) continue;
        assert.equal(leaf.planSteps?.length, leaf.executionStepCount,
          "每次成功正式提交都必须有且仅有一条前置证据");
        assert.equal(leaf.planSteps[0].action.actionId, outcome.actionId);
        report.steps.leaves += 1;
        report.steps.atoms += leaf.planSteps.length;
        if (leaf.executionStepCount > leaf.actionChain.length) report.steps.foldedLeaves += 1;
        for (const step of leaf.planSteps) {
          report.steps.families[step.action.family] = (report.steps.families[step.action.family] || 0) + 1;
          assert.equal(step.action.actorId, leaf.planSteps[0].action.actorId);
        }
        for (const [index, step] of plans.compilePlanSteps(leaf.planSteps).entries()) {
          if (!step.valid) {
            report.steps.invalidReasons[step.reason] = (report.steps.invalidReasons[step.reason] || 0) + 1;
            const evidence = leaf.planSteps[index];
            const key = JSON.stringify({ reason: step.reason, target: evidence.routeTargetId,
              planId: evidence.routePlanId, family: evidence.action.family });
            report.steps.invalidTargets[key] = (report.steps.invalidTargets[key] || 0) + 1;
          }
        }
      }
    }
    report.returnedPlan = result.plan || null;
    assert.ok(report.steps.leaves > 0, "必须覆盖真实生产计划叶");
    assert.ok(report.steps.foldedLeaves > 0, "必须覆盖折叠提交链");
    assert.equal(report.opponents, 0);
    assert.ok(report.wallMs <= 10000, "单次决策超过10秒，不得直接运行完整实验");
    // 只验证已有赢家计划在真实内核中的同回合推进；不调用第二次搜索，不模拟对手。
    report.continuation = [];
    let plan = result.plan;
    for (let guard = 0; plan?.nextActionId && guard < 32; guard += 1) {
      const observation = env.observe();
      const legal = env.legalActions();
      const reuse = plans.planReuseCheck(plan, observation, legal, { sameTurn: true });
      const entry = { actionId: plan.nextActionId, hit: reuse.hit, reason: reuse.reason || null };
      report.continuation.push(entry);
      if (!reuse.hit) {
        entry.assumed = plan.steps[0];
        entry.actual = legal.find((action) => action.actionId === plan.nextActionId) || null;
        entry.currentFacts = entry.actual ? plans.capturePlanStep({ observation, action: entry.actual }) : null;
        break;
      }
      if (["end_turn", "pass"].includes(reuse.action.family)) break;
      assert.equal(env.step(reuse.action).ok, true);
      plan = reuse.nextPlan;
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    env.dispose();
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  }
}
