"use strict";

const assert = require("node:assert/strict");
const baseline = require("./ai-controller.seed-baseline.json");
const { createHeadlessEnv } = require("./headless-env");

function chooseBaselineAction(actions) {
  return actions.find((action) => action.family === "pass")
    || actions.find((action) => action.family === "end_turn")
    || actions[0]
    || null;
}

function countActions(actionSequence) {
  return actionSequence.reduce((counts, actionId) => {
    counts[actionId] = (counts[actionId] || 0) + 1;
    return counts;
  }, {});
}

const env = createHeadlessEnv();
const failures = [];
const actionSequence = [];
let observation = env.reset({
  seed: baseline.seed,
  activePlayerCount: baseline.config.activePlayerCount,
  aiDifficulty: baseline.config.aiDifficulty,
});

for (
  let stepIndex = 0;
  stepIndex < 200 && !env.isTerminal();
  stepIndex += 1
) {
  const action = chooseBaselineAction(env.legalActions());
  if (!action) {
    failures.push(`第 ${stepIndex} 步没有合法行动`);
    break;
  }
  actionSequence.push(action.payload?.sourceActionType || action.family);
  const result = env.step(action);
  if (!result.ok) {
    failures.push(result.error || `第 ${stepIndex} 步执行失败`);
    break;
  }
  observation = result.observation;
}

const actual = {
  terminal: env.isTerminal(),
  completionRate: env.isTerminal() ? 1 : 0,
  steps: actionSequence.length,
  scores: observation.publicState.players.map((player) => player.score),
  bugCount: failures.length,
  blocked: failures.length > 0 || !env.isTerminal(),
};

assert.deepEqual(actual, baseline.terminalSummary);
assert.deepEqual(
  actionSequence.slice(0, baseline.keyActionSequence.length),
  baseline.keyActionSequence,
);
assert.deepEqual(countActions(actionSequence), baseline.actionCounts);
assert.equal(env.getReplay().finalStateSummary.terminal, true);

env.dispose();

console.log("app/ai-controller.seed-baseline.test.js ok");
