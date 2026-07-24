"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const browserRuleComposition = require("./browser-rule-composition");
const stateStoreApi = require("../game/state/state-store");
const effectRuntimeApi = require("../game/effects/session-runtime");
const researchTechSession = require("../game/effects/research-tech-session");
const standardAction = require("../game/actions/standard-action");
const quickTurnActionExecutor = require("./quick-turn-action-executor");
const { createRuleComposition, SAVE_SCHEMA_VERSION } = require("../game/rule-composition");

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

function createTestEffectDomain(families, createEffectGroup, executors = {}) {
  return {
    families,
    create({ runtime }) {
      for (const [type, executor] of Object.entries(executors)) runtime.registerExecutor(type, executor);
      return { createEffectGroup };
    },
  };
}

function createHarness(initialValue = 0) {
  let commitEvents = 0;
  const composition = createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (options) => createState(options.value ?? initialValue),
    projectState: (state) => ({
      match: structuredClone(state.match),
      meta: { stateVersion: state.meta.stateVersion },
    }),
    effectDomains: [createTestEffectDomain(["launch", "scan", "quick_trade"], (_state, action) => {
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
    }, {
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
    })],
  });
  composition.subscribe((event) => {
    if (event.source === "committed") commitEvents += 1;
  });
  return { composition, commitEvents: () => commitEvents };
}

function createForkableHarness() {
  function create() {
    return createRuleComposition({
      stateStoreApi,
      effectRuntimeApi,
      createActionRegistry: createRegistry,
      createInitialState: () => createState(0),
      projectState: (state) => ({
        match: structuredClone(state.match),
        meta: { stateVersion: state.meta.stateVersion },
      }),
      effectDomains: [createTestEffectDomain(["launch", "scan", "quick_trade"], (_state, action) => ({
        effects: [{ type: "add", payload: { amount: action.family === "scan" ? 2 : 1 } }],
      }), {
        add(state, effect) {
          state.match.value += effect.payload.amount;
          return { ok: true, nextState: state };
        },
      })],
      createCounterfactualFork(envelope) {
        const fork = create();
        const restored = fork.lifecycle.restore(envelope);
        assert.equal(restored.ok, true);
        return fork;
      },
    });
  }
  return create();
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
  const composition = createForkableHarness();
  const actions = composition.inputPort.enumerateActions()
    .filter((action) => action.family !== "quick_trade");
  const before = composition.lifecycle.save().envelope;
  const outcomes = composition.counterfactualPort.evaluate(actions);
  const reversed = composition.counterfactualPort.evaluate([...actions].reverse());
  assert.deepEqual(
    outcomes.map((outcome) => [outcome.actionId, outcome.leaves[0].observation.match.value]),
    reversed.map((outcome) => [outcome.actionId, outcome.leaves[0].observation.match.value]),
    "候选枚举顺序不得改变任一真实执行 outcome",
  );
  assert.deepEqual(composition.lifecycle.save().envelope, before,
    "执行全部 fork 后 canonical state/RNG/session/journal/history/replay 必须不变");
  assert.equal(outcomes.find((outcome) => outcome.actionId.startsWith("scan")).leaves[0].observation.match.value, 2);
  assert.equal(outcomes.find((outcome) => outcome.actionId.startsWith("launch")).leaves[0].observation.match.value, 1);
}

