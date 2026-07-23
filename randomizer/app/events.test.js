"use strict";

const assert = require("node:assert/strict");
const { createAppEventState, routeProbeDecisionClick, routeMainActionButtonClick } = require("./events");

function route(dataset, disabled = false) {
  const calls = [];
  const button = { dataset, disabled };
  const event = {
    target: {
      closest(selector) {
        const key = selector.slice(6, -1).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
        return Object.hasOwn(dataset, key) ? button : null;
      },
    },
  };
  const handled = routeProbeDecisionClick(event, {
    handleProbeSectorScanChoice: (rocketId) => calls.push(["sector", rocketId]),
    confirmProbeSectorScanSelection: () => calls.push(["confirm"]),
    handleProbeLocationRewardChoice: (rocketId) => calls.push(["location", rocketId]),
  });
  return { handled, calls };
}

assert.deepEqual(route({ probeScanRocketId: "rocket-1" }), {
  handled: true,
  calls: [["sector", "rocket-1"]],
});
assert.deepEqual(route({ probeScanConfirm: "true" }), {
  handled: true,
  calls: [["confirm"]],
});
assert.deepEqual(route({ probeLocationRewardRocketId: "rocket-2" }), {
  handled: true,
  calls: [["location", "rocket-2"]],
});
assert.deepEqual(route({ probeScanRocketId: "rocket-1" }, true), {
  handled: false,
  calls: [],
});
assert.deepEqual(route({ unrelated: "true" }), {
  handled: false,
  calls: [],
});

{
  const ui = { alienTracePickerState: { mode: "trace" }, moveHighlightRocketId: "rocket-1" };
  const state = createAppEventState({
    pending: {
      getPendingCardTriggerFreeMove: () => ({ id: "move" }),
      getActionEffectFlow: () => ({ id: "flow" }),
    },
    alien: { getPendingChongFossilChoice: () => ({ id: "fossil" }) },
    ui,
  });
  assert.deepEqual(state.pendingChongFossilChoice, { id: "fossil" });
  assert.deepEqual(state.pendingCardTriggerFreeMove, { id: "move" });
  assert.deepEqual(state.pendingActionEffectFlow, { id: "flow" });
  assert.equal(state.moveHighlightRocketId, "rocket-1");
  state.alienTracePickerState = { mode: "reveal" };
  assert.deepEqual(ui.alienTracePickerState, { mode: "reveal" });
}

{
  const calls = [];
  const button = {
    id: "action-scan-button",
    disabled: false,
    getAttribute: () => "false",
  };
  const handled = routeMainActionButtonClick({
    target: { closest: () => button },
  }, {
    actionBarMain: { contains: (candidate) => candidate === button },
    quickButton: null,
    dispatchStandardIntent: (family) => calls.push(family),
  });
  assert.equal(handled, true);
  assert.deepEqual(calls, ["scan"]);
}

console.log("events tests passed");
