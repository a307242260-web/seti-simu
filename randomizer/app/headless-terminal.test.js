"use strict";

const assert = require("node:assert/strict");
const { createHeadlessEnv } = require("./headless-env");
const { HeadlessWorkerPool } = require("../training/worker-pool");
const { IPC_ERROR_CODES } = require("../training/worker-protocol");

function chooseFastTerminalAction(actions) {
  return actions.find((action) => action.family === "pass")
    || actions.find((action) => action.family === "end_turn")
    || actions[0]
    || null;
}

function assertTerminalObservation(observation, legalActions) {
  assert.equal(observation.terminal, true);
  assert.equal(observation.decision, null);
  assert.deepEqual(legalActions, []);
}

function assertDirectTerminalError(result, actionId) {
  assert.equal(result.ok, false);
  assert.equal(result.code, "HEADLESS_TERMINAL");
  assert.equal(result.actionId, actionId);
  assert.equal(result.actorPlayerId, null);
  assert.equal(result.done, true);
  assert.equal(result.error, "环境已终局，不能继续执行动作");
  assert.equal(result.replayEvent, null);
  assert.deepEqual(result.legalActions, []);
  assertTerminalObservation(result.observation, result.legalActions);
}

(async () => {
  const config = { seed: "seti54-terminal", activePlayerCount: 4 };
  const direct = createHeadlessEnv();
  const pool = new HeadlessWorkerPool({ size: 1, timeoutMs: 180000 });
  try {
    const directOpening = direct.reset(config);
    const workerOpening = await pool.request(0, "reset", { config });
    assert.equal(directOpening.terminal, false);
    assert.equal(workerOpening.terminal, false);

    let lastLegalAction = null;
    let terminalResult = null;
    for (let stepIndex = 0; stepIndex < 200 && !direct.isTerminal(); stepIndex += 1) {
      assert.equal(direct.observe().terminal, false, "终局 pending 完成前 observation.terminal 必须为 false");
      const action = chooseFastTerminalAction(direct.legalActions());
      assert.ok(action, `第 ${stepIndex} 步应存在合法动作`);
      lastLegalAction = structuredClone(action);
      const directStep = direct.step(action);
      const workerStep = await pool.request(0, "step", { action });
      assert.equal(directStep.ok, true, directStep.error);
      assert.deepEqual(workerStep.observation, directStep.observation);
      assert.deepEqual(workerStep.legalActions, directStep.legalActions);
      assert.equal(workerStep.done, directStep.done);
      if (directStep.done) terminalResult = directStep;
    }

    assert.equal(direct.isTerminal(), true, "快速局应到达 terminal");
    assert.ok(terminalResult, "最后一个合法动作应完成终局 pending");
    assertTerminalObservation(terminalResult.observation, terminalResult.legalActions);
    assert.deepEqual(direct.legalActions(), []);
    const workerTerminalState = await pool.request(0, "state");
    assert.equal(workerTerminalState.terminal, true);
    assertTerminalObservation(workerTerminalState.observation, workerTerminalState.legalActions);

    const directCheckpoint = direct.createCheckpoint();
    const directReplay = direct.getReplay();
    const workerCheckpoint = await pool.request(0, "checkpoint");
    const workerReplay = await pool.request(0, "replay");
    const fakeAction = {
      actionId: "terminal-fake-action",
      actorPlayerId: "player-fake",
      stateVersion: -1,
      decisionVersion: -1,
    };

    for (const action of [lastLegalAction, fakeAction]) {
      const first = direct.step(action);
      const second = direct.step(action);
      assertDirectTerminalError(first, action.actionId);
      assert.deepEqual(second, first, "terminal error 必须稳定");
      assert.deepEqual(direct.createCheckpoint(), directCheckpoint, "terminal step 不得改变 checkpoint/RNG/cursor");
      assert.deepEqual(direct.getReplay(), directReplay, "terminal step 不得改变 replay");

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await assert.rejects(
          pool.request(0, "step", { action }),
          (error) => {
            assert.equal(error.code, IPC_ERROR_CODES.TERMINAL);
            assert.equal(error.message, "环境已终局，不能继续执行动作");
            assert.equal(error.details?.headlessCode, "HEADLESS_TERMINAL");
            assert.deepEqual(error.details?.legalActionIds, []);
            return true;
          },
        );
      }
      assert.deepEqual(await pool.request(0, "checkpoint"), workerCheckpoint);
      assert.deepEqual(await pool.request(0, "replay"), workerReplay);
    }
  } finally {
    direct.dispose();
    await pool.close();
  }
  console.log("headless terminal tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
