#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const randomizerRoot = path.join(repositoryRoot, "randomizer");
const matches = [];
const excludes = [];
let listOnly = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const option = process.argv[index];
  if (option === "--list") {
    listOnly = true;
  } else if (option === "--match" || option === "--exclude") {
    const value = process.argv[index + 1];
    if (!value) throw new Error(`${option} 需要一个路径子串`);
    (option === "--match" ? matches : excludes).push(value);
    index += 1;
  } else {
    throw new Error(`未知参数：${option}`);
  }
}

function collect(directory, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute, output);
    else if (entry.isFile() && entry.name.endsWith(".test.js")) output.push(absolute);
  }
}

const tests = [];
collect(randomizerRoot, tests);
const selected = tests
  .map((absolute) => ({ absolute, relative: path.relative(repositoryRoot, absolute).split(path.sep).join("/") }))
  .filter(({ relative }) => matches.length === 0 || matches.some((value) => relative.includes(value)))
  .filter(({ relative }) => excludes.every((value) => !relative.includes(value)))
  .sort((left, right) => left.relative.localeCompare(right.relative));

if (listOnly) {
  selected.forEach(({ relative }) => process.stdout.write(`${relative}\n`));
  process.stdout.write(`SUMMARY total=${selected.length}\n`);
  process.exit(0);
}

let passed = 0;
const failures = [];
for (const test of selected) {
  const result = spawnSync(process.execPath, [test.absolute], { cwd: repositoryRoot, stdio: "inherit" });
  if (result.status === 0) passed += 1;
  else failures.push({ file: test.relative, status: result.status, signal: result.signal || null });
}

process.stdout.write(`SUMMARY passed=${passed} failed=${failures.length} total=${selected.length}\n`);
if (failures.length) {
  failures.forEach((failure) => process.stderr.write(`FAIL ${failure.file} status=${failure.status} signal=${failure.signal || "none"}\n`));
  process.exitCode = 1;
}
