#!/usr/bin/env node
"use strict";

const { performance } = require("node:perf_hooks");
const { HeadlessWorkerPool } = require("../randomizer/training/worker-pool");

function parseArgs(argv) {
  const options = { workers: 1, gamesPerWorker: 1, maxSteps: 200, timeoutMs: 180000 };
  const keys = new Map([
    ["--workers", "workers"],
    ["--games-per-worker", "gamesPerWorker"],
    ["--max-steps", "maxSteps"],
    ["--timeout-ms", "timeoutMs"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = keys.get(argv[index]);
    if (!key) throw new Error(`未知参数：${argv[index]}`);
    const value = Number(argv[++index]);
    if (!Number.isInteger(value) || value < 1) throw new Error(`${argv[index - 1]} 必须是正整数`);
    options[key] = value;
  }
  return options;
}

function chooseFastAction(actions) {
  return actions.find((action) => action.family === "pass")
    || actions.find((action) => action.family === "end_turn")
    || actions[0]
    || null;
}

function measureSerialization() {
  const sample = {
    schemaVersion: "seti-rl-ipc-v1",
    requestId: 1,
    operation: "batch",
    payload: {
      requests: Array.from({ length: 32 }, (_, index) => ({
        workerId: index,
        operation: "step",
        payload: { action: { actionId: `pass:${index}`, actorPlayerId: `player-${index % 4}` } },
      })),
    },
  };
  const iterations = 5000;
  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) JSON.parse(JSON.stringify(sample));
  const seconds = (performance.now() - startedAt) / 1000;
  return {
    iterations,
    batchSize: 32,
    roundTripsPerSecond: iterations / seconds,
    decisionsPerSecond: iterations * 32 / seconds,
  };
}

async function measureInferenceIdle(workers) {
  const iterations = 10000;
  const batch = Array.from({ length: workers }, (_, index) => ({ workerId: index, logits: [0, 1, 0] }));
  const infer = async (items) => items.map((item) => ({ workerId: item.workerId, maskIndex: 1 }));
  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) await infer(batch);
  const seconds = (performance.now() - startedAt) / 1000;
  return {
    iterations,
    batchSize: workers,
    batchesPerSecond: iterations / seconds,
    decisionsPerSecond: iterations * workers / seconds,
  };
}

async function measureEnvironment(options) {
  const pool = new HeadlessWorkerPool({
    size: options.workers,
    timeoutMs: options.timeoutMs,
    maxPendingPerWorker: 1,
  });
  let decisions = 0;
  let resetMilliseconds = 0;
  let stepMilliseconds = 0;
  let phaseBreakdown = null;
  try {
    for (let game = 0; game < options.gamesPerWorker; game += 1) {
      const resetStartedAt = performance.now();
      const resetBatch = await pool.batch(Array.from({ length: options.workers }, (_, workerId) => ({
        workerId,
        operation: "reset",
        payload: {
          config: {
            seed: `worker-benchmark-v1:${game}:${workerId}`,
            activePlayerCount: 4,
            episodeId: `benchmark-${game}-${workerId}`,
            policyVersion: "fast-terminal-v1",
            opponentIdentity: "self-play",
            seat: "all",
          },
        },
      })));
      resetMilliseconds += performance.now() - resetStartedAt;
      const states = new Map();
      const lastActions = new Map();
      for (const item of resetBatch) {
        if (!item.ok) throw new Error(`worker ${item.workerId} reset 失败：${item.error.message}`);
        states.set(item.workerId, item.result);
      }
      for (let step = 0; step < options.maxSteps; step += 1) {
        const active = [...states.entries()].filter(([, state]) => !state.terminal);
        if (!active.length) break;
        const stepStartedAt = performance.now();
        const stepBatch = await pool.batch(active.map(([workerId, state]) => ({
          workerId,
          operation: "step",
          payload: { action: chooseFastAction(state.legalActions) },
        })));
        for (const [workerId, state] of active) {
          lastActions.set(workerId, chooseFastAction(state.legalActions));
        }
        stepMilliseconds += performance.now() - stepStartedAt;
        for (const item of stepBatch) {
          if (!item.ok) throw new Error(`worker ${item.workerId} step 失败：${item.error.message}`);
          decisions += 1;
          states.set(item.workerId, {
            observation: item.result.observation,
            legalActions: item.result.legalActions,
            terminal: item.result.done,
          });
        }
      }
      if ([...states.values()].some((state) => !state.terminal)) {
        const stalled = [];
        for (const [workerId, state] of states.entries()) {
          if (state.terminal) continue;
          const checkpoint = await pool.request(workerId, "checkpoint");
          stalled.push({
            episode: `benchmark-${game}-${workerId}`,
            seed: `worker-benchmark-v1:${game}:${workerId}`,
            cursor: checkpoint?.replayCursor?.stepIndex ?? null,
            lastAction: lastActions.get(workerId) || null,
          });
        }
        throw new Error(`存在 episode 未在 ${options.maxSteps} 步内终局：${JSON.stringify(stalled)}`);
      }
    }
    const diagnosticBatch = await pool.batch(Array.from({ length: options.workers }, (_, workerId) => ({
      workerId,
      operation: "diagnostics",
    })));
    phaseBreakdown = diagnosticBatch.reduce((totals, item) => {
      if (!item.ok) return totals;
      for (const [key, value] of Object.entries(item.result)) {
        totals[key] = Number(totals[key] || 0) + Number(value || 0);
      }
      return totals;
    }, {});
  } finally {
    await pool.close();
  }
  const totalSeconds = (resetMilliseconds + stepMilliseconds) / 1000;
  return {
    workers: options.workers,
    games: options.workers * options.gamesPerWorker,
    decisions,
    resetSeconds: resetMilliseconds / 1000,
    stepSeconds: stepMilliseconds / 1000,
    totalSeconds,
    aggregateDecisionsPerSecond: decisions / totalSeconds,
    stepOnlyDecisionsPerSecond: decisions / (stepMilliseconds / 1000),
    workerPhaseBreakdown: phaseBreakdown,
    targetDecisionsPerSecond: 50,
    targetMet: decisions / totalSeconds >= 50,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = {
    schemaVersion: "seti-rl-worker-benchmark-v1",
    command: `node tools/benchmark_rl_workers.js --workers ${options.workers} --games-per-worker ${options.gamesPerWorker} --max-steps ${options.maxSteps}`,
    nodeVersion: process.version,
    serializationIdle: measureSerialization(),
    inferenceIdle: await measureInferenceIdle(options.workers),
    environment: await measureEnvironment(options),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.environment.targetMet) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
