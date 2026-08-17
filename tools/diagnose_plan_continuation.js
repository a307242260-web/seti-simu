#!/usr/bin/env node
"use strict";

/**
 * 计划延续诊断工具（record-once / analyze-many）。
 *
 * 设计目的：模拟盘单次决策全量反事实搜索很慢，无法支持「跑 N 局」式快速迭代。
 * 本工具把测量拆成两段：
 *
 *   1) record（慢，一次性）：完整跑一局（可 --max-decisions 截断），每次决策照常
 *      全量搜索，同时从结果里采样：选择的 action、winning leaf 的计划下一步、
 *      目录指纹（实际 + 计划假设）、赢面 margin、耗时构成与事实快照，写入 JSON。
 *   2) analyze（快，可无限次）：纯读 JSON，做同席连续决策配对，输出：
 *      - actualHit：计划下一步 == 新搜索实际选择（语义级），这是 fast-path 的
 *        理论上界命中率；
 *      - would-hit 预测器（stepLegal / directorySame / planAssumedSame / marginOk）
 *        的 precision/recall；
 *      - 失效原因分布：step-not-legal / directory-changed / margin 非正 /
 *        plan-degraded-or-alternative-improved；
 *      - 事实变化分布：相邻决策间 board.* / directory.* 哪些分量变了
 *        （旋转 / 行星槽 / alien / 扇区 / 公共牌 / 科技供应 / 火箭占位…）；
 *      - 可省时间上界：actualHit 决策的搜索耗时之和（可扣 fast-path 检查成本）。
 *
 * 用法：
 *   node tools/diagnose_plan_continuation.js --record out.json
 *   node tools/diagnose_plan_continuation.js --record out.json --max-decisions 120
 *   node tools/diagnose_plan_continuation.js --record out.json --seed seti-107
 *   node tools/diagnose_plan_continuation.js --analyze out.json
 *   node tools/diagnose_plan_continuation.js --analyze out.json --seat player-white
 *   node tools/diagnose_plan_continuation.js --analyze out.json --detail
 *   node tools/diagnose_plan_continuation.js --analyze out.json --fast-path-ms 20
 */

const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const {
  FIXED_BOARD_ID,
  FIXED_BOARD_CONFIG,
} = require("../randomizer/training/heuristic-policy.fixed-board");
const planContinuation = require("../randomizer/game/ai/plan-continuation");

const RECORD_SCHEMA_VERSION = "seti-plan-continuation-record-v1";

function readOption(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  if (!argv[index + 1]) throw new Error(`${name} 需要参数值`);
  return argv[index + 1];
}

function buildOptions() {
  const argv = process.argv.slice(2);
  const recordPath = readOption(argv, "--record");
  const analyzePath = readOption(argv, "--analyze");
  if (recordPath && analyzePath) throw new Error("--record 与 --analyze 互斥");
  if (!recordPath && !analyzePath) throw new Error("需要 --record <path> 或 --analyze <path>");
  const maxDecisionsValue = readOption(argv, "--max-decisions");
  const maxDecisions = maxDecisionsValue == null ? 200 : Number(maxDecisionsValue);
  if (!Number.isSafeInteger(maxDecisions) || maxDecisions <= 0) {
    throw new TypeError("--max-decisions 必须是正整数");
  }
  const fastPathMs = Number(readOption(argv, "--fast-path-ms") ?? 15);
  if (!Number.isFinite(fastPathMs) || fastPathMs < 0) {
    throw new TypeError("--fast-path-ms 必须是非负数");
  }
  return {
    recordPath,
    analyzePath,
    maxDecisions,
    seed: readOption(argv, "--seed"),
    boardId: readOption(argv, "--board-id"),
    seat: readOption(argv, "--seat"),
    detail: argv.includes("--detail"),
    fastPathMs,
  };
}

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

