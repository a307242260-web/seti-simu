#!/usr/bin/env node
"use strict";

/**
 * 次级代理搜索"完备性 + 性能"可迭代 benchmark。
 *
 * 度量目标（评估函数优劣不参与）：
 * - 完备性：目标目录是否完整进入搜索（totalTargetSchedulerPrunedCount → 0）、
 *   搜索是否自然耗尽（naturalExhaustionDecisionCount → searchedDecisionCount）、
 *   beam 剪枝必须为 0。
 * - 性能：单次决策耗时分布（median/p90/max、>2s、>10s 计数）、物理执行节点总量。
 * - 语义不变性：固定盘面四席终局分（评估函数冻结，搜索改动不应改变最终分数语义）。
 *
 * 用法：
 *   node tools/benchmark_secondary_search.js                      # 全量跑并输出汇总 JSON
 *   node tools/benchmark_secondary_search.js --record out.json    # 全量跑并保存轨迹
 *   node tools/benchmark_secondary_search.js --replay out.json --samples "1,320,405"
 *   node tools/benchmark_secondary_search.js --replay out.json --sample-every 10
 *   node tools/benchmark_secondary_search.js --output summary.json --detail
 *   node tools/benchmark_secondary_search.js --max-decision-ms 10000   # 硬门禁（默认不设）
 */

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const {
  FIXED_BOARD_ID,
  FIXED_BOARD_CONFIG,
} = require("../randomizer/training/heuristic-policy.fixed-board");

const SCHEMA_VERSION = "seti-secondary-search-benchmark-v1";
const TRAJECTORY_SCHEMA_VERSION = "seti-secondary-search-trajectory-v1";

function readOption(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  if (!argv[index + 1]) throw new Error(`${name} 需要参数值`);
  return argv[index + 1];
}

function parseSamples(value) {
  if (!value) return null;
  return new Set(String(value).split(",")
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isSafeInteger(number) && number > 0));
}

