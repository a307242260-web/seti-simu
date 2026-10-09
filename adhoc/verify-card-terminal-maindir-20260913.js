"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/card-terminal-maindir-verification-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const source = "seti-saves/seti-save-research-income-choice-greedy-20260913-5ef60d81-full-v272.json";
const save = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
const record = { source, step: 147,
  scope: "CARD-TERMINAL-VALUE-01 合回主目录后的独立复验：第147步蓝席 card_corner 弃 b_63。" };
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (let index = 0; index < 146; index += 1) {
    const expected = save.replaySteps[index];
    const action = env.legalActions().find((candidate) => candidate.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action, `第${index + 1}步完整动作`);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after, `第${index + 1}步结果`);
  }
  const expectedAction = save.replaySteps[146].action;
  assert.equal(expectedAction.actionId, "card_corner:d9c95165");
  assert.equal(expectedAction.target?.cardInstanceId, "card-45-0");
  record.baselineActionId = expectedAction.actionId;
  record.blueHand = (env.observe("player-blue")?.selfState?.hand || []).map((card) => card.cardId || card.id);
  const checkpoint = env.createCheckpoint();
  delete checkpoint.replaySteps;
  delete checkpoint.effectSessionJournals;
  delete checkpoint.browserReplaySteps;
  env.loadCheckpoint(checkpoint);
  const started = performance.now();
  const result = env.runHeuristicPolicyDecision();
  record.wallMs = performance.now() - started;
  record.ok = result.ok;
  record.actionId = result.actionId;
  record.planKeys = (result.plan?.steps || []).map((step) => step.actionKey);
  record.diagnostics = env.getCounterfactualDiagnostics();
  assert.equal(result.ok, true);
  assert(record.wallMs < 30000, "单决策 30 秒门槛");
  assert.deepEqual(record.diagnostics.failedNodeCountByCode, {});
} catch (error) {
  record.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, wallMs: Math.round(record.wallMs || 0),
    baseline: record.baselineActionId, chosen: record.actionId,
    blueHand: record.blueHand, failed: record.diagnostics?.failedNodeCountByCode }));
}
