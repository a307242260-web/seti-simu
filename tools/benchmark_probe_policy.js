"use strict";

const { spawn } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const path = require("node:path");

const ITERATIONS = 12;
const SINGLE_DECISION_LIMIT_MS = 1000;
const PARENT_TIMEOUT_MS = 15000;

async function runWorker() {
  const { createSimulationEnv } = require("../randomizer/app/simulation-env");
  const environment = createSimulationEnv();
  const samples = [];
  const memoryDeltas = [];
  try {
    environment.reset({
      seed: "seti-104-official-v1",
      activePlayerCount: 4,
      aiDifficulty: "weak_start",
    });
    while (environment.legalActions()[0]?.family?.startsWith("choose_")) {
      const result = environment.step(environment.legalActions()[0]);
      if (!result.ok) throw new Error(result.error || "setup Decision 执行失败");
    }
    const checkpoint = environment.createCheckpoint();
    for (let index = 0; index < ITERATIONS; index += 1) {
      environment.loadCheckpoint(checkpoint);
      global.gc?.();
      const heapBefore = process.memoryUsage().heapUsed;
      const startedAt = performance.now();
      environment.runHeuristicPolicyDecision();
      const elapsed = performance.now() - startedAt;
      global.gc?.();
      samples.push(elapsed);
      memoryDeltas.push(process.memoryUsage().heapUsed - heapBefore);
      if (elapsed > SINGLE_DECISION_LIMIT_MS) {
        throw new Error(`单次 Policy ${elapsed.toFixed(2)}ms 超过 ${SINGLE_DECISION_LIMIT_MS}ms 门禁`);
      }
    }
    const sorted = [...samples].sort((left, right) => left - right);
    const sortedMemory = [...memoryDeltas].sort((left, right) => left - right);
    const percentile = (ratio) => sorted[Math.ceil(sorted.length * ratio) - 1];
    process.stdout.write(`${JSON.stringify({
      schemaVersion: "seti-probe-policy-benchmark-v1",
      iterations: ITERATIONS,
      candidateCount: environment.getCounterfactualDiagnostics()?.candidateCount || 0,
      medianMilliseconds: percentile(0.5),
      p90Milliseconds: percentile(0.9),
      maxMilliseconds: Math.max(...samples),
      medianHeapDeltaBytes: sortedMemory[Math.floor(sortedMemory.length / 2)],
      maxHeapDeltaBytes: Math.max(...memoryDeltas),
    }, null, 2)}\n`);
  } finally {
    environment.dispose();
  }
}

function runParent() {
  const child = spawn(process.execPath, ["--expose-gc", __filename, "--worker"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, PARENT_TIMEOUT_MS);
  const forwardSignal = () => child.kill("SIGTERM");
  process.once("SIGINT", forwardSignal);
  process.once("SIGTERM", forwardSignal);
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.once("close", (code, signal) => {
    clearTimeout(timer);
    process.removeListener("SIGINT", forwardSignal);
    process.removeListener("SIGTERM", forwardSignal);
    if (signal === "SIGKILL") {
      process.stderr.write(`probe benchmark 超过 ${PARENT_TIMEOUT_MS}ms 硬超时，子进程已回收\n`);
      process.exitCode = 1;
      return;
    }
    if (stderr) process.stderr.write(stderr);
    if (stdout) process.stdout.write(stdout);
    process.exitCode = code || 0;
  });
}

if (process.argv.includes("--worker")) {
  runWorker().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
} else {
  runParent();
}