function buildOptions() {
  const argv = process.argv.slice(2);
  const recordPath = readOption(argv, "--record");
  const replayPath = readOption(argv, "--replay");
  if (recordPath && replayPath) {
    throw new Error("--record 与 --replay 互斥");
  }
  const samples = parseSamples(readOption(argv, "--samples"));
  const sampleEvery = readOption(argv, "--sample-every");
  const sampleEveryNumber = sampleEvery == null ? null : Number(sampleEvery);
  if (sampleEveryNumber != null
    && (!Number.isSafeInteger(sampleEveryNumber) || sampleEveryNumber <= 0)) {
    throw new TypeError("--sample-every 必须是正整数");
  }
  const maxDecisionMilliseconds = readOption(argv, "--max-decision-ms");
  const maxDecisionNumber = maxDecisionMilliseconds == null
    ? 0
    : Number(maxDecisionMilliseconds);
  if (maxDecisionMilliseconds != null
    && (!Number.isFinite(maxDecisionMilliseconds) || maxDecisionMilliseconds <= 0)) {
    throw new TypeError("--max-decision-ms 必须是正数");
  }
  const maxDecisionsValue = readOption(argv, "--max-decisions");
  const maxDecisions = maxDecisionsValue == null ? 2000 : Number(maxDecisionsValue);
  if (!Number.isSafeInteger(maxDecisions) || maxDecisions <= 0) {
    throw new TypeError("--max-decisions 必须是正整数");
  }
  const seed = readOption(argv, "--seed");
  const boardId = readOption(argv, "--board-id");
  const outputPath = readOption(argv, "--output");
  return {
    recordPath,
    replayPath,
    samples,
    sampleEvery: sampleEveryNumber,
    maxDecisionMilliseconds: maxDecisionNumber,
    maxDecisions,
    seed,
    boardId,
    outputPath,
    detail: argv.includes("--detail"),
  };
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * ratio) - 1];
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function summarizeDecisions(decisions, detail) {
  const searched = decisions.filter((record) => record.diagnostics?.secondaryAgentSearch === true);
  const times = decisions.map((record) => record.elapsedMilliseconds);
  const sortedTimes = [...times].sort((left, right) => left - right);
  const completeness = {
    fullCoverageDecisionCount: searched.filter((record) => (
      Number(record.diagnostics.targetSchedulerPrunedCount) === 0
    )).length,
    totalTargetSchedulerPrunedCount: searched.reduce((total, record) => (
      total + (Number(record.diagnostics.targetSchedulerPrunedCount) || 0)
    ), 0),
    naturalExhaustionDecisionCount: searched.filter((record) => (
      !record.diagnostics.executionLimitReached
      && Number(record.diagnostics.remainingFrontierNodeCount) === 0
    )).length,
    limitHitDecisionCount: searched.filter((record) => (
      record.diagnostics.executionLimitReached === true
    )).length,
    totalRemainingFrontierNodes: searched.reduce((total, record) => (
      total + (Number(record.diagnostics.remainingFrontierNodeCount) || 0)
    ), 0),
    maxRemainingFrontierNodes: Math.max(0, ...searched.map((record) => (
      Number(record.diagnostics.remainingFrontierNodeCount) || 0
    ))),
    beamPrunedOriginTotal: searched.reduce((total, record) => (
      total + (Number(record.diagnostics.beamPrunedOriginCount) || 0)
    ), 0),
    totalTargetEquivalentChoicePrunedCount: searched.reduce((total, record) => (
      total + (Number(record.diagnostics.targetEquivalentChoicePrunedCount) || 0)
    ), 0),
    totalCompletedGoalTransitions: searched.reduce((total, record) => (
      total + (Number(record.diagnostics.completedGoalTransitionCount) || 0)
    ), 0),
    maxCompletedGoalDepth: Math.max(0, ...searched.map((record) => (
      Number(record.diagnostics.maxCompletedGoalDepth) || 0
    ))),
  };
  const slowest = [...searched]
    .sort((left, right) => right.elapsedMilliseconds - left.elapsedMilliseconds)
    .slice(0, 8)
    .map((record) => ({
      decisionNumber: record.decisionNumber,
      actor: record.actorPlayerId,
      family: record.family,
      milliseconds: Math.round(record.elapsedMilliseconds),
      executedNodeCount: record.diagnostics.executedNodeCount,
      executionLimitReached: Boolean(record.diagnostics.executionLimitReached),
      remainingFrontierNodeCount: record.diagnostics.remainingFrontierNodeCount,
      targetSchedulerPrunedCount: record.diagnostics.targetSchedulerPrunedCount,
      rootTargetCount: record.diagnostics.rootTargetCount,
    }));
  const performance = {
    medianMs: Math.round(median(times) * 100) / 100,
    p90Ms: Math.round(percentile(sortedTimes, 0.9) * 100) / 100,
    maxMs: Math.round(Math.max(0, ...times) * 100) / 100,
    over2000msCount: times.filter((value) => value > 2000).length,
    over10000msCount: times.filter((value) => value > 10000).length,
    totalExecutedNodes: searched.reduce((total, record) => (
      total + (Number(record.diagnostics.executedNodeCount) || 0)
    ), 0),
    slowestDecisions: slowest,
  };
  return {
    searchedDecisionCount: searched.length,
    completeness,
    performance,
    ...(detail
      ? {
        perDecision: decisions.map((record) => ({
          decisionNumber: record.decisionNumber,
          actorPlayerId: record.actorPlayerId,
          family: record.family,
          elapsedMilliseconds: Math.round(record.elapsedMilliseconds * 100) / 100,
          searched: record.diagnostics?.secondaryAgentSearch === true,
          ...(record.diagnostics?.secondaryAgentSearch === true ? {
            executedNodeCount: record.diagnostics.executedNodeCount,
            executionLimitReached: Boolean(record.diagnostics.executionLimitReached),
            remainingFrontierNodeCount: record.diagnostics.remainingFrontierNodeCount,
            rootTargetCount: record.diagnostics.rootTargetCount,
            targetSchedulerPrunedCount: record.diagnostics.targetSchedulerPrunedCount,
            targetEquivalentChoicePrunedCount: record.diagnostics.targetEquivalentChoicePrunedCount,
            beamPrunedOriginCount: record.diagnostics.beamPrunedOriginCount,
            maxCompletedGoalDepth: record.diagnostics.maxCompletedGoalDepth,
            completedGoalTransitionCount: record.diagnostics.completedGoalTransitionCount,
            transpositionHitCount: record.diagnostics.transpositionHitCount,
            sharedPhysicalExecutionOriginCount: record.diagnostics.sharedPhysicalExecutionOriginCount,
          } : {}),
        })),
      }
      : {}),
  };
}

