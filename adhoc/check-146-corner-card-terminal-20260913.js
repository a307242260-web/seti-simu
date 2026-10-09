"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "adhoc/decision146-card-terminal-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const source = "seti-saves/seti-save-research-income-choice-greedy-20260913-5ef60d81-full-v272.json";
const save = JSON.parse(fs.readFileSync(source));
const env = createSimulationEnv();
const record = { source, step: 147, scope: "蓝席 card_corner 弃 b_63 的冷决策对比（CARD-TERMINAL-VALUE-01）" };
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
  const hand = env.observe("player-blue")?.selfState?.hand || [];
  record.baselineAction = { actionId: expectedAction.actionId, summary: expectedAction.summary, target: expectedAction.target };
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
  record.chosen = (result.plan?.steps || []).slice(0, 3);
  record.changed = result.actionId !== expectedAction.actionId;
  record.blueHand = hand.map((card) => card.cardId || card.id);
  record.diagnostics = env.getCounterfactualDiagnostics();
  assert.equal(result.ok, true);
} catch (error) {
  record.error = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  env.dispose();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({
    output,
    wallMs: Math.round(record.wallMs || 0),
    baseline: record.baselineAction?.actionId,
    chosen: record.actionId,
    changed: record.changed,
    blueHand: record.blueHand,
    failed: record.diagnostics?.failedNodeCountByCode,
  }));
}
