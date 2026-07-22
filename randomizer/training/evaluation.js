"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createSimulationEnv } = require("../app/simulation-env");
const {
  createRandomState,
  readCheckpoint,
  runEpisode,
} = require("./self-play");

const SEED_POOL_SCHEMA = "seti-rl-evaluation-seed-pool-v1";
const REPORT_SCHEMA = "seti-rl-evaluation-report-v1";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadSeedPool(seedPoolPath) {
  const seedPool = readJson(seedPoolPath);
  if (seedPool?.schemaVersion !== SEED_POOL_SCHEMA) {
    throw new Error(`不支持的评测 seed pool schema：${seedPool?.schemaVersion || "missing"}`);
  }
  if (seedPool.activePlayerCount !== 4) {
    throw new Error("稳定 200 协议只接受固定 4 人局");
  }
  if (!Array.isArray(seedPool.seeds) || seedPool.seeds.length === 0) {
    throw new Error("评测 seed pool 必须至少包含一个 seed");
  }
  const uniqueSeeds = new Set(seedPool.seeds.map(String));
  if (uniqueSeeds.size !== seedPool.seeds.length) {
    throw new Error("评测 seed pool 中不能包含重复 seed");
  }
  return seedPool;
}

function percentileNearestRank(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[rank - 1];
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function collectMetrics(games, activePlayerCount) {
  const scores = games.flatMap((game) => game.terminal ? game.scores : []);
  const actionAttempts = games.reduce((total, game) => total + game.totalActionAttempts, 0);
  const illegalActionAttempts = games.reduce((total, game) => total + game.illegalActionAttempts, 0);
  const terminalGames = games.filter((game) => game.terminal).length;
  const blockedGames = games.filter((game) => game.blocked).length;
  return {
    games: games.length,
    expectedScoreCount: games.length * activePlayerCount,
    scoreCount: scores.length,
    meanScore: scores.length
      ? round(scores.reduce((total, score) => total + score, 0) / scores.length)
      : null,
    p25: percentileNearestRank(scores, 0.25),
    p50: percentileNearestRank(scores, 0.5),
    p75: percentileNearestRank(scores, 0.75),
    minScore: scores.length ? Math.min(...scores) : null,
    maxScore: scores.length ? Math.max(...scores) : null,
    terminalGames,
    completionRate: games.length ? round(terminalGames / games.length) : 0,
    blockedGames,
    blockRate: games.length ? round(blockedGames / games.length) : 0,
    illegalActionAttempts,
    totalActionAttempts: actionAttempts,
    illegalActionRate: actionAttempts ? round(illegalActionAttempts / actionAttempts) : 0,
  };
}

function evaluateAcceptance(metrics, acceptance = {}) {
  const checks = {
    minimumGames: metrics.games >= Number(acceptance.minimumGames ?? 0),
    completeScoreSet: metrics.scoreCount === metrics.expectedScoreCount,
    meanScore: metrics.meanScore !== null && metrics.meanScore >= Number(acceptance.meanScore ?? 200),
    p25: metrics.p25 !== null && metrics.p25 >= Number(acceptance.p25 ?? 180),
    p50: metrics.p50 !== null && metrics.p50 >= Number(acceptance.p50 ?? 200),
    completionRate: metrics.completionRate >= Number(acceptance.completionRate ?? 1),
    illegalActionRate: metrics.illegalActionRate <= Number(acceptance.maxIllegalActionRate ?? 0),
    blockRate: metrics.blockRate <= Number(acceptance.maxBlockRate ?? 0),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}

function identifyCheckpoint(checkpoint, checkpointPath) {
  return {
    path: checkpointPath ? path.relative(process.cwd(), path.resolve(checkpointPath)) : null,
    schemaVersion: checkpoint.schemaVersion,
    agentSchemaVersion: checkpoint.agent?.schemaVersion || null,
    algorithm: checkpoint.agent?.algorithm || null,
    episodesTrained: Number(checkpoint.agent?.episodesTrained || 0),
  };
}

function compareReports(candidate, baseline) {
  if (candidate.protocol?.seedPoolId !== baseline.protocol?.seedPoolId) {
    throw new Error("只能比较使用同一 seed pool 的评测报告");
  }
  const metricKeys = [
    "meanScore", "p25", "p50", "p75", "completionRate", "illegalActionRate", "blockRate",
  ];
  return {
    baselineCheckpoint: baseline.checkpoint,
    deltas: Object.fromEntries(metricKeys.map((key) => [
      key,
      round(Number(candidate.metrics[key] || 0) - Number(baseline.metrics[key] || 0)),
    ])),
  };
}

function runEvaluation(options = {}) {
  const seedPool = options.seedPool || loadSeedPool(options.seedPoolPath);
  const checkpoint = options.checkpoint || readCheckpoint(options.checkpointPath);
  const envFactory = options.envFactory || createSimulationEnv;
  const maxSteps = Math.max(1, Number(options.maxSteps ?? seedPool.maxSteps ?? checkpoint.config?.maxSteps ?? 100));
  const games = [];
  seedPool.seeds.forEach((seed, index) => {
    const summary = runEpisode({
      envFactory,
      agent: checkpoint.agent,
      random: createRandomState(`${seedPool.id}:${seed}`),
      episodeIndex: index,
      episodeSeed: String(seed),
      seed: String(seed),
      activePlayerCount: 4,
      aiDifficulty: options.aiDifficulty ?? seedPool.aiDifficulty ?? checkpoint.config?.aiDifficulty ?? "laughable",
      maxSteps,
      evaluate: true,
      logPath: options.logPath,
    });
    const game = {
      index,
      seed: String(seed),
      steps: summary.steps,
      terminal: summary.terminal,
      blocked: summary.blocked,
      blockedReason: summary.blockedReason,
      illegalActionAttempts: summary.illegalActionAttempts,
      totalActionAttempts: summary.totalActionAttempts,
      scores: summary.terminal
        ? summary.players.map((player) => Number(player.finalScore ?? player.score))
        : [],
      players: summary.players,
    };
    games.push(game);
    options.onGameComplete?.(game, index + 1, seedPool.seeds.length);
  });
  const metrics = collectMetrics(games, 4);
  const report = {
    schemaVersion: REPORT_SCHEMA,
    protocol: {
      seedPoolId: seedPool.id,
      seedPoolSchemaVersion: seedPool.schemaVersion,
      activePlayerCount: 4,
      maxSteps,
      percentileMethod: "nearest-rank",
      scorePopulation: "all_terminal_seats",
      acceptance: seedPool.acceptance,
    },
    checkpoint: identifyCheckpoint(checkpoint, options.checkpointPath),
    metrics,
    acceptance: evaluateAcceptance(metrics, seedPool.acceptance),
    games,
  };
  if (options.baselineReport) {
    report.comparison = compareReports(report, options.baselineReport);
  }
  return report;
}

function writeReport(reportPath, report) {
  const absolutePath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

module.exports = {
  REPORT_SCHEMA,
  SEED_POOL_SCHEMA,
  collectMetrics,
  compareReports,
  evaluateAcceptance,
  loadSeedPool,
  percentileNearestRank,
  runEvaluation,
  writeReport,
};
