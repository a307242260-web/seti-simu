#!/usr/bin/env node
"use strict";

const readline = require("node:readline");
const { SimulationWorkerPool } = require("../randomizer/training/worker-pool");
const {
  IPC_ERROR_CODES,
  IPC_SCHEMA_VERSION,
  IpcError,
  assertRequest,
  createErrorResponse,
  createResponse,
} = require("../randomizer/training/worker-protocol");

function parseArgs(argv) {
  const options = { workers: 1, timeoutMs: 120000, maxInflight: 64 };
  const keys = new Map([
    ["--workers", "workers"],
    ["--timeout-ms", "timeoutMs"],
    ["--max-inflight", "maxInflight"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = keys.get(argv[index]);
    if (!key) throw new Error(`未知参数：${argv[index]}`);
    const value = Number(argv[++index]);
    if (!Number.isInteger(value) || value < 1) throw new Error(`${argv[index - 1]} 必须是正整数`);
    options[key] = value;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pool = new SimulationWorkerPool({
    size: options.workers,
    timeoutMs: options.timeoutMs,
    maxPendingPerWorker: 1,
  });
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let inflight = 0;
  let closing = false;

  function write(record) {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }

  async function dispatch(request) {
    switch (request.operation) {
      case "server_info":
        return {
          schemaVersion: IPC_SCHEMA_VERSION,
          workers: pool.size,
          pid: process.pid,
          persistent: true,
          recoveryStrategy: "reset_and_replay_action_journal",
        };
      case "worker_request":
        return pool.request(
          request.payload?.workerId,
          request.payload?.operation,
          request.payload?.payload || {},
          { timeoutMs: request.payload?.timeoutMs },
        );
      case "batch":
        return pool.batch(request.payload?.requests, { timeoutMs: request.payload?.timeoutMs });
      case "shutdown":
        closing = true;
        input.close();
        return { shuttingDown: true };
      default:
        throw new IpcError(IPC_ERROR_CODES.INVALID_REQUEST, `未知 server operation：${request.operation}`);
    }
  }

  input.on("line", (line) => {
    if (!line.trim() || closing) return;
    let request = null;
    try {
      request = JSON.parse(line);
      assertRequest(request);
      if (inflight >= options.maxInflight) {
        throw new IpcError(
          IPC_ERROR_CODES.BACKPRESSURE,
          `server inflight 已达上限 ${options.maxInflight}`,
          { inflight, maxInflight: options.maxInflight },
        );
      }
    } catch (error) {
      write(createErrorResponse(request?.requestId, error));
      return;
    }
    inflight += 1;
    dispatch(request)
      .then((result) => write(createResponse(request.requestId, result)))
      .catch((error) => write(createErrorResponse(request.requestId, error)))
      .finally(async () => {
        inflight -= 1;
        if (closing && inflight === 0) {
          await pool.close();
          process.exitCode = 0;
        }
      });
  });

  input.on("close", async () => {
    closing = true;
    if (inflight === 0) await pool.close();
  });
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