{
  const parityFamilies = [
    "orbit",
    "place_data",
    "research_tech",
    "play_card",
    "scan",
    "launch",
    "move",
    "pass",
    "analyze",
  ];
  const familyAmount = Object.freeze(Object.fromEntries(
    parityFamilies.map((family, index) => [family, index + 1]),
  ));
  function createParityComposition() {
    function parityRegistry() {
      return {
        enumerate(state, request = {}) {
          return (request.family ? [request.family] : parityFamilies).map((family) => ({
            schemaVersion: "seti-standard-action-v1",
            family,
            phase: family === "place_data" ? "quick" : "main",
            actionId: `${family}:parity:${state.meta.stateVersion}`,
            actorId: "player-1",
            stateVersion: state.meta.stateVersion,
            decisionVersion: 0,
            target: { kind: `${family}-target` },
            payload: {},
            summary: family,
          }));
        },
        validate(state, action) {
          const fresh = this.enumerate(state, { family: action?.family })[0];
          return fresh?.actionId === action?.actionId
            ? { ok: true }
            : { ok: false, code: "STANDARD_ACTION_STALE" };
        },
      };
    }
    const composition = createRuleComposition({
      stateStoreApi,
      effectRuntimeApi,
      createActionRegistry: parityRegistry,
      createInitialState: () => createState(0),
      projectState: (state) => ({
        match: structuredClone(state.match),
        meta: { stateVersion: state.meta.stateVersion },
      }),
      effectDomains: [createTestEffectDomain(parityFamilies, (_state, action) => ({
        effects: [
          { type: "parity_add", payload: { amount: familyAmount[action.family] } },
          ...(action.family === "analyze" ? [{
            type: "parity_blue_trace",
            kind: "decision",
            ownerId: "player-1",
            payload: {
              choices: [
                {
                  id: "alien-1-blue",
                  actionId: "choose_target:alien-1-blue",
                  family: "choose_target",
                  phase: "conditional",
                  amount: 3,
                },
                {
                  id: "alien-2-blue",
                  actionId: "choose_target:alien-2-blue",
                  family: "choose_target",
                  phase: "conditional",
                  amount: 5,
                },
              ],
            },
          }] : []),
        ],
      }), {
        parity_add(state, effect) {
          state.match.value += effect.payload.amount;
          return { ok: true, nextState: state };
        },
        parity_blue_trace: {
          getLegalChoices(_state, effect) { return effect.payload.choices; },
          resolveDecision(state, _effect, choice) {
            state.match.value += choice.amount;
            state.match.blueTraceChoice = choice.id;
            return { ok: true, nextState: state };
          },
        },
      })],
      createCounterfactualFork(envelope) {
        const fork = createParityComposition();
        assert.equal(fork.lifecycle.restore(envelope).ok, true);
        return fork;
      },
    });
    return composition;
  }

  const sandbox = createParityComposition();
  const root = sandbox.lifecycle.save().envelope;
  const actions = sandbox.inputPort.enumerateActions();
  const outcomes = sandbox.counterfactualPort.evaluate(actions);
  assert.deepEqual(sandbox.lifecycle.save().envelope, root,
    "动作族 parity 矩阵执行后必须保持 canonical root 不变");
  for (const action of actions) {
    const outcome = outcomes.find((candidate) => candidate.actionId === action.actionId);
    assert.equal(outcome.status, "settled", `${action.family} 必须得到 settled outcome`);
    const directLeaves = [];
    if (action.family === "analyze") {
      for (const expectedChoiceId of ["alien-1-blue", "alien-2-blue"]) {
        const direct = createParityComposition();
        assert.equal(direct.inputPort.submitAction(
          direct.inputPort.enumerateActions({ family: action.family })[0],
        ).ok, true);
        const decision = direct.inspect().session.decision;
        assert.equal(decision.decisionKind, "parity_blue_trace");
        const choice = decision.choices.find((candidate) => candidate.id === expectedChoiceId);
        assert.equal(direct.inputPort.submitDecision({
          decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion,
          ownerId: decision.ownerId,
          choice,
        }).ok, true);
        directLeaves.push(direct.projection().state);
      }
      assert.equal(outcome.leaves.every((leaf) => leaf.actionChain.length === 2), true,
        "analyze -> blue trace 必须展开完整标准 Decision 链");
    } else {
      const direct = createParityComposition();
      const directAction = direct.inputPort.enumerateActions({ family: action.family })[0];
      assert.equal(direct.inputPort.submitAction(directAction).ok, true);
      directLeaves.push(direct.projection().state);
    }
    assert.deepEqual(
      outcome.leaves.map((leaf) => leaf.observation.match).sort((left, right) => left.value - right.value),
      directLeaves.map((leaf) => leaf.match).sort((left, right) => left.value - right.value),
      `${action.family} 沙箱 leaf 必须等于同根直接标准提交`,
    );
  }
}

