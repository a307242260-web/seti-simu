"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const standardAction = require("./standard-action");

assert.equal(standardAction.ALL_FAMILIES.length, 22);
assert.equal(new Set(standardAction.ALL_FAMILIES).size, 22, "22 family 必须唯一");

const executorSource = fs.readFileSync(
  path.resolve(__dirname, "../../app/ai/action-executor.js"),
  "utf8",
);
const enumerateSource = executorSource.slice(
  executorSource.indexOf("function enumerateHeadlessTurnActions()"),
  executorSource.indexOf("function executeAiTurnAction("),
);
assert.match(enumerateSource, /dispatchRuntimeAction\?\.\(\{ kind: "standard_enumerate" \}\)/);
assert.doesNotMatch(
  enumerateSource,
  /actions\.canExecute|quickTrades\.canExecuteTrade|canMoveRocket|canPlaceAnyData/,
  "训练枚举不得维护第二套 family legality",
);

const executeSource = executorSource.slice(
  executorSource.indexOf("function executeAiTurnAction("),
  executorSource.indexOf("function shouldRetryAiTurnAction("),
);
assert.match(executeSource, /dispatchRuntimeAction\(\{ standardAction: standardDescriptor \}\)/);

const actionRuntimeSource = fs.readFileSync(
  path.resolve(__dirname, "../../app/action-runtime.js"),
  "utf8",
);
assert.match(actionRuntimeSource, /standardActionAdapter\.enumerate/);
assert.match(actionRuntimeSource, /standardActionAdapter\.execute\(createActionContext\(\), standardDescriptor\)/);

const contractSource = fs.readFileSync(
  path.resolve(__dirname, "../../app/headless-contract.js"),
  "utf8",
);
assert.match(contractSource, /actionId: standardAction\.actionId/);

console.log("standard-action stage5 integration tests passed");
