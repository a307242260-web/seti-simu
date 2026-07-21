"use strict";

const assert = require("node:assert/strict");
const { createHeadlessEnv } = require("./headless-env");

const env = createHeadlessEnv();

try {
  env.reset({
    seed: "headless-training-replay",
    activePlayerCount: 4,
    aiDifficulty: "laughable",
    offlineTeacher: true,
    compactReplay: true,
  });
  const result = env.runOfflineTeacherDecision();
  assert.equal(result.done, false);
  assert.equal(result.teacherAdapter, "seti-heuristic-policy-v2");
  assert.equal(result.chosenAction.actionId, result.beforeActions.find(
    (candidate) => candidate.actionId === result.chosenAction.actionId,
  ).actionId);

  const [step] = env.getReplay().steps;
  assert.equal(step.publicSummary, null);
  assert.equal(step.effectSessionJournal.schemaVersion, "seti-effect-session-journal-compact-v1");
  assert.equal(step.effectSessionJournal.replay.length, 1);
  assert.equal(step.effectSessionJournal.replay[0].confirmed, true);
  assert.equal(step.effectSessionJournal.replayCursor >= 1, true);
  console.log("headless-training-replay tests passed");
} finally {
  env.dispose();
}
