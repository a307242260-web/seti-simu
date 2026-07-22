#!/usr/bin/env node
"use strict";

const { performance } = require("node:perf_hooks");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");

function parseArgs(argv) {
  const options = { games: 3, maxSteps: 200 };
  const keys = new Map([["--games", "games"], ["--max-steps", "maxSteps"]]);
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

function main() {
  const options = parseArgs(process.argv.slice(2));
  let decisions = 0;
  const startedAt = performance.now();
  for (let gameIndex = 0; gameIndex < options.games; gameIndex += 1) {
    const env = createSimulationEnv();
    const seed = `simulation-benchmark-v2:${gameIndex}`;
    let lastAction = null;
    try {
      env.reset({ seed, activePlayerCount: 4 });
      for (let step = 0; step < options.maxSteps && !env.isTerminal(); step += 1) {
        const action = chooseFastAction(env.legalActions());
        if (!action) throw new Error(`第 ${gameIndex + 1} 局第 ${step} 步没有合法动作`);
        lastAction = action;
        const result = env.step(action);
        if (!result.ok) throw new Error(result.error || "simulation step 失败");
        decisions += 1;
      }
      if (!env.isTerminal()) {
        const cursor = env.createCheckpoint()?.replayCursor?.stepIndex ?? null;
        throw new Error(
          `episode 未在 ${options.maxSteps} 步内终局：${JSON.stringify({
            episode: `simulation-benchmark-${gameIndex}`,
            seed,
            cursor,
            lastAction,
          })}`,
        );
      }
    } finally {
      env.dispose();
    }
  }
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "seti-rl-simulation-benchmark-v1",
    games: options.games,
    maxSteps: options.maxSteps,
    decisions,
    elapsedSeconds: Math.round(elapsedSeconds * 1000) / 1000,
    decisionsPerSecond: Math.round((decisions / elapsedSeconds) * 1000) / 1000,
    command: `node tools/benchmark_simulation_env.js --games ${options.games} --max-steps ${options.maxSteps}`,
  }, null, 2)}\n`);
}

main();
