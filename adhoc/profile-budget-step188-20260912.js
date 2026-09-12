"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const inspector = require("node:inspector");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const source = "reports/iteration/budget-before-step188-20260912.json";
const output = "reports/iteration/budget-step188-profile-20260912.json";
const cpuPath = "reports/iteration/budget-step188-20260912.cpuprofile";
async function main() {
  if (fs.existsSync(output) || fs.existsSync(cpuPath)) {
    console.log("已有诊断产物，不重复运行；失败结果也保留。");
    return;
  }
  const bytes = fs.readFileSync(source);
  const input = JSON.parse(bytes);
  const env = createSimulationEnv();
  const session = new inspector.Session();
  const post = method => new Promise((resolve, reject) => session.post(method,
    (error, result) => error ? reject(error) : resolve(result)));
  const report = { source, inputHash: crypto.createHash("sha256").update(bytes).digest("hex"),
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "188步冷计划单决策CPU与目标路线诊断；开启正式trace配置，无生产修改，不是完整局基线重跑。" };
  let started = false;
  try {
    const checkpoint = input.checkpoint;
    delete checkpoint.replaySteps;
    checkpoint.config.traceCounterfactualGoalClusters = true;
    env.loadCheckpoint(checkpoint);
    assert.deepEqual(env.legalActions(), input.legalActions);
    session.connect();
    await post("Profiler.enable");
    await post("Profiler.start");
    started = true;
    console.log("[单决策诊断] 第188步开始：4096执行/256队列/30秒搜索期限，CPU采样开启");
    const start = performance.now();
    const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    report.ok = result.ok;
    report.selectedActionId = result.policyDecision?.actionId;
    report.searches = result.searches;
    report.diagnostics = env.getCounterfactualDiagnostics();
    report.plan = result.plan;
    assert.equal(result.ok, true);
    assert(result.searches.some(s => s.kind === "strategic" && s.diagnostics.executedNodeCount > 0));
  } catch (error) {
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    if (started) {
      const { profile } = await post("Profiler.stop");
      fs.writeFileSync(cpuPath, JSON.stringify(profile), { flag: "wx" });
    }
    session.disconnect();
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify({ output, cpuPath, wallMs: report.wallMs, ok: report.ok,
      selectedActionId: report.selectedActionId, error: report.error,
      nodes: report.diagnostics?.executedNodeCount }, null, 2));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
