"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const standardAction = require("./standard-action");

const state = {
  actorId: "player-stage4-owner",
  stateVersion: 41,
  decisionVersion: 17,
  enabled: true,
};
const executions = [];

function createProvider(family) {
  return {
    label: family,
    getOptions() {
      return state.enabled
        ? {
          ok: true,
          choices: ["alpha", "beta"].map((choiceId) => ({
            target: { kind: `${family}-fixture`, choiceId },
            payload: { outcome: `${family}:${choiceId}` },
            label: `${family} ${choiceId}`,
          })),
        }
        : { ok: false, message: "没有合法选项" };
    },
    canExecute(_context, option) {
      return option.target?.kind === `${family}-fixture`
        ? { ok: true }
        : { ok: false, message: "目标类型不匹配" };
    },
    execute(_context, option) {
      executions.push({ family, choiceId: option.target.choiceId });
      return { ok: true, progressed: true };
    },
  };
}

const stage4Actions = Object.fromEntries(
  standardAction.CONDITIONAL_FAMILIES.map((family) => [family, createProvider(family)]),
);
const registry = standardAction.createRegistry({
  getAuthority: () => ({
    actorId: state.actorId,
    stateVersion: state.stateVersion,
    decisionVersion: state.decisionVersion,
  }),
});
for (const definition of standardAction.createStage4Definitions(stage4Actions)) {
  registry.register(definition);
}

assert.deepEqual(
  registry.coverage().filter((entry) => entry.phase === "conditional"),
  standardAction.CONDITIONAL_FAMILIES.map((family) => ({
    family,
    phase: "conditional",
    registered: true,
  })),
  "七类 conditional family 必须各有真实 registry definition",
);

for (const family of standardAction.CONDITIONAL_FAMILIES) {
  const candidates = registry.enumerate({}, { family });
  assert.equal(candidates.length, 2, `${family} 必须保留两个非等价合法选项`);
  assert.equal(new Set(candidates.map((candidate) => candidate.actionId)).size, 2);
  assert.ok(candidates.every((candidate) => candidate.actorId === state.actorId));
  assert.ok(candidates.every((candidate) => candidate.stateVersion === state.stateVersion));
  assert.ok(candidates.every((candidate) => candidate.decisionVersion === state.decisionVersion));

  const result = registry.execute({}, candidates[1]);
  assert.equal(result.ok, true, `${family} registry execute 应成功`);
  assert.deepEqual(executions.at(-1), { family, choiceId: "beta" });

  state.decisionVersion += 1;
  const stale = registry.execute({}, candidates[0]);
  assert.equal(stale.ok, false, `${family} 旧 timestep action 必须失效`);
  assert.equal(stale.code, "STANDARD_ACTION_STALE");
}

state.enabled = false;
for (const family of standardAction.CONDITIONAL_FAMILIES) {
  assert.deepEqual(registry.enumerate({}, { family }), [], `${family} 零选项不得伪造候选`);
}

assert.throws(
  () => standardAction.createConditionalDefinition("unknown_family", createProvider("unknown_family")),
  /未知 conditional Standard Action family/,
);

const appSource = fs.readFileSync(path.resolve(__dirname, "../../app.js"), "utf8");
const enumerateEntry = appSource.slice(
  appSource.indexOf("function enumerateHeadlessConditionalActions()"),
  appSource.indexOf("function executeHeadlessConditionalAction(action)"),
);
const executeEntry = appSource.slice(
  appSource.indexOf("function executeHeadlessConditionalAction(action)"),
  appSource.indexOf("function advanceHeadlessDeterministicState()"),
);
assert.match(enumerateEntry, /actionRuntimeController\.dispatchAction/, "条件枚举必须进入共享 registry adapter");
assert.match(executeEntry, /actionRuntimeController\.dispatchAction\(\{ standardAction \}\)/, "条件执行必须进入共享 registry adapter");
assert.doesNotMatch(executeEntry, /onConfirm|querySelector|runAi|recover|skipCurrentActionEffect/, "registry 入口不得直接调用 UI/AI/recover/skip 旁路");

console.log(`standard-action stage4 tests passed (${standardAction.CONDITIONAL_FAMILIES.length} families)`);
