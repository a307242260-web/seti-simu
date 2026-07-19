"use strict";

const assert = require("node:assert/strict");
const standardAction = require("../actions/standard-action");
const domainSession = require("./industry-alien-session");

const MATRIX = Object.freeze([
  { domain: "company", speciesId: null, kind: "industry_picker", choices: ["turing-orange", "turing-purple"] },
  { domain: "trace", speciesId: "yichangdian", kind: "alien_trace_placement", choices: ["pink-1", "pink-2"] },
  { domain: "jiuzhe", speciesId: "jiuzhe", kind: "alien_card_gain", choices: ["card-1", "card-7"] },
  { domain: "yichangdian", speciesId: "yichangdian", kind: "alien_card_gain", choices: ["displayed", "blind"] },
  { domain: "banrenma", speciesId: "banrenma", kind: "alien_opportunity", choices: ["reward-trace", "reward-energy"] },
  { domain: "fangzhou", speciesId: "fangzhou", kind: "alien_species_branch", choices: ["place-panel", "unlock-card2"] },
  { domain: "chong", speciesId: "chong", kind: "alien_task", choices: ["fossil-01", "fossil-02"] },
  { domain: "amiba", speciesId: "amiba", kind: "alien_species_branch", choices: ["symbol-1", "symbol-2"] },
  { domain: "aomomo", speciesId: "aomomo", kind: "alien_card_gain", choices: ["displayed", "blind"] },
  { domain: "runezu", speciesId: "runezu", kind: "alien_species_branch", choices: ["symbol-sun", "symbol-moon"] },
]);

function createState() {
  return { version: 12, stateVersion: 12, decisionVersion: 0, trace: [], choices: {} };
}

function createRegistry() {
  const registry = standardAction.createRegistry({
    getAuthority(context) {
      const state = context.state || context;
      return {
        actorId: context.pending?.ownerId || state.actorId,
        stateVersion: state.stateVersion,
        decisionVersion: state.decisionVersion,
      };
    },
  });
  for (const family of new Set(Object.values(domainSession.FAMILY_BY_KIND))) {
    registry.register(standardAction.createConditionalDefinition(family, {
      getOptions(context) {
        const pending = context.pending;
        return {
          ok: true,
          choices: pending.choiceIds.map((choiceId) => ({
            target: { choiceId, entityRef: { kind: pending.decisionKind, id: choiceId } },
            payload: {
              domainDecisionKind: pending.decisionKind,
              speciesId: pending.speciesId,
              companyId: pending.companyId || null,
              label: `${pending.decisionKind}:${choiceId}`,
              role: choiceId === "skip" ? "skip" : null,
            },
            label: `${pending.decisionKind}:${choiceId}`,
          })),
        };
      },
      canExecute(context, action) {
        return context.pending.choiceIds.includes(action.target.choiceId)
          ? { ok: true }
          : { ok: false, message: "choice 已失效" };
      },
      execute(context, action) {
        const state = context.state || context;
        state.decisionVersion += 1;
        state.trace.push(`decision:${context.pending.decisionKind}:${action.target.choiceId}`);
        return {
          ok: true,
          nextState: state,
          followups: context.pending.followupsByChoice?.[action.target.choiceId] || [],
        };
      },
    }));
  }
  return registry;
}

function createHarness(initialState = createState(), options = {}) {
  const authority = { current: structuredClone(initialState) };
  const registry = createRegistry();
  const forbiddenCalls = options.forbiddenCalls || { industry: 0, alien: 0, species: 0, continuation: 0 };
  const flow = domainSession.createIndustryAlienRuntime({
    readCommittedState: () => structuredClone(authority.current),
    enumerateDecision(state, pending) {
      return registry.enumerate({ state, pending }, { family: pending.family, actorId: pending.ownerId });
    },
    executeDecision(state, action, pending) {
      return registry.execute({ state, pending }, action);
    },
    executeEffect(state, payload) {
      if (payload.data.fail) return { ok: false, code: "DOMAIN_EFFECT_REJECTED", message: "反例 effect 拒绝" };
      state.trace.push(`effect:${payload.effectType}`);
      return {
        ok: true,
        nextState: state,
        followups: payload.data.followups || [],
        events: [{ type: payload.effectType }],
        rng: payload.data.rng || [],
        irreversible: payload.data.irreversible || null,
      };
    },
    buildActionFlow(_state, action) {
      return { ok: true, followups: action.payload.followups };
    },
  });
  return { authority, registry, forbiddenCalls, flow };
}

