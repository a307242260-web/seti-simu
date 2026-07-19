"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const standardAction = require("../actions/standard-action");
const scanCardSession = require("./scan-card-session");

function createCommittedState(overrides = {}) {
  return {
    version: 11,
    actorId: "p1",
    decisionVersion: 0,
    targets: ["nebula-a", "nebula-b"],
    sectors: ["yellow", "blue"],
    payments: ["energy", "data"],
    triggerRewards: ["data", "score"],
    rewards: 0,
    hand: ["card-7"],
    played: [],
    trace: [],
    ...structuredClone(overrides),
  };
}

function createConditionalRegistry() {
  function optionsForPending(state, pending) {
    if (pending.type === "scan_target") return state.targets;
    if (pending.type === "scan_sector") return state.sectors;
    if (pending.type === "play_card_payment") return state.payments;
    if (pending.type === "card_trigger_choice") return state.triggerRewards;
    return [];
  }

  function provider(family) {
    return {
      getOptions(context) {
        return {
          ok: true,
          choices: optionsForPending(context.state, context.pending).map((choiceId) => ({
            target: { pendingType: context.pending.type, choiceId },
            payload: { outcome: `${context.pending.type}:${choiceId}` },
            label: `${family}:${choiceId}`,
          })),
        };
      },
      canExecute(context, option) {
        return optionsForPending(context.state, context.pending).includes(option.target?.choiceId)
          ? { ok: true }
          : { ok: false, message: "conditional choice 已失效" };
      },
      execute(context, option) {
        const choiceId = option.target.choiceId;
        context.state.decisionVersion += 1;
        context.state.trace.push(`decision:${context.pending.type}:${choiceId}`);
        return {
          ok: true,
          nextState: context.state,
          events: [{
            type: "standardDecisionExecuted",
            family,
            actionId: option.actionId,
          }],
        };
      },
    };
  }

  const registry = standardAction.createRegistry({
    getAuthority: (context) => ({
      actorId: context.state.actorId,
      stateVersion: context.state.version,
      decisionVersion: context.state.decisionVersion,
    }),
  });
  for (const family of ["choose_target", "choose_payment", "choose_reward"]) {
    registry.register(standardAction.createConditionalDefinition(family, provider(family)));
  }
  return registry;
}

function createHarness(api = scanCardSession, options = {}) {
  let authority = createCommittedState(options.state);
  const calls = {
    legacyQueue: 0,
    legacyContinuation: 0,
    legacyPendingResolver: 0,
  };
  const registry = createConditionalRegistry();
  const facade = api.createScanCardRuntime({
    readCommittedState: () => authority,
    enumerateConditional(state, pending) {
      return registry.enumerate({ state, pending }, { family: pending.family });
    },
    executeConditional(state, action, pending) {
      return registry.execute({ state, pending }, action);
    },
    runScan(state, payload) {
      const targetId = payload.targetAction.target.choiceId;
      state.trace.push(`scan:${targetId}`);
      return {
        ok: true,
        nextState: state,
        scan: { targetId },
        events: [{ type: "signalMarked", targetId }],
      };
    },
    buildScanSectorPending(_state, result) {
      return {
        type: "scan_sector",
        family: "choose_target",
        scan: result.scan,
      };
    },
    settleScan(state, payload) {
      const sectorId = payload.sectorAction.target.choiceId;
      state.trace.push(`sector:${sectorId}`);
      return {
        ok: true,
        nextState: state,
        settlement: { sectorId, targetId: payload.scan.targetId },
        events: [{ type: "sectorCompleted", sectorId }],
      };
    },
    buildScanFollowups() {
      return options.badFollowup
        ? [{ priority: "mystery", kind: "legacy_queue", payload: {} }]
        : [
          { priority: "deferred", kind: "deferred_draw", payload: { cardId: "draw-a" } },
          { priority: "direct", kind: "participant_reward", payload: { playerId: "p1" } },
          { priority: "trigger", kind: "trigger", payload: { id: "scan-passive" } },
          { priority: "direct", kind: "participant_reward", payload: { playerId: "p2" } },
          { priority: "deferred", kind: "deferred_draw", payload: { cardId: "draw-b" } },
        ];
    },
    applyParticipantReward(state, reward) {
      state.rewards += 1;
      state.trace.push(`reward:${reward.playerId}`);
      return { ok: true, nextState: state };
    },
    drawDeferredCard(state, draw) {
      state.hand.push(draw.cardId);
      state.trace.push(`draw:${draw.cardId}`);
      return {
        ok: true,
        nextState: state,
        events: [{ type: "cardDrawn", cardId: draw.cardId }],
        rng: [{ kind: "fixtureDraw", cardId: draw.cardId }],
      };
    },
    playCard(state, payload) {
      const cardId = payload.action.target.cardId;
      state.played.push(cardId);
      state.trace.push(`play:${cardId}`);
      return {
        ok: true,
        nextState: state,
        card: { cardId },
        history: [{ type: "playCard", cardId }],
      };
    },
    buildCardEffects(_state, result) {
      return [
        { id: `${result.card.cardId}:first`, amount: 1 },
        { id: `${result.card.cardId}:second`, amount: 2 },
      ];
    },
    applyCardEffect(state, cardEffect) {
      state.trace.push(`card-effect:${cardEffect.id}`);
      return { ok: true, nextState: state };
    },
    buildCardTriggers() {
      return [
        { id: "task-complete", type: "task" },
        { id: "industry-passive", type: "passive", needsChoice: true },
      ];
    },
    applyTrigger(state, trigger) {
      state.trace.push(`trigger:${trigger.id}`);
      return {
        ok: true,
        nextState: state,
        trigger,
        events: [{ type: "cardTrigger", triggerId: trigger.id }],
      };
    },
    buildTriggerDecision(_state, result) {
      if (options.unknownPending && result.trigger.needsChoice) {
        return { type: "legacy_unknown_pending", family: "choose_reward" };
      }
      return result.trigger.needsChoice
        ? { type: "card_trigger_choice", family: "choose_reward" }
        : null;
    },
  });
  return {
    ...facade,
    calls,
    getAuthority: () => authority,
    setAuthority: (next) => { authority = next; },
  };
}

