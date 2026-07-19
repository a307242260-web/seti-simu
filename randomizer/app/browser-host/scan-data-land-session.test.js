"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const standardAction = require("../../game/actions/standard-action");
const scanCardSession = require("../../game/effects/scan-card-session");
const effectHost = require("../effect-session-host");
const projectionAdapterApi = require("./projection-adapter");
const viewStateApi = require("./view-state-store");
const inputAdapterApi = require("./input-adapter");
const decisionUiApi = require("./decision-ui");

function createState() {
  return {
    version: 40,
    stateVersion: 40,
    decisionVersion: 0,
    actorId: "p1",
    players: {
      p1: { id: "p1", name: "一号" },
      p2: { id: "p2", name: "二号" },
    },
    cards: {
      hands: { p1: [], p2: [] },
      deck: ["hidden-alpha", "hidden-beta"],
    },
    choices: {
      scan_target: ["nebula-a", "nebula-b"],
      scan_sector: ["yellow", "blue"],
      scan_participant_reward: {
        p1: ["score", "data"],
        p2: ["energy", "card"],
      },
      data_placement: ["computer-a", "computer-b"],
      land_target: ["mars", "europa"],
      land_payment: ["energy", "card"],
    },
    trace: [],
  };
}

function choiceIds(state, pending) {
  const source = state.choices[pending.type];
  return Array.isArray(source) ? source : (source?.[pending.ownerId] || []);
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
  for (const family of ["scan", "place_data", "land"]) {
    registry.register(standardAction.createOptionDefinition(family, {
      getOptions: () => ({ ok: true, choices: [{ target: { intent: family }, label: family }] }),
      canExecute: () => ({ ok: true }),
      execute: () => { throw new Error("Browser Host 不得调用旧 action executor"); },
    }));
  }
  for (const family of ["choose_target", "choose_payment", "choose_reward"]) {
    registry.register(standardAction.createConditionalDefinition(family, {
      getOptions(context) {
        const state = context.state || context;
        return {
          ok: true,
          choices: choiceIds(state, context.pending).map((choiceId) => ({
            target: {
              kind: context.pending.type,
              choiceId,
              ...(context.pending.type === "choose_payment" ? { cost: choiceId } : {}),
            },
            payload: context.pending.type === "land_payment" ? { cost: { resource: choiceId, amount: 1 } } : {},
            label: `${context.pending.type}:${choiceId}`,
          })),
        };
      },
      canExecute(context, option) {
        return choiceIds(context.state || context, context.pending).includes(option.target?.choiceId)
          ? { ok: true }
          : { ok: false, message: "choice 已失效" };
      },
      execute(context, option) {
        const state = context.state || context;
        state.decisionVersion += 1;
        state.trace.push(`decision:${context.pending.type}:${context.pending.ownerId}:${option.target.choiceId}`);
        return { ok: true, nextState: state };
      },
    }));
  }
  return registry;
}

function createFlow(authority, registry, forbiddenCalls) {
  return scanCardSession.createScanCardRuntime({
    readCommittedState: () => structuredClone(authority.current),
    enumerateConditional(state, pending) {
      return registry.enumerate({ state, pending }, { family: pending.family, actorId: pending.ownerId });
    },
    executeConditional(state, action, pending) {
      return registry.execute({ state, pending }, action);
    },
    runScan(state, payload) {
      state.trace.push(`scan:${payload.targetAction.target.choiceId}`);
      return { ok: true, nextState: state, scan: { targetId: payload.targetAction.target.choiceId } };
    },
    buildScanSectorPending(_state, result) {
      return { type: "scan_sector", scan: result.scan };
    },
    settleScan(state, payload) {
      state.trace.push(`sector:${payload.sectorAction.target.choiceId}`);
      return { ok: true, nextState: state, settlement: { sectorId: payload.sectorAction.target.choiceId } };
    },
    buildScanFollowups() {
      return [
        { priority: "deferred", kind: "deferred_draw", payload: { playerId: "p1" } },
        { priority: "direct", kind: "participant_reward", ownerId: "p1", payload: { playerId: "p1" } },
        { priority: "direct", kind: "participant_reward", ownerId: "p2", payload: { playerId: "p2" } },
      ];
    },
    buildParticipantRewardPending(_state, reward) {
      return { ownerId: reward.playerId };
    },
    applyParticipantReward(state, reward) {
      state.trace.push(`reward:${reward.playerId}:${reward.rewardAction.target.choiceId}`);
      return { ok: true, nextState: state };
    },
    drawDeferredCard(state, draw) {
      const cardId = state.cards.deck.shift();
      state.cards.hands[draw.playerId].push(cardId);
      state.trace.push(`draw:${cardId}`);
      return {
        ok: true,
        nextState: state,
        rng: [{ kind: "hidden-draw", cardId }],
        irreversible: { kind: "hidden-information", reason: "延迟补牌已揭示" },
      };
    },
    placeData(state, payload) {
      state.trace.push(`data:${payload.placementAction.target.choiceId}`);
      return { ok: true, nextState: state };
    },
    buildLandPaymentPending() {
      return {};
    },
    land(state, payload) {
      state.trace.push(`land:${payload.targetAction.target.choiceId}:${payload.paymentAction.target.choiceId}`);
      return { ok: true, nextState: state };
    },
    playCard() { forbiddenCalls.oldContinuation += 1; return { ok: false }; },
    buildCardEffects() { forbiddenCalls.oldContinuation += 1; return []; },
    applyCardEffect() { forbiddenCalls.oldContinuation += 1; return { ok: false }; },
    buildCardTriggers() { forbiddenCalls.oldContinuation += 1; return []; },
    applyTrigger() { forbiddenCalls.oldContinuation += 1; return { ok: false }; },
  });
}

