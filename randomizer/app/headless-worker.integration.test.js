"use strict";

const assert = require("node:assert/strict");
const { createHeadlessEnv } = require("./headless-env");
const { HeadlessWorkerPool } = require("../training/worker-pool");

async function main() {
  const config = {
    seed: "ipc-direct-parity-v1",
    activePlayerCount: 4,
    episodeId: "parity-episode",
    policyVersion: "parity-policy",
    opponentIdentity: "self-play",
    seat: "all",
  };
  const direct = createHeadlessEnv();
  const pool = new HeadlessWorkerPool({ size: 1, timeoutMs: 180000 });
  try {
    const directObservation = direct.reset(config);
    const workerOpening = await pool.request(0, "reset", { config });
    assert.deepEqual(workerOpening.observation, directObservation);
    assert.deepEqual(workerOpening.legalActions, direct.legalActions());

    const action = direct.legalActions().find((candidate) => candidate.family === "pass")
      || direct.legalActions()[0];
    const directStep = direct.step(action);
    const workerStep = await pool.request(0, "step", { action });
    assert.equal(workerStep.ok, true);
    assert.deepEqual(workerStep.observation, directStep.observation);
    assert.deepEqual(workerStep.legalActions, directStep.legalActions);
    assert.deepEqual(workerStep.reward, directStep.reward);

    const checkpoint = await pool.request(0, "checkpoint");
    const replay = await pool.request(0, "replay");
    assert.deepEqual(checkpoint.episodeMetadata, replay.episodeMetadata);
    assert.equal(replay.episodeMetadata.policyVersion, "parity-policy");

    await pool.request(0, "reset", { config: { seed: "discarded-state", activePlayerCount: 4 } });
    const restored = await pool.request(0, "load_checkpoint", { checkpoint });
    assert.deepEqual(restored.observation, workerStep.observation);
    assert.deepEqual(restored.legalActions, workerStep.legalActions);
    const restoredReplay = await pool.request(0, "replay");
    assert.equal(restoredReplay.episodeMetadata.policyVersion, "parity-policy");

    const workerGeneration = pool.getSlot(0).generation;
    for (let episodeIndex = 0; episodeIndex < 100; episodeIndex += 1) {
      const seed = `worker-reset-isolation-${episodeIndex}`;
      const episodeConfig = {
        seed,
        activePlayerCount: 4,
        episodeId: `worker-reset-isolation-${episodeIndex}`,
      };
      const freshDirect = createHeadlessEnv();
      try {
        const freshOpening = freshDirect.reset(episodeConfig);
        const persistentWorkerOpening = await pool.request(0, "reset", { config: episodeConfig });
        assert.deepEqual(
          persistentWorkerOpening.observation,
          freshOpening,
          `常驻 worker 第 ${episodeIndex} 局 opening 必须与 fresh direct 一致`,
        );
        assert.deepEqual(
          persistentWorkerOpening.legalActions,
          freshDirect.legalActions(),
          `常驻 worker 第 ${episodeIndex} 局 legalActions 必须与 fresh direct 一致`,
        );
      } finally {
        freshDirect.dispose();
      }
    }
    assert.equal(pool.getSlot(0).generation, workerGeneration, "100 局 reset 不得通过重启 worker 绕过隔离");
  } finally {
    direct.dispose();
    await pool.close();
  }
  console.log("headless-worker integration tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
