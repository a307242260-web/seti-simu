"use strict";
// 对照实验：同一协调器 + 同一 Heuristic 决策函数，在真实 Simulation 装配
// （simulation-env，projectCounterfactualState = buildObservation）下推进到
// 主行动边界，看机器席位 observation 是否完整、决策是否正常（非 pass 退化）。
//
// 用法：node tools/diagnose_sim_machine_end_to_end.js

const { createSimulationEnv } = require("../randomizer/app/simulation-env");

const SEED = "sim-control-1";

(async () => {
  const env = createSimulationEnv({});
  env.reset({ seed: SEED, activePlayerCount: 4, aiDifficulty: "laughable" });

  let steps = 0;
  let mainBoundarySeen = false;
  let firstMainAction = null;
  let lastAction = null;
  while (steps < 120) {
    steps += 1;
    if (env.isTerminal()) break;
    // 检查当前边界是否还是初始选择（legalActions 全为 choose_card/choose_payment）
    const legal = env.legalActions();
    if (!legal.length) break;
    const allSetup = legal.every((action) => (
      ["choose_card", "choose_payment"].includes(action.family)
      && ["start_initial_setup", "select_initial_card", "confirm_initial_setup", "discard-hand-cards"]
        .includes(action.target?.kind)
    ));
    const result = env.runHeuristicPolicyDecision(false);
    lastAction = result?.policyDecision?.actionId || null;
    if (!allSetup && !mainBoundarySeen) {
      mainBoundarySeen = true;
      firstMainAction = result.policyDecision?.actionId || null;
      // 抓取主行动边界的观察内容（协调器跑完后的 env observation 是当前状态，
      // 用 actionOutcomes 的 rootObservation 看决策时看到的盘面）
      const outcomes = result.actionOutcomes || [];
      const sample = outcomes.find((o) => o.status === "settled" && o.leaves?.length > 0);
      const rootObs = sample?.rootObservation || outcomes[0]?.rootObservation || null;
      if (rootObs) {
        const projection = rootObs.outcomeProjection || {};
        const selfState = rootObs.selfState || {};
        const players = Array.isArray(rootObs.publicState?.players)
          ? rootObs.publicState.players
          : Object.values(rootObs.publicState?.players || {});
        console.log("Simulation 主行动边界 rootObservation:", JSON.stringify({
          players: players.length,
          selfHand: Array.isArray(selfState.hand) ? selfState.hand.length : "missing",
          assets: { ...(projection.assets || {}) },
          ownedTechIds: [...(projection.progress?.ownedTechIds || [])],
          realizedScore: projection.scoring?.realizedScore,
          boardRockets: Array.isArray(rootObs.publicState?.board?.rockets)
            ? rootObs.publicState.board.rockets.length
            : "missing",
        }, null, 2));
        console.log("Simulation 主行动边界决策:", JSON.stringify({
          actionId: firstMainAction,
          settledCount: outcomes.filter((o) => o.status === "settled").length,
          settledWithLeaves: outcomes.filter((o) => o.status === "settled" && o.leaves?.length > 0).length,
          topFamilies: outcomes.slice(0, 6).map((o) => o.actionId.split(":")[0]),
        }, null, 2));
      }
      break; // 抓到主行动边界即可
    }
    if (!result) break;
  }
  console.log(`推进步数: ${steps}, 到达主行动边界: ${mainBoundarySeen}`);
  if (!mainBoundarySeen) console.log("未到达主行动边界（可能一直停在初始选择或提前终局）");
  env.dispose();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
