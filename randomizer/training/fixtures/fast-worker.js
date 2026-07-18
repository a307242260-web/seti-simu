"use strict";

const { parentPort } = require("node:worker_threads");

let state = null;

parentPort.on("message", (message) => {
  const { requestId, operation, payload = {} } = message;
  if (operation === "crash") process.exit(17);
  if (operation === "hang") return;
  if (operation === "reset") {
    state = { seed: payload.config?.seed || null, steps: [] };
    parentPort.postMessage({ requestId, ok: true, result: { ...state, terminal: false } });
    return;
  }
  if (operation === "step") {
    if (payload.action?.actionId === "illegal") {
      parentPort.postMessage({
        requestId,
        ok: false,
        error: { code: "illegal_action", message: "fixture illegal action", details: null },
      });
      return;
    }
    state.steps.push(payload.action.actionId);
    parentPort.postMessage({ requestId, ok: true, result: { steps: [...state.steps], done: false } });
    return;
  }
  if (operation === "state") {
    parentPort.postMessage({ requestId, ok: true, result: { ...state, terminal: false } });
    return;
  }
  if (operation === "replay" || operation === "checkpoint") {
    parentPort.postMessage({ requestId, ok: true, result: { ...state } });
    return;
  }
  parentPort.postMessage({ requestId, ok: true, result: { operation } });
});
