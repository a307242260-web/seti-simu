"use strict";

const path = require("node:path");
const { Worker } = require("node:worker_threads");
const {
  IPC_ERROR_CODES,
  IpcError,
} = require("./worker-protocol");

const WORKER_PATH = path.resolve(__dirname, "simulation-worker.js");

class WorkerSlot {
  constructor(id, options = {}) {
    this.id = String(id);
    this.timeoutMs = Math.max(1, Number(options.timeoutMs || 120000));
    this.maxPending = Math.max(1, Number(options.maxPendingPerWorker || 1));
    this.workerPath = options.workerPath || WORKER_PATH;
    this.worker = null;
    this.generation = 0;
    this.sequence = 0;
    this.pending = new Map();
    this.recoveryPromise = null;
    this.episode = null;
    this.closed = false;
    this.spawn();
  }

  spawn() {
    if (this.closed) return;
    this.generation += 1;
    const generation = this.generation;
    const worker = new Worker(this.workerPath);
    this.worker = worker;
    worker.on("message", (message) => this.handleMessage(message, generation));
    worker.on("error", (error) => this.handleFailure(error, generation));
    worker.on("exit", (code) => {
      if (!this.closed && generation === this.generation && code !== 0) {
        this.handleFailure(new IpcError(
          IPC_ERROR_CODES.WORKER_CRASH,
          `worker ${this.id} 异常退出，exit=${code}`,
          { workerId: this.id, generation, exitCode: code },
        ), generation);
      }
    });
  }

  handleMessage(message, generation) {
    if (generation !== this.generation) return;
    const pending = this.pending.get(message?.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.requestId);
    if (message.ok) pending.resolve(message.result);
    else pending.reject(new IpcError(
      message.error?.code || IPC_ERROR_CODES.INVALID_REQUEST,
      message.error?.message || "worker 请求失败",
      message.error?.details || null,
    ));
  }

