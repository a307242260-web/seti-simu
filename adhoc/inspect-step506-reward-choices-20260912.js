"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const model = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/step506-reward-choices-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("reports/iteration/budget-before-step506-20260912.json"));
const save = JSON.parse(fs.readFileSync(input.source));
const env = createSimulationEnv();
const rows = [];
try {
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(), input.legalActions);
  for (let index = 505; index < 516; index += 1) {
    const legal = env.legalActions();
    const expected = save.replaySteps[index].action;
    const action = legal.find(a => a.actionId === expected.actionId);
    assert(action);
    if (legal.some(a => a.target?.kind === "planet-reward-alien-trace")) {
      const observation = model.createDecisionObservation(env.observe("player-white"), { seatId: "player-white" });
      const selected = evaluator.selectSecondaryAgentSuccessors({ branchObservation: observation,
        focalSeatId: "player-white", currentAction: save.replaySteps[index - 1].action,
        routeTargetId: "land:saturn:satellite:titan", routePlanId: "land:saturn:satellite:titan",
        legalSuccessors: legal });
      rows.push({ step: index + 1, selectedRecordedAction: action,
        legalCount: legal.length, searchSelectedCount: selected.length,
        legalActions: legal, searchSelected: selected });
    }
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, save.replaySteps[index].after);
  }
  assert.equal(rows.length, 2);
  fs.writeFileSync(output, JSON.stringify({ source: input.source,
    scope: "按已记录真实路线重放，检查土卫六两次任意痕迹正式选择及绑定后继；无AI搜索，不证明其他路线相同。",
    rows }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(rows.map(row => ({ step: row.step, legal: row.legalCount,
    selected: row.searchSelectedCount, choices: row.searchSelected.map(a => a.summary) })), null, 2));
} finally { env.dispose(); }
