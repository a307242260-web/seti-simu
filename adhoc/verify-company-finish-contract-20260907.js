"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const mode = process.argv[2]; assert.ok(["before", "fixed"].includes(mode));
const output = `reports/iteration/company-finish-contract-${mode}-20260907.json`;
if (fs.existsSync(output)) console.log("已有公司结束合同记录");
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/green-company-finish-20260907.json"));
  const cp = source.entries.find(e => e.step === 192).checkpoint;
  const save = JSON.parse(fs.readFileSync(source.savePath)); const rows = []; let bound;
  for (const variant of ["recorded", "free-first"]) {
    const env = createSimulationEnv();
    try {
      env.loadCheckpoint(cp);
      if (variant === "recorded") {
        const fork = env.createCounterfactualFork().composition;
        try {
          const observation = fork.projection({ playerId: "player-green", role: "player" }).state;
          const goal = observation.probeRouteRequirements.candidates.find(g => g.requirementId === "rocket:4:orbit:venus:planet:");
          const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: "player-green", branchObservation: observation,
            legalSuccessors: env.legalActions(), routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}` });
          assert.equal(goal.movementNextSteps.some(s => s.skip), false);
          assert.equal(selected.some(a => a.target?.skip), mode === "before"); bound = { goal, selected };
        } finally { fork.dispose(); }
      }
      const inputs = [];
      const execute = action => { assert.ok(action); const r = env.step(action); assert.equal(r.ok, true, JSON.stringify(r.error)); inputs.push(action); };
      if (variant === "free-first") execute(env.legalActions().find(a => a.target?.deltaX === -1));
      else for (let i = 191; i < 194; i++) execute(env.legalActions().find(a => a.actionId === save.replaySteps[i].action.actionId));
      const state = JSON.parse(env.createCheckpoint().coreState.committedState);
      rows.push({ variant, inputs, player: state.players.players.find(p => p.id === "player-green"),
        pieces: state.pieces, planets: state.planets, aliens: state.aliens, rng: state.meta.rngState });
    } finally { env.dispose(); }
  }
  const kept = rows[1].player.hand.find(c => !rows[0].player.hand.some(old => old.id === c.id));
  assert.equal(kept.cardId, "amiba_1.webp");
  const expected = structuredClone(rows[1].player); expected.hand = expected.hand.filter(c => c.id !== kept.id); expected.resources.handSize--;
  assert.deepEqual(rows[0].player, expected);
  for (const key of ["pieces", "planets", "aliens", "rng"]) assert.deepEqual(rows[0][key], rows[1][key]);
  fs.writeFileSync(output, JSON.stringify({ scope: "真实192两正式分支与绑定合同，不运行搜索", mode, bound, rows, keptCard: kept, passed: true }, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: true, keptCard: kept.cardId, inputs: rows.map(r => r.inputs.length) }));
}