{
  const { composition, commitEvents } = createHarness(10);
  const action = composition.inputPort.enumerateActions({ family: "scan" })[0];
  const opened = composition.inputPort.submitAction(action);
  assert.equal(opened.ok, true);
  assert.equal(opened.journal.actions.length, 1, "活跃 Session 输入结果必须携带冻结 journal 快照");
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
    ownerId: decision.ownerId,
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
  const composition = createRuleComposition({
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
    ownerId: decision.ownerId,
    choice: decision.choices[0],
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.phase, "completed");
  assert.equal(composition.projection().state.match.tech, "blue1");
  assert.equal(composition.projection().stateVersion, 1);
}

{
  let composition = null;
  let unsafeCheckpoint = null;
  composition = createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: () => createState(0),
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    effectDomains: [createTestEffectDomain(["launch", "scan", "quick_trade"],
      () => ({ effects: [{ type: "checkpoint_probe" }] }), {
      checkpoint_probe(state) {
        unsafeCheckpoint = composition.lifecycle.save();
        state.match.value += 1;
        return { ok: true, nextState: state };
      },
      })],
  });
  const action = composition.inputPort.enumerateActions({ family: "launch" })[0];
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  assert.equal(unsafeCheckpoint.ok, false, "执行中的 unsafe checkpoint 不得伪装成成功存档");
  assert.equal(unsafeCheckpoint.code, "EFFECT_CHECKPOINT_UNSAFE_PHASE");
}

{
  let commitEvents = 0;
  const replace = (target, source) => {
    for (const key of Reflect.ownKeys(target)) delete target[key];
    Object.assign(target, structuredClone(source));
  };
  const composition = createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (_options, workingState) => structuredClone(workingState),
    stateAdapter: {
      createWorkingState: () => createState(0),
      createCommittedState: (workingState, committedState) => ({
        ...structuredClone(workingState),
        meta: structuredClone(committedState.meta),
      }),
      createProjectionState: (workingState) => structuredClone(workingState),
      restoreWorkingState: replace,
    },
    executeOwnerInput(workingState, command) {
      if (command.kind !== "increment") return { ok: false, code: "UNKNOWN" };
      workingState.match.value += command.amount;
      return { ok: true, amount: command.amount };
    },
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    effectDomains: [createTestEffectDomain(["launch", "scan", "quick_trade"],
      () => ({ effects: [{ type: "noop" }] }),
      { noop: (state) => ({ ok: true, nextState: state }) })],
  });
  composition.stateSourcePort.subscribe(() => { commitEvents += 1; });
  const source = composition.stateSourcePort.read({ viewerId: "test", role: "spectator" });
  assert.equal(source.state.match.value, 0, "只读 StateSource 必须投影 Composition working state");
  assert.equal(Object.isFrozen(source), true, "StateSource envelope 必须冻结");
  assert.equal(Object.hasOwn(composition, "getWorkingState"), false, "Composition 不得公开 mutable working root accessor");
  const before = composition.projection();
  composition.inputPort.enumerateActions({ family: "launch" });
  assert.deepEqual(composition.projection(), before, "枚举必须保持 committed projection 不变");
  assert.equal(commitEvents, 0, "枚举不得隐式 compare-and-commit");
  const commandResult = composition.inputPort.submitOwnerInput({ kind: "increment", amount: 4 });
  assert.equal(commandResult.ok, true);
  assert.equal(commandResult.stateVersion, 1);
  assert.equal(composition.stateSourcePort.read().state.match.value, 4);
  assert.equal(commitEvents, 1, "宿主命令必须由 composition 统一执行一次 CAS");
  const rejected = composition.inputPort.submitOwnerInput({ kind: "unknown", amount: 99 });
  assert.equal(rejected.ok, false);
  assert.equal(composition.stateSourcePort.read().state.match.value, 4, "失败宿主命令必须零污染");
}

