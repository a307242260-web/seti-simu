"use strict";
const assert = require("node:assert/strict");
const standardAction = require("./standard-action");
function makeActions() {
  function action(family, choices) { return { label: family, getOptions(context) { return { ok: true, choices: choices(context) }; }, canExecute(context, option) { return this.getOptions(context).choices.some((choice) => JSON.stringify(choice.target) === JSON.stringify(option.target)) ? { ok: true } : { ok: false }; }, execute(context, option) { context.executed.push({ family, target: option.target, payload: option.payload }); context.stateVersion += 1; return { ok: true, events: [{ type: family }] }; } }; }
  return {
    scan: action("scan", () => [{ target: { sectorId: "earth" }, payload: { cost: { credits: 1, energy: 2 } } }]),
    analyze: action("analyze", () => [{ target: { kind: "computer", requiredSlot: 5 }, payload: { cost: { energy: 1 } } }]),
    playCard: action("play_card", (context) => context.hand.map((card) => ({ target: { cardInstanceId: card.id }, payload: { cost: card.cost } }))),
    pass: action("pass", () => [{ target: { kind: "pass" } }]),
  };
}
function registry() { const value = standardAction.createRegistry({ getAuthority: (context) => ({ actorId: context.actorId, stateVersion: context.stateVersion, decisionVersion: context.decisionVersion }) }); for (const definition of standardAction.createStage2Definitions(makeActions())) value.register(definition); return value; }
const base = { actorId: "blue", stateVersion: 4, decisionVersion: 9, hand: [{ id: "card-instance-1", cost: { credits: 2 } }, { id: "card-instance-2", cost: { energy: 1 } }], executed: [] };
const candidates = registry().enumerate(structuredClone(base));
assert.deepEqual([...new Set(candidates.map((item) => item.family))].sort(), ["analyze", "pass", "play_card", "scan"]);
assert.equal(candidates.filter((item) => item.family === "play_card").length, 2);
for (const candidate of candidates) { const fork = structuredClone(base); assert.equal(registry().execute(fork, candidate).ok, true); assert.equal(fork.executed.length, 1); }
const staleContext = structuredClone(base); staleContext.stateVersion += 1; assert.equal(registry().execute(staleContext, candidates[0]).code, "STANDARD_ACTION_STALE"); assert.deepEqual(staleContext.executed, []);
const browser = structuredClone(base); const policy = structuredClone(base); const browserAdapter = standardAction.createRegistryAdapter(registry()); const policyAdapter = standardAction.createRegistryAdapter(registry()); const cardAction = browserAdapter.enumerate(browser, { family: "play_card" })[1]; assert.equal(browserAdapter.execute(browser, cardAction).ok, true); assert.equal(policyAdapter.execute(policy, cardAction).ok, true); assert.deepEqual(policy, browser);
assert.equal(browserAdapter.executeLegacy(structuredClone(base), "play_card").code, "STANDARD_ACTION_AMBIGUOUS");
console.log("standard-action stage2 tests passed");
