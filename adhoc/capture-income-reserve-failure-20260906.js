"use strict";
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/income-reserve-full-failure-20260906-v2.json";
if (fs.existsSync(output)) console.log(`已有失败checkpoint，未重跑：${output}`);
else {
  const record = JSON.parse(fs.readFileSync("reports/research/990c007e.082d3e12.quick-200.json"));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const state = JSON.parse(save.committedState);
  state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
  const committed = JSON.stringify(state);
  const input = { schemaVersion: "seti-rl-checkpoint-v1", coreState: { version: 2,
    committedState: committed, compositionEnvelope: { schemaVersion: "seti-rule-composition-save-v1",
      committedState: committed, session: save.session ?? null } },
    config: { seed: record.seed, activePlayerCount: record.activePlayerCount, aiDifficulty: record.aiDifficulty,
      policyVersion: record.policyVersion, ...record.flags },
    replayCursor: { seed: record.seed, stepIndex: 0 }, replaySteps: null, browserReplaySteps: save.replaySteps };
  const report = { createdAt: new Date().toISOString(), gitCommit: "082d3e12", quickRecord: record,
    originalFullLog: fs.readFileSync("/tmp/seti-income-reserve-full-20260906.log", "utf8"),
    scope: "失败续跑无checkpoint产物；仅从已存200步恢复、最多60步捕获同一错误。v1的30步窗口未到下个棕方边界，保留未复现记录；本项非全盘重跑。", steps: [] };
  const env = createSimulationEnv();
  try {
    env.loadCheckpoint(input);
    for (let index = 200; index < 260; index += 1) {
      report.beforeDecision = env.createCheckpoint();
      report.observation = env.observe();
      report.legalActions = env.legalActions();
      report.nextIndex = index;
      const start = performance.now();
      const result = env.runHeuristicPolicyDecision();
      const ms = performance.now() - start;
      report.steps.push({ index, actionId: result.policyDecision?.actionId, ms });
      if (ms > 10000) { report.stoppedForPerformance = true; break; }
    }
  } catch (error) {
    report.error = { message: error.message, stack: error.stack };
    report.reproduced = error.message.includes("secondaryAgentSearch 需要 focalSeatId");
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, index: report.nextIndex, reproduced: report.reproduced,
      stoppedForPerformance: report.stoppedForPerformance, error: report.error,
      legalActions: report.legalActions?.map((a) => ({ id: a.actionId, family: a.family, actor: a.actorId, target: a.target })) }));
  }
}
