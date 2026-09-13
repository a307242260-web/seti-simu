"use strict";
const assert = require("node:assert/strict");
const { captureInitialWorld, identifyWorld, buildWorldIdentity } = require("./fixed-world-identity");
const world = captureInitialWorld({ seed: "seti-free-analyze-v1" });
const identity = identifyWorld(world);
assert.equal(identity.worldVersion, "human-405-world-v1");
assert.match(identity.fingerprint, /^[a-f0-9]{64}$/);
assert.deepEqual(buildWorldIdentity({ seed: world.seed, aiDifficulty: "strong",
  policyVersion: "unrelated-policy", vStateValueEnabled: true }), identity,
"策略配置变化不得改变世界身份");
const reordered = structuredClone(world);
reordered.domains = Object.fromEntries(Object.entries(reordered.domains).reverse());
assert.deepEqual(identifyWorld(reordered), identity, "对象字段顺序不改变指纹");
for (const [domain, mutate] of [
  ["cards", state => state.drawPileCardIds.reverse()],
  ["aliens", state => state.amiba.initialConfiguration.cardDeck.reverse()],
  ["tech", state => { const keys = Object.keys(state.stacks); const first = state.stacks[keys[0]];
    state.stacks[keys[0]] = state.stacks[keys[1]]; state.stacks[keys[1]] = first; }],
  ["initialOffers", state => { state.fixtureChange = true; }],
]) {
  const changed = structuredClone(world);
  mutate(changed.domains[domain]);
  const next = identifyWorld(changed);
  assert.notEqual(next.fingerprint, identity.fingerprint, `${domain}差异必须可见`);
  assert.deepEqual(Object.keys(identity.components).filter(key => next.components[key] !== identity.components[key]), [domain]);
}
assert.notEqual(buildWorldIdentity({ seed: world.seed, activePlayerCount: 3 }).fingerprint, identity.fingerprint);
assert.notEqual(buildWorldIdentity({ seed: "another-world" }).fingerprint, identity.fingerprint);
assert.equal(Object.hasOwn(identity, "domains"), false, "记录只带哈希，不携带隐藏配置");
const { buildIdentity, fingerprintOf } = require("./run_research_validation");
const experiment = buildIdentity({ seed: world.seed, config: {} });
const changedPolicy = buildIdentity({ seed: world.seed, config: { vStateValueEnabled: true } });
assert.deepEqual(experiment.world, changedPolicy.world);
assert.notEqual(fingerprintOf(experiment), fingerprintOf(changedPolicy), "实验去重仍区分策略配置");
assert.equal(fingerprintOf(experiment), fingerprintOf(structuredClone(experiment)), "相同实验身份稳定去重");
assert.notEqual(fingerprintOf(experiment), fingerprintOf({ ...experiment,
  world: { ...experiment.world, fingerprint: "different-world" } }), "实验去重必须纳入世界身份");
console.log("fixed world identity tests passed");
