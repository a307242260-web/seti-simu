"use strict";

const assert = require("node:assert/strict");
const { createCommittedGameState, createStateStore } = require("../game/state/state-store");
const fs = require("node:fs");
const path = require("node:path");
const effectSession = require("../game/effects/session-runtime");
const researchTechSession = require("../game/effects/research-tech-session");
const scanCardSession = require("../game/effects/scan-card-session");
const standardAction = require("../game/actions/standard-action");
const { createQuickActionCoordinator } = require("../game/effects/quick-action-session");
const {
  createBrowserEffectSessionHost,
  createBrowserEffectInputAdapter,
} = require("./effect-session-host");

function createState() {
  return {
    version: 4,
    stateVersion: 4,
    decisionVersion: 0,
    actorId: "p1",
    rotation: 0,
    legalTechs: ["orange1"],
    placedTechs: [],
    targets: ["nebula-a", "nebula-b"],
    sectors: ["yellow", "blue"],
    payments: ["energy", "data"],
    triggerRewards: ["data", "score"],
    hand: ["card-7"],
    played: [],
    rewards: 0,
    value: 0,
    quickKinds: ["boost"],
    trace: [],
  };
}

function createStore(initialState = createState()) {
  let state = structuredClone(initialState);
  const commits = [];
  return {
    getSnapshot: () => ({ version: state.version, state: structuredClone(state) }),
    compareAndCommit(baseVersion, nextState, meta) {
      if (state.version !== baseVersion) {
        return { ok: false, code: "STATE_VERSION_CONFLICT", message: "version changed" };
      }
      state = structuredClone(nextState);
      commits.push({ baseVersion, meta: structuredClone(meta) });
      return { ok: true };
    },
    state: () => structuredClone(state),
    commits,
  };
}

function createRegistry() {
  const registry = standardAction.createRegistry({
    getAuthority: (context) => ({
      actorId: (context.state || context).actorId,
      stateVersion: (context.state || context).stateVersion,
      decisionVersion: (context.state || context).decisionVersion,
    }),
  });
  function values(state, family) {
    if (family === "research_tech") return ["research"];
    if (family === "scan") return ["scan"];
    if (family === "play_card") return state.hand;
    if (family === "quick_trade") return state.quickKinds;
    return [];
  }
  for (const family of ["research_tech", "scan", "play_card", "quick_trade"]) {
    registry.register(standardAction.createOptionDefinition(family, {
      getOptions(state) {
        return {
          ok: true,
          choices: values(state, family).map((id) => ({
            target: family === "play_card" ? { cardId: id } : { id, kind: id },
          })),
        };
      },
      canExecute: () => ({ ok: true }),
      execute: () => {
        throw new Error("Browser host 不得调用 legacy Standard Action execute");
      },
    }));
  }
  for (const family of ["choose_target", "choose_payment", "choose_reward"]) {
    registry.register(standardAction.createConditionalDefinition(family, {
      getOptions(context) {
        const { state, pending } = context;
        const valuesByType = {
          scan_target: state.targets,
          scan_sector: state.sectors,
          play_card_payment: state.payments,
          card_trigger_choice: state.triggerRewards,
        };
        return {
          ok: true,
          choices: (valuesByType[pending.type] || []).map((id) => ({
            target: { choiceId: id },
          })),
        };
      },
      canExecute: () => ({ ok: true }),
      execute(context, option) {
        context.state.decisionVersion += 1;
        context.state.trace.push(`decision:${context.pending.type}:${option.target.choiceId}`);
        return { ok: true, nextState: context.state };
      },
    }));
  }
  return registry;
}

function createResearchFlow(store, registry, options = {}) {
  const facade = researchTechSession.createResearchTechRuntime({
    readCommittedState: () => store.state(),
    rotate(state) {
      state.rotation += 1;
      state.legalTechs = ["purple1", "blue2"];
      state.trace.push("rotate");
      return { ok: true, nextState: state };
    },
    listChoices: (state) => state.legalTechs.map((tileId) => ({ tileId })),
    place(state, choice) {
      state.placedTechs.push(choice.tileId);
      state.trace.push(`place:${choice.tileId}`);
      return { ok: true, nextState: state, placement: choice };
    },
    buildImmediateRewards: () => [{ kind: "score", amount: 3 }],
    applyImmediateReward(state, reward) {
      if (options.failReward) throw new Error("reward poison");
      state.value += reward.amount;
      state.trace.push(`reward:${reward.kind}`);
      return { ok: true, nextState: state };
    },
  });
  facade.runtime.registerExecutor("browser_quick_boost", (state) => ({
    ok: true,
    nextState: { ...state, value: state.value + 2, trace: [...state.trace, "quick:boost"] },
  }));
  const coordinator = createQuickActionCoordinator({
    runtime: facade.runtime,
    registry,
    buildEffectGroup: () => ({ effects: [{ type: "browser_quick_boost" }] }),
  });
  return { ...facade, interrupt: coordinator.interrupt };
}

