"use strict";

const assert = require("node:assert/strict");
const { createHeadlessEnv } = require("./headless-env");

const config = { seed: "schema-probe", activePlayerCount: 4 };
const source = createHeadlessEnv();
const opening = source.reset(config);
const actions = source.legalActions();
assert.ok(actions.length > 0, "opening 应存在合法动作");
assert.equal(opening.decision?.actorPlayerId, actions[0].actorPlayerId);
source.dispose();

for (const action of actions) {
  const env = createHeadlessEnv();
  env.reset(config);
  const matching = env.legalActions().find((candidate) => candidate.actionId === action.actionId);
  assert.ok(matching, `fresh env 应重建动作 ${action.actionId}`);
  const result = env.step(matching);
  assert.equal(result.ok, true, `${action.actionId} 不应出现在 mask 后执行失败：${result.error || "unknown"}`);
  env.dispose();
}

console.log(`headless legality tests passed (${actions.length} opening actions)`);