function createHarness() {
  const authority = { current: createState() };
  const forbiddenCalls = { pendingOwner: 0, oldContinuation: 0, aiResolver: 0 };
  const registry = createRegistry();
  const flow = createFlow(authority, registry, forbiddenCalls);
  let latestObservation = null;
  let latestInspection = null;
  let commitCount = 0;
  const store = {
    getSnapshot: () => ({ state: structuredClone(authority.current) }),
    compareAndCommit(baseVersion, nextState) {
      if (baseVersion !== authority.current.version) return { ok: false, code: "STATE_VERSION_CONFLICT" };
      authority.current = structuredClone(nextState);
      authority.current.version += 1;
      authority.current.stateVersion = authority.current.version;
      commitCount += 1;
      return { ok: true };
    },
  };
  const viewStore = viewStateApi.createViewStateStore();
  const projectionAdapter = projectionAdapterApi.createBrowserProjectionAdapter({
    stateStore: store,
    sessionRuntime: {
      inspect: () => structuredClone(latestInspection),
      observe: () => structuredClone(latestObservation),
    },
  });
  let host;
  function project() {
    const inspection = host.inspect();
    if (inspection.phase === "idle") return null;
    const ownerId = latestInspection.decision?.ownerId || authority.current.actorId;
    return projectionAdapter.projectSession({}, {
      viewer: { viewerId: `browser-${ownerId}`, playerId: ownerId, role: "player" },
    });
  }
  host = effectHost.createBrowserEffectSessionHost({
    stateStore: store,
    actionRegistry: registry,
    flows: { scan: flow, place_data: flow, land: flow },
    renderProjection(observation, inspection) {
      latestObservation = observation;
      latestInspection = inspection.session;
    },
  });
  const input = inputAdapterApi.createBrowserInputAdapter({
    dispatchAction: (action) => host.dispatchAction(action),
    submitDecision: (submission) => host.submitDecisionChoice(
      submission.decisionId,
      submission.decisionVersion,
      submission.choice.choiceId,
    ),
    viewStateStore: viewStore,
    refreshProjection: () => undefined,
  });
  const controller = decisionUiApi.createDecisionUiController({ dispatchIntent: input.dispatchIntent });

  function assertAndChoose(choiceId, expectedRenderer) {
    const rawDecision = host.inspect().session.decision;
    const projection = project();
    viewStore.reconcileProjection(projection);
    const renderInput = { projection, viewState: viewStore.getSnapshot() };
    const model = controller.render(renderInput);
    const rawIds = rawDecision.choices.map((choice) => choice.actionId).sort();
    const projectedIds = projection.decision.choices.map((choice) => choice.choiceId).sort();
    const renderedIds = model.content.choices.map((choice) => choice.choiceId).sort();
    assert.deepEqual(projectedIds, rawIds, "UI choices 必须与 Effect Session inspect 逐项等价");
    assert.deepEqual(renderedIds, rawIds, "领域 renderer 不得增删 choices");
    assert.equal(model.rendererKey, expectedRenderer);
    const choice = projection.decision.choices.find((entry) => entry.label.endsWith(`:${choiceId}`));
    assert.ok(choice, `缺少 choice ${choiceId}`);
    controller.dispatchUiIntent({ type: "focus", choiceId: choice.choiceId }, renderInput);
    const refreshed = { projection, viewState: viewStore.getSnapshot() };
    assert.equal(controller.dispatchUiIntent({ type: "confirm" }, refreshed).ok, true);
  }

  function dispatchFamily(family) {
    const action = host.enumerateActions({ family })[0];
    assert.ok(action, `缺少 ${family} Standard Action`);
    assert.equal(input.dispatchIntent({ kind: "action", action }).ok, true);
  }

  return {
    authority,
    forbiddenCalls,
    host,
    project,
    assertAndChoose,
    dispatchFamily,
    getCommitCount: () => commitCount,
  };
}

