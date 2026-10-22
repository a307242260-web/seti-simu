"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSearchAgent, VERSION } = require("./search-agent");
const { createAgentDecisionFunction } = require("./agent-runtime");
const { createAnalysisPort } = require("./analysis-port");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSimulationEnv } = require("../../app/simulation-env");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const coordinator = require("./machine-player-coordinator");
const { createBrowserRuleComposition } = require("../../app/browser-rule-composition");
const { defaultVisibilityPolicy } = require("../../app/browser-host/projection-adapter");
const { createBrowserAiBootstrap } = require("../../app/ai/browser-bootstrap");
const { buildIdentity, fingerprintOf } = require("../../../tools/run_research_validation");
const read = p => JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../..", p)));
const fixture = id => read(`adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`);
function simulation(f, options = {}) {
  const env = createSimulationEnv(options);
  env.reset({ seed: f.source.seed, agentType: options.agentFactory ? "custom" : "search", compactReplay: true });
  const checkpoint = env.createCheckpoint();
  checkpoint.coreState.committedState = f.compositionEnvelope.committedState;
  checkpoint.coreState.compositionEnvelope = f.compositionEnvelope;
  env.loadCheckpoint(checkpoint);
  return env;
}
function direct(f, cache = 0) {
  const seed = f.source.seed;
  const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
  kernel.newGame({ seed });
  const comp = kernel.composition; assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
  const port = createAnalysisPort({ composition: comp, seatId: f.seatId, maxCacheEntries: cache });
  let closes = 0;
  const runtime = createAgentDecisionFunction({ seatId: f.seatId, createAgent: createSearchAgent,
    analysisPortFactory: () => ({ ...port, close() { closes += 1; port.close(); } }) });
  const boundary = coordinator.createMachinePlayerCoordinator({ composition: comp, execute: () => assert.fail("纯选择不能提交") }).readBoundary(f.seatId);
  const before = comp.lifecycle.save().envelope;
  const result = runtime.run(boundary);
  assert.equal(closes, 1); assert.deepEqual(comp.lifecycle.save().envelope, before);
  assert.throws(() => runtime.run({ ...boundary, legalActions: boundary.legalActions.slice(1) }), /BOUNDARY_MISMATCH/);
  assert.equal(closes, 2);
  const changed = structuredClone(boundary);
  changed.legalActions[0].payload = { forged: true };
  assert.throws(() => runtime.run(changed), /BOUNDARY_MISMATCH/);
  assert.equal(closes, 3);
  runtime.dispose(); assert.throws(() => runtime.run(boundary), /AGENT_DISPOSED/);
  comp.dispose();
  return result;
}
(async () => {
  const f = fixture("003"), expected = direct(f), cached = direct(f, 256), env = simulation(f);
  assert.equal(expected.actionId, cached.actionId);
  const result = env.runAgentDecision();
  assert.equal(result.actionId, expected.actionId);
  assert.equal(result.policyProvenance.type, "search"); assert.equal(result.policyProvenance.version, VERSION);
  assert.equal(result.agentTrace.coverage, "complete");
  assert.equal(result.searches[0].value, expected.searches[0].value);
  assert.equal(result.searches[0].diagnostics.transitions, expected.searches[0].diagnostics.transitions);
  assert(result.searches[0].rootAndSearchMilliseconds >= result.searches[0].diagnostics.milliseconds);
  assert.equal(Object.isFrozen(result.agentTrace.search), true);
  assert.equal(Object.hasOwn(result.agentTrace.search, "selectionContinuation"), false);
  assert.equal(env.getReplay().steps.length, 1);

  const browser = createBrowserRuleComposition({ seed: f.source.seed, random: createSeededRandom(f.source.seed),
    browserProjection: { visibilityPolicy: defaultVisibilityPolicy,
      getFinalReadModelOwner: () => ({ project: () => ({ players: [], finalBoard: {} }) }),
      getBrowserReadModelOwner: () => ({ project: () => ({ render: {} }) }), createRenderPresentation: () => ({}) } });
  browser.newGame({ seed: f.source.seed, activePlayerCount: 4 });
  assert(browser.lifecycle.restore(f.compositionEnvelope).ok);
  let submissions = 0;
  const port = createBrowserAiBootstrap({ ruleComposition: browser, machinePlayerCoordinatorModule: coordinator,
    heuristicDecisionFunctionModule: { createHeuristicDecisionFunction() { assert.fail("新玩家不得调用旧AI"); } },
    agentRuntimeModule: require("./agent-runtime"), analysisPortModule: require("./analysis-port"),
    agentFactory: createSearchAgent, machineConfig: { agentType: "search" }, isMachineSeat: () => true,
    inputAdapter: { dispatchAction(action) { submissions += 1; return browser.inputPort.submitAction(action); },
      submitDecision(decision) { submissions += 1; return browser.inputPort.submitDecision(decision); } } }).machinePlayerPort;
  const browserResult = await port.runOnce();
  assert(browserResult.ok, browserResult.message); assert.equal(submissions, 1);
  assert.equal(browserResult.actionId, expected.actionId); assert.equal(browserResult.agentTrace.coverage, "complete");
  assert.deepEqual(JSON.parse(browser.lifecycle.save().envelope.committedState), JSON.parse(env.createCheckpoint().coreState.committedState));

  const complex = fixture("008"), failures = [];
  const failed = simulation(complex, { onAgentDecision: event => failures.push(event) });
  const before = failed.createCheckpoint();
  assert.throws(() => failed.runAgentDecision(), error => error.cause?.code === "SEARCH_INCOMPLETE");
  assert.deepEqual(failed.createCheckpoint().coreState, before.coreState);
  assert.equal(failed.getReplay().steps.length, 0); assert.equal(failures.length, 1);
  assert.equal(failures[0].coverage, "incomplete"); assert.equal(failures[0].actionId, null);
  assert.equal(failures[0].search.stopReason, "transition-budget");
  assert(browser.lifecycle.restore(complex.compositionEnvelope).ok);
  const browserBefore = browser.lifecycle.save().envelope;
  const browserFailure = await port.runOnce();
  assert.equal(browserFailure.ok, false); assert.equal(browserFailure.code, "SEARCH_INCOMPLETE");
  assert.equal(browserFailure.search.complete, false); assert.equal(submissions, 1);
  assert.deepEqual(browser.lifecycle.save().envelope, browserBefore);
  env.dispose(); failed.dispose(); browser.dispose();

  const postFixture = fixture("011"), post = simulation(postFixture), postExpected = direct(postFixture);
  const postResult = post.runAgentDecision();
  assert.equal(postResult.actionId, postExpected.actionId); assert.equal(postResult.agentTrace.coverage, "complete");
  assert.equal(postResult.searches[0].value, postExpected.searches[0].value); assert.equal(post.getReplay().steps.length, 1);
  post.dispose();

  const base = read("reports/ai-foundation-20261022/analysis-root-input-v2.json");
  base.config.agentType = "search";
  const reused = createSimulationEnv(); reused.loadCheckpoint(base);
  reused.step(reused.legalActions().find(a => a.target?.tradeId === "cards-for-pick-card"));
  const first = reused.runAgentDecision();
  assert(first.searches[0].selectionPlan); assert(first.searches[0].diagnostics.transitions > 0);
  const restored = createSimulationEnv(); restored.loadCheckpoint(reused.createCheckpoint());
  let reuseHits = 0;
  for (let step = 0; step < 2; step += 1) {
    const a = reused.runAgentDecision(), b = restored.runAgentDecision();
    assert.equal(a.actionId, b.actionId); assert.deepEqual(a.observation, b.observation);
    if (a.searches[0].diagnostics.continuation === "hit") reuseHits += 1;
    if (step === 0) assert(b.searches[0].diagnostics.transitions > 0, "恢复不能携带旧临时token");
  }
  assert.equal(reuseHits, 2);
  assert.deepEqual(reused.createCheckpoint().coreState, restored.createCheckpoint().coreState);
  reused.dispose(); restored.dispose();

  const searchIdentity = buildIdentity({ seed: f.source.seed, config: { agentType: "search" } });
  assert.equal(searchIdentity.policyVersion, VERSION);
  assert.notEqual(fingerprintOf(searchIdentity), fingerprintOf(buildIdentity({ seed: f.source.seed, config: { agentType: "completion" } })));
  let closed = 0;
  const bad = createSearchAgent({ seatId: f.seatId, analysisPort: {
    openRoot() { throw new Error("formal failure"); }, close() { closed += 1; } } });
  assert.throws(() => bad.decide({ seatId: f.seatId }), /formal failure/); assert.equal(closed, 1);
  console.log(JSON.stringify({ sharedSearchAgent: "passed", fixture: "case-003", transitions: result.searches[0].diagnostics.transitions,
    postMainTransitions: postResult.searches[0].diagnostics.transitions,
    incompleteFixture: "case-008", reuseHits, wholeGames: 0 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
