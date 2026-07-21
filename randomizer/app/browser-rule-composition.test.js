"use strict";

const assert = require("node:assert/strict");
const stateStoreApi = require("../game/state/state-store");
const effectRuntimeApi = require("../game/effects/session-runtime");
const researchTechSession = require("../game/effects/research-tech-session");
const { createBrowserRuleComposition, SAVE_SCHEMA_VERSION } = require("./browser-rule-composition");

function createState(value = 0) {
  return {
    meta: {
      schemaVersion: stateStoreApi.SCHEMA_VERSION,
      stateVersion: 0,
      gameId: "browser-composition-test",
      rulesetVersion: "test-v1",
      seed: "fixed",
      rngState: {},
      sequences: {},
    },
    match: { value },
    turn: {},
    players: {},
    solarSystem: {},
    pieces: {},
    planets: {},
    data: {},
    cards: {},
    tech: {},
    aliens: {},
    finalScoring: {},
  };
}

function createRegistry() {
  function descriptor(state, family, target = "default") {
    return {
      schemaVersion: "seti-standard-action-v1",
      family,
      phase: family === "quick_trade" ? "quick" : "main",
      actionId: `${family}:${target}:${state.meta.stateVersion}`,
      actorId: "player-1",
      stateVersion: state.meta.stateVersion,
      decisionVersion: state.match.decisionVersion || 0,
      target: { id: target },
      payload: {},
      summary: family,
    };
  }
  return {
    enumerate(state, request = {}) {
      const families = request.family ? [request.family] : ["launch", "scan", "quick_trade"];
      return families.map((family) => descriptor(state, family));
    },
    validate(state, action) {
      const current = this.enumerate(state, { family: action?.family })[0];
      return current?.actionId === action?.actionId
        ? { ok: true }
        : { ok: false, code: "STANDARD_ACTION_STALE", message: "stale" };
    },
  };
}

function createHarness(initialValue = 0) {
  let commitEvents = 0;
  const composition = createBrowserRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (options) => createState(options.value ?? initialValue),
    projectState: (state) => ({
      match: structuredClone(state.match),
      meta: { stateVersion: state.meta.stateVersion },
    }),
    createEffectGroup(_state, action) {
      if (action.family === "scan") {
        return {
          effects: [
            { type: "add", payload: { amount: 2 } },
            {
              type: "choose",
              kind: "decision",
              ownerId: "player-1",
              payload: { choices: [{ id: "left", amount: 3 }, { id: "right", amount: 5 }] },
              allowQuickActions: true,
            },
          ],
        };
      }
      if (action.family === "quick_trade") return { effects: [{ type: "add", payload: { amount: 7 } }] };
      return { effects: [{ type: "add", payload: { amount: 1 } }] };
    },
    effectExecutors: {
      add(state, effect) {
        state.match.value += effect.payload.amount;
        return { ok: true, nextState: state };
      },
      choose: {
        getLegalChoices(_state, effect) { return effect.payload.choices; },
        resolveDecision(state, _effect, choice) {
          state.match.value += choice.amount;
          return { ok: true, nextState: state };
        },
      },
      fail() { throw new Error("boom"); },
    },
  });
  composition.subscribe((event) => {
    if (event.source === "committed") commitEvents += 1;
  });
  return { composition, commitEvents: () => commitEvents };
}

{
  const { composition, commitEvents } = createHarness();
  const action = composition.inputPort.enumerateActions({ family: "launch" })[0];
  const result = composition.inputPort.submitAction(action);
  assert.equal(result.ok, true);
  assert.equal(result.phase, "completed");
  assert.equal(composition.projection().state.match.value, 1);
  assert.equal(composition.projection().stateVersion, 1);
  assert.equal(commitEvents(), 1, "完整 Effect Queue 只允许一次 CAS");
  assert.equal(Object.hasOwn(composition, "compareAndCommit"), false);
  assert.equal(Object.hasOwn(composition, "getSnapshot"), false);
  assert.equal(Object.hasOwn(composition, "actionRegistry"), false);
}

