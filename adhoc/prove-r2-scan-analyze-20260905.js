"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/resource-r2-scan-analyze-proof-20260905.json";
if (fs.existsSync(output)) {
  console.log(fs.readFileSync(output, "utf8"));
} else {
  const diagnostic = JSON.parse(fs.readFileSync("reports/iteration/resource-r2-baseline-step73-20260905.json"));
  const scanOutcome = diagnostic.outcomes.find((o) => o.actionId.startsWith("scan:"));
  const before = scanOutcome.rootFacts;
  const after = scanOutcome.leaves[0].facts;
  const ordinaryBefore = structuredClone(before);
  const ordinaryAfter = structuredClone(after);
  ordinaryBefore.blueBonusAssets = { credits: 0, energy: 0, ordinaryCards: 0 };
  ordinaryAfter.blueBonusAssets = { credits: 0, energy: 0, ordinaryCards: 0 };
  const sourceComparison = {
    blueSource: evaluator.evaluateStrategicFactsBreakdown(before, after),
    ordinarySource: evaluator.evaluateStrategicFactsBreakdown(ordinaryBefore, ordinaryAfter),
  };
  assert.equal(sourceComparison.blueSource.total, -10);
  assert.equal(sourceComparison.ordinarySource.total, 0);
  const record = JSON.parse(fs.readFileSync("reports/research/16bce41e.d9283ce5.full.json"));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "已有盘面纯重放后手工规则链；对手选择PASS仅证明可行性，不是对手策略预测或全盘实验",
    sourceComparison, actions: [], completed: false };
  function step(action) {
    assert.ok(action, "期望的正式行动必须合法");
    const result = env.step(action);
    assert.equal(result.ok, true);
    report.actions.push(action);
  }
  function drain() {
    for (let guard = 0; guard < 30; guard += 1) {
      const choices = env.legalActions();
      if (choices[0]?.phase !== "conditional") return;
      step(choices.find((a) => a.target?.choiceId === "data:computer") || choices[0]);
    }
    throw new Error("条件决策未在30步内排空");
  }
  try {
    env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "weak_start" });
    for (let i = 0; i < 72; i += 1) assert.equal(env.step(save.replaySteps[i].action).ok, true);
    report.before = env.observe();
    step(env.legalActions().find((a) => a.family === "scan"));
    drain();
    report.afterScan = env.observe();
    step(env.legalActions().find((a) => a.family === "place_data"));
    drain();
    report.afterPlacement = env.observe();
    step(env.legalActions().find((a) => a.family === "end_turn"));
    for (let guard = 0; guard < 12; guard += 1) {
      drain();
      const legal = env.legalActions();
      if ((legal[0]?.actorId || legal[0]?.actorPlayerId) === "player-brown") break;
      step(legal.find((a) => a.family === "pass"));
    }
    step(env.legalActions().find((a) => a.family === "analyze"));
    drain();
    report.afterAnalyze = env.observe();
    report.completed = true;
  } catch (error) {
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    env.dispose();
  }
  console.log(JSON.stringify({ output, completed: report.completed, actions: report.actions.map((a) => `${a.actorId}:${a.family}`), sourceComparison }));
}
