#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const inventory = require("./node-test-inventory");

const repositoryRoot = path.resolve(__dirname, "..");
const randomizerRoot = path.join(repositoryRoot, "randomizer");
const matches = [];
const excludes = [];
let listOnly = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const option = process.argv[index];
  if (option === "--list") listOnly = true;
  else if (option === "--match" || option === "--exclude") {
    const value = process.argv[index + 1];
    if (!value) throw new Error(`${option} 需要一个路径子串`);
    (option === "--match" ? matches : excludes).push(value);
    index += 1;
  } else throw new Error(`未知参数：${option}`);
}

const classifications = ["unit", "fullFlow"];
const classified = new Map();
const requiredFields = ["file", "owner", "obligation", "counterexample"];
const invalidEntries = [];
for (const classification of classifications) {
  for (const test of inventory[classification]) {
    const invalidFields = requiredFields.filter(
      (field) => typeof test?.[field] !== "string" || !test[field].trim(),
    );
    if (invalidFields.length) invalidEntries.push({ classification, test, invalidFields });
    if (classified.has(test.file)) throw new Error(`测试重复分类：${test.file}`);
    classified.set(test.file, { ...test, classification });
  }
}

function collectTests(directory, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectTests(absolute, output);
    else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      output.push(path.relative(repositoryRoot, absolute).split(path.sep).join("/"));
    }
  }
}

const registeredTests = [...classified.values()].sort((left, right) => left.file.localeCompare(right.file));
const diskTests = [];
collectTests(randomizerRoot, diskTests);
diskTests.sort();
const missing = registeredTests.filter((test) => !fs.existsSync(path.join(repositoryRoot, test.file)));
const unregistered = diskTests.filter((file) => !classified.has(file));
if (missing.length || unregistered.length || invalidEntries.length || inventory.fullFlow.length !== 1) {
  if (missing.length) process.stderr.write(`清单文件不存在：\n${missing.map((test) => test.file).join("\n")}\n`);
  if (unregistered.length) process.stderr.write(`未登记测试：\n${unregistered.join("\n")}\n`);
  for (const invalid of invalidEntries) {
    process.stderr.write(`清单条目字段缺失：${invalid.classification} ${invalid.test?.file || "<unknown>"} ${invalid.invalidFields.join(",")}\n`);
  }
  if (inventory.fullFlow.length !== 1) process.stderr.write(`full-flow 必须恰好一个，当前 ${inventory.fullFlow.length}\n`);
  process.exit(1);
}

const selected = registeredTests
  .filter(({ file }) => matches.length === 0 || matches.some((value) => file.includes(value)))
  .filter(({ file }) => excludes.every((value) => !file.includes(value)));

if (listOnly) {
  for (const test of registeredTests) {
    process.stdout.write(`${test.classification}\t${test.owner}\t${test.file}\t${test.obligation}\t${test.counterexample}\n`);
  }
  for (const classification of classifications) {
    process.stdout.write(`COUNT ${classification}=${inventory[classification].length}\n`);
  }
  process.exit(0);
}

const totals = { unit: { passed: 0, failed: 0, milliseconds: 0 }, fullFlow: { passed: 0, failed: 0, milliseconds: 0 } };
const ownerCounts = {};
const failures = [];
for (const test of selected) {
  const startedAt = process.hrtime.bigint();
  ownerCounts[test.owner] = (ownerCounts[test.owner] || 0) + 1;
  const result = spawnSync(process.execPath, [path.join(repositoryRoot, test.file)], { cwd: repositoryRoot, stdio: "inherit" });
  const milliseconds = Number(process.hrtime.bigint() - startedAt) / 1e6;
  totals[test.classification].milliseconds += milliseconds;
  if (result.status === 0) totals[test.classification].passed += 1;
  else {
    totals[test.classification].failed += 1;
    failures.push({ file: test.file, status: result.status, signal: result.signal || null });
  }
}

for (const classification of classifications) {
  const total = totals[classification];
  process.stdout.write(`SUMMARY ${classification} passed=${total.passed} failed=${total.failed} total=${total.passed + total.failed} time=${(total.milliseconds / 1000).toFixed(2)}s\n`);
}
for (const [owner, count] of Object.entries(ownerCounts).sort(([left], [right]) => left.localeCompare(right))) {
  process.stdout.write(`OWNER ${owner} tests=${count}\n`);
}
for (const failure of failures) process.stderr.write(`FAIL ${failure.file} status=${failure.status} signal=${failure.signal || "none"}\n`);
if (failures.length) process.exitCode = 1;
