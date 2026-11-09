"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const scenario = require("./research-human405-full");
const runner = require("./run_research_validation");

const options = { full: true, config: { agentType: "search", scenario: scenario.R4_ID, compactReplay: true } };
const identity = runner.buildIdentity(options);
assert.equal(identity.scenario.openingInputs, 259);
assert.equal(identity.scenario.originalOpeningInputs, 23);
assert.equal(identity.scenario.decisionGate.enforcement, "reject-before-input");
assert.throws(() => runner.buildIdentity({ ...options, full: false }), /REQUIRES_FULL/);
assert.throws(() => scenario.continuation(scenario.V661_ID), /V661_CONTINUATION_SOURCE_DRIFT/);
const source = scenario.continuation(scenario.R4_ID);
assert(source.save.machineAI["player-white"], "fixture must contain an old plan to invalidate");
const env = scenario.createEnvironment({}, identity.scenario);
let beforeWhite;
try {
  const steps = scenario.initialize(env, { seed: identity.seed, activePlayerCount: 4, compactReplay: true },
    identity.scenario, { checkpointFromSave: runner.checkpointFromSave });
  assert.deepEqual(steps, source.save.replaySteps);
  const restored = env.saveBrowserSave();
  assert.equal(restored.committedState, source.save.committedState);
  assert.deepEqual(restored.session, source.save.session);
  assert.equal(restored.machineAI["player-white"], undefined);
  assert.equal(env.observe().publicState.roundNumber, 4);
  for (let i = 0; i < 2; i++) {
    assert.notEqual(env.observe().decision.actorPlayerId, "player-white");
    assert(env.runAgentDecision().ok);
  }
  assert.equal(env.observe().decision.actorPlayerId, "player-white");
  beforeWhite = env.createCheckpoint();
} finally { env.dispose(); }

// Drive the actual production agent boundary with a closed, over-limit
// result. Preserve the unchanged root and reject a duplicate by fingerprint.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seti-r4-admission-fault-"));
const root = path.resolve(__dirname, "..");
try {
  const preload = path.join(dir, "fault.cjs");
  const agentPath = path.join(root, "randomizer/game/ai/search-agent.js");
  fs.writeFileSync(preload, `
    const file=${JSON.stringify(agentPath)}, api=require(file);
    require.cache[require.resolve(file)].exports={...api,createSearchAgent(context){
      const original=api.createSearchAgent(context);
      return {...original,decide(){ return {search:{complete:true,rootAndSearchMilliseconds:10,
        diagnostics:{nativeExecutions:257}}}; }};
    }};
  `);
  const args = ["tools/run_research_validation.js", "--name", "r4-admission-gate-unit", "--config",
    `agentType=search,scenario=${scenario.R4_ID},compactReplay=true`, "--full", "--no-save", "--records-dir", dir];
  const run = () => spawnSync(process.execPath, args, { cwd: root, encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require=${preload}` } });
  const attempt = run();
  assert.equal(attempt.status, 1, attempt.stderr);
  const file = path.join(dir, fs.readdirSync(dir).find(n => n.endsWith(".full.json")));
  const bytes = fs.readFileSync(file), record = JSON.parse(bytes);
  assert.equal(record.failure.code, "WHITE_ONLY_DECISION_GATE_EXCEEDED", JSON.stringify(record.failure));
  assert.equal(record.failure.decisionAdmitted, false);
  assert.equal(record.failure.searchGraphClosed, true);
  assert.equal(record.metrics.searches.at(-1).committed, false);
  assert.equal(record.metrics.searches.at(-1).diagnostics.nativeExecutions, 257);
  assert.equal(record.steps, 261);
  assert.equal(record.resumeStep, 259);
  assert.deepEqual(record.roundEnds.map(r => [r.round, r.score]), [[1, 15], [2, 48], [3, 118]]);
  const cp = JSON.parse(fs.readFileSync(path.resolve(root, record.failure.checkpointPath)));
  assert.deepEqual(cp.coreState.compositionEnvelope, beforeWhite.coreState.compositionEnvelope);
  assert.deepEqual(cp.browserReplaySteps, source.save.replaySteps);
  assert.equal(run().status, 2);
  assert.deepEqual(fs.readFileSync(file), bytes);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log("R4 resumed prefix and RNG exact, old plan invalidated, 257-input attempt uncommitted and duplicate rejected");
