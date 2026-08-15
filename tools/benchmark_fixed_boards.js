"use strict";
// 固定盘面均分基准：seti-107（双发）/ seti-free-analyze-v1（免电分析）
// 用法: node tools/benchmark_fixed_boards.js [boardId]
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const { FIXED_BOARD_CONFIG } = require("../randomizer/training/heuristic-policy.fixed-board");

const BOARD_BY_ID = {
  "seti-107": { seed: "seti-107", label: "双发盘面" },
  "seti-free-analyze-v1": { seed: "seti-free-analyze-v1", label: "免电分析盘面" },
};

const requested = process.argv[2] || "seti-107";
const boards = requested === "all"
  ? Object.entries(BOARD_BY_ID)
  : [[requested, BOARD_BY_ID[requested] || { seed: requested, label: requested }]];

for (const [boardId, spec] of boards) {
  const env = createSimulationEnv();
  env.reset({
    ...FIXED_BOARD_CONFIG,
    seed: spec.seed,
    episodeId: `fixed-bench-${boardId}`,
  });
  let count = 0;
  try {
    while (!env.isTerminal() && count < 2000) {
      env.runHeuristicPolicyDecision();
      count += 1;
    }
    const terminal = env.observe();
    const totals = terminal.publicState.players.map((p) => (
      (p.score || 0) + (p.securedEndGameBonus || 0)
    ));
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    console.log(
      `${boardId} (${spec.label}): ${totals.join(",")} | AVG=${avg.toFixed(1)} | decisions=${count}`,
    );
  } catch (error) {
    console.log(`${boardId} (${spec.label}): CRASH at decision ${count} - ${error.message}`);
  }
  env.dispose();
}
