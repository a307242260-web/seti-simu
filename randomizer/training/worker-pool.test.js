"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { HeadlessWorkerPool } = require("./worker-pool");
const {
  IPC_ERROR_CODES,
  IPC_SCHEMA_VERSION,
  assertRequest,
} = require("./worker-protocol");

async function main() {
  assert.equal(assertRequest({
    schemaVersion: IPC_SCHEMA_VERSION,
    requestId: 1,
    operation: "server_info",
  }).operation, "server_info");
  assert.throws(
    () => assertRequest({ schemaVersion: "old", requestId: 1, operation: "ping" }),
    (error) => error.code === IPC_ERROR_CODES.SCHEMA_MISMATCH,
  );

  const pool = new HeadlessWorkerPool({
    size: 2,
    timeoutMs: 1000,
    workerPath: path.resolve(__dirname, "fixtures", "fast-worker.js"),
  });
  try {
    const resets = await pool.batch([0, 1].map((workerId) => ({
      workerId,
      operation: "reset",
      payload: {
        config: {
          seed: `seed-${workerId}`,
          episodeId: `episode-${workerId}`,
          policyVersion: "policy-v7",
          opponentIdentity: "baseline-v1",
          seat: workerId,
        },
      },
    })));
    assert.equal(resets.every((item) => item.ok), true);

    const stepped = await pool.batch([0, 1].map((workerId) => ({
      workerId,
      operation: "step",
      payload: { action: { actionId: `action-${workerId}` } },
    })));
    assert.equal(stepped.every((item) => item.ok), true);

    const illegal = await pool.batch([{
      workerId: 0,
      operation: "step",
      payload: { action: { actionId: "illegal" } },
    }]);
    assert.equal(illegal[0].ok, false);
    assert.equal(illegal[0].error.code, IPC_ERROR_CODES.ILLEGAL_ACTION);

    await assert.rejects(
      pool.request(0, "crash"),
      (error) => error.code === IPC_ERROR_CODES.WORKER_CRASH,
    );
    const recovered = await pool.request(0, "state");
    assert.deepEqual(recovered.steps, ["action-0"]);

    const replay = await pool.request(0, "replay");
    assert.equal(replay.episodeMetadata.policyVersion, "policy-v7");
    assert.equal(replay.episodeMetadata.opponentIdentity, "baseline-v1");
    assert.equal(replay.episodeMetadata.seat, 0);
    assert.equal(replay.episodeMetadata.seed, "seed-0");

    await assert.rejects(
      pool.request(1, "hang", {}, { timeoutMs: 20 }),
      (error) => error.code === IPC_ERROR_CODES.TIMEOUT,
    );
    const timeoutRecovered = await pool.request(1, "state");
    assert.deepEqual(timeoutRecovered.steps, ["action-1"]);

    let completedEpisodes = 0;
    for (let episodeIndex = 0; episodeIndex < 100; episodeIndex += 1) {
      const workerId = episodeIndex % 2;
      await pool.request(workerId, "reset", {
        config: {
          seed: `continuous-${episodeIndex}`,
          episodeId: `continuous-${episodeIndex}`,
          policyVersion: "policy-v7",
          opponentIdentity: "baseline-v1",
          seat: workerId,
        },
      });
      for (let stepIndex = 0; stepIndex < 3; stepIndex += 1) {
        await pool.request(workerId, "step", {
          action: { actionId: `episode-${episodeIndex}-step-${stepIndex}` },
        });
      }
      const episodeReplay = await pool.request(workerId, "replay");
      assert.equal(episodeReplay.steps.length, 3);
      assert.equal(episodeReplay.episodeMetadata.episodeId, `continuous-${episodeIndex}`);
      completedEpisodes += 1;
    }
    assert.equal(completedEpisodes, 100, "常驻 worker 应连续完成 100 个协议 smoke episode");
  } finally {
    await pool.close();
  }
  console.log("training/worker-pool tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