function choose(harness, session, choiceId) {
  const decision = harness.inspect(session).decision;
  assert.equal(decision.ok, true);
  const choice = decision.choices.find((candidate) => candidate.target.choiceId === choiceId);
  assert.ok(choice, `缺少选择 ${choiceId}`);
  const resolved = harness.resolveDecision(session, {
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice,
  });
  assert.equal(resolved.ok, true);
  return choice;
}

function drainToDecision(harness, session) {
  const drained = harness.drain(session);
  assert.equal(drained.ok, true);
  assert.equal(session.phase, "awaiting_input");
  return harness.inspect(session).decision;
}

function runScanTrace(api = scanCardSession) {
  const harness = createHarness(api);
  const baseState = harness.getAuthority();
  const dispatched = harness.dispatch(baseState, {
    family: "scan",
    actorId: "p1",
    actionId: "scan:fixed",
  }, { sessionId: "scan-fixed" });
  assert.equal(dispatched.ok, true);
  drainToDecision(harness, dispatched.session);
  choose(harness, dispatched.session, "nebula-b");
  drainToDecision(harness, dispatched.session);
  choose(harness, dispatched.session, "blue");
  const completed = harness.drain(dispatched.session);
  assert.equal(completed.ok, true);
  assert.equal(dispatched.session.phase, "completed");
  assert.deepEqual(dispatched.session.committedState.trace, [
    "decision:scan_target:nebula-b",
    "scan:nebula-b",
    "decision:scan_sector:blue",
    "sector:blue",
    "reward:p1",
    "reward:p2",
    "trigger:scan-passive",
    "draw:draw-a",
    "draw:draw-b",
  ], "direct/trigger/deferred 必须稳定排序，不能采用 adapter 输入顺序");
  assert.deepEqual(baseState.trace, [], "session 完成前不得污染权威输入");
  assert.equal(dispatched.session.journal.decisions.length, 2);
  assert.ok(dispatched.session.journal.decisions.every((entry) => (
    entry.choice.schemaVersion === standardAction.SCHEMA_VERSION && entry.choice.actionId
  )), "journal 必须保留 Standard Action identity");
  assert.deepEqual(harness.calls, {
    legacyQueue: 0,
    legacyContinuation: 0,
    legacyPendingResolver: 0,
  });
  return {
    committedState: dispatched.session.committedState,
    journal: dispatched.session.journal,
  };
}

function runCardTrace(api = scanCardSession) {
  const harness = createHarness(api);
  const baseState = harness.getAuthority();
  const dispatched = harness.dispatch(baseState, {
    family: "play_card",
    actorId: "p1",
    actionId: "play-card:fixed",
    target: { cardId: "card-7" },
  }, { sessionId: "play-card-fixed" });
  assert.equal(dispatched.ok, true);
  drainToDecision(harness, dispatched.session);
  choose(harness, dispatched.session, "data");
  drainToDecision(harness, dispatched.session);
  assert.deepEqual(dispatched.session.workingState.trace, [
    "decision:play_card_payment:data",
    "play:card-7",
    "card-effect:card-7:first",
    "card-effect:card-7:second",
    "trigger:task-complete",
    "trigger:industry-passive",
  ], "卡牌顺序效果必须全部先于任务/被动 trigger 与新决策");
  choose(harness, dispatched.session, "score");
  const completed = harness.drain(dispatched.session);
  assert.equal(completed.ok, true);
  assert.equal(dispatched.session.phase, "completed");
  assert.deepEqual(dispatched.session.committedState.trace, [
    "decision:play_card_payment:data",
    "play:card-7",
    "card-effect:card-7:first",
    "card-effect:card-7:second",
    "trigger:task-complete",
    "trigger:industry-passive",
    "decision:card_trigger_choice:score",
  ]);
  assert.equal(dispatched.session.journal.decisions.length, 2, "支付与 trigger 新决策必须是独立 journal step");
  assert.deepEqual(baseState.trace, []);
  return {
    committedState: dispatched.session.committedState,
    journal: dispatched.session.journal,
  };
}

