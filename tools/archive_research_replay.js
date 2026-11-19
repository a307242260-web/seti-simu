#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createSeededRandom } = require("../randomizer/game/random");
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { compactDecision } = require("./research-record-retention");

const SCHEMA = "seti-research-replay-v1";
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(file, "utf8");
const parse = file => JSON.parse(read(file));
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function ordered(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(ordered);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
}
const digest = value => hash(JSON.stringify(ordered(value)));

function replay(archive) {
  assert.equal(archive.schemaVersion, SCHEMA);
  assert(typeof archive.seed === "string" && archive.seed && [3, 4].includes(archive.activePlayerCount));
  const { seed, activePlayerCount } = archive;
  const random = createSeededRandom(seed);
  const rngState = { algorithm: "seti-simulation-mulberry32-v1", state: random.getState() };
  const kernel = createSimulationRuleComposition({ seed, activePlayerCount, random, rngState, trustedProjectionReader: true });
  const comp = kernel.composition;
  try {
    comp.lifecycle.newGame({ seed, activePlayerCount, initialize: true, rngState });
    comp.inputPort.beginDrain({ metadata: { source: "research-archive" } });
    for (const [index, step] of archive.actions.entries()) {
      const { action } = step;
      const inspect = comp.inspect();
      const decision = inspect.phase === "awaiting_input" ? inspect.session.decision : null;
      const choices = decision?.choices || comp.inputPort.enumerateActions({});
      const samePayload = item => item.family === action.family && item.actorId === action.actorId
        && digest(item.target || {}) === digest(action.target || {});
      const chosen = choices.find(item => item.actionId === action.actionId && samePayload(item));
      assert(chosen, `RESEARCH_ARCHIVE_ACTION_MISSING step=${index + 1} action=${action.actionId}`);
      const result = decision
        ? comp.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: chosen })
        : chosen.phase === "quick" ? comp.inputPort.submitQuickAction(chosen) : comp.inputPort.submitAction(chosen);
      assert(result.ok, `RESEARCH_ARCHIVE_ACTION_FAILED step=${index + 1} action=${action.actionId}`);
    }
    const { envelope } = comp.lifecycle.save();
    const state = JSON.parse(envelope.committedState);
    assert.equal(state.meta.worldVersion, archive.worldVersion);
    const output = { nativeStateSha256: digest(state), sessionSha256: digest(envelope.session), rng: state.meta.rngState };
    assert.deepEqual(output, archive.expected, "RESEARCH_ARCHIVE_FINAL_STATE_OR_RNG_DRIFT");
    return output;
  } finally { comp.dispose(); }
}

function archiveFromRecord(recordFile) {
  const record = parse(recordFile);
  assert(record.terminal && record.savePath, "RESEARCH_ARCHIVE_REQUIRES_FINISHED_RECORD");
  const save = parse(path.resolve(ROOT, record.savePath));
  const state = JSON.parse(save.committedState);
  assert.equal(state.meta.seed, record.seed);
  assert.equal(state.turn.activePlayerCount, record.activePlayerCount);
  assert(state.turn.gameEnded && !save.session, "RESEARCH_ARCHIVE_REQUIRES_SETTLED_SAVE");
  assert.equal(save.replaySteps.length, record.steps);
  const actions = save.replaySteps.map(({ action }) => ({ action: {
    actionId: action.actionId, actorId: action.actorId, family: action.family, target: action.target,
  } }));
  const rows = record.agentTracePath ? read(path.resolve(ROOT, record.agentTracePath)).split("\n").filter(line => line.trim()) : [];
  const firstStep = actions.length - rows.length + 1;
  assert(firstStep > 0);
  const decisions = rows.map((line, index) => {
    const row = compactDecision(JSON.parse(line), { step: firstStep + index });
    const actual = actions[row.step - 1]?.action;
    assert(actual && row.actionId === actual.actionId && row.seat === actual.actorId, `RESEARCH_ARCHIVE_TRACE_MISMATCH step=${row.step}`);
    return row;
  });
  return { schemaVersion: SCHEMA, seed: record.seed, worldVersion: state.meta.worldVersion,
    ruleCommit: record.gitCommit, policyVersion: record.policyVersion, activePlayerCount: record.activePlayerCount,
    actions, decisions, expected: { nativeStateSha256: digest(state), sessionSha256: digest(save.session), rng: state.meta.rngState } };
}

if (require.main === module) {
  const [file, out, extra] = process.argv.slice(2);
  assert(file && out && !extra, "用法: node tools/archive_research_replay.js <正式记录.json> <历史复盘.json> 或 --verify <历史复盘.json>");
  const archive = file === "--verify" ? parse(out) : archiveFromRecord(file);
  replay(archive);
  if (file !== "--verify") fs.writeFileSync(out, JSON.stringify(archive) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ seed: archive.seed, ruleCommit: archive.ruleCommit, inputs: archive.actions.length, decisions: archive.decisions.length, verified: true }));
}

module.exports = { archiveFromRecord, replay };
