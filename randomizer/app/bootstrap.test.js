"use strict";

const assert = require("node:assert/strict");
const bootstrap = require("./bootstrap");

(async () => {
  const calls = [];
  const listeners = {};
  const scheduled = [];
  const appended = [];
  const root = {
    location: {
      search: "?codexAiBatch=2&renderReadout=1&diagnostics=1",
    },
    URLSearchParams,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    setTimeout(handler) {
      scheduled.push(handler);
      return scheduled.length;
    },
  };
  const document = {
    readyState: "complete",
    body: {
      appendChild(node) {
        appended.push(node);
      },
    },
    createElement(tagName) {
      return {
        tagName,
        dataset: {},
        textContent: "",
      };
    },
  };
  const startScreenState = { entered: false };

  const publicApi = bootstrap.initializeAppBootstrap({
    root,
    document,
    initializeShell() {
      calls.push("initializeShell");
    },
    startScreenState,
    savePersistentGameStateNow(options) {
      calls.push(["save", options.label]);
    },
    normalizeAiDifficulty(value) {
      return value || "laughable";
    },
    uiRuntimeState: {
      codexAiBatchSuppressReadoutRender: false,
    },
    async runAiAutoBattleBatch(options) {
      calls.push(["runBatch", options.games, options.includeSampleDiagnostics]);
      options.onStep({ steps: 25, roundNumber: 2, turnNumber: 1, currentPlayerId: "player-white" });
      return {
        ok: true,
        gamesRequested: options.games,
        gamesRun: options.games,
        samples: [{
          gameIndex: 1,
          seed: "seed-a",
          summary: { ok: true },
          playerResults: [{ playerLabel: "白", finalScore: 123, finalMarkCount: 3 }],
        }],
      };
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
  assert.deepEqual(calls[0], "initializeShell");
  assert.equal(appended.length, 1);
  assert.equal(appended[0].id, "codex-ai-batch-result");
  assert.ok(typeof listeners.beforeunload === "function");

  listeners.beforeunload();
  assert.equal(calls.some((entry) => Array.isArray(entry) && entry[0] === "save"), false);

  startScreenState.entered = true;
  listeners.beforeunload();
  assert.deepEqual(calls.find((entry) => Array.isArray(entry) && entry[0] === "save"), ["save", "刷新前状态"]);

  assert.equal(scheduled.length, 1);
  await scheduled[0]();
  assert.deepEqual(calls.find((entry) => Array.isArray(entry) && entry[0] === "runBatch"), ["runBatch", 2, true]);
  assert.equal(appended[0].dataset.status, "ok");

  const summary = bootstrap.summarizeCodexAiBatchResult({
    ok: true,
    gamesRequested: 1,
    gamesRun: 1,
    samples: [{
      gameIndex: 1,
      seed: "seed-b",
      summary: { ok: true },
      playerResults: [
        { playerLabel: "白", finalScore: 10, finalMarkCount: 3 },
        { playerLabel: "红", finalScore: 20, finalMarkCount: 2 },
      ],
    }],
  });
  assert.equal(summary.averageFinalScore, 15);
  assert.equal(summary.fullMarkGameRate, 0);

  console.log("bootstrap tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
