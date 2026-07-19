"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const controllerStart = appSource.indexOf("createAiController({");
const controllerEnd = appSource.indexOf("\n  });", controllerStart);
assert.notEqual(controllerStart, -1, "app.js 应装配 AI controller");
assert.notEqual(controllerEnd, -1, "AI controller context 应有稳定结束边界");

const controllerContext = appSource.slice(controllerStart, controllerEnd);
for (const name of [
  "confirmCardTaskCompletion",
  "executeFreeMoveForCardTrigger",
  "getReadyCardTasks",
  "handleCardTriggerChoice",
  "cancelCardTriggerChoice",
]) {
  assert.match(
    controllerContext,
    new RegExp(`${name}: \\(\\.\\.\\.args\\) => ${name}\\?\\.\\(\\.\\.\\.args\\)`),
    `${name} 必须延迟解析，不能在 Card Trigger runtime 初始化前按值注入`,
  );
}

const cardTriggerStart = appSource.indexOf("createCardTriggerRuntime({");
const cardTriggerEnd = appSource.indexOf("\n  });", cardTriggerStart);
assert.notEqual(cardTriggerStart, -1, "app.js 应装配 Card Trigger runtime");
assert.match(
  appSource.slice(cardTriggerStart, cardTriggerEnd),
  /\n    getPendingOwnerFields,/,
  "Card Trigger runtime 必须显式注入 pending owner mapper",
);

const cardTriggerSource = fs.readFileSync(path.resolve(__dirname, "card-trigger-runtime.js"), "utf8");
assert.match(
  cardTriggerSource.slice(0, cardTriggerSource.indexOf("    } = context;")),
  /\n      getPendingOwnerFields,/,
  "Card Trigger runtime 必须从显式 context 解构 pending owner mapper",
);

console.log("AI controller browser late-binding tests passed");
