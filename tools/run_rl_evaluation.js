#!/usr/bin/env node
"use strict";

const path = require("node:path");
const {
  runEvaluation,
  writeReport,
} = require("../randomizer/training/evaluation");

function printHelp() {
  console.log(`SETI RL evaluation harness

用法：
  node tools/run_rl_evaluation.js --checkpoint PATH [options]

选项：
  --checkpoint PATH        要评测的 self-play checkpoint（必填）
  --seed-pool PATH         固定 seed pool（默认 stable-200-v1）
  --report PATH            写入完整 JSON 报告
  --log PATH               写入可逐步回放的 JSONL
  --baseline-report PATH   与同 seed pool 的历史报告比较
  --max-steps N            覆盖单局最大决策步数
  --help                   显示帮助
`);
}

function parseArgs(argv) {
  const options = {};
  const valueOptions = new Map([
    ["--checkpoint", "checkpointPath"],
    ["--seed-pool", "seedPoolPath"],
    ["--report", "reportPath"],
    ["--log", "logPath"],
    ["--baseline-report", "baselineReportPath"],
    ["--max-steps", "maxSteps"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    const key = valueOptions.get(argument);
    if (!key) throw new Error(`未知参数：${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} 缺少参数值`);
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
  if (!options.checkpointPath) throw new Error("必须传入 --checkpoint");
  options.seedPoolPath ||= path.resolve(__dirname, "../randomizer/training/evaluation/stable-200-v1.seeds.json");
  if (options.baselineReportPath) {
    options.baselineReport = require(path.resolve(options.baselineReportPath));
  }
  options.onGameComplete = (game, completed, total) => {
    console.error(`[${completed}/${total}] ${game.seed} terminal=${game.terminal} blocked=${game.blocked} steps=${game.steps}`);
  };
  const report = runEvaluation(options);
  if (options.reportPath) writeReport(options.reportPath, report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.acceptance.passed) process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
}
