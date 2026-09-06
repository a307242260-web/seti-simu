"use strict";
const fs = require("node:fs"), inspector = require("node:inspector"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/rule-failures-433-20260907.json";
async function main() {
  if (fs.existsSync(output)) { console.log(`已有失败证据：${output}`); return; }
  const env = createSimulationEnv(), debug = new inspector.Session();
  const report = { scope: "真实433单决策失败断点取证，保留原始效果/返回/工作状态；不作为性能数据，不改生产函数", failures: [] };
  const post = (method, params = {}) => new Promise((resolve, reject) => debug.post(method, params,
    (error, result) => error ? reject(error) : resolve(result)));
  let debugError;
  debug.connect();
  debug.on("Debugger.paused", message => {
    const frame = message.params.callFrames[0];
    debug.post("Debugger.evaluateOnCallFrame", {
      callFrameId: frame.callFrameId,
      expression: "JSON.stringify({effect,resultType:typeof result,resultValue:result ?? null,workingState:session.workingState,journal:session.journal})",
      returnByValue: true,
    }, (error, response) => {
      if (error || response.exceptionDetails) debugError = error || new Error(JSON.stringify(response.exceptionDetails));
      else report.failures.push(JSON.parse(response.result.value));
      debug.post("Debugger.resume", {}, error => { if (error) debugError = error; });
    });
  });
  try {
    const file = require.resolve("../randomizer/game/effects/session-runtime");
    const lineNumber = fs.readFileSync(file, "utf8").split("\n")
      .findIndex(line => line.includes('if (!result || result.ok !== true || !("nextState" in result))'));
    assert.ok(lineNumber >= 0, "必须找到正式结果失败判定，禁止猜断点位置");
    await post("Debugger.enable");
    await post("Debugger.setBreakpointByUrl", { urlRegex: "session-runtime\\.js$", lineNumber,
      condition: '!result || result.ok !== true || !("nextState" in result)' });
    const cp = JSON.parse(fs.readFileSync("reports/iteration/amiba-overflow-before-step-433-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const result = env.runHeuristicPolicyDecision();
    assert.equal(result.ok, true);
    if (debugError) throw debugError;
    report.diagnostics = env.getCounterfactualDiagnostics();
    const expected = Object.values(report.diagnostics.failedNodeCountByCode).reduce((n, count) => n + count, 0);
    assert.equal(report.failures.length, expected, "断点捕获必须覆盖实际失败数");
    report.captured = true;
  } catch (error) {
    report.captured = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    await post("Debugger.disable"); debug.disconnect(); env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, captured: report.captured, failures: report.failures.map(f => ({
      effect: f.effect, resultType: f.resultType, resultValue: f.resultValue })), error: report.error }, null, 2));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