  handleFailure(error, generation) {
    if (generation !== this.generation || this.closed) return;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error instanceof IpcError ? error : new IpcError(
        IPC_ERROR_CODES.WORKER_CRASH,
        `worker ${this.id} 崩溃：${error?.message || error}`,
        { workerId: this.id, generation },
      ));
    }
    this.pending.clear();
    this.worker = null;
    this.spawn();
  }

  rawRequest(operation, payload = {}, options = {}) {
    if (!this.worker) {
      return Promise.reject(new IpcError(
        IPC_ERROR_CODES.WORKER_CRASH,
        `worker ${this.id} 尚未可用`,
        { workerId: this.id },
      ));
    }
    if (this.pending.size >= this.maxPending) {
      return Promise.reject(new IpcError(
        IPC_ERROR_CODES.BACKPRESSURE,
        `worker ${this.id} 等待队列已满`,
        { workerId: this.id, pending: this.pending.size, maxPending: this.maxPending },
      ));
    }
    const requestId = `${this.id}:${this.generation}:${++this.sequence}`;
    const timeoutMs = Math.max(1, Number(options.timeoutMs || this.timeoutMs));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        const timeoutError = new IpcError(
          IPC_ERROR_CODES.TIMEOUT,
          `worker ${this.id} 执行 ${operation} 超时（${timeoutMs}ms）`,
          { workerId: this.id, operation, timeoutMs, generation: this.generation },
        );
        const timedOutWorker = this.worker;
        this.handleFailure(timeoutError, this.generation);
        timedOutWorker?.terminate();
        reject(timeoutError);
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer, operation });
      this.worker.postMessage({ requestId, operation, payload });
    });
  }

  async ensureRecovered() {
    if (!this.episode || this.episode.generation === this.generation) return;
    if (this.recoveryPromise) return this.recoveryPromise;
    const episode = this.episode;
    this.recoveryPromise = (async () => {
      try {
        await this.rawRequest("reset", { config: episode.config });
        for (const action of episode.actions) {
          await this.rawRequest("step", { action });
        }
        episode.generation = this.generation;
      } catch (error) {
        throw new IpcError(
          IPC_ERROR_CODES.WORKER_RECOVERY_FAILED,
          `worker ${this.id} 未完成 episode 恢复失败：${error.message}`,
          { workerId: this.id, episodeId: episode.metadata.episodeId || null, cause: error.code },
        );
      } finally {
        this.recoveryPromise = null;
      }
    })();
    return this.recoveryPromise;
  }

  async request(operation, payload = {}, options = {}) {
    if (!["reset", "load_checkpoint", "dispose"].includes(operation)) await this.ensureRecovered();
    const result = await this.rawRequest(operation, payload, options);
    if (operation === "reset") {
      const config = structuredClone(payload.config || {});
      this.episode = {
        config,
        actions: [],
        generation: this.generation,
        metadata: {
          episodeId: config.episodeId || `${this.id}:${config.seed ?? "seti-simulation"}`,
          policyVersion: config.policyVersion || null,
          opponentIdentity: config.opponentIdentity || null,
          seat: config.seat ?? null,
          seed: config.seed ?? null,
        },
      };
    } else if (operation === "step") {
      this.episode?.actions.push(structuredClone(payload.action));
    } else if (operation === "load_checkpoint") {
      const checkpoint = payload.checkpoint || {};
      const config = structuredClone(checkpoint.config || {});
      const metadata = checkpoint.episodeMetadata || {};
      this.episode = {
        config,
        actions: (checkpoint.replaySteps || []).map((step) => structuredClone(step.action)),
        generation: this.generation,
        metadata: {
          episodeId: metadata.episodeId || config.episodeId || `${this.id}:${config.seed ?? "seti-simulation"}`,
          policyVersion: metadata.policyVersion || config.policyVersion || null,
          opponentIdentity: metadata.opponentIdentity || config.opponentIdentity || null,
          seat: metadata.seat ?? config.seat ?? null,
          seed: config.seed ?? checkpoint.replayCursor?.seed ?? null,
        },
      };
    } else if (["replay", "checkpoint"].includes(operation) && result && this.episode) {
      result.episodeMetadata = structuredClone(this.episode.metadata);
    } else if (operation === "dispose") {
      this.episode = null;
    }
    return result;
  }

  async close() {
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new IpcError(IPC_ERROR_CODES.WORKER_CRASH, `worker ${this.id} 已关闭`));
    }
    this.pending.clear();
    const worker = this.worker;
    this.worker = null;
    if (worker) await worker.terminate();
  }
}

class SimulationWorkerPool {
  constructor(options = {}) {
    const size = Math.max(1, Number(options.size || 1));
    this.slots = Array.from({ length: size }, (_, index) => new WorkerSlot(index, options));
  }

  get size() {
    return this.slots.length;
  }

  getSlot(workerId) {
    const slot = this.slots[Number(workerId)];
    if (!slot) {
      throw new IpcError(IPC_ERROR_CODES.INVALID_REQUEST, `未知 workerId：${workerId}`, {
        workerId,
        size: this.size,
      });
    }
    return slot;
  }

  request(workerId, operation, payload = {}, options = {}) {
    return this.getSlot(workerId).request(operation, payload, options);
  }

  async batch(requests, options = {}) {
    if (!Array.isArray(requests)) {
      throw new IpcError(IPC_ERROR_CODES.INVALID_REQUEST, "batch.requests 必须是数组");
    }
    const results = await Promise.all(requests.map(async (request, batchIndex) => {
      try {
        return {
          batchIndex,
          workerId: request.workerId,
          ok: true,
          result: await this.request(
            request.workerId,
            request.operation,
            request.payload || {},
            { timeoutMs: request.timeoutMs || options.timeoutMs },
          ),
        };
      } catch (error) {
        return {
          batchIndex,
          workerId: request.workerId,
          ok: false,
          error: { code: error.code, message: error.message, details: error.details || null },
        };
      }
    }));
    return results;
  }

  async close() {
    await Promise.all(this.slots.map((slot) => slot.close()));
  }
}

module.exports = {
  SimulationWorkerPool,
  WorkerSlot,
};
