"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/income-card-reserve-witness-20260906-v3.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3s1-green-boundary-20260906.json";
  const source = JSON.parse(fs.readFileSync(sourcePath));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), sourcePath,
    scope: "真实绿方第80步盘面，正式执行先补一牌再换能、扫描与收入；不运行搜索，不作为全盘效果验收。", steps: [] };
  function submit(predicate, label) {
    const actions = env.legalActions();
    const action = actions.find(predicate);
    if (!action) report.failedBoundary = { label, actions };
    assert.ok(action, `${label}必须合法`);
    report.steps.push(action);
    const result = env.step(action);
    if (!result.ok) report.failedExecution = { action, result };
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  try {
    env.loadCheckpoint(source.beforeDivergence);
    report.before = env.observe();
    submit((a) => a.target?.tradeId === "publicity-for-card", "宣传换牌");
    submit((a) => a.target?.kind === "trade-card-selection" && a.target?.source === "public", "选公开牌");
    for (let i = 0; i < 2; i += 1) {
      submit((a) => a.target?.tradeId === "cards-for-energy", "手牌换能");
      for (let j = 0; j < 2; j += 1) submit((a) => a.target?.kind === "discard-hand-card" && a.presentation?.selected === false, "选择未勾选支付牌");
      submit((a) => a.target?.confirm === true, "确认支付");
    }
    report.beforeScan = env.createCheckpoint();
    submit((a) => a.family === "scan", "扫描");
    submit((a) => a.target?.nebulaId === "sector-4-a", "正式地球扫描");
    submit((a) => a.family === "choose_card" && a.target?.nebulaId === "sector-3-a", "公共牌扫描");
    submit((a) => a.family === "place_data", "放数据");
    submit((a) => a.target?.target === "computer", "填第4格");
    report.incomeChoices = env.legalActions();
    submit((a) => String(a.target?.choiceId || "").startsWith("income:"), "插收入牌");
    report.after = env.observe();
    const before = report.before.publicState.players.find((p) => p.playerId === "player-green");
    const after = report.after.publicState.players.find((p) => p.playerId === "player-green");
    assert.notDeepEqual(after.income, before.income, "正式收入轨必须增长");
    report.afterCheckpoint = env.createCheckpoint();
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, steps: report.steps.map((a) => a.family), error: report.error }));
  }
}
