"use strict";

const assert = require("node:assert/strict");
const standardAction = require("./standard-action");

function createState() {
  return {
    actorId: "p1",
    stateVersion: 3,
    decisionVersion: 7,
    legal: Object.fromEntries(standardAction.ALL_FAMILIES.map((family) => [family, true])),
    commits: [],
  };
}

function definition(family) {
  return {
    family,
    enumerate(state) {
      return state.legal[family]
        ? [{ target: { id: `${family}-target` }, payload: { cost: 1 }, summary: `${family} label` }]
        : [];
    },
    validate(state) {
      return state.legal[family] ? { ok: true } : { ok: false, code: "RULE_REJECTED" };
    },
    execute(state, action) {
      state.commits.push({ family, actionId: action.actionId });
      return { ok: true, events: [{ type: "committed", family }] };
    },
  };
}

const state = createState();
const registry = standardAction.createRegistry({
  getAuthority: (current) => ({
    actorId: current.actorId,
    stateVersion: current.stateVersion,
    decisionVersion: current.decisionVersion,
  }),
});
for (const family of standardAction.ALL_FAMILIES) registry.register(definition(family));

assert.deepEqual(
  registry.coverage().filter((entry) => !entry.registered),
  [],
  "正式 registry 的 15 个顶层 family 与 7 个 conditional family 必须都有行为 definition",
);
const actions = registry.enumerate(state);
assert.equal(actions.length, standardAction.ALL_FAMILIES.length);
assert.deepEqual(actions, registry.enumerate(state), "同一 authority 与业务 identity 必须生成稳定 actionId");
for (const action of actions) {
  assert.equal(action.phase, standardAction.PHASE_BY_FAMILY[action.family]);
  assert.equal(registry.validate(state, action).ok, true);
  const fork = createState();
  assert.equal(registry.execute(fork, action).ok, true, `${action.family} 必须可从同一 checkpoint 执行`);
  assert.deepEqual(fork.commits, [{ family: action.family, actionId: action.actionId }]);
}

const sample = actions[0];
for (const invalid of [
  [{ ...sample, schemaVersion: "future" }, "STANDARD_ACTION_SCHEMA_MISMATCH"],
  [{ ...sample, actorId: "p2" }, "STANDARD_ACTION_ACTOR_MISMATCH"],
  [{ ...sample, stateVersion: 2 }, "STANDARD_ACTION_STALE"],
  [{ ...sample, decisionVersion: 8 }, "STANDARD_ACTION_STALE"],
  [{ ...sample, family: "unknown_family" }, "STANDARD_ACTION_UNREGISTERED_FAMILY"],
  [{ ...sample, target: { id: "tampered" } }, "STANDARD_ACTION_NOT_LEGAL"],
]) {
  const fork = createState();
  const before = structuredClone(fork);
  assert.equal(registry.execute(fork, invalid[0]).code, invalid[1]);
  assert.deepEqual(fork, before, `${invalid[1]} 必须零提交`);
}

const summaryChanged = { ...sample, summary: "另一种显示文案" };
assert.equal(registry.validate(state, summaryChanged).ok, true, "显示文案不得参与 Action identity 或合法性");
state.legal[sample.family] = false;
assert.equal(registry.execute(state, sample).code, "STANDARD_ACTION_NOT_LEGAL");
assert.deepEqual(state.commits, [], "候选失效后不得执行历史 action");

assert.throws(() => registry.register(definition("launch")), /重复注册/);
assert.throws(() => registry.register({ family: "unknown_family" }), /未知 Standard Action family/);

console.log("standard action protocol tests passed");
