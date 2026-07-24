"use strict";

const assert = require("node:assert/strict");
const eventsApi = require("./events");
const { routeMainActionButtonClick } = eventsApi;

assert.equal(
  Object.hasOwn(eventsApi, "routeProbeDecisionClick"),
  false,
  "专用 probe Decision DOM router 必须物理删除，由通用 Decision UI 持有 choice identity",
);

{
  const calls = [];
  const button = {
    id: "action-scan-button",
    dataset: { actionId: "scan:current" },
    disabled: false,
    getAttribute: () => "false",
  };
  const handled = routeMainActionButtonClick({
    target: { closest: () => button },
  }, {
    actionBarMain: { contains: (candidate) => candidate === button },
    quickButton: null,
    activateAction: (actionId) => calls.push(actionId),
  });
  assert.equal(handled, true);
  assert.deepEqual(calls, ["scan:current"]);
}

console.log("events tests passed");
