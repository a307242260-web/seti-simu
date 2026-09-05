"use strict";
// 已有固定盘面的单次决策验收；checkpoint保留代码指纹，不重跑已有输出。
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const outcome = require("../randomizer/game/ai/outcome-model");
const output = "reports/iteration/resource-r2b-scan-chain-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const record = JSON.parse(fs.readFileSync("reports/research/16bce41e.d9283ce5.full.json"));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const env = createSimulationEnv();
  const report = {
    createdAt: new Date().toISOString(),
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    workingDiffSha256: crypto.createHash("sha256").update(execFileSync("git", ["diff", "HEAD", "--", "randomizer"])).digest("hex"),
    sourceRecord: "16bce41e.d9283ce5.full.json", replayCount: 72,
    scope: "替换实现的单次冷计划搜索，非全盘成绩；不恢复原计划缓存",
  };
  try {
    env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "weak_start" });
    for (let index = 0; index < report.replayCount; index += 1) {
      assert.equal(env.step(save.replaySteps[index].action).ok, true, `重放${index + 1}`);
    }
    const legal = env.legalActions();
    const scan = legal.find((action) => action.family === "scan");
    assert.ok(scan);
    const started = performance.now();
    const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    report.actionId = result.policyDecision.actionId;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const scanOutcome = result.actionOutcomes.find((item) => item.actionId === scan.actionId);
    report.scan = {
      status: scanOutcome.status, code: scanOutcome.code,
      leaves: (scanOutcome.leaves || []).map((leaf) => ({
        actionChain: leaf.actionChain, terminalReason: leaf.terminalReason,
        facts: outcome.createStrategicFacts(leaf.observation, scan.actorId),
        successors: leaf.legalSuccessors?.map((action) => ({ family: action.family, actorId: action.actorId })),
      })),
    };
    // 此接口是协调器决策并提交，不是只读counterfactualPort；状态隔离另由规则端口测试验证。
    assert.equal(report.diagnostics.opponentExecutedNodeCount, 0);
    assert.ok(report.wallMs <= 10000, `单步超过10秒：${report.wallMs}`);
    assert.ok(report.scan.leaves.some((leaf) => (
      leaf.actionChain.some((id) => id.startsWith("analyze:")) && leaf.facts.realizedScore >= 16
    )), "scan根须保留正式分析得分后继叶");
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    env.dispose();
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs, error: report.error?.message }));
  }
}

// 复用已保存搜索结果重新验收，不因最初误用协调器的只读断言而重跑同一次搜索。
const reviewPath = "reports/iteration/resource-r2b-scan-chain-review-20260905.json";
if (!fs.existsSync(reviewPath)) {
  const recorded = JSON.parse(fs.readFileSync(output));
  assert.equal(recorded.diagnostics.opponentExecutedNodeCount, 0);
  assert.ok(recorded.wallMs <= 10000);
  const analysisLeaves = recorded.scan.leaves.filter((leaf) => (
    leaf.actionChain.some((id) => id.startsWith("analyze:")) && leaf.facts.realizedScore >= 16
  ));
  assert.ok(analysisLeaves.length > 0);
  fs.writeFileSync(reviewPath, `${JSON.stringify({
    sourceCheckpoint: output, sourceSha256: crypto.createHash("sha256").update(fs.readFileSync(output)).digest("hex"),
    passed: true, wallMs: recorded.wallMs, analysisLeafCount: analysisLeaves.length,
    scope: "仅验证扫描后继分析叶、无对手执行和单步性能；不证明规则端口状态隔离",
    harnessCorrection: "runHeuristicPolicyDecision按契约提交所选行动，旧只读断言错误；原始失败checkpoint保留，不改写为通过",
  }, null, 2)}\n`);
}
console.log(`验收记录：${reviewPath}`);
