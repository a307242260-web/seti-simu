"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createReportSave } = require("../tools/robot-report-fixture");
const { checkpointFromSave } = require("../tools/run_research_validation");
const { buildWorldIdentity } = require("../tools/fixed-world-identity");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const output = path.join(__dirname, `fixed-world-decision-${commit}-20260913.json`);
if (fs.existsSync(output)) {
  console.log(`[skip] 已有同版本单决策证据：${output}`);
  process.exit(0);
}
const seed = "seti-free-analyze-v1";
const save = createReportSave(seed);
const checkpoint = checkpointFromSave(save, { seed, activePlayerCount: 4 });
const env = createSimulationEnv();
const record = { schemaVersion: "seti-fixed-world-decision-benchmark-v1", commit,
  scope: "正式开局、一次固定交易及其条件选择全部结算后的主行动决策；不是全盘或快速实验成绩。",
  world: buildWorldIdentity({ seed }), checkpoint, searchDeadlineMs: 30000 };
try {
  env.loadCheckpoint(checkpoint);
  for (let i = 0; i < 20 && env.legalActions().every(action => action.phase === "conditional"); i += 1) {
    const action = env.legalActions()[0];
    if (!action || !env.step(action).ok) throw new Error("基准夹具条件步骤结算失败");
  }
  const legal = env.legalActions();
  if (!legal.some(action => ["launch", "scan", "research_tech", "play_card"].includes(action.family))) {
    throw new Error("基准夹具未到达可执行主行动的决策边界");
  }
  record.checkpoint = env.createCheckpoint();
  record.rootFamilies = [...new Set(legal.map(action => action.family))];
  console.log(`[单决策] ${commit} ${record.world.worldVersion}：开始一次真实机器人决策，搜索期限30秒`);
  const start = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - start;
  record.ok = result.ok;
  record.actionId = result.actionId;
  record.searches = result.searches;
  record.scores = result.observation.publicState.players.map(player => ({ id: player.id, score: player.score }));
  if (!result.ok) throw new Error("单决策返回失败");
  console.log(`[单决策] 动作=${record.actionId} 用时=${record.wallMs.toFixed(1)}ms 搜索=${record.searches.length}`);
} catch (error) {
  record.ok = false;
  record.error = { code: error.code || null, message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  console.log(`[证据] ${output}`);
}
