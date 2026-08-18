"use strict";
// 诊断（正确装配路径 v2）：AI 拿到 b_117 后为何不打。
// createSimulationEnv.reset() 从零开局（projectCounterfactualState→buildObservation
// 完整装配），再用存档 replaySteps 动作逐步 env.step(action) 重放（运行时路径），
// 到目标步后停在决策点，检查协调器读边界等价的 observation：
//   assets / probeGoalRequirements / play_card 目标绑定。
// 用法: node tools/diag_playcard_b117.js <save-file> <step-index>
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");

const saveFile = process.argv[2];
const targetStep = Number(process.argv[3] || 31);
if (!saveFile) {
  console.log("用法: node tools/diag_playcard_b117.js <save-file> <step-index>");
  process.exit(1);
}
const save = JSON.parse(fs.readFileSync(saveFile, "utf8"));
const state = JSON.parse(save.committedState);
const replaySteps = save.replaySteps || [];

const env = createSimulationEnv();
env.reset({
  seed: save.seed || state?.meta?.seed || "seti-simulation",
  activePlayerCount: Number(state?.turn?.activePlayerCount) || 4,
  aiDifficulty: "laughable",
  episodeId: `diag:${path.basename(saveFile, ".json")}`,
});

// 逐步重放前 targetStep 步动作
let ok = 0;
for (let index = 0; index < replaySteps.length && index < targetStep; index += 1) {
  const step = replaySteps[index];
  const result = env.step(step.action);
  if (!result?.ok) {
    console.log(`step ${index} 重放失败: ${result?.error || result?.failure?.message || "?"} action=${step.action?.family}`);
    break;
  }
  ok += 1;
}
console.log(`== 重放 ${ok} 步（目标 ${targetStep}）==`);

const obs = env.observe();
const legal = env.legalActions();
console.log("current:", obs.publicState?.currentPlayerId, "| round:", obs.publicState?.roundNumber, "| pending:", obs.publicState?.pending?.phase || "main");
console.log(`legalActions: ${legal.length}`);
const byFam = {};
for (const a of legal) byFam[a.family] = (byFam[a.family] || 0) + 1;
console.log("byFamily:", JSON.stringify(byFam));

const white = obs.publicState?.players?.find((p) => p.playerId === "player-white");
console.log("白色资源: 钱", white?.credits, "能", white?.energy, "宣", white?.publicity, "手", white?.handCount);
console.log("白色手牌:", (obs.selfState?.hand || []).map((c) => `${c.id}(${c.price})`).join(", "));

const prog = obs.outcomeProjection?.progress;
console.log("probe candidates:", prog?.probeGoalRequirements?.candidates?.length, "| launch:", (prog?.probeGoalRequirements?.candidates || []).filter((c) => c.nextStep?.family === "launch").length);
console.log("assets:", JSON.stringify(obs.outcomeProjection?.assets));

// 协调器等价：createDecisionObservation(projection.state) —— 用 env.observe() 的观察
// 再装配（协调器传的是 projection(viewer).state = buildObservation 输出，结构相同）
const { createDecisionObservation } = require("../randomizer/game/ai/outcome-model");
const { selectSecondaryAgentRootActions, enumerateSecondaryAgentRootTargets } = require("../randomizer/game/ai/expected-score-evaluator");
const obs2 = createDecisionObservation(obs, {
  seatId: "player-white",
  stateVersion: legal[0]?.stateVersion ?? null,
  decisionVersion: legal[0]?.decisionVersion ?? null,
});
console.log("二次装配 assets:", JSON.stringify(obs2.outcomeProjection?.assets));
const bound = selectSecondaryAgentRootActions({
  focalSeatId: "player-white",
  rootObservation: obs2,
  legalActions: legal,
});
const boundCards = bound.filter((a) => a.family === "play_card");
console.log(`目标绑定: ${bound.length}，play_card: ${boundCards.length}`);
for (const c of boundCards) console.log("  play_card:", c.summary || c.target?.cardInstanceId, "| cost:", JSON.stringify(c.payload?.cost));

// 目标明细
const targets = enumerateSecondaryAgentRootTargets({
  focalSeatId: "player-white",
  rootObservation: obs2,
  legalActions: legal,
  maxProxyDepth: undefined,
});
console.log(`enumerate 目标: ${targets.length}`);
for (const t of targets) {
  const pc = (t.compatibleActionIds || []).filter((id) => legal.find((a) => a.actionId === id)?.family === "play_card");
  console.log("  ", t.planId, "| actions:", (t.compatibleActionIds || []).length, pc.length ? `| play_card: ${pc.length}` : "");
}
