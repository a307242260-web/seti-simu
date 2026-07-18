"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const aiDir = __dirname;
const controllerSource = fs.readFileSync(path.join(aiDir, "../../app/ai-controller.js"), "utf8");
const indexSource = fs.readFileSync(path.join(aiDir, "../../index.html"), "utf8");
const modules = [
  "resource-valuation",
  "alien-valuation",
  "final-pace",
  "trade-candidates",
  "action-value",
  "demand-card",
  "route-planet",
  "tech-action",
  "scan-value",
  "card-candidates",
  "state-summary",
  "income-card",
  "movement-industry-data",
  "alien-choice-value",
  "tech-candidates",
  "selection-pressure",
];

for (const moduleName of modules) {
  const source = fs.readFileSync(path.join(aiDir, `${moduleName}.js`), "utf8");
  const lineCount = source.split(/\r?\n/).length;
  assert.ok(lineCount < 3000, `${moduleName}.js 应保持在 3000 行以内`);
  assert.doesNotMatch(source, /\bdocument\b|querySelector|\bels\b/, `${moduleName}.js 不得读取 DOM`);
  assert.match(indexSource, new RegExp(`game/ai/${moduleName}\\.js`), `${moduleName}.js 必须在浏览器入口装配`);
}

const migratedFunctionNames = modules.flatMap((moduleName) => {
  const source = fs.readFileSync(path.join(aiDir, `${moduleName}.js`), "utf8");
  return Array.from(source.matchAll(/^    function ([A-Za-z0-9_$]+)\(/gm), (match) => match[1]);
});
for (const functionName of migratedFunctionNames) {
  assert.doesNotMatch(
    controllerSource,
    new RegExp(`^    function ${functionName}\\(`, "m"),
    `${functionName} 的原函数体必须从 ai-controller.js 删除`,
  );
}
assert.ok(controllerSource.split(/\r?\n/).length < 6000, "ai-controller.js 应显著缩减到 6000 行以内");

console.log("game/ai/ai-domain-migration.test.js ok");
