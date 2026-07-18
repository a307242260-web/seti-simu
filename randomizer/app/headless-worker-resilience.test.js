"use strict";

const assert = require("node:assert/strict");
const { HeadlessWorkerPool } = require("../training/worker-pool");
const { IPC_ERROR_CODES } = require("../training/worker-protocol");

(async () => {
  const pool = new HeadlessWorkerPool({
    size: 1,
    timeoutMs: 180000,
    maxPendingPerWorker: 1,
  });
  try {
    const config = {
      seed: "headless-real-worker-recovery",
      activePlayerCount: 4,
      episodeId: "headless-real-worker-recovery",
    };
    const opening = await pool.request(0, "reset", { config });
    const action = opening.legalActions[0];
    assert.ok(action, "真实 worker recovery 夹具应存在合法动作");
    const stepped = await pool.request(0, "step", { action });
    const checkpointBeforeCrash = await pool.request(0, "checkpoint");
    const replayBeforeCrash = await pool.request(0, "replay");

    const slot = pool.getSlot(0);
    const generationBeforeCrash = slot.generation;
    await slot.worker.terminate();
    for (let attempt = 0; attempt < 100 && slot.generation === generationBeforeCrash; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.ok(slot.generation > generationBeforeCrash, "真实 worker crash 后必须重建 generation");

    const recovered = await pool.request(0, "state");
    assert.deepEqual(recovered.observation, stepped.observation);
    assert.deepEqual(recovered.legalActions, stepped.legalActions);
    assert.deepEqual(await pool.request(0, "checkpoint"), checkpointBeforeCrash);
    assert.deepEqual(await pool.request(0, "replay"), replayBeforeCrash);

    await pool.request(0, "reset", {
      config: {
        ...config,
        seed: "headless-real-backpressure",
        episodeId: "headless-real-backpressure",
      },
    });
    const pendingState = slot.rawRequest("state");
    await assert.rejects(
      slot.rawRequest("ping"),
      (error) => error.code === IPC_ERROR_CODES.BACKPRESSURE,
    );
    await pendingState;
  } finally {
    await pool.close();
  }
  console.log("headless worker resilience tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
