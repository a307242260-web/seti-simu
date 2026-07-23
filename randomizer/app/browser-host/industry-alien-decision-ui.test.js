"use strict";

const assert = require("node:assert/strict");
const standardAction = require("../../game/actions/standard-action");
const domainSession = require("../../game/effects/industry-alien-session");
const projectionApi = require("./projection-adapter");
const viewStateApi = require("./view-state-store");
const inputApi = require("./input-adapter");
const decisionUiApi = require("./decision-ui");
const domainUiApi = require("./industry-alien-decision-ui");

function rawChoice(kind, choiceId, options = {}) {
  return {
    schemaVersion: standardAction.SCHEMA_VERSION,
    actionId: `${domainSession.FAMILY_BY_KIND[kind]}:${choiceId}`,
    family: domainSession.FAMILY_BY_KIND[kind],
    phase: "conditional",
    actorId: options.ownerId || "p1",
    stateVersion: 5,
    decisionVersion: 8,
    target: { choiceId, entityRef: { kind: options.entityKind || "slot", id: choiceId } },
    payload: {
      domainDecisionKind: kind,
      speciesId: options.speciesId || null,
      companyId: options.companyId || null,
      role: options.role || null,
      image: options.image || null,
      reward: options.reward || null,
      card: options.card || null,
      task: options.task || null,
      branch: options.branch || null,
      status: options.status || null,
    },
    summary: options.label || choiceId,
  };
}

function rawDecision(kind, options = {}) {
  return {
    decisionId: options.decisionId || `decision:${kind}`,
    decisionVersion: options.decisionVersion ?? 8,
    ownerId: options.ownerId || "p1",
    decisionKind: kind,
    choices: options.choices || [
      rawChoice(kind, "choice-a", options),
      rawChoice(kind, "choice-b", options),
    ],
    minChoices: 1,
    maxChoices: 1,
    allowQuickActions: false,
  };
}

function projectDecision(decision, viewer = { viewerId: "viewer-p1", playerId: "p1", role: "player" }) {
  const state = {
    meta: { stateVersion: 5 },
    players: { p1: { id: "p1", hand: [] }, p2: { id: "p2", hand: [] } },
    cards: { hands: { p1: [], p2: [] }, deck: ["hidden"] },
  };
  const sessionRuntime = {
    inspect: () => ({
      ok: true,
      sessionId: "domain-session",
      revision: decision.decisionVersion,
      phase: "awaiting_input",
      baseVersion: 5,
      decision,
      controls: { allowQuickActions: false },
    }),
    observe: () => ({
      sessionId: "domain-session",
      revision: decision.decisionVersion,
      phase: "awaiting_input",
      state,
      decision,
    }),
  };
  const presenter = domainUiApi.createDomainDecisionPresenter({
    fallback: projectionApi.defaultDecisionPresenter,
  });
  return projectionApi.createBrowserProjectionAdapter({
    stateStore: { getSnapshot: () => structuredClone(state) },
    sessionRuntime,
    decisionPresenter: presenter,
  }).project({ session: {}, viewer });
}

(function testRendererRegistryIsExhaustiveAndUsesDomainProjectionOnly() {
  const registry = domainUiApi.createIndustryAlienDecisionRegistry(decisionUiApi);
  assert.equal(domainUiApi.assertRendererCoverage(registry), true);
  for (const kind of domainUiApi.DECISION_KINDS) {
    const projection = projectDecision(rawDecision(kind, {
      speciesId: kind === "industry_picker" ? null : "runezu",
      companyId: kind === "industry_picker" ? "turing" : null,
      card: { id: "card-a", public: true },
      task: { id: "task-a", progress: 1 },
      branch: { id: "branch-a" },
      reward: { score: 3 },
    }));
    const store = viewStateApi.createViewStateStore();
    store.reconcileProjection(projection);
    const model = registry.render({ projection, viewState: store.getSnapshot() });
    assert.equal(model.ok, true);
    assert.equal(model.rendererKey, domainUiApi.RENDERER_KEY_BY_KIND[kind]);
    assert.equal(model.content.choices.length, 2);
    assert.deepEqual(
      model.content.choices.map((choice) => choice.choiceId),
      projection.decision.choices.map((choice) => choice.choiceId),
      `${kind} renderer 不得重枚举合法项`,
    );
  }
})();

