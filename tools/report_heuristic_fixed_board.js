#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  formatDecisionSearchTraceHtml,
  formatTurnReportHtml,
  formatTurnReportMarkdown,
  runFixedBoardTurnReport,
} = require("../randomizer/training/heuristic-policy-turn-report");

function readOption(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  if (!argv[index + 1]) throw new Error(`${name} 需要参数值`);
  return argv[index + 1];
}

const argv = process.argv.slice(2);
const outputValue = readOption(argv, "--output");
const outputPath = outputValue ? path.resolve(outputValue) : null;
const seed = readOption(argv, "--seed");
const boardId = readOption(argv, "--board-id");
const maxDecisionValue = readOption(argv, "--max-decision-ms");
const traceDecisionValue = readOption(argv, "--trace-decision");
const focusDecisionValue = readOption(argv, "--focus-decision");
const maxDecisionMilliseconds = maxDecisionValue == null ? null : Number(maxDecisionValue);
if (
  maxDecisionMilliseconds != null
  && (!Number.isFinite(maxDecisionMilliseconds) || maxDecisionMilliseconds <= 0)
) {
  throw new TypeError("--max-decision-ms 必须是正数");
}
const focusDecision = focusDecisionValue == null ? null : Number(focusDecisionValue);
if (focusDecision != null && (!Number.isSafeInteger(focusDecision) || focusDecision <= 0)) {
  throw new TypeError("--focus-decision 必须是正整数");
}
const traceDecisionNumbers = traceDecisionValue == null
  ? []
  : traceDecisionValue.split(",").map((value) => Number(value.trim()));
if (focusDecision != null && !traceDecisionNumbers.includes(focusDecision)) {
  traceDecisionNumbers.push(focusDecision);
}
if (traceDecisionNumbers.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
  throw new TypeError("--trace-decision 必须是逗号分隔的正整数");
}
const report = runFixedBoardTurnReport({
  ...(seed ? { config: { seed } } : {}),
  ...(boardId ? { boardId } : {}),
  ...(maxDecisionMilliseconds ? {
    maxDecisionMilliseconds: Number(maxDecisionMilliseconds),
  } : {}),
  ...(traceDecisionNumbers.length ? { traceDecisionNumbers } : {}),
  ...(focusDecision != null ? { stopAfterDecision: focusDecision } : {}),
});
const output = outputPath && path.extname(outputPath).toLowerCase() === ".html"
  ? focusDecision == null
    ? formatTurnReportHtml(report)
    : formatDecisionSearchTraceHtml(report, focusDecision)
  : formatTurnReportMarkdown(report);
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, "utf8");
  process.stdout.write(`${outputPath}\n`);
} else {
  process.stdout.write(output);
}
