"use strict";

const assert = require("node:assert/strict");
const {
  buildEnvironmentEvents,
  drainHeadlessDeterministicEffects,
} = require("./headless-env");

function createEffectHarness(effectResult) {
  let active = true;
  const calls = { execute: 0, skip: 0 };
  return {
    calls,
    api: {
      listHeadlessConditionalActionCandidates: () => ({ candidates: [] }),
      listHeadlessTurnActionCandidates: () => ({ candidates: active ? [] : [{ id: "pass" }] }),
      getTurnState: () => ({ gameEnded: false }),
      advanceHeadlessDeterministicState: () => ({ progressed: false }),
      getAiAutoBattleProgress: () => ({
        pendingState: {
          actionEffectFlowActive: active,
          currentEffect: active
            ? { id: "effect-fixture-7", type: "fixture_reward", label: "测试效果" }
            : null,
        },
      }),
      getHeadlessDecisionOwnerState: () => ({ actorPlayerId: "player-brown" }),
      executeHeadlessCurrentActionEffect: () => {
        calls.execute += 1;
        if (effectResult.ok !== false) active = false;
        return structuredClone(effectResult);
      },
      skipHeadlessActionEffect: () => {
        calls.skip += 1;
        active = false;
        return { ok: true, skipped: true };
      },
    },
  };
}

const failureHarness = createEffectHarness({ ok: false, message: "生产执行器故障" });
const failure = drainHeadlessDeterministicEffects(failureHarness.api);
assert.equal(failure.ok, false);
assert.deepEqual(failure.final, {
  code: "HEADLESS_EFFECT_EXECUTION_FAILED",
  state: "action_effect",
  family: null,
  type: "fixture_reward",
  owner: "player-brown",
  message: "HEADLESS_EFFECT_EXECUTION_FAILED state=action_effect family=unknown type=fixture_reward owner=player-brown effect=effect-fixture-7 cause=生产执行器故障",
  effectId: "effect-fixture-7",
  cause: "生产执行器故障",
});
assert.deepEqual(failureHarness.calls, { execute: 1, skip: 0 }, "执行失败不得调用 skip 掩盖");
assert.equal(failure.steps.length, 1, "故障结果只保留内部诊断，不是成功 replay event");
assert.equal(failure.steps[0].ok, false);

const noTargetHarness = createEffectHarness({
  ok: true,
  progressed: true,
  skipped: true,
  noTarget: true,
  message: "无合法目标，按效果声明落空",
});
const noTarget = drainHeadlessDeterministicEffects(noTargetHarness.api);
assert.equal(noTarget.ok, true);
assert.equal(noTarget.boundary, "turn_action");
assert.deepEqual(noTargetHarness.calls, { execute: 1, skip: 0 });
assert.deepEqual(buildEnvironmentEvents(noTarget, 0, "fixture_parent"), [{
  eventIndex: 0,
  type: "auto_skip",
  family: null,
  target: null,
  ownerPlayerId: null,
  sourceActionType: "fixture_parent",
  irreversible: null,
}], "声明式无目标落空应作为成功环境事件推进");

console.log("headless effect failure tests passed");
