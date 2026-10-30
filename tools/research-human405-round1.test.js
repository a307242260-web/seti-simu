"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const scenario = require("./research-human405-round1");
const { buildIdentity, fingerprintOf } = require("./run_research_validation");

const options = { seed: "seti-free-analyze-v1", config: { agentType: "search", scenario: scenario.ID } };
const identity = buildIdentity(options);
assert.equal(identity.scenario.id, scenario.ID);
assert.equal(identity.scenario.roles["player-white"], "shared-search");
assert.equal(identity.scenario.roles["player-green"], "pass-only");
assert.notEqual(fingerprintOf(identity), fingerprintOf(buildIdentity({ ...options, config: { agentType: "search" } })), "controlled opponents must not reuse a four-AI experiment fingerprint");
assert.notEqual(fingerprintOf(identity), fingerprintOf({ ...identity, scenario: { ...identity.scenario, openingCheckpointSha256: "changed" } }), "opening provenance belongs to experiment identity");
assert.throws(() => buildIdentity({ ...options, full: true }), /REQUIRES_QUICK/);
assert.throws(() => buildIdentity({ ...options, config: { ...options.config, activePlayerCount: 3 } }), /CONFIGURATION_INVALID/);
assert.throws(() => buildIdentity({ ...options, config: { agentType: "search", scenario: "unknown" } }), /SCENARIO_UNKNOWN/);

const prefixIdentity = buildIdentity({ ...options, config: { ...options.config, scenario: scenario.B117_PREFIX_ID } });
assert.equal(prefixIdentity.scenario.openingInputs, 27);
assert.equal(prefixIdentity.scenario.originalOpeningInputs, 23);
assert.equal(prefixIdentity.scenario.controlledPrefix.forcedInputs, 4);
assert.notEqual(fingerprintOf(prefixIdentity), fingerprintOf(identity), "forced teacher inputs must have an independent fingerprint");
assert.notEqual(fingerprintOf(prefixIdentity), fingerprintOf({ ...prefixIdentity, scenario: { ...prefixIdentity.scenario,
  controlledPrefix: { ...prefixIdentity.scenario.controlledPrefix, actionsSha256: "changed" } } }));
assert.throws(() => buildIdentity({ ...options, full: true, config: { ...options.config, scenario: scenario.B117_PREFIX_ID } }), /REQUIRES_QUICK/);

const root = path.resolve(__dirname, "..");
const source = JSON.parse(fs.readFileSync(path.join(root, "seti-saves/seti-save-537-merged.json"), "utf8"));
const openingBefore = scenario.opening();
const env = scenario.createEnvironment();
try {
  const seeded = scenario.initialize(env, { seed: identity.seed, activePlayerCount: 4, agentType: "search", compactReplay: true, policyVersion: identity.policyVersion }, identity.scenario);
  assert.equal(seeded.length, 23);
  assert.equal(env.createCheckpoint().coreState.committedState, openingBefore.checkpoint.coreState.committedState);
  assert.equal(env.createCheckpoint().config.agentType, "custom");
  assert.equal(env.observe("player-white").publicState.currentPlayerId, "player-white");
  assert(!scenario.settled(env.observe()));
  // Four confirmed teacher inputs reach the first passive opponent. No white
  // AI episode is run by this unit test.
  for (let i = 23; i < 27; i++) {
    const old = source.replaySteps[i], action = env.legalActions().find(a => a.actionId === old.action.actionId && a.actorId === old.actorPlayerId);
    assert(action); assert(env.step(action).ok);
  }
  const nativePrefix = env.createCheckpoint();
  const controlled = scenario.createEnvironment();
  try {
    const seededPrefix = scenario.initialize(controlled, { seed: identity.seed, activePlayerCount: 4, compactReplay: true }, prefixIdentity.scenario);
    assert.equal(seededPrefix.length, 27);
    assert.equal(controlled.createCheckpoint().coreState.committedState, nativePrefix.coreState.committedState);
    assert.deepEqual(controlled.createCheckpoint().coreState.compositionEnvelope, nativePrefix.coreState.compositionEnvelope);
    assert.deepEqual(seededPrefix.slice(0, 23), openingBefore.checkpoint.replaySteps);
    assert.deepEqual(seededPrefix.slice(23).map(e => e.action), source.replaySteps.slice(23, 27).map(e => e.action));
  } finally { controlled.dispose(); }
  for (let i = 0; i < 3; i++) {
    const before = env.createCheckpoint().replaySteps.length, result = env.runAgentDecision();
    assert.equal(result.actorPlayerId, "player-green");
    assert.equal(result.policyProvenance.type, "passive-opponent");
    assert.equal(result.searches.length, 0);
    assert.equal(env.createCheckpoint().replaySteps.length, before + 1);
    const chosen = env.saveBrowserSave().replaySteps.at(-1).action;
    assert(chosen.family === "pass" || ["pass-hand-limit", "pass-reserve-card"].includes(chosen.target.kind));
  }
  assert.equal(env.observe("player-green").publicState.players.find(p => p.playerId === "player-green").score, 7);
  assert.equal(env.observe().publicState.currentPlayerId, "player-blue");
} finally { env.dispose(); }
assert.deepEqual(scenario.opening().checkpoint, openingBefore.checkpoint, "host configuration must not rewrite the source opening");
const invalidPrefix = scenario.createEnvironment();
try {
  assert.throws(() => scenario.initialize(invalidPrefix, { seed: identity.seed, activePlayerCount: 4 }, {
    ...prefixIdentity.scenario, controlledPrefix: { ...prefixIdentity.scenario.controlledPrefix, actionsSha256: "changed" },
  }), /WHITE_ONLY_PREFIX_IDENTITY_DRIFT/);
  assert.equal(invalidPrefix.createCheckpoint().replaySteps.length, 23, "identity drift must not execute a forced input");
} finally { invalidPrefix.dispose(); }

