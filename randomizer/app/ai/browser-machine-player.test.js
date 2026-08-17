"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createBrowserMachinePlayerPort,
} = require("./browser-bootstrap");

function makeComposition({ phase = "action", legalActions, currentPlayerId } = {}) {
  const action = legalActions && legalActions[0];
  return {
    inspect: () => ({
      phase,
      session: phase === "awaiting_input" ? { decision: { ownerId: action?.actorId || "p1" } } : null,
    }),
    lifecycle: { save: () => ({ ok: true, envelope: {} }) },
    inputPort: { enumerateActions: () => legalActions || [] },
    projection: () => ({ state: { phase, meta: { stateVersion: action?.stateVersion || 4 } } }),
    projectionSource: {
      read: () => ({
        source: { kind: "committed", stateVersion: action?.stateVersion || 4, phase },
        state: {
          match: {
            currentPlayerId: currentPlayerId !== undefined
              ? currentPlayerId
              : (action?.actorId ?? "p1"),
            decisionVersion: 2,
          },
        },
        decision: null,
      }),
    },
    counterfactualPort: { getDiagnostics: () => null },
    subscribe: () => () => {},
  };
}

function makeDecisionFunctionModule(decisionReturn) {
  return {
    createHeuristicDecisionFunction: (options) => {
      assert.equal(typeof options.composition.projection, "function");
      return {
        run: (boundary) => decisionReturn(boundary),
        getProvenance: () => ({ type: "heuristic", version: "test-v1" }),
      };
    },
  };
}

function makeCoordinatorModule({ runDecisionResult }) {
  const calls = { registered: [], decisions: 0, executes: 0 };
  const api = {
    currentDecisionId: null,
    setDecisionId: (id) => { api.currentDecisionId = id; },
    createMachinePlayerCoordinator: (options) => {
      assert.equal(typeof options.execute, "function");
      assert.equal(typeof options.recordStep, "function"); // browser recordStep 空操作
      return {
        readBoundary: (seatId) => ({
          seatId: seatId || "p1",
          phase: api.currentDecisionId ? "awaiting_input" : "action",
          sessionDecision: api.currentDecisionId
            ? { decisionId: api.currentDecisionId }
            : null,
          legalActions: [{ actionId: "pass:p1", actorId: "p1", stateVersion: 4, decisionVersion: 2 }],
          observation: { schemaVersion: "seti-decision-observation-v2" },
        }),
        hasSeat: (seatId) => calls.registered.includes(seatId),
        registerSeat: (seatId, fn) => {
          assert.equal(typeof fn, "function");
          calls.registered.push(seatId);
        },
        runDecision: (seatId, runOptions) => {
          calls.decisions += 1;
          calls.executes += 1;
          const outcome = runDecisionResult({ seatId, runOptions });
          const action = { actionId: outcome.actionId, actorId: seatId };
          options.execute(action);
          options.recordStep(action, { ok: true }, { seatId });
          return outcome;
        },
        resetPlans: () => {},
      };
    },
    calls,
  };
  return api;
}

function makePort(options = {}) {
  const coordinatorModule = makeCoordinatorModule({
    runDecisionResult: options.runDecisionResult || (({ seatId }) => ({
      seatId,
      actionId: "pass:p1",
      source: "scheme",
      decision: { decision: { actionId: "pass:p1" }, actionOutcomes: [] },
      plan: null,
    })),
  });
  const inputAdapter = {
    dispatched: [],
    decisions: [],
    dispatchAction: (action) => {
      inputAdapter.dispatched.push(action);
      return { ok: true };
    },
    submitDecision: (submission) => {
      inputAdapter.decisions.push(submission);
      return { ok: true };
    },
  };
  const port = createBrowserMachinePlayerPort({
    ruleComposition: options.composition || makeComposition(),
    machinePlayerCoordinatorModule: coordinatorModule,
    heuristicDecisionFunctionModule: makeDecisionFunctionModule(options.decisionReturn || (() => ({ actionId: "pass:p1" }))),
    inputAdapter,
    isMachineSeat: options.isMachineSeat || (() => true),
    machineConfig: options.machineConfig || {},
  });
  return { port, coordinatorModule, inputAdapter };
}