{
  let commitEvents = 0;
  let composition = null;
  let outerArgument = null;
  let nestedArgument = null;
  const replace = (target, source) => {
    for (const key of Reflect.ownKeys(target)) delete target[key];
    Object.assign(target, structuredClone(source));
  };
  composition = createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (_options, workingState) => structuredClone(workingState),
    stateAdapter: {
      createWorkingState: () => createState(0),
      createCommittedState: (workingState, committedState) => ({
        ...structuredClone(workingState),
        meta: structuredClone(committedState.meta),
      }),
      createProjectionState: (workingState) => structuredClone(workingState),
      restoreWorkingState: replace,
    },
    executeOwnerInput(workingState, command) {
      if (command.kind === "outer") {
        outerArgument = { owner: workingState.match };
        const nested = composition.inputPort.submitOwnerInput({ kind: "nested", argument: outerArgument });
        return nested.ok ? { ok: true } : nested;
      }
      if (command.kind === "nested") {
        nestedArgument = command.argument;
        assert.equal(nestedArgument, outerArgument, "嵌套命令不得克隆同一事务内的 capability 参数");
        assert.equal(nestedArgument.owner, workingState.match, "嵌套命令必须复用同一 working candidate identity");
        workingState.match.value += 3;
        return { ok: true };
      }
      return { ok: false, code: "UNKNOWN" };
    },
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    effectDomains: [createTestEffectDomain(["launch", "scan", "quick_trade"],
      () => ({ effects: [{ type: "noop" }] }),
      { noop: (state) => ({ ok: true, nextState: state }) })],
  });
  composition.stateSourcePort.subscribe(() => { commitEvents += 1; });
  const result = composition.inputPort.submitOwnerInput({ kind: "outer" });
  assert.equal(result.ok, true);
  assert.equal(composition.stateSourcePort.read().state.match.value, 3);
  assert.equal(commitEvents, 1, "嵌套宿主命令只允许由最外层 composition 执行一次 CAS");
}

{
  const composition = createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (_options, workingState) => structuredClone(workingState),
    stateAdapter: {
      createWorkingState: () => createState(0),
      createCommittedState: (workingState, committedState) => ({
        ...structuredClone(workingState),
        meta: structuredClone(committedState.meta),
      }),
      createProjectionState: (workingState) => structuredClone(workingState),
      createSavedState: (committedState, _workingState, saveOptions) => ({
        ...structuredClone(committedState),
        meta: { ...structuredClone(committedState.meta), rngState: structuredClone(saveOptions.rngState) },
      }),
      restoreWorkingState(target, source) {
        for (const key of Reflect.ownKeys(target)) delete target[key];
        Object.assign(target, structuredClone(source));
      },
    },
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    effectDomains: [createTestEffectDomain(["launch", "scan", "quick_trade"], () => ({
      effects: [{
        type: "choose",
        kind: "decision",
        ownerId: "player-1",
        payload: { choices: [{ id: "left", amount: 1 }] },
      }],
    }), {
      choose: {
        getLegalChoices(_state, effect) { return effect.payload.choices; },
        resolveDecision(state) { return { ok: true, nextState: state }; },
      },
    })],
  });
  const action = composition.inputPort.enumerateActions({ family: "scan" })[0];
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  assert.equal(composition.inspect().phase, "awaiting_input");
  const saved = composition.lifecycle.save({ rngState: { algorithm: "test", state: 7 } });
  assert.equal(JSON.parse(saved.envelope.committedState).meta.rngState.state, 7,
    "活跃 Session 存档必须装饰 committed meta，且不得泄漏 working state");
}

