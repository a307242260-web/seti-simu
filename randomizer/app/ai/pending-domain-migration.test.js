"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appDir = path.resolve(__dirname, "..");
const randomizerDir = path.resolve(appDir, "..");
const controllerSource = fs.readFileSync(path.join(appDir, "ai-controller.js"), "utf8");
const indexSource = fs.readFileSync(path.join(randomizerDir, "index.html"), "utf8");
const moduleFiles = [
  "initial-card-pending.js",
  "interaction-pending.js",
  "action-executor.js",
  "automation-runtime.js",
];

assert.ok(controllerSource.split("\n").length < 3000, "ai-controller.js 应低于 3000 行");

for (const filename of moduleFiles) {
  const source = fs.readFileSync(path.join(__dirname, filename), "utf8");
  const functionNames = [...source.matchAll(/^    function\s+([A-Za-z_$][\w$]*)\s*\(/gm)]
    .map((match) => match[1]);
  assert.ok(functionNames.length > 0, `${filename} 应包含迁入的运行时函数`);
  assert.ok(source.split("\n").length < 3000, `${filename} 应低于 3000 行`);
  assert.match(source, /REQUIRED_CONTEXT_KEYS/, `${filename} 应声明窄 context 键`);
  assert.doesNotMatch(
    source,
    /^    (?:let|const|var)\s+pending[A-Z][A-Za-z0-9_$]*\s*=/m,
    `${filename} 不应重新持有 pending 状态`,
  );
  for (const functionName of functionNames) {
    assert.doesNotMatch(
      controllerSource,
      new RegExp(`\\bfunction\\s+${functionName}\\s*\\(`),
      `${functionName} 函数体应从 ai-controller.js 删除`,
    );
  }
  const moduleIndex = indexSource.indexOf(`./app/ai/${filename}`);
  const controllerIndex = indexSource.indexOf("./app/ai-controller.js");
  assert.ok(moduleIndex >= 0, `${filename} 应在浏览器入口装配`);
  assert.ok(moduleIndex < controllerIndex, `${filename} 应先于 ai-controller.js 加载`);
}

assert.doesNotMatch(
  controllerSource,
  /function\s+(?:executeAiTurnAction|runAiNonTurnAutomationStep|runAiAutomationStep)\s*\(/,
  "顶层 executor 与自动化编排函数体应真实迁出控制器",
);

assert.match(
  controllerSource,
  /AI app runtime context 缺少依赖/,
  "controller composition 应在装配时拒绝缺失的窄 context 依赖",
);

console.log("app/ai/pending-domain-migration.test.js ok");