function createScanCardFlow(store, registry) {
  return scanCardSession.createScanCardRuntime({
    readCommittedState: () => store.state(),
    enumerateConditional(state, pending) {
      return registry.enumerate({ state, pending }, { family: pending.family });
    },
    executeConditional(state, action, pending) {
      return registry.execute({ state, pending }, action);
    },
    runScan(state, payload) {
      state.trace.push(`scan:${payload.targetAction.target.choiceId}`);
      return { ok: true, nextState: state, scan: { targetId: payload.targetAction.target.choiceId } };
    },
    buildScanSectorPending: (_state, result) => ({
      type: "scan_sector",
      family: "choose_target",
      scan: result.scan,
    }),
    settleScan(state, payload) {
      state.trace.push(`sector:${payload.sectorAction.target.choiceId}`);
      return { ok: true, nextState: state };
    },
    buildScanFollowups: () => [
      { priority: "direct", kind: "participant_reward", payload: { playerId: "p1" } },
      { priority: "trigger", kind: "trigger", payload: { id: "scan-passive" } },
      { priority: "deferred", kind: "deferred_draw", payload: { cardId: "draw-a" } },
    ],
    applyParticipantReward(state) {
      state.rewards += 1;
      state.trace.push("reward:p1");
      return { ok: true, nextState: state };
    },
    drawDeferredCard(state, draw) {
      state.hand.push(draw.cardId);
      state.trace.push(`draw:${draw.cardId}`);
      return { ok: true, nextState: state };
    },
    playCard(state, payload) {
      state.played.push(payload.action.target.cardId);
      state.trace.push(`play:${payload.action.target.cardId}`);
      return { ok: true, nextState: state, card: { cardId: payload.action.target.cardId } };
    },
    buildCardEffects: (_state, result) => [{ id: `${result.card.cardId}:effect` }],
    applyCardEffect(state, effect) {
      state.trace.push(`card-effect:${effect.id}`);
      return { ok: true, nextState: state };
    },
    buildCardTriggers: () => [{ id: "task" }, { id: "passive", needsChoice: true }],
    applyTrigger(state, trigger) {
      state.trace.push(`trigger:${trigger.id}`);
      return { ok: true, nextState: state, trigger };
    },
    buildTriggerDecision: (_state, result) => (result.trigger.needsChoice
      ? { type: "card_trigger_choice", family: "choose_reward" }
      : null),
  });
}

function createHost(options = {}) {
  const store = createStore(options.state);
  const registry = createRegistry();
  const renderTrace = [];
  const research = createResearchFlow(store, registry, options);
  const scanCard = createScanCardFlow(store, registry);
  const host = createBrowserEffectSessionHost({
    stateStore: store,
    actionRegistry: registry,
    flows: {
      research_tech: research,
      scan: scanCard,
      play_card: scanCard,
    },
    autoDrain: options.autoDrain,
    renderProjection(projection) {
      renderTrace.push({ phase: projection.phase, trace: projection.state.trace });
      if (options.renderPoison) throw new Error("render poison");
    },
  });
  return { host, store, registry, renderTrace };
}

function action(host, family) {
  return host.enumerateActions({ family })[0];
}

function choose(host, id) {
  const decision = host.inspect().session.decision;
  const choice = decision.choices.find((candidate) => (
    candidate.tileId === id || candidate.target?.choiceId === id
  ));
  assert.ok(choice, `缺少 decision choice: ${id}; 当前 choices=${JSON.stringify(decision.choices)}`);
  return host.submitDecisionChoice(
    decision.decisionId,
    decision.decisionVersion,
    choice.actionId || choice.tileId,
  );
}

(function testResearchClickDecisionQuickAndStableCommit() {
  const { host, store } = createHost();
  const input = createBrowserEffectInputAdapter(host);
  const research = action(host, "research_tech");
  assert.equal(input.handleIntent({ kind: "standard_action", actionId: research.actionId }).ok, true);
  const beforeQuick = host.inspect().session.decision;
  const quick = host.enumerateActions({ family: "quick_trade" })[0];
  assert.equal(input.handleIntent({ kind: "quick_action", action: quick }).ok, false,
    "研究 DecisionEffect 不允许 quick 时 browser host 必须 fail-closed");
  assert.deepEqual(host.inspect().session.decision, beforeQuick);
  assert.equal(choose(host, "purple1").ok, true);
  assert.deepEqual(store.state().trace, ["rotate", "place:purple1", "reward:score"]);
  assert.equal(store.commits.length, 1);
  assert.equal(host.inspect().phase, "idle");
})();

