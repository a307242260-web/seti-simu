#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { runSelfPlay } = require("../randomizer/training/self-play");

function printHelp() {
  console.log(`SETI self-play training harness

用法：
  node tools/run_self_play_training.js [options]

选项：
  --episodes N              本次运行局数（默认 1）
  --seed TEXT               训练种子前缀
  --checkpoint PATH         每局边界写入的 checkpoint
  --checkpoint-every N      每 N 局写 checkpoint（默认 1）
  --resume PATH             从 checkpoint 恢复 agent、统计与 episode 游标
  --log PATH                逐步 JSONL 日志
  --report-dir PATH         每局 HTML 总结目录（默认与日志或 checkpoint 相邻的 reports）
  --evaluate                只评测，不更新 agent
  --max-steps N             单局最大决策步数（默认 100）
  --epsilon NUMBER          训练探索率（默认 0.1）
  --learning-rate NUMBER    action-kind Monte Carlo 学习率（默认 0.15）
  --active-player-count N   活跃玩家数（默认 4）
  --ai-difficulty TEXT      simulation AI 难度（默认 laughable）
  --help                    显示帮助
`);
}

function parseArgs(argv) {
  const options = {};
  const valueOptions = new Map([
    ["--episodes", "episodes"],
    ["--seed", "seed"],
    ["--checkpoint", "checkpointPath"],
    ["--checkpoint-every", "checkpointEvery"],
    ["--resume", "resumeFrom"],
    ["--log", "logPath"],
    ["--report-dir", "reportDirectory"],
    ["--max-steps", "maxSteps"],
    ["--epsilon", "epsilon"],
    ["--learning-rate", "learningRate"],
    ["--active-player-count", "activePlayerCount"],
    ["--ai-difficulty", "aiDifficulty"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--evaluate") {
      options.evaluate = true;
      continue;
    }
    const key = valueOptions.get(argument);
    if (!key) throw new Error(`未知参数：${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} 缺少参数值`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.resumeFrom && !options.checkpointPath && !options.evaluate) {
    options.checkpointPath = options.resumeFrom;
  }
  if (options.checkpointPath) options.checkpointPath = path.resolve(options.checkpointPath);
  if (options.resumeFrom) options.resumeFrom = path.resolve(options.resumeFrom);
  if (options.logPath) options.logPath = path.resolve(options.logPath);
  if (!options.reportDirectory) {
    const artifactPath = options.logPath || options.checkpointPath || options.resumeFrom;
    options.reportDirectory = artifactPath
      ? path.join(path.dirname(artifactPath), "reports")
      : path.resolve("checkpoint/self-play/reports");
  } else {
    options.reportDirectory = path.resolve(options.reportDirectory);
  }
  const result = runSelfPlay(options);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
}