(function testVisibilityAndProjectionDoNotLeakOwnerChoices() {
  const decision = rawDecision("alien_card_gain", {
    speciesId: "yichangdian",
    choices: [
      rawChoice("alien_card_gain", "displayed", { speciesId: "yichangdian", card: { id: "public-card" } }),
      rawChoice("alien_card_gain", "blind", { speciesId: "yichangdian", card: { hidden: true } }),
    ],
  });
  const ownerProjection = projectDecision(decision);
  const opponentProjection = projectDecision(decision, { viewerId: "viewer-p2", playerId: "p2", role: "player" });
  assert.equal(ownerProjection.decision.choices.length, 2);
  assert.deepEqual(opponentProjection.decision.choices, []);
  assert.equal(JSON.stringify(opponentProjection).includes("public-card"), false);
})();

(function testViewStateRebuildAndStaleSubmission() {
  const projection = projectDecision(rawDecision("alien_species_branch", { speciesId: "fangzhou" }));
  const registry = domainUiApi.createIndustryAlienDecisionRegistry(decisionUiApi);
  const firstStore = viewStateApi.createViewStateStore();
  firstStore.reconcileProjection(projection);
  const first = registry.render({ projection, viewState: firstStore.getSnapshot() });
  firstStore.dispatch({
    type: "draft.set",
    intentKind: "decision",
    selectedChoiceIds: [projection.decision.choices[0].choiceId],
  });
  const rebuiltStore = viewStateApi.createViewStateStore();
  rebuiltStore.reconcileProjection(structuredClone(projection));
  const rebuilt = registry.render({ projection: structuredClone(projection), viewState: rebuiltStore.getSnapshot() });
  assert.deepEqual(rebuilt.content, first.content, "清空 ViewState 后必须由 projection 等价重建领域内容");
  assert.deepEqual(rebuilt.shell, first.shell);

  let domainCalls = 0;
  const input = inputApi.createBrowserInputAdapter({
    dispatchAction: () => ({ ok: true }),
    submitDecision() {
      domainCalls += 1;
      return { ok: false, code: "EFFECT_DECISION_STALE", message: "Decision 已过期" };
    },
    viewStateStore: firstStore,
    refreshProjection: () => ({ projectionId: "fresh-domain-projection" }),
  });
  const controller = domainUiApi.createIndustryAlienDecisionUiController(decisionUiApi, {
    registry,
    dispatchIntent: input.dispatchIntent,
  });
  const result = controller.dispatchUiIntent({ type: "confirm" }, {
    projection,
    viewState: firstStore.getSnapshot(),
  });
  assert.equal(result.code, "EFFECT_DECISION_STALE");
  assert.equal(domainCalls, 1, "UI 只能原样提交一次，不得 rewrite/retry stale identity");
  assert.equal(input.inspectInputState().lastResult.refreshedProjection.projectionId, "fresh-domain-projection");
})();

(function testMalformedIdentityAndUnknownRendererFailClosed() {
  assert.throws(() => projectDecision(rawDecision("alien_task", {
    speciesId: "chong",
    choices: [{
      actionId: "legacy-task", family: "choose_reward", actorId: "p1", summary: "旧任务 resolver",
    }],
  })), /Standard Action identity/);

  const registry = domainUiApi.createIndustryAlienDecisionRegistry(decisionUiApi);
  const result = registry.render({
    projection: {
      projectionId: "unknown",
      decision: { decisionId: "unknown", decisionVersion: 1, ownerId: "p1", kind: "legacy_species_pending", choices: [] },
    },
    viewState: {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DECISION_UI_RENDERER_MISSING");
})();

console.log("browser industry/alien Decision UI tests passed");
