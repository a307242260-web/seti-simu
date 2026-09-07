"use strict";
const fs = require("node:fs"), path = require("node:path"), inspector = require("node:inspector"), assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const tree = process.argv[2]; assert.ok(path.isAbsolute(tree));
const mode = process.argv[3] || "cold"; assert.ok(["cold", "blue50", "brown171", "green162"].includes(mode));
const rootStep = Number(process.argv[5] || (["brown171","green162"].includes(mode) ? 171 : 122));
assert.ok([122,171,173].includes(rootStep));
assert.ok(rootStep !== 173 || mode === "green162", "173只用于相同预热下的真实后态对照");
const codeCommit = process.argv[4] || "4b246dca";
const output = `reports/iteration/resource-cache-${rootStep}-${["cold","brown171"].includes(mode) ? "trace" : mode}${codeCommit === "4b246dca" ? "" : `-${codeCommit}`}-20260907.json`;
if (fs.existsSync(output)) console.log("已有缓存读写跟踪，不重跑");
else {
  const filename = path.join(tree, "randomizer/game/ai/expected-score-evaluator.js");
  const source = fs.readFileSync(filename, "utf8").split("\n");
  const session = new inspector.Session(); session.connect();
  function post(method, params = {}) {
    let done = false, value, error;
    session.post(method, params, (e, r) => { error = e; value = r; done = true; });
    assert.ok(done, "本地Inspector请求必须同步返回"); if (error) throw error; return value;
  }
  const events = [], failures = [], breakpoints = new Map(); let env, currentStep = rootStep, primer = null;
  const conflictKeys = mode === "green162" ? JSON.parse(fs.readFileSync("reports/iteration/resource-cache-171-keys-20260907.json")).rows.filter(r=>r.conflictingSeats.length).map(r=>r.key) : [];
  try {
    post("Debugger.enable");
    for (const [kind, marker] of [["lookup", "if (resourcePreparationCache.has(preparationKey))"], ["write", "resourcePreparationCache.set(preparationKey, plannedTradeIds)"]]) {
      if(mode === "brown171" && kind === "lookup") continue;
      const matches = source.flatMap((line, i) => line.includes(marker) ? [i] : []); assert.equal(matches.length, 1);
      const breakpoint = post("Debugger.setBreakpointByUrl", { url: pathToFileURL(filename).href, lineNumber: matches[0],
        ...(mode === "blue50" ? { condition: "preparationKey.startsWith('1:2:1:1:1:3:2:')" }
          : mode === "green162" ? { condition: `${JSON.stringify(conflictKeys)}.includes(preparationKey)` } : {}) });
      breakpoints.set(breakpoint.breakpointId, kind);
    }
    session.on("Debugger.paused", ({ params }) => {
      try {
        const kind = breakpoints.get(params.hitBreakpoints?.[0]); assert.ok(kind);
        const expression = `JSON.stringify({key:preparationKey,seatId,required,initial,target,legal:Array.from(legalByTradeId),cached:resourcePreparationCache.has(preparationKey)?resourcePreparationCache.get(preparationKey):null${kind === "write" ? ",plannedTradeIds" : ""}})`;
        const result = post("Debugger.evaluateOnCallFrame", { callFrameId: params.callFrames[0].callFrameId, expression, returnByValue: true });
        assert.equal(result.exceptionDetails, undefined);
        events.push({ step: currentStep, kind, ...JSON.parse(result.result.value), callers: params.callFrames.slice(1,5).map(f => f.functionName) });
      } catch (error) { failures.push({ message: error.message, stack: error.stack }); }
      finally { post("Debugger.resume"); }
    });
    env = require(path.join(tree,"randomizer/app/simulation-env")).createSimulationEnv();
    const cp = rootStep !== 122
      ? JSON.parse(fs.readFileSync("reports/iteration/brown-income-roots-20260907.json")).rows.find(r=>r.step===rootStep).checkpoint
      : JSON.parse(fs.readFileSync("reports/iteration/company-income-122-20260907.json")).checkpoint;
    if (mode === "blue50") {
      currentStep = 50;
      const record = JSON.parse(fs.readFileSync("reports/research/f237707b.4b246dca.full.json")), save = JSON.parse(fs.readFileSync(record.savePath));
      env.reset(cp.config);
      for (let i=0; i<49; i++) {
        const expected=save.replaySteps[i], action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
        assert.deepEqual(action,expected.action); assert.equal(env.step(action).ok,true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
      }
      const checkpoint=env.createCheckpoint(), start=performance.now(), result=env.runHeuristicPolicyDecision();
      delete checkpoint.replaySteps;
      primer={ checkpoint, wallMs:performance.now()-start, diagnostics:env.getCounterfactualDiagnostics(), plan:result.plan, action:result.policyDecision.actionId };
      assert.equal(result.ok,true); currentStep=122;
    }
    if (mode === "green162") {
      currentStep=162;
      const checkpoint=JSON.parse(fs.readFileSync("reports/iteration/green-company-finish-20260907.json")).entries.find(e=>e.step===162).checkpoint;
      delete checkpoint.replaySteps; env.loadCheckpoint(checkpoint);
      const start=performance.now(),result=env.runHeuristicPolicyDecision();
      primer={checkpoint,wallMs:performance.now()-start,diagnostics:env.getCounterfactualDiagnostics(),plan:result.plan,action:result.policyDecision.actionId};
      assert.equal(result.ok,true);currentStep=rootStep;
    }
    delete cp.replaySteps; env.loadCheckpoint(cp);
    assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,cp.coreState.compositionEnvelope);
    const start = performance.now(), result = env.runHeuristicPolicyDecision(), wallMs = performance.now()-start;
    const diagnostics = env.getCounterfactualDiagnostics();
    fs.writeFileSync(output, JSON.stringify({ scope: "Inspector只读断点跟踪指定真实根，不修改源码/缓存，不重跑全盘；耗时含诊断开销，171仅跟踪写入", codeCommit, rootStep,
      mode, primer, wallMs, diagnostics, events, failures, plan: result.plan },null,2)+"\n");
    assert.equal(result.ok,true); assert.deepEqual(failures,[]); assert.ok(events.length>0);
    if (mode === "cold") { assert.equal(diagnostics.executedNodeCount,90); assert.equal(diagnostics.successfulInputSubmissionCount,132); }
    if (mode === "brown171") { assert.equal(diagnostics.executedNodeCount,4096); assert.equal(diagnostics.successfulInputSubmissionCount,5542); }
    console.log(JSON.stringify({ events:events.length, keys:new Set(events.map(e=>e.key)).size, writes:events.filter(e=>e.kind==="write").length,wallMs,
      nodes:diagnostics.executedNodeCount,inputs:diagnostics.successfulInputSubmissionCount,planStart:result.plan.steps.slice(0,3),
      writesByStep:mode === "brown171" ? undefined : events.filter(e=>e.kind==="write").map(e=>({step:e.step,seat:e.seatId,trades:e.plannedTradeIds})) }));
  } finally { env?.dispose(); session.disconnect(); }
}