{
  const replace = (target, source) => {
    for (const key of Reflect.ownKeys(target)) delete target[key];
    Object.assign(target, structuredClone(source));
  };
  const composition = createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (_options, workingState) => structuredClone(workingState),
    stateAdapter: {
      createWorkingState() {
        const state = createState(12);
        state.solarSystem.rootPoison = "canonical-root-must-not-escape";
        return state;
      },
      createCommittedState: (workingState, committedState) => ({
        ...structuredClone(workingState),
        meta: structuredClone(committedState.meta),
      }),
      restoreWorkingState: replace,
    },
    readModels: {
      matchSummary: (workingRoot) => ({ value: workingRoot.match.value }),
    },
    projectState: (state) => ({ match: structuredClone(state.match) }),
    effectDomains: [createTestEffectDomain(["launch", "scan", "quick_trade"],
      () => ({ effects: [{ type: "noop" }] }),
      { noop: (state) => ({ ok: true, nextState: state }) })],
  });
  assert.equal(Object.hasOwn(composition, "stateSourcePort"), false,
    "未显式提供 canonical projection adapter 时不得暴露完整 root port");
  assert.deepEqual(composition.readModelPort.read("matchSummary"), { value: 12 });
  assert.equal(composition.readModelPort.read("matchSummary").rootPoison, undefined,
    "窄 read model 不得携带 canonical root poison");
  assert.equal(Object.isFrozen(composition.readModelPort.read("matchSummary")), true);
  assert.throws(() => composition.readModelPort.read("canonicalRoot"), /未注册 read model/);
}

{
  assert.equal(
    quickTurnActionExecutor.ACTION_FAMILIES.includes("quick_trade"),
    false,
    "Browser legacy Quick/Turn executor 不得继续声明 quick_trade family",
  );
  const legacyQuickTurnSource = [
    quickTurnActionExecutor.createQuickTurnActionExecutor,
    quickTurnActionExecutor.createQuickTradeFlow,
  ].map((factory) => factory.toString()).join("\n");
  for (const forbiddenSource of [
    "executeQuickTrade",
    "excludeFamilies",
    "quickTrades.executeTrade",
    "options.workingRoot",
  ]) {
    assert.equal(
      legacyQuickTurnSource.includes(forbiddenSource),
      false,
      `Browser legacy quick_trade executor 残留禁用实现: ${forbiddenSource}`,
    );
  }
  assert.equal(
    fs.readFileSync(require.resolve("./action-runtime"), "utf8")
      .includes('excludeFamilies: ["quick_trade"]'),
    false,
    "Browser Standard Action adapter 不得保留 quick_trade exclude 配置",
  );
  const dispatched = [];
  const quickTradeFlow = quickTurnActionExecutor.createQuickTradeFlow({
    dispatchRuleInput(input) {
      dispatched.push(input);
      return { ok: true };
    },
  });
  assert.equal(quickTradeFlow.runQuickTrade("credits-for-energy", { workingRoot: {} }).ok, true);
  assert.deepEqual(dispatched, [{
    kind: "standard_intent",
    family: "quick_trade",
    selector: { tradeId: "credits-for-energy" },
  }], "Browser quick_trade UI 壳只能提交公共 standard_intent");
}

