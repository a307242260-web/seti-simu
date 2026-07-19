"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const researchTechSession = require("./research-tech-session");

function createCommittedState(overrides = {}) {
  return {
    version: 7,
    rotation: 0,
    actorId: "p2",
    publicity: 8,
    legalTechs: ["orange1"],
    placedTechs: [],
    data: 0,
    score: 0,
    trace: [],
    ...structuredClone(overrides),
  };
}

function createAdapter(api = researchTechSession, options = {}) {
  const calls = {
    rotate: 0,
    listChoices: 0,
    place: 0,
    reward: 0,
    legacyQueue: 0,
    legacyContinuation: 0,
  };
  let authority = createCommittedState(options.state);
  const facade = api.createResearchTechRuntime({
    readCommittedState: () => authority,
    rotate(state) {
      calls.rotate += 1;
      state.rotation += 1;
      state.legalTechs = ["purple1", "blue2"];
      state.trace.push("rotate");
      return {
        ok: true,
        nextState: state,
        events: [{ type: "solarRotated", rotation: state.rotation }],
        log: { type: "rotate", rotation: state.rotation },
      };
    },
    listChoices(state) {
      calls.listChoices += 1;
      assert.equal(state.rotation, 1, "DecisionEffect 必须读取旋转后的 workingState");
      return state.legalTechs.map((tileId) => ({ tileId }));
    },
    place(state, choice) {
      calls.place += 1;
      assert.equal(state.rotation, 1, "放置必须读取旋转后的 workingState");
      assert.ok(state.legalTechs.includes(choice.tileId));
      state.publicity -= 6;
      state.placedTechs.push(choice.tileId);
      state.trace.push(`place:${choice.tileId}`);
      return {
        ok: true,
        nextState: state,
        placement: { tileId: choice.tileId },
        events: [{ type: "researchTechPlaced", tileId: choice.tileId }],
        log: { type: "place", tileId: choice.tileId },
      };
    },
    buildImmediateRewards(state, placement) {
      assert.deepEqual(state.placedTechs, [placement.placement.tileId]);
      return placement.placement.tileId === "purple1"
        ? [{ kind: "data", amount: 2 }, { kind: "score", amount: 3 }]
        : [];
    },
    applyImmediateReward(state, reward) {
      calls.reward += 1;
      if (options.failReward === reward.kind) throw new Error(`reward failed: ${reward.kind}`);
      state[reward.kind] += reward.amount;
      state.trace.push(`reward:${reward.kind}:${reward.amount}`);
      return {
        ok: true,
        nextState: state,
        events: [{ type: "researchTechImmediateReward", ...reward }],
        log: { type: "reward", ...reward },
      };
    },
  });
  return {
    ...facade,
    calls,
    getAuthority: () => authority,
    setAuthority: (next) => { authority = next; },
  };
}

function dispatchAndReachDecision(harness) {
  const committed = harness.getAuthority();
  const dispatched = harness.dispatch(committed, {
    family: "research_tech",
    actorId: "p2",
    actionId: "research-tech:fixed",
  }, { sessionId: "research-tech-fixed" });
  assert.equal(dispatched.ok, true);
  assert.equal(dispatched.session.queue.length, 2);
  assert.equal(dispatched.session.committedState, null);

  const rotation = harness.advance(dispatched.session);
  assert.equal(rotation.ok, true);
  assert.equal(dispatched.session.queue.length, 1);
  assert.equal(dispatched.session.committedState, null, "queue 未清空不得 commit");

  const decisionResult = harness.advance(dispatched.session);
  assert.equal(decisionResult.ok, true);
  assert.equal(dispatched.session.phase, "awaiting_input");
  assert.equal(decisionResult.decision.ownerId, "p2");
  assert.deepEqual(decisionResult.decision.choices, [{ tileId: "purple1" }, { tileId: "blue2" }]);
  assert.equal(dispatched.session.committedState, null, "DecisionEffect 等待输入时不得 commit");
  return { committed, session: dispatched.session, decision: decisionResult.decision };
}

function runFixedTrace(api = researchTechSession) {
  const harness = createAdapter(api);
  const { committed, session, decision } = dispatchAndReachDecision(harness);
  const resolved = harness.resolveDecision(session, {
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: { tileId: "purple1" },
  });
  assert.equal(resolved.ok, true);
  assert.equal(session.queue[0].type, api.EFFECT_TYPES.PLACE);
  assert.equal(session.committedState, null, "选择完成但放置未执行时不得 commit");

  const placement = harness.advance(session);
  assert.equal(placement.ok, true);
  assert.equal(session.queue.length, 2);
  assert.equal(session.committedState, null, "即时奖励未清空时不得 commit");

  const firstReward = harness.advance(session);
  assert.equal(firstReward.ok, true);
  assert.equal(session.queue.length, 1);
  assert.equal(session.committedState, null, "仍有即时奖励时不得 commit");

  const completed = harness.drain(session);
  assert.equal(completed.ok, true);
  assert.equal(session.phase, "completed");
  assert.deepEqual(session.committedState.trace, [
    "rotate",
    "place:purple1",
    "reward:data:2",
    "reward:score:3",
  ]);
  assert.deepEqual(committed, createCommittedState(), "session 不得提前污染权威输入");
  assert.deepEqual(harness.calls, {
    rotate: 1,
    listChoices: 2,
    place: 1,
    reward: 2,
    legacyQueue: 0,
    legacyContinuation: 0,
  });
  return {
    inspection: harness.inspect(session),
    committedState: session.committedState,
    journal: session.journal,
  };
}

(function testResearchTechReferenceChain() {
  runFixedTrace();
})();

(function testFailureRollsBackWholeResearchChain() {
  const harness = createAdapter(researchTechSession, { failReward: "score" });
  const { committed, session, decision } = dispatchAndReachDecision(harness);
  harness.resolveDecision(session, {
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: { tileId: "purple1" },
  });
  const failed = harness.drain(session);
  assert.equal(failed.code, "EFFECT_EXECUTOR_THROWN");
  assert.equal(session.phase, "aborted");
  assert.deepEqual(session.workingState, committed);
  assert.equal(session.committedState, null);
})();

(function testWrongFamilyFailsClosed() {
  const harness = createAdapter();
  const result = harness.dispatch(harness.getAuthority(), { family: "scan", actorId: "p2" });
  assert.equal(result.code, "RESEARCH_TECH_ACTION_FAMILY_INVALID");
  assert.equal(result.session.phase, "aborted");
})();

(function testBrowserAndNodeHostFixedTraceParity() {
  const context = vm.createContext({
    console,
    structuredClone,
    globalThis: null,
  });
  context.globalThis = context;
  for (const file of ["session-runtime.js", "research-tech-session.js"]) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }
  const browserTrace = JSON.parse(JSON.stringify(runFixedTrace(context.SetiResearchTechSession)));
  const nodeTrace = JSON.parse(JSON.stringify(runFixedTrace(researchTechSession)));
  assert.deepEqual(browserTrace, nodeTrace);
})();

(function testMigratedHotPathHasNoLegacyQueueOrContinuation() {
  const source = fs.readFileSync(path.join(__dirname, "research-tech-session.js"), "utf8");
  for (const forbidden of [
    "actionEffectFlow",
    "abilities.chain",
    "appendResearchTechFollowupEffects",
    "completeCurrentActionEffect",
  ]) {
    assert.equal(source.includes(forbidden), false, `迁移热路径不得引用 ${forbidden}`);
  }
})();

console.log("research tech effect session tests passed");
