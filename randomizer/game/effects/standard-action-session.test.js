"use strict";

const assert = require("node:assert/strict");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("./session-runtime");
const cardSelection = require("./card-selection-decision");
const browserPendingDecision = require("./browser-pending-decision");
const standardActionDomain = require("./standard-action-session");
const { createRuleComposition } = require("../rule-composition");

function state() {
  return stateStoreApi.createCommittedGameState({
    gameId: "standard-action-domain",
    rulesetVersion: "test-v1",
    seed: 124,
    rngState: {},
    sequences: {},
    match: { actions: [] },
    turn: { currentPlayerId: "p1" },
    players: {}, solarSystem: {}, pieces: {}, planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
  });
}

const composition = createRuleComposition({
  stateStoreApi,
  effectRuntimeApi,
  createInitialState: state,
  projectState: (root) => ({ actions: root.match.actions }),
  createActionRegistry() {
    const descriptor = (root) => ({
      schemaVersion: "seti-standard-action-v1",
      actionId: `launch:${root.meta.stateVersion}`,
      family: "launch",
      phase: "main",
      actorId: "p1",
      stateVersion: root.meta.stateVersion,
      decisionVersion: 0,
      target: null,
      payload: {},
      summary: "发射",
    });
    return {
      enumerate: (root) => [descriptor(root)],
      validate(root, action) {
        return descriptor(root).actionId === action?.actionId ? { ok: true } : { ok: false, code: "STANDARD_ACTION_STALE" };
      },
      execute(root, action) {
        root.match.actions.push(action.family);
        return {
          ok: true,
          message: "发射完成",
          commands: [{ undo() { throw new Error("宿主 undo closure 不得进入 committed root"); } }],
          history: [{ undo() { throw new Error("legacy history closure 不得进入 Session result"); } }],
          events: [{ type: "launch" }],
        };
      },
    };
  },
  effectDomains: [{
    create: standardActionDomain.createStandardActionDomain,
    families: ["launch"],
    options: { actionFamilies: ["launch"] },
  }],
});

const action = composition.inputPort.enumerateActions()[0];
const result = composition.inputPort.submitAction(action);
assert.equal(result.ok, true);
assert.equal(result.phase, "completed");
assert.deepEqual(composition.projection().state.actions, ["launch"]);
assert.equal(composition.projection().stateVersion, 1);
assert.equal(JSON.stringify(composition.lifecycle.save().envelope).includes("undo"), false);

{
  let sessionOwnedResolveCalls = 0;
  const decisionComposition = createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createInitialState() {
      const root = state();
      root.match.phase = "turn";
      return root;
    },
    projectState: (root) => ({ phase: root.match.phase, actions: root.match.actions }),
    createActionRegistry() {
      return {
        enumerate: () => [],
        validate: () => ({ ok: true }),
        execute(root, action) {
          root.match.actions.push(action.actionId);
          root.match.phase = action.family === "launch" ? "decision" : "turn";
          return { ok: true };
        },
      };
    },
    effectDomains: [{
      create: standardActionDomain.createStandardActionDomain,
      families: ["launch", "choose_target"],
      options: {
        actionFamilies: ["launch", "choose_target"],
        continuation: {
          inspect(root) {
            if (root.match.phase !== "decision") {
              return { ok: true, boundary: "turn_action", decisionType: "turn_action", candidates: [] };
            }
            const choice = (id) => ({
              standardAction: {
                schemaVersion: "seti-standard-action-v1",
                actionId: `choose_target:${id}`,
                family: "choose_target",
                phase: "conditional",
                actorId: "p1",
                target: { choiceId: id },
                payload: {},
              },
            });
            return {
              ok: true,
              boundary: "conditional_choice",
              decisionType: "conditional_choice",
              ownerId: "p1",
              candidates: [choice("left"), choice("right")],
            };
          },
          executeDeterministic: () => ({ ok: false, code: "UNEXPECTED_DETERMINISTIC_STEP" }),
          resolveDecision(root, choice) {
            sessionOwnedResolveCalls += 1;
            root.match.actions.push(choice.standardAction.actionId);
            root.match.phase = "turn";
            return { ok: true };
          },
        },
      },
    }],
  });
  const opened = decisionComposition.inputPort.submitAction({
    schemaVersion: "seti-standard-action-v1",
    actionId: "launch:decision",
    family: "launch",
    phase: "main",
    actorId: "p1",
    target: null,
    payload: {},
  });
  assert.equal(opened.ok, true);
  const inspection = decisionComposition.inspect();
  assert.equal(inspection.phase, "awaiting_input");
  assert.deepEqual(
    inspection.session.decision.choices.map((choice) => choice.standardAction.actionId),
    ["choose_target:left", "choose_target:right"],
  );
  const resolved = decisionComposition.inputPort.submitDecision({
    decisionId: inspection.session.decision.decisionId,
    decisionVersion: inspection.session.decision.decisionVersion,
    choice: inspection.session.decision.choices[1],
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.phase, "completed");
  assert.equal(sessionOwnedResolveCalls, 1);
  assert.deepEqual(decisionComposition.projection().state.actions, ["launch:decision", "choose_target:right"]);
}

