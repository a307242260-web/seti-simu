"use strict";

const assert = require("node:assert/strict");
const stateStore = require("./state/state-store");
const { createCanonicalRoot, createRuleComposition } = require("./rule-composition");

function createRoot(overrides = {}) {
  return createCanonicalRoot({
    gameId: "rule-composition-fixture",
    rulesetVersion: "fixture-v1",
    seed: 119,
    rngState: { algorithm: "fixture", state: 119, cursor: 0 },
    sequences: { effect: 0 },
    match: { status: "playing", playerOrder: ["p1"] },
    turn: { round: 1, currentPlayerId: "p1", decisionVersion: 0 },
    players: { byId: { p1: { credits: 5, score: 0 } } },
    solarSystem: {},
    pieces: {},
    planets: {},
    data: {},
    cards: {},
    tech: { choices: ["blue", "yellow"] },
    aliens: {},
    finalScoring: {},
    ...overrides,
  });
}

function actionDefinition() {
  return {
    family: "research_tech",
    enumerate(root) {
      return root.players.byId.p1.credits >= 2
        ? [{ target: { track: "space" }, summary: "研究科技" }]
        : [];
    },
    validate(root) {
      return root.players.byId.p1.credits >= 2
        ? { ok: true }
        : { ok: false, code: "INSUFFICIENT_CREDITS" };
    },
    execute() {
      return { ok: true, events: [] };
    },
  };
}

function buildEffectGroup(_root, action) {
  return {
    ownerId: action.actorId,
    effects: [
      { type: "pay", payload: { credits: 2 } },
      { type: "choose-tech", kind: "decision", ownerId: action.actorId, decisionKind: "choose_tech" },
      { type: "reward", payload: { score: 5 } },
    ],
  };
}

function effectExecutors(options = {}) {
  return {
    pay(root, effect) {
      if (options.throwOnPay) throw new Error("pay failed");
      const next = structuredClone(root);
      next.players.byId.p1.credits -= effect.payload.credits;
      return {
        ok: true,
        nextState: next,
        events: [{ type: "credits_paid", amount: effect.payload.credits }],
      };
    },
    "choose-tech": {
      getLegalChoices(root) {
        return root.tech.choices.map((id) => ({ id }));
      },
      resolveDecision(root, _effect, choice) {
        const next = structuredClone(root);
        next.tech.chosen = choice.id;
        return { ok: true, nextState: next, events: [{ type: "tech_chosen", id: choice.id }] };
      },
    },
    reward(root, effect) {
      const next = structuredClone(root);
      next.players.byId.p1.score += effect.payload.score;
      return {
        ok: true,
        nextState: next,
        events: [{ type: "score_gained", amount: effect.payload.score }],
      };
    },
  };
}

function createFixture(options = {}) {
  return createRuleComposition({
    initialRoot: createRoot(),
    actionDefinitions: [actionDefinition()],
    buildEffectGroup,
    effectExecutors: effectExecutors(options),
    projectState(root) {
      return {
        version: root.meta.stateVersion,
        credits: root.players.byId.p1.credits,
        score: root.players.byId.p1.score,
        chosenTech: root.tech.chosen || null,
      };
    },
  });
}

(function testCanonicalSchemaIsUnchanged() {
  const root = createRoot();
  assert.equal(root.meta.schemaVersion, stateStore.SCHEMA_VERSION);
  assert.deepEqual(Object.keys(root), stateStore.REQUIRED_ROOT_SLICES);
})();

(function testFixedActionEffectDecisionTraceCommitsExactlyOnce() {
  const composition = createFixture();
  let commits = 0;
  composition.subscribeCommits((event) => {
    if (event.type === "committed") commits += 1;
  });
  const before = composition.serializeCommittedState().serialized;
  const action = composition.enumerateActions({ family: "research_tech" })[0];
  assert.equal(action.actorId, "p1");

  const submitted = composition.submitAction(action);
  assert.equal(submitted.ok, true);
  assert.equal(submitted.phase, "awaiting_input");
  assert.equal(composition.serializeCommittedState().serialized, before, "Decision 等待期间 committed bytes 不得变化");
  assert.deepEqual(composition.observe("browser").state, {
    version: 0,
    credits: 3,
    score: 0,
    chosenTech: null,
  });

  const decision = composition.inspect().decision;
  const stale = composition.resolveDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion + 1,
    choice: { id: "blue" },
  });
  assert.equal(stale.code, "EFFECT_DECISION_STALE");
  assert.equal(composition.serializeCommittedState().serialized, before, "stale Decision 不得污染 committed bytes");

  const completed = composition.resolveDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: { id: "blue" },
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.phase, "completed");
  assert.equal(commits, 1);
  assert.equal(composition.getCommittedSnapshot().meta.stateVersion, 1);
  assert.deepEqual(completed.journal.actions.map((entry) => entry.action.family), ["research_tech"]);
  assert.deepEqual(completed.journal.decisions.map((entry) => entry.choice), [{ id: "blue" }]);
  assert.deepEqual(completed.journal.effects.map((entry) => entry.type), ["pay", "choose-tech", "reward"]);
  assert.deepEqual(completed.journal.events, [
    { type: "credits_paid", amount: 2 },
    { type: "tech_chosen", id: "blue" },
    { type: "score_gained", amount: 5 },
  ]);
  assert.deepEqual(composition.observe("headless").state, {
    version: 1,
    credits: 3,
    score: 5,
    chosenTech: "blue",
  });

  const staleAction = composition.submitAction(action);
  assert.equal(staleAction.code, "STANDARD_ACTION_STALE");
  assert.equal(commits, 1);
})();

(function testExecutorFailureLeavesCommittedBytesUntouched() {
  const composition = createFixture({ throwOnPay: true });
  let commits = 0;
  composition.subscribeCommits(() => { commits += 1; });
  const before = composition.serializeCommittedState().serialized;
  const action = composition.enumerateActions({ family: "research_tech" })[0];
  const failed = composition.submitAction(action);
  assert.equal(failed.ok, false);
  assert.equal(failed.code, "EFFECT_EXECUTOR_THROWN");
  assert.equal(composition.serializeCommittedState().serialized, before);
  assert.equal(commits, 0);
})();

(function testSessionCheckpointRestoresOnlyAgainstItsCommittedBase() {
  const source = createFixture();
  const action = source.enumerateActions({ family: "research_tech" })[0];
  assert.equal(source.submitAction(action).phase, "awaiting_input");
  const checkpoint = source.createCheckpoint().checkpoint;

  const restored = createFixture();
  assert.equal(restored.restoreCheckpoint(checkpoint).ok, true);
  const decision = restored.inspect().decision;
  assert.equal(restored.resolveDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: { id: "yellow" },
  }).ok, true);
  assert.equal(restored.getCommittedSnapshot().tech.chosen, "yellow");

  const stale = restored.restoreCheckpoint(checkpoint);
  assert.equal(stale.code, "RULE_CHECKPOINT_STALE");
  assert.equal(restored.getCommittedSnapshot().tech.chosen, "yellow");
})();

(function testCompositionDoesNotExposeMutationCapabilitiesOrWorkingRoot() {
  const composition = createFixture();
  for (const forbidden of ["compareAndCommit", "beginWorkingCopy", "runTransaction", "settle", "workingState", "runtime", "store"]) {
    assert.equal(Object.hasOwn(composition, forbidden), false, `composition 不得暴露 ${forbidden}`);
  }
})();

console.log("canonical rule composition tests passed");