(function testScanDataAndLandUseOneDecisionBoundary() {
  const harness = createHarness();

  harness.dispatchFamily("scan");
  harness.assertAndChoose("nebula-b", "board-target");
  harness.assertAndChoose("blue", "board-target");
  harness.assertAndChoose("data", "generic");
  const beforeSecondParticipant = JSON.stringify(harness.project());
  assert.equal(beforeSecondParticipant.includes("hidden-alpha"), false, "补牌前不得泄漏隐藏牌 identity");
  assert.equal(beforeSecondParticipant.includes("hidden-beta"), false, "不得泄漏未来牌序");
  harness.assertAndChoose("card", "generic");
  assert.equal(harness.host.inspect().phase, "idle");
  const scanStable = harness.host.inspect().stableResult;
  assert.equal(scanStable.journal.decisions.length, 4, "扫描链必须记录四次独立 decision");
  const replayAuthority = { current: createState() };
  const replayForbidden = { pendingOwner: 0, oldContinuation: 0, aiResolver: 0 };
  const replayFlow = createFlow(replayAuthority, createRegistry(), replayForbidden);
  const replayed = replayFlow.replayJournal(replayAuthority.current, scanStable.journal);
  assert.equal(replayed.ok, true);
  assert.deepEqual(replayed.session.committedState.trace, harness.authority.current.trace, "扫描 decision journal 必须可重建固定 trace");
  assert.deepEqual(replayForbidden, { pendingOwner: 0, oldContinuation: 0, aiResolver: 0 });

  harness.dispatchFamily("place_data");
  harness.assertAndChoose("computer-b", "board-target");
  assert.equal(harness.host.inspect().phase, "idle");

  harness.dispatchFamily("land");
  harness.assertAndChoose("europa", "board-target");
  harness.assertAndChoose("energy", "payment");
  assert.equal(harness.host.inspect().phase, "idle");

  assert.deepEqual(harness.authority.current.trace, [
    "decision:scan_target:p1:nebula-b",
    "scan:nebula-b",
    "decision:scan_sector:p1:blue",
    "sector:blue",
    "decision:scan_participant_reward:p1:data",
    "reward:p1:data",
    "decision:scan_participant_reward:p2:card",
    "reward:p2:card",
    "draw:hidden-alpha",
    "decision:data_placement:p1:computer-b",
    "data:computer-b",
    "decision:land_target:p1:europa",
    "decision:land_payment:p1:energy",
    "land:europa:energy",
  ]);
  assert.equal(harness.getCommitCount(), 3, "三个 Standard Action 必须各自只原子提交一次");
  assert.deepEqual(harness.forbiddenCalls, { pendingOwner: 0, oldContinuation: 0, aiResolver: 0 });
})();

(function testMigrationHotPathHasNoLegacyOwnersOrContinuations() {
  const source = fs.readFileSync(path.join(__dirname, "../../game/effects/scan-card-session.js"), "utf8");
  for (const forbidden of [
    "scanTargetAction",
    "probeSectorScanAction",
    "probeLocationRewardAction",
    "publicScanQueue",
    "dataPlaceAction",
    "landTargetAction",
    "completeCurrentActionEffect",
    "runAiPendingStep",
  ]) {
    assert.equal(source.includes(forbidden), false, `迁移热路径不得引用 ${forbidden}`);
  }
})();

console.log("scan/data/land browser host session tests passed");
