"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/r3-legacy-payment-boundary-20260906.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重复分析：${output}`);
} else {
  const input = JSON.parse(fs.readFileSync("reports/iteration/r3-actual-opening-plan-20260906.json"));
  const baseline = "20feca27";
  function load(file, overrides = {}) {
    const source = execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" });
    const module = { exports: {} };
    const nativeRequire = createRequire(path.resolve(file));
    new vm.Script(source, { filename: `${baseline}:${file}` }).runInNewContext({
      module, structuredClone, require: (name) => overrides[name] || nativeRequire(name),
    });
    return module.exports;
  }
  const oldPlans = load("randomizer/game/ai/plan-continuation.js");
  const oldCoordinator = load("randomizer/game/ai/machine-player-coordinator.js", { "./plan-continuation": oldPlans });
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), baseline,
    scope: "旧协调器/计划函数消费同一实际赢家的宏步骤链；正式内核提交，不执行新搜索。不是历史赢家身份或整体分差的证明",
    events: [], decisions: [] };
  try {
    env.loadCheckpoint(input.beforeRoot);
    const coordinator = oldCoordinator.createMachinePlayerCoordinator({
      composition: { inspect: () => ({ phase: "idle" }),
        inputPort: { enumerateActions: () => env.legalActions() },
        projection: () => ({ state: env.observe() }) },
      execute: (action) => env.step(action),
      onDiagnostic: (type, details) => report.events.push({ type, ...details }),
    });
    let calls = 0;
    coordinator.registerSeat(input.rootAction.actorId, (boundary) => {
      calls += 1;
      report.decisions.push({ call: calls, legal: boundary.legalActions.map((action) => action.actionId) });
      if (calls === 1) {
        return { actionId: input.rootAction.actionId, plan: oldPlans.buildPlanFromSnapshot({
          plan: { hasContinuation: true, nextActionId: input.macroContinuation[0], continuation: input.macroContinuation },
          // 同回合旧旁路不读取此字段；不伪造任何依赖事实。
          planDependency: null, planAssumedRevealedCount: null,
        }) };
      }
      assert.equal(boundary.legalActions.length, 1);
      return { actionId: boundary.legalActions[0].actionId };
    });
    report.results = [];
    for (let index = 0; index < 3; index += 1) {
      const result = coordinator.runDecision(input.rootAction.actorId);
      report.results.push({ actionId: result.actionId, source: result.source });
    }
    assert.deepEqual(report.results.map((result) => result.source), ["scheme", "plan-reuse", "scheme"]);
    assert.equal(report.results[2].actionId, input.boundaries[1].nextActionId);
    assert.equal(report.events.some((event) => event.reason === "step-not-legal-within-turn"), true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,
      JSON.parse(fs.readFileSync("reports/iteration/r3-first-divergence-20260906.json")).candidate[0].after);
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
