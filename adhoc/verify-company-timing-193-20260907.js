"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const outcomes = require("../randomizer/game/ai/outcome-model");
const output = "reports/iteration/company-timing-193-20260907.json";
if (fs.existsSync(output)) console.log("已有时机与计划失效证据");
else {
  const env = createSimulationEnv(), report = { scope: "原生正式重放162至193前态与计划复用判定，不运行AI", events: [] };
  try {
    const r = JSON.parse(fs.readFileSync("reports/research/f237707b.4b246dca.full.json")), save = JSON.parse(fs.readFileSync(r.savePath));
    const source = JSON.parse(fs.readFileSync("reports/iteration/green-company-finish-20260907.json"));
    env.loadCheckpoint(source.entries.find(e => e.step === 162).checkpoint);
    let plan = JSON.parse(fs.readFileSync("reports/iteration/company-finish-decision-162-20260907.json")).plan;
    for (let i = 0; i < 3; i++) plan = plans.advancePlan(plan);
    let previous;
    for (let index = 161; index <= 192; index++) {
      const state = JSON.parse(env.createCheckpoint().coreState.committedState);
      const snapshot = { solarSystem: state.solarSystem, rocket: state.pieces.rockets.find(p => p.id === 4),
        revealed: Object.values(state.aliens.aliens).filter(a => a.revealed).length };
      if (previous && JSON.stringify(snapshot) !== JSON.stringify(previous)) report.events.push({ afterStep: index, previous, current: snapshot });
      previous = snapshot;
      if (index === 192) {
        const fork = env.createCounterfactualFork().composition;
        try {
          const legal = fork.inputPort.enumerateActions();
          const observation = outcomes.createDecisionObservation(fork.projection({ playerId: "player-green", role: "player" }).state,
            { seatId: "player-green", stateVersion: legal[0].stateVersion, decisionVersion: legal[0].decisionVersion });
          report.planNext = plan.steps[0];
          report.reuse = plans.planReuseCheck(plan, observation, legal);
          report.nextActionLegal = legal.some(a => a.actionId === plan.nextActionId);
          report.actualAction = save.replaySteps[index].action;
          report.finalSnapshot = snapshot;
        } finally { fork.dispose(); }
        break;
      }
      const expected = save.replaySteps[index], action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action); const result = env.step(action); assert.equal(result.ok, true, JSON.stringify(result.error));
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.passed = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; report.passed = false; process.exitCode = 1; }
  finally { env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); }
  console.log(JSON.stringify({ output, passed: report.passed, error: report.error, reuse: report.reuse,
    nextActionLegal: report.nextActionLegal, events: report.events.map(e => ({ afterStep: e.afterStep,
      solarChanged: JSON.stringify(e.previous.solarSystem) !== JSON.stringify(e.current.solarSystem),
      rocketBefore: e.previous.rocket, rocketAfter: e.current.rocket, revealedBefore: e.previous.revealed, revealedAfter: e.current.revealed })) }));
}