function finalScoresOf(env) {
  const terminal = env.observe();
  return Object.fromEntries(
    (terminal.publicState?.players || []).map((player) => [
      player.playerLabel || player.playerId,
      Number(player.finalScore ?? player.score ?? 0),
    ]),
  );
}

function runFullGame(options) {
  const env = createSimulationEnv();
  const decisions = [];
  const trajectory = [];
  let partial = false;
  try {
    const initialObservation = env.reset({
      ...FIXED_BOARD_CONFIG,
      ...(options.seed ? { seed: options.seed } : {}),
    });
    const playerLabels = Object.fromEntries(
      (initialObservation.publicState?.players || []).map((player) => [
        player.playerId,
        player.playerLabel || player.playerId,
      ]),
    );
    let decisionCount = 0;
    while (!env.isTerminal() && decisionCount < options.maxDecisions) {
      const beforeActions = env.legalActions();
      const startedAt = performance.now();
      const result = env.runHeuristicPolicyDecision();
      const elapsedMilliseconds = performance.now() - startedAt;
      decisionCount += 1;
      if (
        options.maxDecisionMilliseconds > 0
        && elapsedMilliseconds > options.maxDecisionMilliseconds
      ) {
        throw new Error(
          `第 ${decisionCount} 次决策 ${result.policyDecision?.actionId || ""} `
          + `${elapsedMilliseconds.toFixed(2)}ms 超过 ${options.maxDecisionMilliseconds}ms 门禁`,
        );
      }
      const chosen = beforeActions.find((action) => (
        action.actionId === result.policyDecision.actionId
      ));
      if (!chosen) throw new Error(`无法还原第 ${decisionCount} 个 PolicyDecision`);
      const diagnostics = env.getCounterfactualDiagnostics() || {};
      decisions.push({
        decisionNumber: decisionCount,
        actorPlayerId: chosen.actorPlayerId || beforeActions[0]?.actorPlayerId,
        family: chosen.family,
        elapsedMilliseconds,
        diagnostics,
      });
      trajectory.push({
        decisionNumber: decisionCount,
        actionId: chosen.actionId,
        family: chosen.family,
        actorPlayerId: chosen.actorPlayerId || beforeActions[0]?.actorPlayerId,
      });
    }
    partial = !env.isTerminal();
    const summary = {
      schemaVersion: SCHEMA_VERSION,
      mode: options.recordPath ? "record" : "full",
      boardId: options.boardId || FIXED_BOARD_ID,
      seed: initialObservation.seed,
      policyVersion: FIXED_BOARD_CONFIG.policyVersion,
      decisionCount,
      partial,
      finalScores: finalScoresOf(env),
      ...summarizeDecisions(decisions, options.detail),
    };
    if (options.recordPath) {
      const trajectoryFile = {
        schemaVersion: TRAJECTORY_SCHEMA_VERSION,
        boardId: summary.boardId,
        seed: summary.seed,
        policyVersion: summary.policyVersion,
        decisions: trajectory,
      };
      fs.writeFileSync(options.recordPath, `${JSON.stringify(trajectoryFile, null, 2)}\n`);
    }
    return summary;
  } finally {
    env.dispose();
  }
}

