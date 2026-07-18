"use strict";

const assert = require("node:assert/strict");
const {
  drainHeadlessDeterministicEffects,
  getHeadlessLegalBoundary,
} = require("./headless-env");

function createFailClosedHarness({ pendingState = {}, candidates = [] } = {}) {
  const calls = {
    turn: 0,
    executeConditional: 0,
    advance: 0,
    executeEffect: 0,
    skip: 0,
    resolver: 0,
    dom: 0,
    recover: 0,
  };
  const actorPlayer = { id: "player-green" };
  return {
    calls,
    api: {
      getAiAutoBattleProgress: () => ({ pendingState: structuredClone(pendingState) }),
      getHeadlessDecisionOwnerState: () => ({ actorPlayerId: actorPlayer.id }),
      listHeadlessConditionalActionCandidates: () => ({ actorPlayer, candidates: structuredClone(candidates) }),
      listHeadlessTurnActionCandidates: () => {
        calls.turn += 1;
        return { ok: true, currentPlayer: actorPlayer, candidates: [{ id: "pass" }] };
      },
      executeHeadlessConditionalAction: () => {
        calls.executeConditional += 1;
        return { ok: true };
      },
      advanceHeadlessDeterministicState: () => {
        calls.advance += 1;
        return { progressed: false };
      },
      executeHeadlessCurrentActionEffect: () => {
        calls.executeEffect += 1;
        return { ok: true };
      },
      skipHeadlessActionEffect: () => {
        calls.skip += 1;
        return { ok: true };
      },
      getTurnState: () => ({ gameEnded: false }),
      runAiPendingStep: () => { calls.resolver += 1; },
      queryDom: () => { calls.dom += 1; },
      recoverPendingAction: () => { calls.recover += 1; },
    },
  };
}

const cases = [
  {
    name: "unknown pending key",
    input: { pendingState: { pendingMysteryState: { type: "mystery_pending" } } },
    code: "HEADLESS_UNSUPPORTED_PENDING",
    state: "pendingMysteryState",
    type: "mystery_pending",
    family: null,
  },
  {
    name: "known key with unknown type",
    input: { pendingState: { pendingScanTargetType: "mystery_scan_type" } },
    code: "HEADLESS_UNSUPPORTED_PENDING_TYPE",
    state: "pendingScanTargetType",
    type: "mystery_scan_type",
    family: null,
  },
  {
    name: "unknown conditional family",
    input: {
      candidates: [{
        id: "conditionalChoice",
        family: "mystery_family",
        target: { kind: "mystery_kind", choiceId: "one" },
      }],
    },
    code: "HEADLESS_UNSUPPORTED_CONDITIONAL_FAMILY",
    state: "conditional_choice",
    type: "mystery_kind",
    family: "mystery_family",
  },
];

for (const testCase of cases) {
  const boundaryHarness = createFailClosedHarness(testCase.input);
  const boundary = getHeadlessLegalBoundary(boundaryHarness.api);
  assert.equal(boundary.ok, false, `${testCase.name} legal boundary 必须 fail-closed`);
  assert.deepEqual(boundary.candidates, [], `${testCase.name} 不得暴露顶层 legal action`);
  assert.deepEqual(boundary.error, {
    code: testCase.code,
    state: testCase.state,
    family: testCase.family,
    type: testCase.type,
    owner: "player-green",
    message: `${testCase.code} state=${testCase.state} family=${testCase.family || "unknown"} type=${testCase.type} owner=player-green`,
  });
  assert.equal(boundaryHarness.calls.turn, 0, `${testCase.name} 不得穿透到顶层 action`);

  const drainHarness = createFailClosedHarness(testCase.input);
  const resolution = drainHeadlessDeterministicEffects(drainHarness.api);
  assert.equal(resolution.ok, false, `${testCase.name} drain 必须 fail-closed`);
  assert.deepEqual(resolution.final, boundary.error);
  assert.deepEqual(resolution.steps, [], `${testCase.name} 不得伪造推进事件`);
  assert.deepEqual(drainHarness.calls, {
    turn: 0,
    executeConditional: 0,
    advance: 0,
    executeEffect: 0,
    skip: 0,
    resolver: 0,
    dom: 0,
    recover: 0,
  }, `${testCase.name} 不得调用 executor/resolver/DOM/recover/skip`);
}

console.log("headless fail-closed tests passed");
