"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), inspector = require("node:inspector");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/data-choices-53-trace-20260907.json";
if (fs.existsSync(output)) console.log(`已有专项断点证据：${output}`);
else {
  const debug = new inspector.Session(); debug.connect();
  const post = (method, params = {}) => {
    let done = false, error, result;
    debug.post(method, params, (e, r) => { error = e; result = r; done = true; });
    assert.ok(done); if (error) throw error; return result;
  };
  const env = createSimulationEnv(), report = { scope: "第53步非优胜数据选位专项断点，不作为性能成绩，不改生产函数", rows: [], errors: [] };
  debug.on("Debugger.paused", ({ params }) => {
    try {
      const r = post("Debugger.evaluateOnCallFrame", { callFrameId: params.callFrames[0].callFrameId,
        expression: `JSON.stringify({current,candidates,depth:node.depth,origins:node.origins.map(o=>({target:o.routeTargetId,plan:o.routePlanId,chain:o.chain,informationMasked:o.informationMasked})),effect:inspection.session.currentEffect})`, returnByValue: true });
      assert.equal(r.exceptionDetails, undefined);
      report.rows.push(JSON.parse(r.result.value));
    } catch (error) { report.errors.push({ message: error.message, stack: error.stack }); }
    finally { post("Debugger.resume"); }
  });
  try {
    post("Debugger.enable");
    const source = fs.readFileSync(require.resolve("../randomizer/game/rule-composition"), "utf8").split("\n");
    const matches = source.flatMap((l, i) => l.includes("let inputClassification =") ? [i] : []);
    assert.equal(matches.length, 1);
    post("Debugger.setBreakpointByUrl", { urlRegex: "rule-composition\\.js$", lineNumber: matches[0],
      condition: 'current.family === "choose_target" && String(current.target?.choiceId || "").startsWith("data:")' });
    env.loadCheckpoint(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root);
    const result = env.runHeuristicPolicyDecision();
    report.diagnostics = env.getCounterfactualDiagnostics(); report.selected = result.policyDecision;
    assert.equal(result.ok, true); assert.deepEqual(report.errors, []);
    const old = JSON.parse(fs.readFileSync("reports/iteration/data-search-53-43c5ba3a-20260907.json"));
    for (const key of ["executedNodeCount", "successfulInputSubmissionCount", "executedNodeCountByDecisionKind", "failedNodeCountByCode"])
      assert.deepEqual(report.diagnostics[key], old.diagnostics[key]);
    assert.equal(result.policyDecision.actionId, old.action.actionId);
    assert.equal(report.rows.length, report.diagnostics.executedNodeCountByDecisionKind["choose_target:conditional/decision=choose_target/effect=science_domain_place_data"]);
    report.passed = true;
  } catch (error) { report.passed = false; report.errors.push({ message: error.message, stack: error.stack }); process.exitCode = 1; }
  finally {
    post("Debugger.disable"); debug.disconnect(); env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ passed: report.passed, rows: report.rows.length, errors: report.errors }));
  }
}
