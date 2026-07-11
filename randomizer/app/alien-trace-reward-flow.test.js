"use strict";

const assert = require("node:assert/strict");
const {
  resolveAllowedAlienSlotIds,
  resolveAlienTraceRewardFlow,
} = require("./alien-trace-reward-flow");

assert.deepEqual(resolveAllowedAlienSlotIds([], [1, 2, 3]), [], "an explicit empty restriction must remain empty");
assert.deepEqual(resolveAllowedAlienSlotIds(["2"], null), [2]);
assert.deepEqual(resolveAllowedAlienSlotIds(null, [1, 2, 3]), [1, 2, 3]);

{
  let finished = false;
  const flow = resolveAlienTraceRewardFlow({
    effect: { type: "alien_trace", label: "普通痕迹奖励" },
    allowedTraceTypes: ["pink", "yellow", "blue"],
    allowedAlienSlotIds: null,
    openFangzhouChoice: () => null,
    hasPanelPlacementTarget: (context) => {
      assert.equal(context.allowedAlienSlotIds, null, "a reward without targetRule must inspect every alien slot");
      return false;
    },
    beginPanelPlacement: () => assert.fail("a no-target reward must not open trace-board mode"),
    finishNoTarget: () => {
      finished = true;
      return { ok: true, alienTraceRewardLost: true };
    },
  });
  assert.equal(flow.route, "no-target");
  assert.equal(finished, true, "an unrestricted no-target trace reward must finish as lost");
}

{
  const eligibleSlots = [2];
  const flow = resolveAlienTraceRewardFlow({
    effect: { type: "alien_trace", options: { targetRule: "playerHasSameTrace" } },
    allowedTraceTypes: ["blue"],
    allowedAlienSlotIds: eligibleSlots,
    openFangzhouChoice: () => null,
    hasPanelPlacementTarget: (context) => {
      assert.deepEqual(context.allowedAlienSlotIds, eligibleSlots);
      assert.deepEqual(context.allowedTraceTypes, ["blue"]);
      return false;
    },
    finishNoTarget: () => ({ ok: true, alienTraceRewardLost: true }),
  });
  assert.equal(flow.route, "no-target", "a restricted reward must not treat a revealed but saturated slot as legal");
}

{
  let fangzhouOpened = false;
  const flow = resolveAlienTraceRewardFlow({
    effect: { type: "alien_trace", options: { targetRule: "playerHasSameTrace" } },
    allowedTraceTypes: ["pink"],
    allowedAlienSlotIds: [],
    openFangzhouChoice: (context) => {
      assert.deepEqual(context.allowedAlienSlotIds, []);
      fangzhouOpened = true;
      return null;
    },
    hasPanelPlacementTarget: (context) => {
      assert.deepEqual(context.allowedAlienSlotIds, []);
      return false;
    },
    finishNoTarget: () => ({ ok: true, alienTraceRewardLost: true }),
  });
  assert.equal(flow.route, "no-target");
  assert.equal(fangzhouOpened, true, "the app callback must receive the explicit empty restriction unchanged");
}

{
  let panelChecked = false;
  let finished = false;
  const unlockResult = { ok: true, message: "已解锁方舟牌" };
  const flow = resolveAlienTraceRewardFlow({
    effect: { type: "alien_trace" },
    allowedTraceTypes: ["pink"],
    openFangzhouChoice: () => unlockResult,
    hasPanelPlacementTarget: () => {
      panelChecked = true;
      return false;
    },
    finishNoTarget: () => {
      finished = true;
      return null;
    },
  });
  assert.equal(flow.route, "fangzhou");
  assert.equal(flow.result, unlockResult);
  assert.equal(panelChecked, false, "Fangzhou unlock must resolve before panel no-target fallback");
  assert.equal(finished, false);
}

{
  let effectAdvanced = false;
  const requiredEffect = {
    type: "alien_trace",
    required: true,
    options: { skippable: false },
  };
  const flow = resolveAlienTraceRewardFlow({
    effect: requiredEffect,
    openFangzhouChoice: () => null,
    hasPanelPlacementTarget: () => false,
    finishNoTarget: (context) => {
      assert.equal(context.effect, requiredEffect);
      effectAdvanced = true;
      return { ok: true, alienTraceRewardLost: true };
    },
  });
  assert.equal(flow.route, "no-target");
  assert.equal(effectAdvanced, true, "required/non-skippable effects must advance when the reward has no legal target");
}

{
  let placementStarted = false;
  const flow = resolveAlienTraceRewardFlow({
    effect: { type: "alien_trace" },
    openFangzhouChoice: () => null,
    hasPanelPlacementTarget: () => true,
    beginPanelPlacement: () => {
      placementStarted = true;
      return { ok: true, message: "请选择痕迹位" };
    },
    finishNoTarget: () => assert.fail("a legal panel reward must not be discarded"),
  });
  assert.equal(flow.route, "panel");
  assert.equal(placementStarted, true);
}

console.log("app/alien-trace-reward-flow.test.js ok");