function captureDecision(input) {
  const {
    decisionNumber,
    seatId,
    family,
    chosenAction,
    legalActions,
    elapsedMilliseconds,
    diagnostics,
  } = input;
  const snapshot = planContinuation.extractPlanSnapshot({
    seatId,
    chosenAction,
    legalActions,
    actionOutcomes: input.actionOutcomes || [],
    rootObservation: (input.actionOutcomes || []).find((outcome) => (
      outcome?.rootObservation
    ))?.rootObservation || null,
  });
  return {
    decisionNumber,
    seatId,
    family,
    actionId: chosenAction.actionId,
    actionKey: planContinuation.actionSemanticKey(chosenAction),
    legalActionKeys: (legalActions || []).map(planContinuation.actionSemanticKey),
    legalActionIds: (legalActions || []).map((action) => action.actionId),
    plan: snapshot.plan,
    margin: snapshot.margin,
    topScore: snapshot.topScore,
    secondScore: snapshot.secondScore,
    elapsedMilliseconds,
    searched: diagnostics?.secondaryAgentSearch === true,
    executedNodeCount: Number(diagnostics?.executedNodeCount) || 0,
    timing: {
      fork: Number(diagnostics?.forkMilliseconds) || 0,
      execution: Number(diagnostics?.executionMilliseconds) || 0,
      projection: Number(diagnostics?.projectionMilliseconds) || 0,
      checkpoint: Number(diagnostics?.checkpointMilliseconds) || 0,
      frontier: Number(diagnostics?.frontierMilliseconds) || 0,
      orchestration: Number(diagnostics?.orchestrationMilliseconds) || 0,
      total: Number(diagnostics?.totalMilliseconds) || 0,
    },
    directoryFingerprint: snapshot.directoryFingerprint,
    directoryFingerprintWithRockets: snapshot.directoryFingerprintWithRockets,
    facts: snapshot.facts,
    planAssumedFacts: snapshot.plan?.planAssumedObservation
      ? planContinuation.directoryFactsSnapshot(snapshot.plan.planAssumedObservation)
      : null,
  };
}

function runRecord(options) {
  const env = createSimulationEnv();
  const decisions = [];
  let seed = null;
  try {
    const initialObservation = env.reset({
      ...FIXED_BOARD_CONFIG,
      ...(options.seed ? { seed: options.seed } : {}),
    });
    seed = initialObservation.seed;
    let decisionCount = 0;
    while (!env.isTerminal() && decisionCount < options.maxDecisions) {
      const beforeActions = env.legalActions();
      const startedAt = performance.now();
      const result = env.runHeuristicPolicyDecision();
      const elapsedMilliseconds = performance.now() - startedAt;
      decisionCount += 1;
      const chosen = beforeActions.find((action) => (
        action.actionId === result.policyDecision.actionId
      ));
      if (!chosen) {
        throw new Error(`第 ${decisionCount} 个 PolicyDecision 无法还原到 legal descriptor`);
      }
      decisions.push(captureDecision({
        decisionNumber: decisionCount,
        seatId: chosen.actorPlayerId || beforeActions[0]?.actorPlayerId,
        family: chosen.family,
        chosenAction: chosen,
        legalActions: beforeActions,
        actionOutcomes: result.actionOutcomes || [],
        elapsedMilliseconds,
        diagnostics: env.getCounterfactualDiagnostics() || {},
      }));
      if (decisionCount % 10 === 0) {
        process.stderr.write(
          `record: ${decisionCount} 决策，最近 ${Math.round(elapsedMilliseconds)}ms，`
          + `堆 ${(process.memoryUsage().heapUsed / 1048576).toFixed(0)}MB\n`,
        );
      }
    }
    const output = {
      schemaVersion: RECORD_SCHEMA_VERSION,
      boardId: options.boardId || FIXED_BOARD_ID,
      seed,
      policyVersion: FIXED_BOARD_CONFIG.policyVersion,
      decisionCount,
      partial: !env.isTerminal(),
      decisions,
    };
    fs.writeFileSync(options.recordPath, `${JSON.stringify(output)}\n`);
    process.stderr.write(`已写入 ${options.recordPath}（${decisions.length} 决策）\n`);
    return output;
  } finally {
    env.dispose();
  }
}

