"use strict";

const { parentPort } = require("node:worker_threads");
const { createHeadlessEnv } = require("../app/headless-env");
const {
  IPC_ERROR_CODES,
  IpcError,
  serializeError,
} = require("./worker-protocol");

if (!parentPort) throw new Error("headless-worker 必须由 worker_threads 启动");

let env = null;

function requireEnv() {
  if (!env) throw new IpcError(IPC_ERROR_CODES.INVALID_REQUEST, "worker 尚未 reset");
  return env;
}

function snapshotState(targetEnv) {
  const observation = targetEnv.observe();
  return {
    observation,
    legalActions: targetEnv.legalActions(),
    terminal: targetEnv.isTerminal(),
  };
}

async function execute(operation, payload = {}) {
  switch (operation) {
    case "ping":
      return { pid: process.pid };
    case "reset": {
      env?.dispose?.();
      env = createHeadlessEnv();
      const observation = env.reset(payload.config || {});
      return { observation, legalActions: env.legalActions(), terminal: env.isTerminal() };
    }
    case "state":
      return snapshotState(requireEnv());
    case "step": {
      const result = requireEnv().step(payload.action);
      if (!result.ok) {
        throw new IpcError(IPC_ERROR_CODES.ILLEGAL_ACTION, result.error || "动作执行失败", {
          actionId: payload.action?.actionId || null,
          actorPlayerId: result.actorPlayerId || null,
          legalActionIds: (result.legalActions || []).map((action) => action.actionId),
        });
      }
      return result;
    }
    case "checkpoint":
      return requireEnv().createCheckpoint();
    case "diagnostics":
      return requireEnv().getDiagnostics();
    case "load_checkpoint":
      return {
        observation: requireEnv().loadCheckpoint(payload.checkpoint),
        legalActions: requireEnv().legalActions(),
        terminal: requireEnv().isTerminal(),
      };
    case "replay":
      return requireEnv().getReplay();
    case "dispose":
      env?.dispose?.();
      env = null;
      return { disposed: true };
    default:
      throw new IpcError(IPC_ERROR_CODES.INVALID_REQUEST, `未知 worker operation：${operation}`);
  }
}

parentPort.on("message", async (message) => {
  const requestId = message?.requestId;
  try {
    const result = await execute(message?.operation, message?.payload);
    parentPort.postMessage({ requestId, ok: true, result });
  } catch (error) {
    parentPort.postMessage({ requestId, ok: false, error: serializeError(error) });
  }
});

process.on("exit", () => env?.dispose?.());
