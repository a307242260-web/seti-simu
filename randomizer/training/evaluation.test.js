"use strict";

const assert = require("node:assert/strict");
const {
  REPORT_SCHEMA,
  collectMetrics,
  compareReports,
  evaluateAcceptance,
  percentileNearestRank,
  runEvaluation,
} = require("./evaluation");

function createFakeEnv() {
  let seed = null;
  let terminal = false;
  let stepIndex = 0;

  function observe() {
    const seedNumber = Number(seed.slice(-2));
    return {
      players: [0, 1, 2, 3].map((offset) => ({
        playerId: `player-${offset + 1}`,
        finalScore: terminal ? 175 + seedNumber * 10 + offset * 5 : null,
      })),
    };
  }

  return {
    reset(config) {
      seed = config.seed;
      terminal = false;
      stepIndex = 0;
      return observe();
    },
    legalActions() {
      return terminal ? [] : [{
        actionId: `pass:${stepIndex}`,
        actorPlayerId: "player-1",
        kind: "pass",
        maskIndex: 0,
      }];
    },
    step(action) {
      stepIndex += 1;
      terminal = true;
      return {
        ok: true,
        actorPlayerId: action.actorPlayerId,
        reward: { immediateScoreDelta: 0, terminalScoreDelta: 0 },
        done: true,
        observation: observe(),
      };
    },
    isTerminal() {
      return terminal;
    },
    dispose() {},
  };
}

assert.equal(percentileNearestRank([40, 10, 30, 20], 0.25), 10);
assert.equal(percentileNearestRank([40, 10, 30, 20], 0.5), 20);
assert.equal(percentileNearestRank([40, 10, 30, 20], 0.75), 30);

const metrics = collectMetrics([
  {
    terminal: true,
    blocked: false,
    scores: [180, 190, 200, 210],
    illegalActionAttempts: 0,
    totalActionAttempts: 10,
  },
  {
    terminal: true,
    blocked: false,
    scores: [200, 210, 220, 230],
    illegalActionAttempts: 0,
    totalActionAttempts: 10,
  },
], 4);
assert.equal(metrics.meanScore, 205);
assert.equal(metrics.p25, 190);
assert.equal(metrics.p50, 200);
assert.equal(metrics.p75, 210);
assert.equal(evaluateAcceptance(metrics, {
  minimumGames: 2,
  meanScore: 200,
  p25: 180,
  p50: 200,
  completionRate: 1,
  maxIllegalActionRate: 0,
  maxBlockRate: 0,
}).passed, true);

const checkpoint = {
  schemaVersion: "seti-self-play-checkpoint-v1",
  config: { aiDifficulty: "laughable", maxSteps: 10 },
  agent: {
    schemaVersion: "seti-action-kind-agent-v1",
    algorithm: "test-agent",
    epsilon: 0,
    episodesTrained: 3,
    actionValues: { pass: 1 },
  },
};
const seedPool = {
  schemaVersion: "seti-rl-evaluation-seed-pool-v1",
  id: "test-pool",
  activePlayerCount: 4,
  maxSteps: 10,
  seeds: ["fake-01", "fake-02", "fake-03"],
  acceptance: {
    minimumGames: 3,
    meanScore: 200,
    p25: 190,
    p50: 200,
    completionRate: 1,
    maxIllegalActionRate: 0,
    maxBlockRate: 0,
  },
};
const report = runEvaluation({ checkpoint, seedPool, envFactory: createFakeEnv });
assert.equal(report.schemaVersion, REPORT_SCHEMA);
assert.equal(report.metrics.games, 3);
assert.equal(report.metrics.scoreCount, 12);
assert.equal(report.metrics.meanScore, 202.5);
assert.equal(report.metrics.p25, 195);
assert.equal(report.metrics.p50, 200);
assert.equal(report.metrics.p75, 210);
assert.equal(report.acceptance.passed, true);
assert.deepEqual(report.games.map((game) => game.seed), seedPool.seeds);

const comparison = compareReports(report, {
  protocol: { seedPoolId: "test-pool" },
  checkpoint: { path: "baseline.json" },
  metrics: { meanScore: 200, p25: 190, p50: 195, p75: 205, completionRate: 1, illegalActionRate: 0, blockRate: 0 },
});
assert.equal(comparison.deltas.meanScore, 2.5);
assert.equal(comparison.deltas.p50, 5);

const checkedInBaseline = require("./evaluation/baseline-v1.report.json");
assert.equal(checkedInBaseline.protocol.seedPoolId, "stable-200-v1");
assert.deepEqual(checkedInBaseline.metrics, {
  games: 20,
  expectedScoreCount: 80,
  scoreCount: 80,
  meanScore: 7.1875,
  p25: 6,
  p50: 7,
  p75: 8,
  minScore: 4,
  maxScore: 11,
  terminalGames: 20,
  completionRate: 1,
  blockedGames: 0,
  blockRate: 0,
  illegalActionAttempts: 0,
  totalActionAttempts: 640,
  illegalActionRate: 0,
});
assert.equal(checkedInBaseline.acceptance.passed, false);

console.log("training/evaluation tests passed");