(async () => {
  // 1) 缺 seat：BROWSER_MACHINE_SEAT_MISSING
  {
    const { port } = makePort({
      composition: makeComposition({ legalActions: [], currentPlayerId: null }),
    });
    const result = await port.runOnce();
    assert.equal(result.ok, false);
    assert.equal(result.code, "BROWSER_MACHINE_SEAT_MISSING");
  }

  // 2) 非机器席位：BROWSER_MACHINE_SEAT_NOT_CONTROLLED
  {
    const { port } = makePort({ isMachineSeat: () => false });
    const result = await port.runOnce();
    assert.equal(result.ok, false);
    assert.equal(result.code, "BROWSER_MACHINE_SEAT_NOT_CONTROLLED");
  }

  // 3) 机器席位走协调器：注册决策函数、execute 提交共享 input port、返回决策形状
  {
    const legalActions = [{
      actionId: "pass:p1", actorId: "p1", family: "pass", phase: "main",
      schemaVersion: "seti-standard-action-v1", stateVersion: 4, decisionVersion: 2,
    }];
    const { port, coordinatorModule, inputAdapter } = makePort({
      composition: makeComposition({ legalActions }),
      machineConfig: { unifiedSearch: true },
    });
    const result = await port.runOnce();
    assert.equal(result.ok, true);
    assert.equal(result.actionId, "pass:p1");
    assert.equal(result.source, "scheme");
    assert.equal(result.policyDecision.actionId, "pass:p1");
    assert.equal(coordinatorModule.calls.registered.includes("p1"), true);
    assert.equal(coordinatorModule.calls.executes, 1);
    assert.equal(inputAdapter.dispatched.length, 1);
    assert.equal(inputAdapter.dispatched[0].actionId, "pass:p1");
    assert.equal(inputAdapter.decisions.length, 0);
  }

  // 4) 同 decision version 去重：MACHINE_POLICY_DUPLICATE_SUBMISSION
  {
    const legalActions = [{
      actionId: "pass:p1", actorId: "p1", family: "pass", phase: "main",
      schemaVersion: "seti-standard-action-v1", stateVersion: 4, decisionVersion: 2,
    }];
    const { port, coordinatorModule } = makePort({ composition: makeComposition({ legalActions }) });
    const first = await port.runOnce();
    assert.equal(first.ok, true);
    const second = await port.runOnce();
    assert.equal(second.ok, false);
    assert.equal(second.code, "MACHINE_POLICY_DUPLICATE_SUBMISSION");
    assert.equal(coordinatorModule.calls.decisions, 1);
  }

  // 4b) setup 内同 stateVersion/decisionVersion 但 decisionId 不同的 choice
  //     不得误判重复（旧 Host authorityKey = kind:decisionId 语义）
  {
    const legalActions = [{
      actionId: "select:p1", actorId: "p1", family: "choose_card", phase: "conditional",
      schemaVersion: "seti-standard-action-v1", stateVersion: 1, decisionVersion: 0,
    }];
    const { port, coordinatorModule } = makePort({ composition: makeComposition({ legalActions }) });
    coordinatorModule.setDecisionId("setup-d1");
    const first = await port.runOnce();
    assert.equal(first.ok, true);
    coordinatorModule.setDecisionId("setup-d2");
    const second = await port.runOnce();
    assert.equal(second.ok, true, "decisionId 变化不得触发去重");
    const third = await port.runOnce();
    assert.equal(third.ok, false, "同一 decisionId 重复才触发去重");
    assert.equal(third.code, "MACHINE_POLICY_DUPLICATE_SUBMISSION");
    assert.equal(coordinatorModule.calls.decisions, 2);
  }

  // 5) awaiting_input 边界走 submitDecision（与人类共用 Decision 端口）
  {
    const legalActions = [{
      actionId: "discard:p1", actorId: "p1", family: "discard", phase: "conditional",
      schemaVersion: "seti-standard-action-v1", stateVersion: 5, decisionVersion: 3,
    }];
    const composition = makeComposition({ phase: "awaiting_input", legalActions });
    composition.inspect = () => ({
      phase: "awaiting_input",
      session: { decision: { ownerId: "p1", decisionId: "d1", decisionVersion: 3 } },
    });
    const { port, inputAdapter } = makePort({
      composition,
      runDecisionResult: ({ seatId }) => ({
        seatId,
        actionId: "discard:p1",
        source: "scheme",
        decision: { decision: { actionId: "discard:p1" }, actionOutcomes: [] },
        plan: null,
      }),
    });
    const result = await port.runOnce();
    assert.equal(result.ok, true);
    assert.equal(inputAdapter.decisions.length, 1);
    assert.equal(inputAdapter.decisions[0].decisionId, "d1");
    assert.equal(inputAdapter.decisions[0].choice.actionId, "discard:p1");
    assert.equal(inputAdapter.dispatched.length, 0);
  }

  // 6) invalidate：generation 递增、清去重键；决策函数在首个 runOnce 时重建
  {
    const legalActions = [{
      actionId: "pass:p1", actorId: "p1", family: "pass", phase: "main",
      schemaVersion: "seti-standard-action-v1", stateVersion: 6, decisionVersion: 1,
    }];
    const { port, coordinatorModule } = makePort({ composition: makeComposition({ legalActions }) });
    await port.runOnce();
    const invalidation = port.invalidate("lifecycle");
    assert.equal(invalidation.ok, true);
    assert.equal(invalidation.generation, 1);
    const again = await port.runOnce();
    assert.equal(again.ok, true);
    assert.equal(coordinatorModule.calls.decisions, 2);
  }

  // 7) 源码级：Browser 机器席位不再包含第二份搜索拷贝与旧 Host 装配
  {
    const source = fs.readFileSync(path.join(__dirname, "browser-bootstrap.js"), "utf8");
    for (const forbidden of [
      "requiresRootCounterfactual",
      "selectSecondaryAgentRootActions",
      "createPolicyInputAdapter",
      "policyInputAdapterModule",
      "readActionOutcomes",
    ]) {
      assert.equal(source.includes(forbidden), false, `browser-bootstrap 不应再包含 ${forbidden}`);
    }
    for (const required of [
      "createMachinePlayerCoordinator",
      "createHeuristicDecisionFunction",
      "recordStep",
    ]) {
      assert.equal(source.includes(required), true, `browser-bootstrap 应包含 ${required}`);
    }
  }

  console.log("browser machine player tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
