"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), inspector = require("node:inspector");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/data-boundary.js");
const { createSimulationEnv } = req("../randomizer/app/simulation-env");
const output = "/Users/bilibili/code/seti-simu/reports/iteration/data-continuation-boundary-candidate-20260908.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const report = { scope: "完整候选方案未提交前的连续起手边界验证；断点运行不作为冷性能成绩", samples: [], errors: [] };
const samples = [], debug = new inspector.Session(), ids = new Map(); debug.connect();
const post = (method, params = {}) => {
  let done = false, error, result;
  debug.post(method, params, (e,r) => { error=e; result=r; done=true; });
  assert.ok(done); if(error) throw error; return result;
};
globalThis.__setiDataChainCount = 0;
globalThis.__setiDataChainPending = false;
globalThis.__setiDataChainCapture = null;
debug.on("Debugger.paused", ({params}) => {
  try {
    const before = ids.get(params.hitBreakpoints[0]) === "before";
    const expression = before
      ? "globalThis.__setiDataChainCapture=structuredClone({envelope:nextBoundary.envelope,key:branchKey(nextBoundary.envelope,nextData.actionId),action:nextData});true"
      : "globalThis.__setiDataChainCapture=structuredClone({envelope:composition.lifecycle.save().envelope,planStep:nextPlanStep});true";
    const r = post("Debugger.evaluateOnCallFrame", {callFrameId:params.callFrames[0].callFrameId,expression,returnByValue:true});
    assert.equal(r.exceptionDetails, undefined);
    if(before) {samples.push(globalThis.__setiDataChainCapture);globalThis.__setiDataChainPending=true;}
    else {samples.at(-1).after=globalThis.__setiDataChainCapture;globalThis.__setiDataChainPending=false;globalThis.__setiDataChainCount++;}
  } catch(error) {report.errors.push(error.stack);}
  finally {post("Debugger.resume");}
});
const env=createSimulationEnv();
try {
  post("Debugger.enable");
  const lines=fs.readFileSync(req.resolve("../randomizer/game/rule-composition"),"utf8").split("\n");
  for(const [kind,marker]of [["before","reusableFork.resetBranch(branchKey(nextBoundary.envelope"],["after","outerActions.push(nextData);"]]) {
    const matches=lines.flatMap((l,i)=>l.includes(marker)?[i]:[]);assert.equal(matches.length,1);
    const bp=post("Debugger.setBreakpointByUrl",{urlRegex:"rule-composition\\.js$",lineNumber:matches[0],
      condition:kind==="before"?"globalThis.__setiDataChainCount < 4":"globalThis.__setiDataChainPending"});
    ids.set(bp.breakpointId,kind);
  }
  const checkpoint=JSON.parse(fs.readFileSync("/private/tmp/seti-rules-baseline-20260908.ohUO6T/reports/iteration/data-root-53-aaaed8d0-20260907.json")).root;
  env.loadCheckpoint(checkpoint);
  const result=env.runHeuristicPolicyDecision();report.diagnostics=env.getCounterfactualDiagnostics();
  post("Debugger.disable");
  assert.equal(result.ok,true);assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.diagnostics.failedNodeCountByCode,{});assert.equal(samples.length,4);
  for(const sample of samples) {
    assert.ok(sample.after);
    const fork=env.createCounterfactualFork(sample.envelope);
    try {
      fork.resetBranch(sample.key);
      assert.equal(fork.composition.lifecycle.restore(sample.envelope).ok,true);
      const action=fork.composition.inputPort.enumerateActions().find(a=>a.actionId===sample.action.actionId);
      assert.ok(action);assert.equal(fork.composition.inputPort.submitAction(action).ok,true);
      assert.deepEqual(fork.composition.lifecycle.save().envelope,sample.after.envelope);
      report.samples.push({branchKey:sample.key,action:sample.action,completeEnvelopeEqual:true,
        nextEffect:fork.composition.inspect().session?.currentEffect?.type});
      console.log(`[连续放数据边界] 完整状态一致：${sample.key}`);
    } finally {fork.composition.dispose();}
  }
  report.action=result.policyDecision.actionId;report.passed=true;
} catch(error) {report.passed=false;report.error=error.stack;process.exitCode=1;}
finally {
  post("Debugger.disable");debug.disconnect();env.dispose();
  delete globalThis.__setiDataChainCount;delete globalThis.__setiDataChainPending;delete globalThis.__setiDataChainCapture;
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,passed:report.passed,samples:report.samples.length,error:report.error}));
}
