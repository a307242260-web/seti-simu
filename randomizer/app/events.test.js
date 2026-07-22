"use strict";

const assert = require("node:assert/strict");
const { routeProbeDecisionClick } = require("./events");

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

console.log("events tests passed");