// ---------------------------------------------------------------------------
// analyze
// ---------------------------------------------------------------------------

function bySeatSequences(decisions, seatFilter) {
  const sequences = new Map();
  for (const record of decisions || []) {
    if (seatFilter && record.seatId !== seatFilter) continue;
    if (!sequences.has(record.seatId)) sequences.set(record.seatId, []);
    sequences.get(record.seatId).push(record);
  }
  return sequences;
}

function pairDecisions(sequences) {
  const pairs = [];
  for (const [seatId, records] of sequences) {
    for (let index = 0; index + 1 < records.length; index += 1) {
      const previous = records[index];
      const current = records[index + 1];
      const pair = planContinuation.pairContinuation(previous, current);
      if (!pair.applicable) continue;
      pairs.push({
        seatId,
        prevDecision: previous.decisionNumber,
        curDecision: current.decisionNumber,
        prevFamily: previous.family,
        curFamily: current.family,
        prevElapsedMs: Number(previous.elapsedMilliseconds) || 0,
        curElapsedMs: Number(current.elapsedMilliseconds) || 0,
        curSearched: current.searched === true,
        ...pair,
      });
    }
  }
  return pairs;
}

function formatRatio(numerator, denominator) {
  if (!denominator) return "n/a";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function printAggregate(title, pairs, options) {
  const stats = planContinuation.aggregateStats(pairs);
  const hitMs = pairs.filter((pair) => pair.actualHit).reduce((sum, pair) => (
    sum + pair.curElapsedMs
  ), 0);
  const netMs = pairs.filter((pair) => pair.actualHit).reduce((sum, pair) => (
    sum + Math.max(0, pair.curElapsedMs - options.fastPathMs)
  ), 0);
  const searchedPairs = pairs.filter((pair) => pair.curSearched);
  const searchedHitMs = searchedPairs.filter((pair) => pair.actualHit)
    .reduce((sum, pair) => sum + pair.curElapsedMs, 0);
  const searchedNetMs = searchedPairs.filter((pair) => pair.actualHit)
    .reduce((sum, pair) => sum + Math.max(0, pair.curElapsedMs - options.fastPathMs), 0);

  process.stdout.write(`\n=== ${title} ===\n`);
  process.stdout.write(
    `配对决策: ${stats.applicableCount} | 实际命中: ${stats.hitCount} (${formatRatio(stats.hitCount, stats.applicableCount)})\n`,
  );
  process.stdout.write(
    `可省时间上界(命中决策的搜索耗时): ${(hitMs / 1000).toFixed(1)}s`
    + ` | 扣 fast-path ${options.fastPathMs}ms: ${(netMs / 1000).toFixed(1)}s\n`,
  );
  const searchedTotalMs = searchedPairs.reduce((sum, pair) => sum + pair.curElapsedMs, 0);
  if (searchedPairs.length) {
    process.stdout.write(
      `其中 cur 为反事实搜索决策 ${searchedPairs.length} 对:`
      + ` 命中 ${searchedPairs.filter((pair) => pair.actualHit).length}`
      + ` (${formatRatio(searchedPairs.filter((pair) => pair.actualHit).length, searchedPairs.length)})`
      + ` | 可省 ${(searchedHitMs / 1000).toFixed(1)}s`
      + ` (占搜索决策总耗时 ${formatRatio(searchedHitMs, searchedTotalMs)})\n`,
    );
  }
  process.stdout.write("预测器 (precision=预测命中/预测, recall=预测命中/实际命中):\n");
  for (const [name, value] of Object.entries(stats.predictorStats)) {
    process.stdout.write(
      `  ${name.padEnd(28)} 预测 ${String(value.predicted).padStart(4)}`
      + `  误报 ${String(value.wrong).padStart(3)}`
      + `  precision ${value.precision == null ? "n/a" : (value.precision * 100).toFixed(1) + "%"}`
      + `  recall ${value.recall == null ? "n/a" : (value.recall * 100).toFixed(1) + "%"}\n`,
    );
  }
  if (Object.keys(stats.reasonCounts).length) {
    process.stdout.write("失效原因 (未命中决策):\n");
    for (const [reason, count] of Object.entries(stats.reasonCounts).sort((a, b) => b[1] - a[1])) {
      process.stdout.write(`  ${reason}: ${count}\n`);
    }
  }
  if (Object.keys(stats.changedCounts).length) {
    process.stdout.write("相邻决策 事实变化分量 (全部配对, 前 12; 含本席行动效果):\n");
    const sorted = Object.entries(stats.changedCounts).sort((a, b) => b[1] - a[1]);
    for (const [component, count] of sorted.slice(0, 12)) {
      process.stdout.write(`  ${component}: ${count}\n`);
    }
    if (sorted.length > 12) process.stdout.write(`  …共 ${sorted.length} 种分量\n`);
  }
  return stats;
}

function runAnalyze(options) {
  const data = JSON.parse(fs.readFileSync(options.analyzePath, "utf8"));
  if (data.schemaVersion !== RECORD_SCHEMA_VERSION) {
    throw new Error(`record schema 不匹配: ${data.schemaVersion}`);
  }
  const decisions = data.decisions || [];
  const sequences = bySeatSequences(decisions, options.seat);
  const pairs = pairDecisions(sequences);

  process.stdout.write(
    `record: ${data.boardId} seed=${data.seed} policy=${data.policyVersion}`
    + ` 决策数=${data.decisionCount} 截断=${data.partial ? "是" : "否"}\n`,
  );

  const bySeatPairs = new Map();
  for (const pair of pairs) {
    if (!bySeatPairs.has(pair.seatId)) bySeatPairs.set(pair.seatId, []);
    bySeatPairs.get(pair.seatId).push(pair);
  }
  for (const [seatId, seatPairs] of [...bySeatPairs.entries()].sort()) {
    const seatStats = printAggregate(`席位 ${seatId}`, seatPairs, options);
    process.stdout.write(`  席位 ${seatId}: ${seatStats.hitCount}/${seatStats.applicableCount}\n`);
  }
  printAggregate("总体", pairs, options);

  // 耗时构成（仅搜索决策的诊断分项；多个 evaluate 时是最后一个的）
  const searched = decisions.filter((record) => record.searched);
  if (searched.length) {
    const sums = { fork: 0, execution: 0, projection: 0, checkpoint: 0, frontier: 0, orchestration: 0 };
    for (const record of searched) {
      for (const key of Object.keys(sums)) sums[key] += record.timing?.[key] || 0;
    }
    const total = Object.values(sums).reduce((sum, value) => sum + value, 0) || 1;
    process.stdout.write("\n耗时构成（搜索决策诊断分项, 占搜索总耗时%）:\n");
    for (const [key, value] of Object.entries(sums)) {
      process.stdout.write(`  ${key.padEnd(14)} ${((value / total) * 100).toFixed(1)}%  (${(value / 1000).toFixed(1)}s)\n`);
    }
    process.stdout.write(`  ${"总".padEnd(14)} 100%  (${(total / 1000).toFixed(1)}s)\n`);
  }

  if (options.detail) {
    process.stdout.write("\n示例配对 (前 12 个未命中):\n");
    const misses = pairs.filter((pair) => !pair.actualHit);
    for (const pair of misses.slice(0, 12)) {
      process.stdout.write(
        `  #${pair.prevDecision}(${pair.seatId}/${pair.prevFamily}) →`
        + ` #${pair.curDecision}(${pair.curFamily}) [${pair.reasons.join(",")}]`
        + (pair.changed.length
          ? ` 变化: ${pair.changed.join(",")}`
          : "")
        + "\n",
      );
    }
  }
  return { pairs, sequences };
}

function main() {
  const options = buildOptions();
  if (options.recordPath) {
    runRecord(options);
    return;
  }
  runAnalyze(options);
}

main();
