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
let architectureOnly = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const option = process.argv[index];
  if (option === "--list") listOnly = true;
  else if (option === "--architecture") architectureOnly = true;
  else if (option === "--match" || option === "--exclude") {
    const value = process.argv[index + 1];
    if (!value) throw new Error(`${option} 需要一个路径子串`);
    (option === "--match" ? matches : excludes).push(value);
    index += 1;
  } else throw new Error(`未知参数：${option}`);
}

function collect(directory, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute, output);
    else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      output.push(path.relative(repositoryRoot, absolute).split(path.sep).join("/"));
    }
  }
}

const classifications = ["unit", "fullFlow", "merge", "architectureGate"];
const architectureModuleKeys = new Set(Object.keys(inventory.architectureModules));
const classified = new Map();
for (const classification of classifications) {
  for (const relative of inventory[classification]) {
    if (classified.has(relative)) throw new Error(`测试重复分类：${relative}`);
    classified.set(relative, classification);
  }
}

const diskTests = [];
collect(randomizerRoot, diskTests);
diskTests.sort();
const missing = [...classified.keys()].filter((relative) => !diskTests.includes(relative));
const unclassified = diskTests.filter((relative) => !classified.has(relative));
const invalidModules = [...inventory.unit, ...inventory.fullFlow].filter((relative) => {
  const modules = inventory.modulesFor(relative);
  return modules.length === 0 || modules.some((moduleKey) => !architectureModuleKeys.has(moduleKey));
});
if (missing.length || unclassified.length || invalidModules.length || inventory.fullFlow.length !== 1) {
  if (missing.length) process.stderr.write(`清单文件不存在：\n${missing.join("\n")}\n`);
  if (unclassified.length) process.stderr.write(`未分类测试：\n${unclassified.join("\n")}\n`);
  if (invalidModules.length) process.stderr.write(`未按 SETI-45 架构模块分类：\n${invalidModules.join("\n")}\n`);
  if (inventory.fullFlow.length !== 1) process.stderr.write(`full-flow 必须恰好一个，当前 ${inventory.fullFlow.length}\n`);
  process.exit(1);
}

const runnableTypes = architectureOnly ? new Set(["architectureGate"]) : new Set(["unit", "fullFlow"]);
const selected = diskTests
  .map((relative) => ({ relative, classification: classified.get(relative) }))
  .filter(({ classification }) => runnableTypes.has(classification))
  .filter(({ relative }) => matches.length === 0 || matches.some((value) => relative.includes(value)))
  .filter(({ relative }) => excludes.every((value) => !relative.includes(value)));

if (listOnly) {
  for (const relative of diskTests) {
    const modules = inventory.modulesFor(relative).map((key) => inventory.architectureModules[key]).join(" + ") || "独立架构闸门/待合并";
    process.stdout.write(`${classified.get(relative)}\t${modules}\t${relative}\n`);
  }
  for (const classification of classifications) {
    process.stdout.write(`COUNT ${classification}=${inventory[classification].length}\n`);
  }
  process.exit(0);
}

const totals = { unit: { passed: 0, failed: 0, milliseconds: 0 }, fullFlow: { passed: 0, failed: 0, milliseconds: 0 }, architectureGate: { passed: 0, failed: 0, milliseconds: 0 } };
const moduleCounts = Object.fromEntries([...architectureModuleKeys].map((key) => [key, 0]));
const failures = [];
for (const test of selected) {
  const startedAt = process.hrtime.bigint();
  for (const moduleKey of inventory.modulesFor(test.relative)) moduleCounts[moduleKey] += 1;
  const result = spawnSync(process.execPath, [path.join(repositoryRoot, test.relative)], { cwd: repositoryRoot, stdio: "inherit" });
  const milliseconds = Number(process.hrtime.bigint() - startedAt) / 1e6;
  totals[test.classification].milliseconds += milliseconds;
  if (result.status === 0) totals[test.classification].passed += 1;
  else {
    totals[test.classification].failed += 1;
    failures.push({ file: test.relative, status: result.status, signal: result.signal || null });
  }
}

for (const classification of [...runnableTypes]) {
  const total = totals[classification];
  process.stdout.write(`SUMMARY ${classification} passed=${total.passed} failed=${total.failed} total=${total.passed + total.failed} time=${(total.milliseconds / 1000).toFixed(2)}s\n`);
}
if (!architectureOnly) process.stdout.write(`SKIPPED merge=${inventory.merge.length} architectureGate=${inventory.architectureGate.length}\n`);
if (!architectureOnly) {
  for (const [moduleKey, count] of Object.entries(moduleCounts)) {
    process.stdout.write(`MODULE ${inventory.architectureModules[moduleKey]} tests=${count}\n`);
  }
}
for (const failure of failures) process.stderr.write(`FAIL ${failure.file} status=${failure.status} signal=${failure.signal || "none"}\n`);
if (failures.length) process.exitCode = 1;
