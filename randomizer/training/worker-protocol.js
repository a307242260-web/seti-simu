"use strict";

const IPC_SCHEMA_VERSION = "seti-rl-ipc-v1";
const IPC_ERROR_CODES = Object.freeze({
  BACKPRESSURE: "backpressure",
  ILLEGAL_ACTION: "illegal_action",
  INVALID_REQUEST: "invalid_request",
  SCHEMA_MISMATCH: "schema_mismatch",
  TERMINAL: "terminal",
  TIMEOUT: "timeout",
  WORKER_CRASH: "worker_crash",
  WORKER_RECOVERY_FAILED: "worker_recovery_failed",
});

class IpcError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "IpcError";
    this.code = code;
    this.details = details;
  }
}

function assertRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new IpcError(IPC_ERROR_CODES.INVALID_REQUEST, "IPC 请求必须是 JSON object");
  }
  if (request.schemaVersion !== IPC_SCHEMA_VERSION) {
    throw new IpcError(
      IPC_ERROR_CODES.SCHEMA_MISMATCH,
      `IPC schema 不匹配：期望 ${IPC_SCHEMA_VERSION}，收到 ${request.schemaVersion || "missing"}`,
      { expected: IPC_SCHEMA_VERSION, received: request.schemaVersion || null },
    );
  }
  if (typeof request.requestId !== "string" && typeof request.requestId !== "number") {
    throw new IpcError(IPC_ERROR_CODES.INVALID_REQUEST, "IPC 请求缺少 requestId");
  }
  if (typeof request.operation !== "string" || !request.operation) {
    throw new IpcError(IPC_ERROR_CODES.INVALID_REQUEST, "IPC 请求缺少 operation");
  }
  return request;
}

function serializeError(error, fallbackCode = IPC_ERROR_CODES.INVALID_REQUEST) {
  return {
    code: error?.code || fallbackCode,
    message: error?.message || String(error),
    details: error?.details || null,
  };
}

function createResponse(requestId, result) {
  return {
    schemaVersion: IPC_SCHEMA_VERSION,
    requestId,
    ok: true,
    result,
  };
}

function createErrorResponse(requestId, error) {
  return {
    schemaVersion: IPC_SCHEMA_VERSION,
    requestId: requestId ?? null,
    ok: false,
    error: serializeError(error),
  };
}

module.exports = {
  IPC_ERROR_CODES,
  IPC_SCHEMA_VERSION,
  IpcError,
  assertRequest,
  createErrorResponse,
  createResponse,
  serializeError,
};
