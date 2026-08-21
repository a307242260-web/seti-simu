#!/usr/bin/env node
"use strict";
// 决策搜索树 dump（标准化调研工具，2026-08-21 建立）：加载存档重放到指定决策点，
// 跑真实决策函数，把完整搜索数据（合法动作/目标目录/根动作/每根 outcome/搜索诊断/
// 实际耗时）dump 成 JSON 文件，供多轮离线分析——不反复重放。
//
// 用法:
//   node tools/dump_decision_tree.js <存档路径> <重放步数> [输出.json]
//     重放到 <重放步数> 个动作后，跑一次 runHeuristicPolicyDecision，
//     把该决策的全部搜索数据写入输出文件（默认 reports/iteration/decision-dumps/
//     <存档名>.step<重放步数>.json）。输出含 wallMs（单次决策实际耗时），
//     用于定位"状态复杂 → 搜索慢/预算耗尽"类问题（如免电盘面白色 R3 42s）。
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const ev = require("../randomizer/game/ai/expected-score-evaluator");

const DEFAULT_DUMP_DIR = path.join(__dirname, "..", "reports", "iteration", "decision-dumps");
const [savePath, stepsArg, outputArg] = process.argv.slice(2);
if (!savePath || !stepsArg) {
  console.error("用法: node tools/dump_decision_tree.js <存档> <重放步数> [输出.json]");
  process.exit(2);
}
const targetSteps = Number(stepsArg);
if (!Number.isSafeInteger(targetSteps) || targetSteps < 0) {
  console.error("重放步数必须是整数");
  process.exit(2);
}
if (!fs.existsSync(savePath)) {
  console.error(`存档不存在: ${savePath}`);
  process.exit(2);
}
const outputPath = outputArg
  || path.join(DEFAULT_DUMP_DIR, `${path.basename(savePath, ".json")}.step${targetSteps}.json`);

const save = JSON.parse(fs.readFileSync(savePath, "utf-8"));
const env = createSimulationEnv();
env.reset({ seed: save.seed, activePlayerCount: 4 });
const replaySteps = save.replaySteps || [];
for (let i = 0; i < targetSteps; i++) {
  env.step(replaySteps[i].action);
}

const legal = env.legalActions();
const rawObs = env.observe();
const seatId = rawObs?.decision?.actorPlayerId
  || legal[0]?.actorId || legal[0]?.actorPlayerId || "player-white";
const obs = outcomeModel.createDecisionObservation(rawObs, {
  seatId,
  stateVersion: legal[0]?.stateVersion ?? null,
  decisionVersion: legal[0]?.decisionVersion ?? null,
});

const t0 = Date.now();
const result = env.runHeuristicPolicyDecision(false);
const wallMs = Date.now() - t0;
const diag = env.getCounterfactualDiagnostics?.() || null;

// 目标目录与根动作（与决策函数同口径）
const targets = ev.enumerateSecondaryAgentRootTargets({
  focalSeatId: seatId,
  rootObservation: obs,
  legalActions: legal,
  maxProxyDepth: 15,
}).map((t) => ({
  targetId: t.targetId,
  planId: t.planId,
  resultTargetIds: t.resultTargetIds,
  compatibleActionIds: t.compatibleActionIds,
}));
const requiresRoot = legal.filter((a) => ev.requiresRootCounterfactual(a, obs));
const roots = ev.selectSecondaryAgentRootActions({
  focalSeatId: seatId,
  rootObservation: obs,
  legalActions: requiresRoot,
  maxProxyDepth: 15,
}).map((a) => a.actionId);

const outcomes = (result.actionOutcomes || []).map((o) => ({
  actionId: o.actionId,
  family: o.actionId.split(":")[0],
  status: o.status,
  code: o.code || null,
  confidence: o.confidence || null,
  leaves: (o.leaves || []).map((leaf) => ({
    leafId: leaf.leafId || null,
    chain: (leaf.actionChain || []).slice(0, 20),
    routeTargetId: leaf.rootRouteTargetId || null,
    routePlanId: leaf.routePlanId || null,
    quickTradeCount: leaf.quickTradeCount || 0,
    secondaryAgentDepth: leaf.secondaryAgentDepth || 0,
    goalPaths: (leaf.secondaryAgentGoalPaths || []).map((p) => p.slice(0, 8)),
  })),
}));

const dump = {
  tool: "dump_decision_tree",
  createdAt: new Date().toISOString(),
  savePath,
  targetSteps,
  seed: save.seed,
  seatId,
  chosen: { actionId: result.actionId, family: result.actionId.split(":")[0] },
  wallMs,
  legalActions: legal.map((a) => ({
    actionId: a.actionId,
    family: a.family,
    phase: a.phase,
    summary: a.summary || "",
  })),
  rootActionIds: roots,
  rootActionCount: roots.length,
  targetCatalog: targets,
  targetCount: targets.length,
  outcomeStatusSummary: outcomes.reduce((m, o) => {
    m[`${o.status}${o.code ? ":" + o.code : ""}`] = (m[`${o.status}${o.code ? ":" + o.code : ""}`] || 0) + 1;
    return m;
  }, {}),
  outcomes,
  diagnostics: diag,
};

fs.mkdirSync(pathDir(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2), "utf-8");
console.log(`已 dump: ${outputPath}`);
console.log(`决策=${dump.chosen.family} 根=${dump.rootActionCount} 目标=${dump.targetCount} 耗时=${wallMs}ms`);
env.dispose();

function pathDir(p) {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(0, idx) : ".";
}
