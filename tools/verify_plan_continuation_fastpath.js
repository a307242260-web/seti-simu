#!/usr/bin/env node
"use strict";

/**
 * 计划延续 fast-path A/B 验证（同 seed 关/开对比）。
 *
 * fast-path 是显式近似（跳过全量搜索、直接提交上次计划出的下一步，含其
 * tie-break），验收口径与 benchmark_secondary_search 的「固定盘面四席终局分
 * 语义不变」一致：同一 seed 下开/关 fast-path 的终局分差应很小，命中率与
 * 失效原因与诊断一致。
 *
 * 用法：
 *   node tools/verify_plan_continuation_fastpath.js
 *   node tools/verify_plan_continuation_fastpath.js --max-decisions 120
 *   node tools/verify_plan_continuation_fastpath.js --seed seti-107
 */

const { performance } = require("node:perf_hooks");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const {
  FIXED_BOARD_ID,
  FIXED_BOARD_CONFIG,
} = require("../randomizer/training/heuristic-policy.fixed-board");

function readOption(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  if (!argv[index + 1]) throw new Error(`${name} 需要参数值`);
  return argv[index + 1];
}

function buildOptions() {
  const argv = process.argv.slice(2);
  const maxDecisionsValue = readOption(argv, "--max-decisions");
  const maxDecisions = maxDecisionsValue == null ? 200 : Number(maxDecisionsValue);
  if (!Number.isSafeInteger(maxDecisions) || maxDecisions <= 0) {
    throw new TypeError("--max-decisions 必须是正整数");
  }
  return {
    maxDecisions,
    seed: readOption(argv, "--seed"),
  };
}

function finalScoresOf(env) {
  const terminal = env.observe();
  return Object.fromEntries(
    (terminal.publicState?.players || []).map((player) => [
      player.playerId,
      Number(player.finalScore ?? player.score ?? 0),
    ]),
  );
}

function runGame(options, planContinuationFastPath) {
  const env = createSimulationEnv();
  try {
    const initialObservation = env.reset({
      ...FIXED_BOARD_CONFIG,
      ...(options.seed ? { seed: options.seed } : {}),
      planContinuationFastPath,
    });
    const startedAt = performance.now();
    let decisionCount = 0;
    let fastPathDecisions = 0;
    while (!env.isTerminal() && decisionCount < options.maxDecisions) {
      const result = env.runHeuristicPolicyDecision();
      decisionCount += 1;
      if (result?.planContinuationFastPath) fastPathDecisions += 1;
    }
    const elapsedMilliseconds = performance.now() - startedAt;
    const diagnostics = env.getDiagnostics() || {};
    return {
      planContinuationFastPath,
      decisionCount,
      fastPathDecisions,
      elapsedMilliseconds: Math.round(elapsedMilliseconds),
      finalScores: finalScoresOf(env),
      planContinuation: {
        hitCount: Number(diagnostics.planContinuationHitCount) || 0,
        missCount: Number(diagnostics.planContinuationMissCount) || 0,
        missReasons: diagnostics.planContinuationMissReasons || {},
      },
    };
  } finally {
    env.dispose();
  }
}

function main() {
  const options = buildOptions();
  const baseline = runGame(options, false);
  const fastPath = runGame(options, true);

  process.stdout.write(
    `盘面=${FIXED_BOARD_ID} seed=${options.seed || FIXED_BOARD_CONFIG.seed}`
    + ` 决策上限=${options.maxDecisions}\n`,
  );
  for (const run of [baseline, fastPath]) {
    process.stdout.write(`\n=== ${run.planContinuationFastPath ? "fast-path ON" : "baseline（全量搜索）"} ===\n`);
    process.stdout.write(`决策数=${run.decisionCount} 耗时=${run.elapsedMilliseconds}ms\n`);
    process.stdout.write(
      `终局分: ${Object.entries(run.finalScores).map(([seat, score]) => `${seat}=${score}`).join("  ")}\n`,
    );
    if (run.planContinuationFastPath) {
      process.stdout.write(
        `fast-path: 命中 ${run.planContinuation.hitCount} / miss ${run.planContinuation.missCount}`
        + ` (实际快路决策 ${run.fastPathDecisions})\n`,
      );
      process.stdout.write(
        `miss 原因: ${Object.entries(run.planContinuation.missReasons).map(([reason, count]) => `${reason}=${count}`).join("  ") || "无"}\n`,
      );
    }
  }

  const seatIds = Object.keys(baseline.finalScores);
  const deltas = seatIds.map((seat) => (
    Number(fastPath.finalScores[seat] || 0) - Number(baseline.finalScores[seat] || 0)
  ));
  const totalDelta = deltas.reduce((sum, delta) => sum + delta, 0);
  process.stdout.write(`\n终局分差 (ON - OFF): ${seatIds.map((seat, index) => `${seat}=${deltas[index] >= 0 ? "+" : ""}${deltas[index]}`).join("  ")}  四席合计 ${totalDelta >= 0 ? "+" : ""}${totalDelta}\n`);
  process.stdout.write(
    `fast-path 命中率: ${fastPath.planContinuation.hitCount}/${fastPath.planContinuation.hitCount + fastPath.planContinuation.missCount}`
    + ` = ${((fastPath.planContinuation.hitCount / Math.max(1, fastPath.planContinuation.hitCount + fastPath.planContinuation.missCount)) * 100).toFixed(1)}%\n`,
  );
}

main();
