#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
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
const maxDecisionMilliseconds = maxDecisionValue == null ? null : Number(maxDecisionValue);
if (
  maxDecisionMilliseconds != null
  && (!Number.isFinite(maxDecisionMilliseconds) || maxDecisionMilliseconds <= 0)
) {
  throw new TypeError("--max-decision-ms 必须是正数");
}
const report = runFixedBoardTurnReport({
  ...(seed ? { config: { seed } } : {}),
  ...(boardId ? { boardId } : {}),
  ...(maxDecisionMilliseconds ? {
    maxDecisionMilliseconds: Number(maxDecisionMilliseconds),
  } : {}),
});
const output = outputPath && path.extname(outputPath).toLowerCase() === ".html"
  ? formatTurnReportHtml(report)
  : formatTurnReportMarkdown(report);
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, "utf8");
  process.stdout.write(`${outputPath}\n`);
} else {
  process.stdout.write(output);
}
