"use strict";

const assert = require("node:assert/strict");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("./session-runtime");
const standardActionDomain = require("./standard-action-session");
const { createBrowserRuleComposition } = require("../../app/browser-rule-composition");

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

const composition = createBrowserRuleComposition({
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
  const decisionComposition = createBrowserRuleComposition({
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
  const singleChoiceComposition = createBrowserRuleComposition({
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

console.log("standard action Effect Session tests passed");