{
  let resolveCalls = 0;
  const singleChoiceComposition = createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createInitialState() {
      const root = state();
      root.match.phase = "turn";
      return root;
    },
    projectState: (root) => ({ phase: root.match.phase }),
    createActionRegistry() {
      return {
        enumerate: () => [],
        validate: () => ({ ok: true }),
        execute(root) {
          root.match.phase = "decision";
          return { ok: true };
        },
      };
    },
    effectDomains: [{
      create: standardActionDomain.createStandardActionDomain,
      families: ["launch", "choose_target"],
      options: {
        actionFamilies: ["launch", "choose_target"],
        continuation: {
          inspect(root) {
            if (root.match.phase !== "decision") {
              return { ok: true, boundary: "turn_action", decisionType: "turn_action", candidates: [] };
            }
            return {
              ok: true,
              boundary: "conditional_choice",
              decisionType: "conditional_choice",
              ownerId: "p1",
              candidates: [{
                standardAction: {
                  schemaVersion: "seti-standard-action-v1",
                  actionId: "choose_target:only",
                  family: "choose_target",
                  phase: "conditional",
                  actorId: "p1",
                  target: { choiceId: "only" },
                  payload: {},
                },
              }],
            };
          },
          executeDeterministic: () => ({ ok: false, code: "UNEXPECTED_DETERMINISTIC_STEP" }),
          resolveDecision(root) {
            resolveCalls += 1;
            root.match.phase = "turn";
            return { ok: true };
          },
        },
      },
    }],
  });
  const opened = singleChoiceComposition.inputPort.submitAction({
    schemaVersion: "seti-standard-action-v1",
    actionId: "launch:single-decision",
    family: "launch",
    phase: "main",
    actorId: "p1",
    target: null,
    payload: {},
  });
  assert.equal(opened.ok, true);
  assert.equal(resolveCalls, 0, "单候选不得在 Session 外自动执行");
  const inspection = singleChoiceComposition.inspect();
  assert.equal(inspection.phase, "awaiting_input", "单候选等待也必须暴露 activeSession DecisionEffect");
  const resolved = singleChoiceComposition.inputPort.submitDecision({
    decisionId: inspection.session.decision.decisionId,
    decisionVersion: inspection.session.decision.decisionVersion,
    choice: inspection.session.decision.choices[0],
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.phase, "completed");
  assert.equal(resolveCalls, 1);
}

function createCardSelectionOwner(overrides = {}) {
  let inspection = null;
  const owner = cardSelection.createCardSelectionDecisionOwner({
    inspectSession: () => inspection,
    resolvePlayer: (root, pending) => root.players.find((player) => player.id === pending.playerId),
    getCardLabel: (card) => card.label,
    getSelectedPublicSlots: () => overrides.selectedSlots || [],
    getPublicScanChoicesForCard: () => ({ ok: true }),
    getPublicScanMinSelectable: () => 1,
    getPublicCardMultiSelectMinSelectable: () => 1,
    canBlindDraw: () => true,
    isFutureSpanEligibleHandCard: (card) => card.eligible,
  });
  return {
    owner,
    setInspection(value) { inspection = value; },
  };
}

{
  const harness = createCardSelectionOwner();
  const root = {
    players: [{ id: "p1", color: "blue", hand: [] }],
    cardState: { publicCards: [{ id: "c1", label: "卡牌一" }] },
  };
  let effect;
  harness.owner.runRuleTransaction(root, () => {
    harness.owner.open(root, {
      type: "public_scan",
      player: root.players[0],
      allowBlindDraw: false,
    });
    effect = harness.owner.takeOpenedDecisionEffect();
  });
  assert.equal(effect.ownerId, "p1");
  assert.equal(effect.kind, "decision");
  assert.equal(effect.payload.choices.length, 1);
  assert.equal(effect.payload.choices[0].target.cardId, "c1");
  assert.deepEqual(effect.payload.choices[0].cardSelection, {
    type: "public_scan",
    playerId: "p1",
    playerColor: "blue",
    effectId: null,
    allowBlindDraw: false,
  });
  assert.equal(harness.owner.read(), null);
}

