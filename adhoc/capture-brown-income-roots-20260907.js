"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/brown-income-roots-20260907.json";
if (fs.existsSync(output)) console.log("已有棕方对照根状态");
else {
  const rows = [];
  for (const [recordId, step] of [["7d87ceb5.6b5381c1", 171], ["f237707b.4b246dca", 173]]) {
    const env = createSimulationEnv(); let fork;
    try {
      const record = JSON.parse(fs.readFileSync(`reports/research/${recordId}.full.json`));
      const save = JSON.parse(fs.readFileSync(record.savePath));
      const cp = JSON.parse(fs.readFileSync("reports/iteration/green-company-finish-20260907.json")).entries.find(e => e.step === 162).checkpoint;
      env.loadCheckpoint(cp);
      for (let index = 161; index < step - 1; index++) {
        const expected = save.replaySteps[index], action = env.legalActions().find(a => a.actionId === expected.action.actionId);
        assert.deepEqual(action, expected.action); const result = env.step(action); assert.equal(result.ok, true, JSON.stringify(result.error));
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      }
      const checkpoint = env.createCheckpoint(); delete checkpoint.replaySteps;
      fork = env.createCounterfactualFork().composition;
      const observation = fork.projection({ playerId: "player-brown", role: "player" }).state;
      const legal = env.legalActions();
      const catalog = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: "player-brown", rootObservation: observation, legalActions: legal });
      const finalState = JSON.parse(save.committedState);
      rows.push({ recordId, step, checkpoint, legal, catalog, observation,
        finalScore: finalState.match.finalScores.find(p => p.playerId === "player-brown"),
        scoreSources: finalState.players.players.find(p => p.id === "player-brown").scoreSources });
    } finally { fork?.dispose(); env.dispose(); }
  }
  const states = rows.map(r => JSON.parse(r.checkpoint.coreState.committedState));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const legalSemantics = r => r.legal.map(({ stateVersion, decisionVersion, ...action }) => action);
  const comparisons = { brownPlayerEqual: equal(...states.map(s => s.players.players.find(p => p.id === "player-brown"))),
    legalExceptAuthorityEqual: equal(...rows.map(legalSemantics)), catalogEqual: equal(...rows.map(r => r.catalog)),
    rngEqual: equal(...states.map(s => s.meta.rngState)),
    sameStateDomains: Object.fromEntries(Object.keys(states[0]).map(k => [k, equal(states[0][k], states[1][k])])) };
  fs.writeFileSync(output, JSON.stringify({ scope: "正式重放两版棕方首次收入分歧所属搜索前态，不运行AI；相同项不能外推全状态相同",
    rows, comparisons, passed: true }, null, 2) + "\n");
  console.log(JSON.stringify({ output, comparisons }));
}