const passive = scenario.passiveAgent("player-blue");
assert.throws(() => passive.decide({ legalActions: [{ actionId: "unexpected", family: "choose_target", target: {} }] }), /UNSUPPORTED_DECISION/);
const reward = ["z", "a"].map(actionId => ({ actionId, family: "choose_card", target: { kind: "pass-reserve-card", cardId: "not-preferred" } }));
assert.equal(passive.decide({ legalActions: reward }).actionId, "a");
assert.equal(passive.decide({ legalActions: [...reward].reverse() }).actionId, "a");
scenario.assertDecisionGate({ diagnostics: { nativeExecutions: 256 }, rootAndSearchMilliseconds: 600 });
for (const [inputs, milliseconds] of [[257, 10], [10, 601]]) {
  const evidence = { complete: true, diagnostics: { nativeExecutions: inputs }, rootAndSearchMilliseconds: milliseconds };
  assert.throws(() => scenario.assertDecisionGate(evidence), error => error.code === "WHITE_ONLY_DECISION_GATE_EXCEEDED" && error.search === evidence);
}

// Standard CLI integration stops at the prepared opening without running white
// AI decisions. Its persisted identity and duplicate guard are still exercised.
for (const scenarioIdentity of [identity, prefixIdentity]) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "seti-white-round1-cli-"));
  try {
    const args = ["tools/run_research_validation.js", "--name", "white-round1-opening-test", "--config", `agentType=search,scenario=${scenarioIdentity.scenario.id}`, "--steps", String(scenarioIdentity.scenario.openingInputs), "--no-save", "--records-dir", directory];
    const first = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);
    const recordPath = path.join(directory, fs.readdirSync(directory).find(p => p.endsWith(".json")));
    const bytes = fs.readFileSync(recordPath), record = JSON.parse(bytes);
    assert.equal(record.steps, scenarioIdentity.scenario.openingInputs);
    assert.deepEqual(record.scenario, scenarioIdentity.scenario);
    assert.equal(record.terminal, false);
    assert.equal(record.scenarioResult.firstRoundSettled, false);
    assert.equal(record.stopReason, "step-limit");
    assert.equal(record.scenario.learnerAgentType, "search");
    assert.equal(record.scoreSemantics, "provisional-after-round1-settlement");
    const duplicate = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
    assert.equal(duplicate.status, 2, duplicate.stderr);
    assert.deepEqual(fs.readFileSync(recordPath), bytes);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }

}

// Inject a host decision failure before any AI input is submitted. The standard
// runner must preserve the unchanged native root and deduplicate the failed run.
for (const scenarioIdentity of [identity, prefixIdentity]) {
  const failedDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "seti-white-round1-fault-"));
  try {
    const preload = path.join(failedDirectory, "fault.cjs");
    fs.writeFileSync(preload, `const api=require(${JSON.stringify(path.join(root, "randomizer/app/simulation-env.js"))});const original=api.createSimulationEnv;api.createSimulationEnv=options=>{const env=original(options);env.runAgentDecision=()=>{const error=new Error('UNIT_SCENARIO_FAULT');error.code='UNIT_SCENARIO_FAULT';throw error;};return env;};\n`);
    const args = ["tools/run_research_validation.js", "--name", "white-round1-fault-test", "--config", `agentType=search,scenario=${scenarioIdentity.scenario.id}`, "--steps", String(scenarioIdentity.scenario.openingInputs + 1), "--no-save", "--records-dir", failedDirectory];
    const childEnv = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require=${preload}` };
    const first = spawnSync(process.execPath, args, { cwd: root, env: childEnv, encoding: "utf8" });
    assert.equal(first.status, 1);
    const recordPath = path.join(failedDirectory, fs.readdirSync(failedDirectory).find(p => p.endsWith(`.quick-${scenarioIdentity.scenario.openingInputs + 1}.json`)));
    const bytes = fs.readFileSync(recordPath), record = JSON.parse(bytes);
    assert.equal(record.status, "failed");
    assert.equal(record.steps, scenarioIdentity.scenario.openingInputs);
    assert.equal(record.scenarioResult.openingInputs, scenarioIdentity.scenario.openingInputs);
    assert.equal(record.failure.code, "UNIT_SCENARIO_FAULT");
    assert.equal(record.failure.failedDecisionCommitted, false);
    assert.deepEqual(record.summary.scores, {});
    const checkpoint = JSON.parse(fs.readFileSync(path.join(root, record.failure.checkpointPath), "utf8"));
    const expected = scenario.createEnvironment();
    try {
      scenario.initialize(expected, { seed: identity.seed, activePlayerCount: 4 }, scenarioIdentity.scenario);
      assert.equal(checkpoint.coreState.committedState, expected.createCheckpoint().coreState.committedState);
    } finally { expected.dispose(); }
    const duplicate = spawnSync(process.execPath, args, { cwd: root, env: childEnv, encoding: "utf8" });
    assert.equal(duplicate.status, 2, duplicate.stderr);
    assert.deepEqual(fs.readFileSync(recordPath), bytes);
  } finally { fs.rmSync(failedDirectory, { recursive: true, force: true }); }

}

console.log(JSON.stringify({ whiteOnlyScenario: "passed", controlledOpening: true, passiveNativeDecisions: 3, scenarioIdentitySeparated: true }));