{
  let captured = null;
  const adapter = {
    createWorkingState: () => ({ match: {}, turn: {}, meta: {} }),
    restoreWorkingState() {},
    validateSessionBoundary: () => ({ ok: true }),
  };
  const composition = browserRuleComposition.createBrowserRuleComposition({
    ruleCompositionApi: {
      createRuleComposition(options) {
        captured = options;
        return {
          options,
          projection: (viewer) => ({
            stateVersion: 7,
            state: options.projectState({
              match: { value: 9 },
              rootPoison: "must-not-cross-browser-boundary",
            }, viewer),
          }),
        };
      },
    },
    stateStoreApi: { SCHEMA_VERSION: 3 },
    highCouplingState: {
      createHighCouplingStateStore: () => ({}),
      purifyHighCouplingSlices: (state) => state,
    },
    initialGameState: {
      createCommittedCandidate: (workingState, metadata, schemaVersion, stateVersion) => ({
        match: structuredClone(workingState.match),
        meta: { ...metadata, schemaVersion, stateVersion },
      }),
    },
    workingStateAdapter: adapter,
    getCommittedContext: () => ({ seed: "browser-seed" }),
    effectRuntimeApi: {},
    runWithWorkingState: (_root, operation) => operation(),
    executeOwnerInput: () => ({ ok: true }),
    initialSetupSource: require("../game/production-composition").createInitialSetupSource(),
    productionRules: { quickTrades: require("../game/actions/quick-trades") },
    browserProjection: {
      visibilityPolicy: (state) => ({
        match: structuredClone(state.match),
        hasRootPoison: Object.hasOwn(state, "rootPoison"),
      }),
      getFinalReadModelOwner: () => ({ project: () => ({ final: true }) }),
      getBrowserReadModelOwner: () => ({ project: () => ({ browser: true }) }),
      createRenderPresentation: () => ({}),
    },
  });
  assert.equal(composition.options, captured);
  assert.equal(
    composition.productionDomainPackId,
    require("../game/production-composition").PACK_ID,
    "Browser 必须由 game 层 Production Domain Pack 创建",
  );
  assert.equal(
    composition.productionActionOwners.quick_trade,
    `${require("../game/production-composition").PACK_ID}:quick_trade`,
    "Browser quick_trade 必须由 game pack 拥有",
  );
  assert.equal(
    composition.productionActionExecutorOwners.quick_trade,
    require("../game/production-composition").QUICK_TRADE_EXECUTOR_ID,
    "Browser quick_trade 必须命中 game-owned executor",
  );
  assert.equal(captured.invariantValidators[0], adapter.validateSessionBoundary);
  assert.deepEqual(
    captured.effectDomains.flatMap((domain) => domain.families).sort(),
    [...standardAction.ALL_FAMILIES].sort(),
    "Browser 必须由 production Domain Pack 安装全部 Standard Action family",
  );
  assert.equal(
    captured.effectDomains.find((domain) => domain.families.includes("play_card")).id,
    require("../game/cards/play-domain").DOMAIN_ID,
    "play_card 必须由独立 game-owned Card Play Domain 唯一拥有",
  );
  const initial = captured.createInitialState({}, { match: {}, turn: {} });
  assert.equal(initial.meta.seed, "browser-seed");
  assert.equal(initial.meta.schemaVersion, 3);
  assert.equal(captured.projectWorkingState, true);
  assert.deepEqual(captured.projectState({
    match: { a: 1 },
    playerState: {}, turnState: {}, solarState: {}, rocketState: {}, planetStatsState: {},
    nebulaDataState: {}, cardState: {}, techGameState: {}, alienGameState: {}, finalScoringState: {},
    rootPoison: "secret",
  }, null, null, { stateVersion: 2 }), {
    match: { a: 1 },
    hasRootPoison: false,
    resident: { finalReadModel: { final: true }, browserReadModel: { browser: true } },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(composition, "stateSourcePort"), false,
    "Browser composition 不得暴露 canonical root state source");
  assert.deepEqual(composition.projectionSource.read().state, {
    match: { value: 9 },
    hasRootPoison: false,
    resident: { finalReadModel: { final: true }, browserReadModel: { browser: true } },
  },
    "Browser projection source 必须只返回显式投影，语义 poison 不得越界");
  assert.equal(composition.projectionSource.read().state.rootPoison, undefined);
}

console.log("rule-composition tests passed");
