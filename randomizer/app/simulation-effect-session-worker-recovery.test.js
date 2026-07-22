"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("./simulation-env");
const { SimulationWorkerPool } = require("../training/worker-pool");

async function main() {
  const config = {
    seed: "effect-session-worker-crash-recovery",
    activePlayerCount: 4,
    episodeId: "effect-session-worker-crash-recovery",
  };
  const pool = new SimulationWorkerPool({ size: 1, timeoutMs: 180000 });
  const direct = createSimulationEnv();
  try {
    await pool.request(0, "reset", { config });
    direct.reset(config);
    const action = direct.legalActions()[0];
    const expected = direct.step(action);
    assert.equal(expected.ok, true, expected.error);
    const workerStep = await pool.request(0, "step", { action });
    assert.deepEqual(workerStep.observation, expected.observation);
    assert.deepEqual(workerStep.replayEvent.effectSessionJournal, expected.replayEvent.effectSessionJournal);

    const generation = pool.getSlot(0).generation;
    await pool.getSlot(0).worker.terminate();
    const recovered = await pool.request(0, "state");
    assert.equal(pool.getSlot(0).generation > generation, true, "worker crash 后必须启动新 generation");
    assert.deepEqual(recovered.observation, expected.observation, "只重放已确认 Action/Decision 后 observation 必须一致");
    assert.deepEqual(recovered.legalActions, expected.legalActions, "crash recovery legal choices 必须同源一致");
    const recoveredReplay = await pool.request(0, "replay");
    assert.deepEqual(recoveredReplay.steps, direct.getReplay().steps, "crash recovery events/journal 必须一致");
  } finally {
    direct.dispose();
    await pool.close();
  }
  console.log("simulation Effect Session worker crash recovery tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
