"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const modulePath = path.resolve(__dirname, "action-executor.js");
delete globalThis.SetiAppAiActionExecutor;
delete require.cache[modulePath];
const moduleEntry = require(modulePath);

assert.equal(globalThis.SetiAppAiActionExecutor, moduleEntry);
assert.equal(typeof moduleEntry.createActionExecutor, "function");
assert.equal(new Set(moduleEntry.REQUIRED_CONTEXT_KEYS).size, moduleEntry.REQUIRED_CONTEXT_KEYS.length);

function createContext(overrides = {}) {
  const context = Object.fromEntries(
    moduleEntry.REQUIRED_CONTEXT_KEYS.map((key) => [key, () => null]),
  );
  const currentPlayer = { id: "player-blue", colorLabel: "蓝色", resources: {} };
  return {
    ...context,
    AI_DIFFICULTY_WEAK_START: "weak_start",
    FINAL_ROUND_NUMBER: 4,
    actions: { canExecute: () => ({ ok: false, message: "disabled" }) },
    ai: { policy: {} },
    aiNumber: (value) => Number(value || 0),
    alienGameState: {},
    finalScoringState: {},
    playerState: {},
    scanEffects: { canExecuteScan: () => ({ ok: false }), getStandardScanCost: () => ({}) },
    state: { pendingActionExecuted: true },
    turnState: { roundNumber: 1 },
    applyAiTurnActionSelectionPressure: (candidates) => candidates,
    buildAiIndustryCandidate: () => null,
    getAiMarkedFinalFormulaEntries: () => [],
    getAiTraceCompetitionState: () => null,
    getCurrentPlayer: () => currentPlayer,
    hasActivePendingSubFlow: () => false,
    isActionEffectFlowActive: () => false,
    isAiAutoBattlePlayer: () => true,
    listAiCardCornerQuickCandidates: () => [],
    listAiDataPlacementCandidates: () => [],
    listAiLateResourceRecoveryTradeCandidates: () => [],
    listAiMoveCandidates: () => [],
    listAiRunezuFaceSymbolQuickCandidates: () => [],
    recordAiAutoBattleLog: () => null,
    roundAiScore: (value) => Number(value || 0),
    scoreAiPassAction: () => 0,
    ...overrides,
  };
}

{
  const dispatched = [];
  const runtime = moduleEntry.createActionExecutor(createContext({
    dispatchRuntimeAction: (action) => {
      dispatched.push(action);
      return { ok: true, progressed: true, action };
    },
  }));
  const result = runtime.executeAiTurnAction({ id: "scan", score: 12 });
  assert.equal(result.ok, true);
  assert.deepEqual(dispatched, [{ kind: "scan", payload: { id: "scan", score: 12 } }]);
  assert.equal(runtime.shouldRetryAiTurnAction({ id: "scan" }, { ok: false }), true);
  assert.equal(runtime.shouldRetryAiTurnAction({ id: "pass" }, { ok: false }), false);
  assert.equal(
    runtime.rejectAiTurnActionCandidate([{ id: "scan" }], { id: "missing" }, { ok: false })[0].available,
    undefined,
    "只按候选对象身份剔除失败项",
  );
}

{
  const calls = [];
  const runtime = moduleEntry.createActionExecutor(createContext({
    beginPlayCardSelection: () => {
      calls.push("begin");
      return { ok: true };
    },
    handlePlayCardSelect: (handIndex) => {
      calls.push(`select:${handIndex}`);
      return { ok: true };
    },
    confirmPlayCardSelection: () => {
      calls.push("confirm");
      return { ok: true, played: true };
    },
  }));
  const result = runtime.executeAiTurnAction(
    { id: "playCard", handIndex: 2 },
    undefined,
    { bypassRuntimeDispatch: true },
  );
  assert.equal(result.played, true, "headless 打牌应执行预校验候选，不应只打开选择态");
  assert.deepEqual(calls, ["begin", "select:2", "confirm"]);
}

{
  const logs = [];
  let dispatched = null;
  const runtime = moduleEntry.createActionExecutor(createContext({
    ai: {
      policy: {
        chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "end-turn"),
      },
    },
    dispatchRuntimeAction: (action) => {
      dispatched = action;
      return { ok: true, progressed: true };
    },
    recordAiAutoBattleLog: (type, message, details) => logs.push({ type, message, details }),
  }));
  const result = runtime.runAiTurnActionDecision();
  assert.equal(result.ok, true);
  assert.equal(dispatched.kind, "end-turn");
  assert.equal(logs[0].type, "turn-action");
  assert.equal(logs[0].details.action.id, "end-turn");
}

{
  const runtime = moduleEntry.createActionExecutor(createContext({
    ai: {
      planner: {
        chooseTurnPlan: () => ({
          key: "pass",
          type: "pass",
          score: -2,
          firstAction: { id: "pass", kind: "pass", score: -2 },
        }),
      },
    },
  }));
  assert.deepEqual(runtime.buildAiPlannerShadowDecision([], {}, { id: "player-blue" }, { id: "scan" }), {
    key: "pass",
    type: "pass",
    score: -2,
    firstAction: {
      id: "pass",
      kind: "pass",
      score: -2,
      actionGraphNet: null,
      planActionId: null,
    },
    policyActionId: "scan",
    diverged: true,
  });
}

console.log("app/ai/action-executor.test.js ok");
