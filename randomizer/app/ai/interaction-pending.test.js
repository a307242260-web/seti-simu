"use strict";

const assert = require("node:assert/strict");
const moduleEntry = require("./interaction-pending");

const context = Object.fromEntries(
  moduleEntry.REQUIRED_CONTEXT_KEYS.map((key) => [key, () => null]),
);
Object.assign(context, {
  els: { scanTargetActions: null },
  enrichAiAlienUseOptions: (options) => options,
});

const runtime = moduleEntry.createInteractionPendingRuntime(context);
const options = runtime.listAiAlienUseOptions({
  type: "amiba-symbol",
  pending: { symbolSlotIds: ["blue-1", "blue-3"] },
  selector: "[data-amiba-symbol-choice]",
  getChoice: () => null,
  allowCancel: true,
});

assert.deepEqual(options.map((option) => option.choice), ["blue-1", "blue-3"]);
assert.ok(options.every((option) => option.synthetic && !option.disabled));

console.log("app/ai/interaction-pending.test.js ok");