function runReplay(options) {
  const trajectoryData = JSON.parse(fs.readFileSync(options.replayPath, "utf8"));
  if (trajectoryData.schemaVersion !== TRAJECTORY_SCHEMA_VERSION) {
    throw new Error(`轨迹 schema 不匹配: ${trajectoryData.schemaVersion}`);
  }
  const recorded = trajectoryData.decisions || [];
  if (!Array.isArray(recorded) || !recorded.length) {
    throw new Error("轨迹文件没有决策记录");
  }
  const sampleSet = options.samples || new Set();
  const sampleEvery = options.sampleEvery;
  const isSample = (decisionNumber) => (
    sampleSet.has(decisionNumber)
    || (sampleEvery != null && decisionNumber % sampleEvery === 0)
  );
  const env = createSimulationEnv();
  const decisions = [];
  let partial = false;
  try {
    const initialObservation = env.reset({
      ...FIXED_BOARD_CONFIG,
      ...(options.seed ? { seed: options.seed } : {}),
    });
    let decisionCount = 0;
    for (const step of recorded) {
      const expectedNumber = step.decisionNumber;
      if (decisionCount + 1 !== expectedNumber) {
        throw new Error(
          `轨迹序号不连续：当前 ${decisionCount + 1}，记录 ${expectedNumber}`
          + "（轨迹必须来自同一盘面/seed 的完整 record）",
        );
      }
      const beforeActions = env.legalActions();
      let elapsedMilliseconds = 0;
      let diagnostics = {};
      if (isSample(expectedNumber)) {
        const startedAt = performance.now();
        const result = env.runHeuristicPolicyDecision();
        elapsedMilliseconds = performance.now() - startedAt;
        if (
          options.maxDecisionMilliseconds > 0
          && elapsedMilliseconds > options.maxDecisionMilliseconds
        ) {
          throw new Error(
            `第 ${expectedNumber} 次采样决策 ${elapsedMilliseconds.toFixed(2)}ms `
            + `超过 ${options.maxDecisionMilliseconds}ms 门禁`,
          );
        }
        if (result.policyDecision.actionId !== step.actionId) {
          throw new Error(
            `轨迹漂移：第 ${expectedNumber} 次搜索选择 ${result.policyDecision.actionId} `
            + `≠ 记录 ${step.actionId}。replay 仅适用于不改变搜索选择的改动`
            + "（例如纯效率优化）；完备性改动请用完整 run/record 模式",
          );
        }
        diagnostics = env.getCounterfactualDiagnostics() || {};
      } else {
        const action = beforeActions.find((candidate) => candidate.actionId === step.actionId);
        if (!action) {
          throw new Error(
            `轨迹漂移：第 ${expectedNumber} 次决策找不到记录动作 ${step.actionId}`
            + "（此前某采样决策改变了轨迹）",
          );
        }
        const startedAt = performance.now();
        const result = env.step(action);
        elapsedMilliseconds = performance.now() - startedAt;
        if (!result?.ok) {
          throw new Error(`第 ${expectedNumber} 次决策提交失败: ${result?.error || "未知"}`);
        }
      }
      decisionCount += 1;
      decisions.push({
        decisionNumber: decisionCount,
        actorPlayerId: step.actorPlayerId,
        family: step.family,
        elapsedMilliseconds,
        diagnostics,
      });
      if (decisionCount >= options.maxDecisions) break;
    }
    partial = !env.isTerminal();
    return {
      schemaVersion: SCHEMA_VERSION,
      mode: "replay",
      boardId: options.boardId || trajectoryData.boardId || FIXED_BOARD_ID,
      seed: trajectoryData.seed,
      policyVersion: trajectoryData.policyVersion || FIXED_BOARD_CONFIG.policyVersion,
      decisionCount,
      partial,
      finalScores: finalScoresOf(env),
      ...summarizeDecisions(decisions, options.detail),
    };
  } finally {
    env.dispose();
  }
}

function main() {
  const options = buildOptions();
  const summary = options.replayPath
    ? runReplay(options)
    : runFullGame(options);
  const output = `${JSON.stringify(summary, null, 2)}\n`;
  if (options.outputPath) {
    fs.writeFileSync(options.outputPath, output);
    process.stdout.write(`已写入 ${options.outputPath}\n`);
  } else {
    process.stdout.write(output);
  }
}

main();
