"use strict";

const assert = require("node:assert/strict");
const { createHeadlessEnv } = require("./headless-env");

const poisonedGlobals = [
  "document",
  "localStorage",
  "Image",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle",
  "alert",
  "confirm",
  "prompt",
];
const originalDescriptors = new Map();
const accessCounts = Object.fromEntries(poisonedGlobals.map((key) => [key, 0]));

function installPoisonGetters() {
  for (const key of poisonedGlobals) {
    originalDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get() {
        accessCounts[key] += 1;
        throw new Error(`headless 禁止读取浏览器全局：${key}`);
      },
      set() {
        throw new Error(`headless 禁止写入浏览器全局：${key}`);
      },
    });
  }
}

function restoreGlobals() {
  for (const key of poisonedGlobals) {
    const descriptor = originalDescriptors.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}

const environments = [];
installPoisonGetters();
try {
  const source = createHeadlessEnv();
  environments.push(source);
  source.reset({ seed: "seti48-poison", activePlayerCount: 4 });
  const action = source.legalActions()[0];
  assert.ok(action, "poison getter 夹具应存在合法动作");
  const result = source.step(action);
  assert.equal(result.ok, true, result.error);
  const replay = source.getReplay();
  const checkpoint = source.createCheckpoint();

  const replayTarget = createHeadlessEnv();
  environments.push(replayTarget);
  replayTarget.loadReplay(replay);

  const checkpointTarget = createHeadlessEnv();
  environments.push(checkpointTarget);
  checkpointTarget.loadCheckpoint(checkpoint);

  for (const env of environments) env.dispose();
  environments.length = 0;
  assert.deepEqual(
    accessCounts,
    Object.fromEntries(poisonedGlobals.map((key) => [key, 0])),
    "reset/step/replay/checkpoint/dispose 不得读取浏览器全局或 UI callback",
  );
} finally {
  for (const env of environments) {
    try {
      env.dispose();
    } catch (_error) {
      // 保留首个 poison getter 失败作为测试根因。
    }
  }
  restoreGlobals();
}

console.log("headless no-browser-globals tests passed");