(function testRepresentativeScanChainAndReplay() {
  const original = runScanTrace();
  const replayHarness = createHarness();
  const replayed = replayHarness.replayJournal(
    replayHarness.getAuthority(),
    original.journal,
    { sessionId: "scan-fixed" },
  );
  assert.equal(replayed.ok, true);
  assert.deepEqual(replayed.session.committedState, original.committedState);
  assert.deepEqual(replayed.session.journal, original.journal);
})();

(function testRepresentativePlayCardChainAndReplay() {
  const original = runCardTrace();
  const replayHarness = createHarness();
  const replayed = replayHarness.replayJournal(
    replayHarness.getAuthority(),
    original.journal,
    { sessionId: "play-card-fixed" },
  );
  assert.equal(replayed.ok, true);
  assert.deepEqual(replayed.session.committedState, original.committedState);
  assert.deepEqual(replayed.session.journal, original.journal);
})();

(function testUnknownPendingAndFollowupFailClosed() {
  const unknownPending = createHarness(scanCardSession, { unknownPending: true });
  const card = unknownPending.dispatch(unknownPending.getAuthority(), {
    family: "play_card",
    actorId: "p1",
    target: { cardId: "card-7" },
  });
  drainToDecision(unknownPending, card.session);
  choose(unknownPending, card.session, "energy");
  const failedPending = unknownPending.drain(card.session);
  assert.equal(failedPending.code, "NESTED_FLOW_PENDING_TYPE_UNKNOWN");
  assert.equal(card.session.phase, "aborted");
  assert.deepEqual(card.session.workingState, card.session.baseState);

  const unknownFollowup = createHarness(scanCardSession, { badFollowup: true });
  const scan = unknownFollowup.dispatch(unknownFollowup.getAuthority(), {
    family: "scan",
    actorId: "p1",
  });
  drainToDecision(unknownFollowup, scan.session);
  choose(unknownFollowup, scan.session, "nebula-a");
  drainToDecision(unknownFollowup, scan.session);
  choose(unknownFollowup, scan.session, "yellow");
  const failedFollowup = unknownFollowup.drain(scan.session);
  assert.equal(failedFollowup.code, "SCAN_FOLLOWUP_TYPE_UNKNOWN");
  assert.equal(scan.session.phase, "aborted");

  const wrongFamily = createHarness().dispatch(createCommittedState(), {
    family: "legacy_pending",
    actorId: "p1",
  });
  assert.equal(wrongFamily.code, "NESTED_FLOW_ACTION_FAMILY_INVALID");
})();

(function testBrowserAndNodeFixedTraceParity() {
  const context = vm.createContext({ console, structuredClone, globalThis: null });
  context.globalThis = context;
  for (const file of [
    "../actions/standard-action.js",
    "session-runtime.js",
    "scan-card-session.js",
  ]) {
    const source = fs.readFileSync(path.resolve(__dirname, file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }
  const browserResult = JSON.parse(JSON.stringify({
    scan: runScanTrace(context.SetiScanCardSession),
    card: runCardTrace(context.SetiScanCardSession),
  }));
  const nodeResult = JSON.parse(JSON.stringify({
    scan: runScanTrace(scanCardSession),
    card: runCardTrace(scanCardSession),
  }));
  assert.deepEqual(browserResult, nodeResult);
})();

(function testMigratedRepresentativeChainsHaveNoLegacyContinuation() {
  const source = fs.readFileSync(path.join(__dirname, "scan-card-session.js"), "utf8");
  for (const forbidden of [
    "actionEffectFlow",
    "abilities.chain",
    "scanRunSequence",
    "publicScanQueue",
    "type1TriggerEvents",
    "completeCurrentActionEffect",
    "runAiPendingStep",
  ]) {
    assert.equal(source.includes(forbidden), false, `迁移热路径不得引用 ${forbidden}`);
  }
})();

console.log("scan/card effect session tests passed");