function actionFor(followups, actorId = "p1") {
  return {
    schemaVersion: standardAction.SCHEMA_VERSION,
    actionId: `industry:${actorId}:${followups.length}`,
    family: "industry",
    phase: "quick",
    actorId,
    stateVersion: 12,
    decisionVersion: 0,
    target: null,
    payload: { followups },
    summary: "公司/外星人领域流程",
  };
}

function pendingFor(row, extra = {}) {
  return {
    decisionKind: row.kind,
    ownerId: extra.ownerId || "p1",
    speciesId: row.speciesId,
    companyId: row.domain === "company" ? "turing" : null,
    choiceIds: [...row.choices],
    ...extra,
  };
}

function dispatchToDecision(harness, pending, extraFollowups = []) {
  const dispatched = harness.flow.dispatch(harness.authority.current, actionFor([
    { kind: "decision", pending },
    ...extraFollowups,
  ]));
  assert.equal(dispatched.ok, true);
  const drained = harness.flow.drain(dispatched.session);
  assert.equal(drained.ok, true);
  assert.equal(dispatched.session.phase, "awaiting_input");
  return dispatched.session;
}

function resolveCurrent(harness, session, choiceIndex = 0) {
  const decision = harness.flow.inspect(session).decision;
  return harness.flow.resolveDecision(session, {
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: decision.choices[choiceIndex],
  });
}

(function testCompanyAndEightSpeciesHaveRealMultiChoiceProof() {
  for (const row of MATRIX) {
    const harness = createHarness();
    const session = dispatchToDecision(harness, pendingFor(row));
    const inspected = harness.flow.inspect(session);
    assert.equal(inspected.decision.decisionKind, row.kind, `${row.domain} Decision kind`);
    assert.equal(inspected.decision.ownerId, "p1", `${row.domain} owner`);
    assert.equal(inspected.decision.choices.length, 2, `${row.domain} 必须是真实多选`);
    assert.ok(inspected.decision.choices.every((choice) => (
      choice.schemaVersion === standardAction.SCHEMA_VERSION
      && choice.family === domainSession.FAMILY_BY_KIND[row.kind]
      && choice.actorId === "p1"
      && choice.payload.domainDecisionKind === row.kind
    )), `${row.domain} choices 必须是标准 Action identity`);
    assert.equal(resolveCurrent(harness, session, 1).ok, true, `${row.domain} choice 必须可执行`);
    assert.equal(harness.flow.drain(session).ok, true);
    assert.equal(session.phase, "completed");
    assert.equal(session.journal.decisions.length, 1);
    assert.deepEqual(session.journal.replay.map((step) => step.kind), ["action", "decision"]);
    assert.match(session.workingState.trace[0], new RegExp(row.kind));
    assert.deepEqual(harness.forbiddenCalls, { industry: 0, alien: 0, species: 0, continuation: 0 });
  }
})();

