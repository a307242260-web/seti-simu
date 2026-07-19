"use strict";

const assert = require("node:assert/strict");
const standardAction = require("./standard-action");

const QUICK_FAMILIES = new Set([
  "move", "quick_trade", "industry", "card_corner", "place_data", "runezu_face_symbol",
]);

function makeAction(family, getChoices) {
  return {
    label: family,
    getOptions(context) {
      const choices = getChoices(context);
      return choices.length ? { ok: true, choices } : { ok: false, choices: [], message: `no ${family}` };
    },
    canExecute(context, option) {
      const options = this.getOptions(context);
      const legal = options.ok && options.choices.some((choice) => (
        JSON.stringify(choice.target || null) === JSON.stringify(option.target || null)
        && JSON.stringify(choice.payload || {}) === JSON.stringify(option.payload || {})
      ));
      return legal ? { ok: true } : { ok: false, message: `illegal ${family}` };
    },
    execute(context, option) {
      const check = this.canExecute(context, option);
      if (!check.ok) return check;
      if (family === "industry") context.oneXUsed = true;
      if (family === "end_turn") context.turnEnded = true;
      context.executed.push({ family, target: option.target, payload: option.payload });
      context.history.push({
        source: family === "end_turn" ? "turn_control" : "quick",
        family,
        irreversible: family === "industry",
      });
      context.replay.push({ family, actorId: context.actorId });
      context.stateVersion += 1;
      return { ok: true, events: [{ type: family }] };
    },
  };
}

function makeActions() {
  return {
    move: makeAction("move", (context) => context.moveTargets.map((target) => ({ target, payload: { payment: { energy: 1 } } }))),
    quickTrade: makeAction("quick_trade", (context) => context.canPayTrade
      ? [{ target: { tradeId: "credits-for-energy" }, payload: { cost: { credits: 2 } } }]
      : []),
    industry: makeAction("industry", (context) => context.oneXUsed
      ? []
      : [{ target: { companyLabel: "图灵系统" } }]),
    cardCorner: makeAction("card_corner", (context) => context.hand.map((card) => ({ target: { cardInstanceId: card.id } }))),
    placeData: makeAction("place_data", (context) => context.dataTargets.map((target) => ({ target }))),
    runezuFaceSymbol: makeAction("runezu_face_symbol", (context) => context.symbolTargets.map((target) => ({ target }))),
    endTurn: makeAction("end_turn", (context) => context.mainActionComplete && !context.pendingChoice
      ? [{ target: { kind: "end-turn" } }]
      : []),
  };
}

function createRegistry() {
  const registry = standardAction.createRegistry({
    getAuthority: (context) => ({
      actorId: context.actorId,
      stateVersion: context.stateVersion,
      decisionVersion: context.decisionVersion,
    }),
  });
  for (const definition of standardAction.createStage3Definitions(makeActions())) registry.register(definition);
  return registry;
}

function createState() {
  return {
    actorId: "blue",
    stateVersion: 12,
    decisionVersion: 7,
    mainActionComplete: true,
    pendingChoice: false,
    oneXUsed: false,
    canPayTrade: true,
    turnEnded: false,
    moveTargets: [
      { rocketId: 3, deltaX: 0, deltaY: 1 },
      { rocketId: 3, deltaX: 1, deltaY: 0 },
    ],
    hand: [{ id: "card-instance-1" }],
    dataTargets: [{ target: "computer", blueSlot: null }],
    symbolTargets: [{ alienSlotId: 2, position: 1, symbolId: "symbol_3" }],
    executed: [],
    history: [],
    replay: [],
  };
}

const registry = createRegistry();
const base = createState();
const candidates = registry.enumerate(structuredClone(base));
assert.deepEqual(
  [...new Set(candidates.map((action) => action.family))].sort(),
  ["card_corner", "end_turn", "industry", "move", "place_data", "quick_trade", "runezu_face_symbol"],
);
assert.equal(candidates.filter((action) => action.family === "move").length, 2);
assert.equal(candidates.filter((action) => QUICK_FAMILIES.has(action.family)).every((action) => action.phase === "quick"), true);
assert.equal(candidates.find((action) => action.family === "end_turn").phase, "turn_control");

for (const candidate of candidates) {
  const fork = structuredClone(base);
  const result = createRegistry().execute(fork, candidate);
  assert.equal(result.ok, true, `${candidate.family} legal action must execute`);
  assert.equal(fork.executed.length, 1);
  assert.equal(fork.replay.length, 1);
  assert.equal(fork.history[0].source, candidate.family === "end_turn" ? "turn_control" : "quick");
  assert.equal(fork.mainActionComplete, true, `${candidate.family} must not clear main-action completion`);
}

const staleState = createState();
staleState.stateVersion += 1;
const staleBefore = structuredClone(staleState);
assert.equal(createRegistry().execute(staleState, candidates[0]).code, "STANDARD_ACTION_STALE");
assert.deepEqual(staleState, staleBefore);

const wrongOwner = createState();
wrongOwner.actorId = "red";
const wrongOwnerBefore = structuredClone(wrongOwner);
assert.equal(createRegistry().execute(wrongOwner, candidates[0]).code, "STANDARD_ACTION_ACTOR_MISMATCH");
assert.deepEqual(wrongOwner, wrongOwnerBefore);

const tampered = structuredClone(candidates.find((action) => action.family === "move"));
tampered.target.deltaX = 99;
const tamperedState = createState();
const tamperedBefore = structuredClone(tamperedState);
assert.equal(createRegistry().execute(tamperedState, tampered).code, "STANDARD_ACTION_NOT_LEGAL");
assert.deepEqual(tamperedState, tamperedBefore);

const duplicateOneX = createState();
duplicateOneX.oneXUsed = true;
assert.equal(createRegistry().enumerate(duplicateOneX, { family: "industry" }).length, 0);
const illegalPayment = createState();
illegalPayment.canPayTrade = false;
assert.equal(createRegistry().enumerate(illegalPayment, { family: "quick_trade" }).length, 0);
const noTarget = createState();
noTarget.dataTargets = [];
assert.equal(createRegistry().enumerate(noTarget, { family: "place_data" }).length, 0);
const pending = createState();
pending.pendingChoice = true;
assert.equal(createRegistry().enumerate(pending, { family: "end_turn" }).length, 0);
const noMainAction = createState();
noMainAction.mainActionComplete = false;
assert.equal(createRegistry().enumerate(noMainAction, { family: "end_turn" }).length, 0);

const browserState = createState();
const policyState = createState();
const browserAdapter = standardAction.createRegistryAdapter(createRegistry());
const policyAdapter = standardAction.createRegistryAdapter(createRegistry());
const validationOnlyState = createState();
const validationOnly = browserAdapter.resolveIntent(validationOnlyState, "industry", { companyLabel: "图灵系统" });
assert.equal(validationOnly.ok, true);
assert.deepEqual(validationOnlyState.executed, [], "AI legacy adapter validation must not execute or mutate state");
const trade = browserAdapter.enumerate(browserState, { family: "quick_trade" })[0];
assert.equal(browserAdapter.execute(browserState, trade).ok, true);
assert.equal(policyAdapter.execute(policyState, trade).ok, true);
assert.deepEqual(policyState, browserState);
assert.equal(browserAdapter.resolveIntent(createState(), "move").code, "STANDARD_ACTION_AMBIGUOUS");

console.log("standard-action stage3 tests passed");
