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

console.log("standard action Effect Session tests passed");
