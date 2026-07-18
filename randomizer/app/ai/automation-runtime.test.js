"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const modulePath = path.resolve(__dirname, "automation-runtime.js");
delete globalThis.SetiAppAiAutomationRuntime;
delete require.cache[modulePath];
const moduleEntry = require(modulePath);

assert.equal(globalThis.SetiAppAiAutomationRuntime, moduleEntry);
assert.equal(typeof moduleEntry.createAutomationRuntime, "function");
assert.equal(new Set(moduleEntry.REQUIRED_CONTEXT_KEYS).size, moduleEntry.REQUIRED_CONTEXT_KEYS.length);

function createContext(overrides = {}) {
  const context = Object.fromEntries(
    moduleEntry.REQUIRED_CONTEXT_KEYS.map((key) => [key, () => null]),
  );
  return {
    ...context,
    ai: { policy: {} },
    cardEffects: {
      EFFECT_TYPES: {
        CARD_MOVE: "card_move",
        FREE_MOVE: "free_move",
      },
    },
    playerState: { currentPlayerId: "player-blue" },
    state: {},
    getAiAutoBattlePendingState: () => ({}),
    getCurrentPlayer: () => ({ id: "player-blue", colorLabel: "蓝色" }),
    hasActivePendingSubFlow: () => false,
    isActionEffectFlowActive: () => false,
    isGameEnded: () => false,
    ...overrides,
  };
}

{
  const calls = [];
  const runtime = moduleEntry.createAutomationRuntime(createContext({
    runAiAlienUseDecision: () => {
      calls.push("alien-use");
      return { ok: true, progressed: true, source: "alien-use" };
    },
    runAiAlienTraceDecision: () => {
      calls.push("alien-trace");
      return { ok: true, progressed: true, source: "alien-trace" };
    },
  }));
  assert.deepEqual(runtime.runAiNonTurnAutomationStep(), {
    ok: true,
    progressed: true,
    source: "alien-use",
  });
  assert.deepEqual(calls, ["alien-use"], "非回合 pending 必须命中首项后立即停止");
}

{
  let turnDecisions = 0;
  const runtime = moduleEntry.createAutomationRuntime(createContext({
    runAiTurnActionDecision: () => {
      turnDecisions += 1;
      return { ok: true, progressed: true, action: { id: "pass" } };
    },
  }));
  const result = runtime.runAiAutomationStep();
  assert.equal(result.action.id, "pass");
  assert.equal(turnDecisions, 1, "pending 全部 idle 后只进入一次顶层行动选择");
}

{
  const bugEntries = [];
  const runtime = moduleEntry.createAutomationRuntime(createContext({
    runAiAlienUseDecision: () => {
      throw new Error("automation exploded");
    },
    recordAiAutoBattleBug: (message, details) => {
      const entry = { message, details };
      bugEntries.push(entry);
      return entry;
    },
  }));
  const result = runtime.runAiAutomationStep();
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.message, "automation exploded");
  assert.match(bugEntries[0].details.stack, /automation exploded/);
}

{
  const runtime = moduleEntry.createAutomationRuntime(createContext());
  assert.equal(runtime.matchesAiTurnActionSelector(
    { id: "placeData", blueSlot: 2, target: { kind: "computer", row: 1 } },
    { id: "placeData", blueSlot: 2, target: { kind: "computer", row: 1 } },
  ), true);
  assert.equal(runtime.matchesAiTurnActionSelector(
    { id: "placeData", blueSlot: 2 },
    { id: "placeData", blueSlot: 3 },
  ), false);
}

console.log("app/ai/automation-runtime.test.js ok");