{
  const { composition, commitEvents } = createHarness(10);
  const action = composition.inputPort.enumerateActions({ family: "scan" })[0];
  const opened = composition.inputPort.submitAction(action);
  assert.equal(opened.ok, true);
  assert.equal(composition.inspect().phase, "awaiting_input");
  assert.equal(composition.projection().state.match.value, 12, "同一 working root 立即消费顺序 Effect");
  assert.equal(composition.projection().state.meta.stateVersion, 0, "Decision 期间 committed version 不变");
  assert.equal(commitEvents(), 0);

  const staleQuick = composition.inputPort.enumerateActions({ family: "quick_trade" })[0];
  const quick = composition.inputPort.submitQuickAction(staleQuick);
  assert.equal(quick.ok, true);
  assert.equal(composition.inspect().phase, "awaiting_input");
  assert.equal(composition.projection().state.match.value, 19);

  const decision = composition.inspect().session.decision;
  const completed = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: decision.choices.find((choice) => choice.id === "right"),
  });
  assert.equal(completed.ok, true);
  assert.equal(composition.projection().state.match.value, 24);
  assert.equal(composition.projection().stateVersion, 1);
  assert.equal(commitEvents(), 1);
}

{
  const { composition, commitEvents } = createHarness(4);
  const legal = composition.inputPort.enumerateActions({ family: "launch" })[0];
  assert.equal(composition.lifecycle.newGame({ value: 8 }).ok, true);
  const before = JSON.stringify(composition.projection());
  const stale = composition.inputPort.submitAction(legal);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "STANDARD_ACTION_STALE");
  assert.equal(JSON.stringify(composition.projection()), before, "stale Action 必须零污染");
  assert.equal(commitEvents(), 0);
}

{
  const { composition } = createHarness(6);
  const saved = composition.lifecycle.save();
  assert.equal(saved.ok, true);
  assert.equal(saved.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(composition.lifecycle.newGame({ value: 99 }).ok, true);
  assert.equal(composition.lifecycle.restore(saved.envelope).ok, true);
  assert.equal(composition.projection().state.match.value, 6);
  assert.equal(composition.lifecycle.restore({ schemaVersion: "legacy-v0" }).code, "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED");
}

{
  let runtimeCreations = 0;
  const sharedRuntimeApi = {
    ...effectRuntimeApi,
    createRuntime(options) {
      runtimeCreations += 1;
      return effectRuntimeApi.createRuntime(options);
    },
  };
  const composition = createBrowserRuleComposition({
    stateStoreApi,
    effectRuntimeApi: sharedRuntimeApi,
    createInitialState: () => createState(0),
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    createActionRegistry() {
      const registry = createRegistry();
      return {
        enumerate(state, request = {}) {
          return request.family && request.family !== "research_tech"
            ? []
            : [{
              schemaVersion: "seti-standard-action-v1",
              family: "research_tech",
              phase: "main",
              actionId: `research_tech:default:${state.meta.stateVersion}`,
              actorId: "player-1",
              stateVersion: state.meta.stateVersion,
              decisionVersion: 0,
              target: { id: "default" },
              payload: {},
              summary: "research_tech",
            }];
        },
        validate(state, action) {
          const current = this.enumerate(state, { family: "research_tech" })[0];
          return current?.actionId === action?.actionId ? { ok: true } : registry.validate(state, action);
        },
      };
    },
    effectDomains: [{
      create: researchTechSession.createResearchTechRuntime,
      families: [researchTechSession.ACTION_FAMILY],
      options: {
        rotate(state) {
          state.match.rotation = (state.match.rotation || 0) + 1;
          return { ok: true, nextState: state };
        },
        listChoices: () => [{ tileId: "blue1" }],
        place(state, choice) {
          state.match.tech = choice.tileId;
          return { ok: true, nextState: state, placement: choice };
        },
        buildImmediateRewards: () => [],
        applyImmediateReward: (state) => ({ ok: true, nextState: state }),
      },
    }],
  });
  assert.equal(runtimeCreations, 1, "production Effect domain 必须注册进 composition 唯一 runtime");
  const action = composition.inputPort.enumerateActions({ family: "research_tech" })[0];
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  const decision = composition.inspect().session.decision;
  const completed = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: decision.choices[0],
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.phase, "completed");
  assert.equal(composition.projection().state.match.tech, "blue1");
  assert.equal(composition.projection().stateVersion, 1);
}

console.log("browser-rule-composition tests passed");
