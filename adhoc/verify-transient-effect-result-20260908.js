"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/transient.js");
const { createRuntime } = req("../randomizer/game/effects/session-runtime");
const output = "/Users/bilibili/code/seti-simu/reports/iteration/transient-effect-result-81ee9ed6-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed: false, scope: "正式runtime返回通道；不是游戏规则或AI效果验收" };
try {
  function create() {
    const runtime = createRuntime();
    runtime.registerExecutor("evidence-probe", (state, effect) => ({
      ok: true, nextState: { ...state, count: state.count + 1 },
      transientProbe: { ordinal: effect.payload.ordinal },
    }));
    const dispatched = runtime.dispatchAction({ count: 0 }, { family: "test" }, () => ({
      groupId: "probe-group", effects: [1, 2].map(ordinal => ({
        type: "evidence-probe", ownerId: "p1", payload: { ordinal },
      })),
    }));
    assert.equal(dispatched.ok, true);
    return { runtime, session: dispatched.session };
  }
  const stepped = create();
  const first = stepped.runtime.advance(stepped.session);
  assert.equal(first.ok, true);
  assert.deepEqual(first.result.transientProbe, { ordinal: 1 });
  const saved = stepped.runtime.createCheckpoint(stepped.session);
  assert.equal(saved.ok, true);
  assert.equal(JSON.stringify(saved).includes("transientProbe"), false);
  const last = stepped.runtime.advance(stepped.session);
  assert.equal(last.ok, true);
  assert.equal(stepped.session.phase, "completed");
  assert.equal(last.result, undefined);
  const drained = create();
  const result = drained.runtime.drain(drained.session);
  assert.equal(result.ok, true);
  assert.equal(drained.session.phase, "completed");
  assert.equal(result.result, undefined);
  assert.equal(JSON.stringify(result).includes("transientProbe"), false);
  assert.deepEqual(drained.session.committedState, stepped.session.committedState);
  report.nonterminalAdvanceReturnsEvidence = true;
  report.terminalAdvanceReturnsEvidence = false;
  report.drainReturnsEvidence = false;
  report.checkpointContainsEvidence = false;
  report.committedState = drained.session.committedState;
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