(function testOpportunityQueueTraceRewardsAndFollowupsUseSessionOrder() {
  const harness = createHarness();
  const first = MATRIX.find((row) => row.domain === "banrenma");
  const session = dispatchToDecision(harness, pendingFor(first, {
    followupsByChoice: {
      "reward-trace": [
        { priority: "deferred", kind: "effect", effectType: "opportunity-finished", payload: {} },
        { priority: "trigger", kind: "effect", effectType: "species-followup", payload: {} },
        { priority: "direct", kind: "effect", effectType: "trace-reward", payload: {} },
        { priority: "direct", kind: "decision", pending: pendingFor({
          domain: "jiuzhe", speciesId: "jiuzhe", kind: "alien_opportunity", choices: ["play-card", "skip"],
        }) },
      ],
    },
  }));
  assert.equal(resolveCurrent(harness, session, 0).ok, true);
  assert.equal(harness.flow.drain(session).ok, true);
  assert.equal(session.phase, "awaiting_input", "第二个机会必须保持独立 Decision");
  assert.deepEqual(session.workingState.trace, [
    "decision:alien_opportunity:reward-trace",
    "effect:trace-reward",
  ]);
  assert.equal(resolveCurrent(harness, session, 1).ok, true);
  assert.equal(harness.flow.drain(session).ok, true);
  assert.equal(session.phase, "completed");
  assert.deepEqual(session.workingState.trace, [
    "decision:alien_opportunity:reward-trace",
    "effect:trace-reward",
    "decision:alien_opportunity:skip",
    "effect:species-followup",
    "effect:opportunity-finished",
  ]);
})();

(function testStaleChoiceFailsWithoutDomainMutation() {
  const harness = createHarness();
  const session = dispatchToDecision(harness, pendingFor(MATRIX[0]));
  const decision = harness.flow.inspect(session).decision;
  const before = structuredClone(session.workingState);
  const result = harness.flow.resolveDecision(session, {
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion + 1,
    choice: decision.choices[0],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "EFFECT_DECISION_STALE");
  assert.deepEqual(session.workingState, before);
  assert.equal(session.journal.decisions.length, 0);
})();

(function testUnknownDecisionAndMalformedChoiceFailClosed() {
  const harness = createHarness();
  const unknown = harness.flow.dispatch(harness.authority.current, actionFor([{
    kind: "decision",
    pending: { decisionKind: "legacy_species_pending", ownerId: "p1", choiceIds: ["a", "b"] },
  }]));
  assert.equal(unknown.ok, false);
  assert.equal(unknown.session.phase, "aborted");
  assert.equal(unknown.code, "INDUSTRY_ALIEN_DECISION_KIND_UNKNOWN");

  assert.deepEqual(domainSession.normalizePending({
    decisionKind: "alien_card_gain", ownerId: "p1", speciesId: "unlisted-species",
  }), {
    ok: false,
    code: "INDUSTRY_ALIEN_SPECIES_UNKNOWN",
    message: "未知外星人物种: unlisted-species",
    speciesId: "unlisted-species",
    ownerId: "p1",
  });
})();

(function testFailureRollsBackAndHiddenInformationLocksAbort() {
  const failingHarness = createHarness();
  const failed = failingHarness.flow.dispatch(failingHarness.authority.current, actionFor([
    { kind: "effect", effectType: "gain-before-failure", payload: {} },
    { kind: "effect", effectType: "reject", payload: { fail: true } },
  ]));
  assert.equal(failed.ok, true);
  const drained = failingHarness.flow.drain(failed.session);
  assert.equal(drained.ok, false);
  assert.equal(failed.session.phase, "aborted");
  assert.deepEqual(failed.session.workingState, failingHarness.authority.current);

  const barrierHarness = createHarness();
  const barrier = barrierHarness.flow.dispatch(barrierHarness.authority.current, actionFor([
    {
      kind: "effect",
      effectType: "blind-alien-card",
      payload: {
        rng: [{ kind: "alien-card-draw", cardId: "hidden-7" }],
        irreversible: { kind: "hidden-information", reason: "外星人盲抽已揭示" },
      },
    },
    { kind: "decision", pending: pendingFor(MATRIX[2]) },
  ]));
  assert.equal(barrierHarness.flow.drain(barrier.session).ok, true);
  assert.equal(barrier.session.phase, "awaiting_input");
  assert.equal(barrierHarness.flow.inspect(barrier.session).controls.canUndo, false);
  const abort = barrierHarness.flow.abort(barrier.session, { code: "LATE_ABORT", message: "过晚取消" });
  assert.equal(abort.ok, false);
  assert.equal(abort.code, "EFFECT_SESSION_IRREVERSIBLE_LOCKED");
  assert.equal(barrier.session.phase, "irreversible_locked");
})();

console.log("industry/alien Effect Session tests passed");
