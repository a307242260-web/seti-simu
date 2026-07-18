#!/usr/bin/env node
"use strict";

const { performance } = require("node:perf_hooks");
const { createHeadlessEnv } = require("../randomizer/app/headless-env");

function parseGames(argv) {
  const index = argv.indexOf("--games");
  if (index < 0) return 3;
  const games = Number(argv[index + 1]);
  if (!Number.isInteger(games) || games < 1) throw new Error("--games 必须是正整数");
  return games;
}

function chooseFastAction(actions) {
  return actions.find((action) => action.family === "pass")
    || actions.find((action) => action.family === "end_turn")
    || actions[0]
    || null;
}

function main() {
  const games = parseGames(process.argv.slice(2));
  let decisions = 0;
  const startedAt = performance.now();
  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    const env = createHeadlessEnv();
    try {
      env.reset({ seed: `headless-benchmark-v2:${gameIndex}`, activePlayerCount: 4 });
      for (let step = 0; step < 100 && !env.isTerminal(); step += 1) {
        const action = chooseFastAction(env.legalActions());
        if (!action) throw new Error(`第 ${gameIndex + 1} 局第 ${step} 步没有合法动作`);
        const result = env.step(action);
        if (!result.ok) throw new Error(result.error || "headless step 失败");
        decisions += 1;
      }
      if (!env.isTerminal()) throw new Error(`第 ${gameIndex + 1} 局未在 100 步内终局`);
    } finally {
      env.dispose();
    }
  }
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "seti-rl-headless-benchmark-v1",
    games,
    decisions,
    elapsedSeconds: Math.round(elapsedSeconds * 1000) / 1000,
    decisionsPerSecond: Math.round((decisions / elapsedSeconds) * 1000) / 1000,
    command: `node tools/benchmark_headless_env.js --games ${games}`,
  }, null, 2)}\n`);
}

main();
