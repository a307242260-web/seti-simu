"use strict";
const fs = require("node:fs");
const zlib = require("node:zlib");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/search-equivalence-r4-20260906-v2.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/r3-brown-before-41-20260906.json"));
  const report = { createdAt: new Date().toISOString(),
    scope: "真实checkpoint仅修改rocket序号的受控接口反例；不是两条已证明可达的历史分支。另只读已有叶寻找完成事实遗漏。", samples: [] };
  try {
    for (const increment of [0, 100]) {
      const env = createSimulationEnv();
      let fork;
      try {
        const current = structuredClone(checkpoint);
        delete current.replaySteps;
        const envelope = current.coreState.compositionEnvelope;
        const state = JSON.parse(envelope.committedState);
        state.meta.sequences.rocket += increment;
        envelope.committedState = JSON.stringify(state);
        current.coreState.committedState = envelope.committedState;
        env.loadCheckpoint(current);
        fork = env.createCounterfactualFork();
        const composition = fork.composition;
        const before = composition.lifecycle.save();
        const action = composition.inputPort.enumerateActions().find((item) => item.family === "launch");
        assert.ok(action);
        const result = composition.inputPort.submitAction(action, { skipProjection: true });
        assert.equal(result.ok, true);
        const event = result.journal.events.find((item) => item.type === "launch");
        assert.ok(event);
        const successors = composition.inputPort.enumerateActions();
        report.samples.push({ increment, action, event,
          nextMoves: successors.filter((item) => item.family === "move"),
          beforeMeta: JSON.parse(before.envelope.committedState).meta });
      } finally { fork?.composition?.dispose(); env.dispose(); }
    }
    assert.equal(report.samples[1].event.rocketId - report.samples[0].event.rocketId, 100);
    const source = JSON.parse(zlib.gunzipSync(fs.readFileSync("reports/iteration/probe-source-opening-20260906.json.gz")));
    const seen = new Map();
    report.completionFactsCollision = null;
    for (const outcome of source.outcomes) {
      for (const leaf of outcome.leaves || []) {
        if (!leaf.observation || leaf.terminalReason !== "goal-completed") continue;
        const facts = evaluator.secondaryAgentCompletionFacts(leaf.observation, "player-white");
        const key = JSON.stringify([outcome.actionId, leaf.secondaryAgentDepth, facts]);
        const rockets = leaf.observation.publicState?.board?.rockets || [];
        const prior = seen.get(key);
        if (prior && JSON.stringify(prior.rockets) !== JSON.stringify(rockets)) {
          report.completionFactsCollision = { actionId: outcome.actionId,
            first: prior, second: { leafId: leaf.leafId, rockets, chain: leaf.actionChain }, facts };
          break;
        }
        seen.set(key, { leafId: leaf.leafId, rockets, chain: leaf.actionChain });
      }
      if (report.completionFactsCollision) break;
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, passed: report.passed,
    rocketIds: report.samples.map((sample) => sample.event.rocketId),
    completionFactsCollision: report.completionFactsCollision && {
      first: report.completionFactsCollision.first.leafId,
      second: report.completionFactsCollision.second.leafId }, error: report.error }, null, 2));
}
