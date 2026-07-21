#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  formatTurnReportMarkdown,
  runFixedBoardTurnReport,
} = require("../randomizer/training/heuristic-policy-turn-report");

function readOutputPath(argv) {
  const index = argv.indexOf("--output");
  if (index < 0) return null;
  if (!argv[index + 1]) throw new Error("--output 需要文件路径");
  return path.resolve(argv[index + 1]);
}

const markdown = formatTurnReportMarkdown(runFixedBoardTurnReport());
const outputPath = readOutputPath(process.argv.slice(2));
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown, "utf8");
  process.stdout.write(`${outputPath}\n`);
} else {
  process.stdout.write(markdown);
}