(function testScanAndCardMultiDecisionPathsUseWorkingProjection() {
  const scanHarness = createHost();
  assert.equal(scanHarness.host.dispatchAction(action(scanHarness.host, "scan")).ok, true);
  choose(scanHarness.host, "nebula-b");
  choose(scanHarness.host, "blue");
  assert.deepEqual(scanHarness.store.state().trace, [
    "decision:scan_target:nebula-b",
    "scan:nebula-b",
    "decision:scan_sector:blue",
    "sector:blue",
    "reward:p1",
    "trigger:scan-passive",
    "draw:draw-a",
  ]);

  const cardHarness = createHost();
  assert.equal(cardHarness.host.dispatchAction(action(cardHarness.host, "play_card")).ok, true);
  choose(cardHarness.host, "energy");
  choose(cardHarness.host, "score");
  assert.deepEqual(cardHarness.store.state().trace, [
    "decision:play_card_payment:energy",
    "play:card-7",
    "card-effect:card-7:effect",
    "trigger:task",
    "trigger:passive",
    "decision:card_trigger_choice:score",
  ]);
})();

(function testAnimatedAdvanceAndAutomaticDrainAreEquivalent() {
  const automatic = createHost();
  automatic.host.dispatchAction(action(automatic.host, "research_tech"));
  choose(automatic.host, "blue2");

  const animated = createHost({ autoDrain: false });
  animated.host.dispatchAction(action(animated.host, "research_tech"));
  while (animated.host.inspect().phase !== "awaiting_input") animated.host.advance();
  choose(animated.host, "blue2");
  while (animated.host.inspect().phase !== "idle") animated.host.advance();
  assert.deepEqual(animated.store.state(), automatic.store.state());
})();

(function testFailureRecoveryAndRenderPoisonDoNotPolluteCommittedState() {
  const initial = createState();
  const { host, store } = createHost({ failReward: true, renderPoison: true });
  host.dispatchAction(action(host, "research_tech"));
  const result = choose(host, "purple1");
  assert.equal(result.ok, false);
  assert.equal(result.phase, "aborted");
  assert.deepEqual(store.state(), initial);
  assert.equal(store.commits.length, 0);
  assert.equal(host.inspect().renderFailure.code, "EFFECT_HOST_RENDER_FAILED");
})();

(function testDomAdapterOnlyReadsStableIdentity() {
  const { host } = createHost();
  const descriptor = action(host, "research_tech");
  const input = createBrowserEffectInputAdapter(host);
  const target = {
    dataset: { setiInput: "action", actionId: descriptor.actionId },
    closest: () => target,
  };
  assert.equal(input.handleDomEvent({ target }).ok, true);
  const staleTarget = {
    dataset: { setiInput: "decision", decisionId: "stale", decisionVersion: "0", choiceId: "purple1" },
    closest: () => staleTarget,
  };
  assert.equal(input.handleDomEvent({ target: staleTarget }).code, "EFFECT_HOST_DECISION_STALE");
})();

(function testMigratedBrowserHostCannotCallLegacyContinuations() {
  const source = fs.readFileSync(path.join(__dirname, "effect-session-host.js"), "utf8");
  for (const forbidden of [
    "pendingState",
    "actionEffectFlow",
    "completeCurrentActionEffect",
    "appendResearchTechFollowupEffects",
    "renderAll",
    "localStorage",
    "document.",
  ]) {
    assert.equal(source.includes(forbidden), false, `browser host 不得引用 ${forbidden}`);
  }
  assert.equal(effectSession.SCHEMA_VERSION, "seti-effect-session-v1");
})();

(function testRealStateStoreCommitSubscriptionRefreshesWithoutOwningFacts() {
  const authority = createStateStore(createCommittedGameState({
    gameId: "browser-store-host",
    rulesetVersion: "stage-7-test",
    seed: "browser-store-host",
    turn: { currentPlayerId: "p1" },
  }));
  let renderedActor = null;
  const host = createBrowserEffectSessionHost({
    stateStore: authority,
    actionRegistry: { enumerate: () => [], validate: () => ({ ok: true }) },
    flows: {},
    projectCommittedState: (state) => ({ actor: state.turn.currentPlayerId }),
    renderProjection: (projection) => { renderedActor = projection.state.actor; },
  });
  const working = authority.beginWorkingCopy();
  working.state.turn.currentPlayerId = "p2";
  const committed = authority.compareAndCommit(working.baseVersion, working.state);
  assert.equal(committed.ok, true);
  assert.equal(renderedActor, "p2", "浏览器必须从 commit subscription 的 committed snapshot 刷新");
  assert.equal(authority.getSnapshot().turn.currentPlayerId, "p2");
  host.dispose();
})();

console.log("browser Effect Session host tests passed");
