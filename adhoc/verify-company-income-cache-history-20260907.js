"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { Readable } = require("node:stream"), { pipeline } = require("node:stream/promises");
const tree = process.argv[2], mode = process.argv[3];
assert.ok(path.isAbsolute(tree)); assert.ok(["cold", "warm42", "warm24"].includes(mode));
const base = `reports/iteration/company-income-cache-${mode}-4b246dca-20260907`;
const { createSimulationEnv } = require(path.join(tree, "randomizer/app/simulation-env"));
const evaluator = require(path.join(tree, "randomizer/game/ai/expected-score-evaluator"));
async function main() {
  if (fs.existsSync(`${base}.json`) || [24,42,122].some(step=>fs.existsSync(`${base}.${step}.jsonl.gz`))) return console.log("已有检查点，不重跑");
  const env = createSimulationEnv(), measurements = [];
  async function capture(checkpoint, step) {
    delete checkpoint.replaySteps; env.loadCheckpoint(checkpoint);
    assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope, checkpoint.coreState.compositionEnvelope);
    const legalActions = env.legalActions(), start = performance.now(), result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now()-start, diagnostics = env.getCounterfactualDiagnostics();
    async function* lines() {
      const { actionOutcomes, ...decision } = result;
      yield JSON.stringify({ type: "header", codeCommit: "4b246dca", mode, step, checkpoint, legalActions, wallMs, diagnostics, result: decision })+"\n";
      for (const outcome of actionOutcomes || []) {
        const { leaves, ...metadata } = outcome;
        yield JSON.stringify({ type: "outcome", outcome: metadata })+"\n";
        for (const leaf of leaves || []) yield JSON.stringify({ type: "leaf", actionId: outcome.actionId, leaf })+"\n";
      }
    }
    await pipeline(Readable.from(lines()),zlib.createGzip(),fs.createWriteStream(`${base}.${step}.jsonl.gz`));
    assert.equal(result.ok,true); assert.deepEqual(diagnostics.failedNodeCountByCode,{}); assert.ok(wallMs<30000);
    const action=legalActions.find(a=>a.actionId===result.policyDecision.actionId);
    const outcome=result.actionOutcomes.find(o=>o.actionId===action.actionId);
    const evaluation=evaluator.evaluateAction({seatId:action.actorId,legalActions,observation:outcome.rootObservation,actionOutcomes:result.actionOutcomes},action);
    measurements.push({step,wallMs,diagnostics,evaluation,plan:result.plan});
    console.log(JSON.stringify({mode,step,wallMs,nodes:diagnostics.executedNodeCount,inputs:diagnostics.successfulInputSubmissionCount,leaf:evaluation.selectedLeafId,score:evaluation.score}));
  }
  try {
    if(mode==="warm24") {
      const root=JSON.parse(fs.readFileSync("reports/iteration/company-income-122-20260907.json")).checkpoint;
      const record=JSON.parse(fs.readFileSync("reports/research/f237707b.4b246dca.full.json"));
      const save=JSON.parse(fs.readFileSync(record.savePath));
      env.reset(root.config);
      for(let i=0;i<23;i++) {
        const expected=save.replaySteps[i],action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
        assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
      }
      await capture(env.createCheckpoint(),24);
    }
    if(mode==="warm42")await capture(JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint,42);
    await capture(JSON.parse(fs.readFileSync("reports/iteration/company-income-122-20260907.json")).checkpoint,122);
    fs.writeFileSync(`${base}.json`,JSON.stringify({scope:"旧代码同一122根对照：按mode选择无预热/绿方42/白方24，不重跑全局，不改正式状态或源码",measurements},null,2)+"\n");
  }finally{env.dispose();}
}
main().catch(error=>{fs.writeFileSync(`${base}.failure.json`,JSON.stringify({message:error.message,stack:error.stack},null,2));console.error(error);process.exitCode=1;});
