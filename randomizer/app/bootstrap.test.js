"use strict";

const assert = require("node:assert/strict");
const bootstrap = require("./bootstrap");

{
  const calls = [];
  const initializeShell = bootstrap.createBrowserShellInitializer({
    actionLogViewRuntime: {
      setReportTab: (value) => calls.push(["tab", value]),
      setLogOpen: (value) => calls.push(["log", value]),
    },
    renderRuntime: {
      setTokenAssetSizes: () => calls.push("tokens"),
      updateContinueButton: () => calls.push("continue"),
    },
    startScreenRuntime: {
      syncStartScreenDebugOption: () => calls.push("debug"),
      syncStartScreenActionLogOption: () => calls.push("action-log"),
      syncStartScreenAlienOptions: () => calls.push("aliens"),
      syncStartScreenIndustryOptions: () => calls.push("industry"),
      setDebugToolsEnabled: (value) => calls.push(["debug-tools", value]),
    },
  });
  initializeShell();
  assert.deepEqual(calls, [
    "tokens", "debug", "action-log", "aliens", "industry",
    ["debug-tools", false], ["tab", "action"], ["log", false], "continue",
  ]);
}

{
  const calls = [];
  const listeners = {};
  const root = {
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
  };
  const startScreenState = { entered: false };
  const publicApi = bootstrap.initializeAppBootstrap({
    root,
    initializeShell() {
      calls.push("initializeShell");
    },
    startScreenState,
    savePersistentGameStateNow(options) {
      calls.push(["save", options.label]);
    },
    publicApiFactory: {
      createPublicApi(context) {
        calls.push(["createPublicApi", context.flag]);
        return { api: true };
      },
    },
    publicApiContext: { flag: "ok" },
  });

  assert.deepEqual(publicApi, { api: true });
  assert.equal(root.SetiRandomizer.api, true);
  assert.equal(calls[0], "initializeShell");
  assert.ok(typeof listeners.beforeunload === "function");
  listeners.beforeunload();
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === "save"), false);
  startScreenState.entered = true;
  listeners.beforeunload();
  assert.deepEqual(
    calls.find((entry) => Array.isArray(entry) && entry[0] === "save"),
    ["save", "刷新前状态"],
  );
}

assert.equal(bootstrap.maybeRunCodexAiBatchSmoke, undefined);
assert.equal(bootstrap.summarizeCodexAiBatchResult, undefined);

console.log("bootstrap tests passed");