{
  const harness = createCardSelectionOwner();
  const root = {
    players: [{ id: "p1", color: "blue", hand: [] }],
    cardState: { publicCards: [] },
  };
  assert.throws(
    () => harness.owner.open(root, { type: "public_scan", playerId: "p1" }),
    /只能在当前规则事务内 open/,
  );
  harness.owner.runRuleTransaction(root, () => {
    harness.owner.open(root, { type: "public_scan", playerId: "p1" });
  });
  assert.equal(harness.owner.takeOpenedDecisionEffect(), null);
  assert.equal(harness.owner.read(), null);
}

{
  const harness = createCardSelectionOwner();
  harness.setInspection({
    session: {
      currentEffect: {
        kind: "decision",
        type: cardSelection.DECISION_EFFECT_TYPE,
        payload: {
          cardSelection: {
            type: "industry_future_hand",
            playerId: "p1",
            allowBlindDraw: false,
          },
        },
      },
    },
  });
  assert.deepEqual(harness.owner.read(), {
    type: "industry_future_hand",
    playerId: "p1",
    allowBlindDraw: false,
  });
}

{
  const harness = createCardSelectionOwner({ selectedSlots: [0] });
  const root = {
    players: [{ id: "p1", hand: [] }],
    cardState: { publicCards: [{ id: "c1", label: "一" }, { id: "c2", label: "二" }] },
  };
  let effect;
  harness.owner.runRuleTransaction(root, () => {
    harness.owner.open(root, {
      type: "card_public_corner_discard",
      playerId: "p1",
      minSelectable: 1,
      maxSelectable: 2,
      allowBlindDraw: false,
    });
    effect = harness.owner.takeOpenedDecisionEffect();
  });
  assert.deepEqual(effect.payload.choices.map((choice) => choice.target.kind), [
    "public-card",
    "confirm-public-corner-discard",
  ]);
  assert.equal(effect.payload.choices.every((choice) => (
    choice.cardSelection.type === "card_public_corner_discard"
  )), true);
}

{
  let inspection = { session: { decision: null } };
  const owner = browserPendingDecision.createBrowserPendingDecisionOwner({
    inspectSession: () => inspection,
    enumerate(_workingRoot, kind, pending) {
      return {
        actorPlayer: { id: pending.playerId },
        candidates: [{
          family: kind === "hand_scan" ? "choose_card" : "choose_payment",
          target: { kind, choiceId: "legal" },
        }],
      };
    },
  });
  const root = {};
  for (const kind of browserPendingDecision.SUPPORTED_KINDS) {
    let effect;
    owner.runRuleTransaction(root, () => {
      owner.open(root, kind, { playerId: "p1", marker: kind });
      effect = owner.takeOpenedDecisionEffect();
    });
    assert.equal(effect.kind, "decision");
    assert.equal(effect.ownerId, "p1");
    assert.deepEqual(effect.payload.choices[0].decisionContext, {
      kind,
      pending: { playerId: "p1", marker: kind },
    });
    inspection = {
      session: {
        decision: {
          choices: structuredClone(effect.payload.choices),
        },
      },
    };
    assert.equal(owner.read(kind).marker, kind, "Browser 必须从同一 Decision snapshot 读取等待态");
  }
  assert.throws(
    () => owner.open(root, "discard", { playerId: "p1" }),
    /当前规则事务/,
  );
}

{
  const root = { match: { stable: true }, playerState: { players: [{ id: "p1" }] } };
  const before = structuredClone(root);
  const owner = browserPendingDecision.createBrowserPendingDecisionOwner({
    inspectSession: () => ({ session: { decision: null } }),
    enumerate: () => ({ actorPlayer: { id: "p1" }, candidates: [] }),
  });
  owner.runRuleTransaction(root, () => {
    assert.throws(
      () => owner.open(root, "scan_target", { playerId: "p1" }),
      /没有合法选项/,
    );
    assert.equal(owner.takeOpenedDecisionEffect(), null);
  });
  assert.deepEqual(root, before, "DecisionEffect 打开失败不得污染 working root");
}

console.log("standard action Effect Session tests passed");
