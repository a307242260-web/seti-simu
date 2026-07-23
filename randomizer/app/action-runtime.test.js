"use strict";

const assert = require("node:assert/strict");
const actionRuntime = require("./action-runtime");

assert.equal(actionRuntime.stripAssetExtension("星际矿业.png"), "星际矿业");
const source = [1, 2, 3];
const shuffled = actionRuntime.shuffleList(source, () => 0);
assert.deepEqual(source, [1, 2, 3]);
assert.deepEqual([...shuffled].sort(), source);

{
  const port = actionRuntime.createActionRuntimePort({
    getController: () => ({
      handleActionEffectButtonClick: (_root, index) => index,
      dispatchAction: (action) => ({ ok: true, action }),
    }),
  });
  assert.equal(port.handleActionEffectButtonClickForRoot({}, 2), 2);
  assert.equal(port.beginScanAction().action.family, "scan");
}

{
  const calls = [];
  const registry = actionRuntime.createCompositionActionRegistry({
    getController: () => ({
      dispatchAction(action, _fallback, actionContext) {
        calls.push({ action, actionContext });
        return action.kind === "standard_enumerate" ? { candidates: ["scan"] } : { ok: true };
      },
      executeStandardDescriptor(actionContext, action) {
        calls.push({ action, actionContext, execute: true });
        return { ok: true, action };
      },
    }),
    createActionContext: (root, action = null) => ({ root, action }),
  });
  const root = { id: "root" };
  const descriptor = { actionId: "scan:1" };
  assert.deepEqual(registry.enumerate(root), ["scan"]);
  assert.equal(registry.validate(root, descriptor).ok, true);
  assert.equal(registry.execute(root, descriptor).action, descriptor);
  assert.equal(calls.length, 3);
  const unavailable = actionRuntime.createCompositionActionRegistry({ getController: () => null, createActionContext: () => ({}) });
  assert.deepEqual(unavailable.enumerate(root), []);
  assert.equal(unavailable.validate(root, descriptor).code, "ACTION_RUNTIME_UNAVAILABLE");
}

{
  const root = {
    solarState: {},
    playerState: { currentPlayerId: "p1", players: [{ id: "p1" }, { id: "p2" }] },
    cardState: {}, rocketState: {}, nebulaDataState: {}, planetStatsState: {}, alienGameState: {},
    finalScoringState: {}, techGameState: { board: {}, ui: {} },
    turnState: { roundNumber: 2, turnNumber: 3 }, meta: { stateVersion: 7 }, match: { decisionVersion: 4 },
  };
  const factory = actionRuntime.createActionContextFactory({
    buildPlutoMarkerContext: () => ({ plutoMarkers: ["marker"] }),
    getNormalTokenAssetForPlayer: () => "token",
    getEarthSectorCoordinate: () => ({ x: 0, y: 0 }),
    solar: { createSolarSnapshot: () => ({ planetLocations: [] }) },
    rotateSolarOrbit: () => {}, drawBasicCardToPlayer: () => {}, drawBasicCard: () => {}, blindDrawCard: () => {},
    rocketActions: { launchRocketAtSector: () => ({ ok: true }) },
    cards: { replenishPublicSlot: () => ({ ok: true }) },
    beginCardSelection: () => {}, beginDiscardSelection: () => {}, beginIncome: () => {},
    getPlayerCompanyBaseIncome: () => 1,
    players: { normalizePlayerTechState: () => ({}) },
    createReadoutRoot: () => root,
  });
  const context = factory.createActionContext(root, { actorId: "p2" });
  assert.equal(context.playerState.currentPlayerId, "p2");
  assert.equal(context.playerState.players, root.playerState.players);
  assert.equal(context.standardActionAuthority.stateVersion, 7);
  assert.deepEqual(context.plutoMarkers, ["marker"]);
  assert.equal(factory.createReadoutActionContext().workingRoot, root);
  assert.throws(() => factory.createActionContext({}), /Composition workingRoot/);
}

{
  const recorded = [];
  const resolveInitialSelectionEffects = actionRuntime.createInitialSelectionEffectsResolver({
    initialCards: {
      resolveInitialSelections: (_context, options) => ({
        ok: true,
        events: [{ type: "signalMarked" }],
        results: [],
        message: `已结算 ${options.playerIds.join(",")}`,
      }),
    },
    createActionContext: () => ({ marker: true }),
    getPlayerIds: () => ["p1", "p2"],
    resolveCompletedSectorSettlements: () => ({
      ok: true,
      message: "扇区已结算",
      participantAwardMessage: "参与者获得宣传",
    }),
    recordScoreSources: (result) => recorded.push(result.message),
  });
  const result = resolveInitialSelectionEffects({ alienGameState: {} });
  assert.equal(result.settlement.ok, true);
  assert.match(result.message, /扇区已结算/);
  assert.deepEqual(recorded, ["已结算 p1,p2"]);
}

{
  const calls = [];
  let flow = null;
  const initialIncome = actionRuntime.createInitialIncomeFlow({
    abilities: {
      chain: {
        startAbilityChain(type, label, effects) {
          calls.push(["chain", type, label]);
          return { effects };
        },
      },
    },
    setActionEffectFlow(_root, next) { flow = next; },
    getActionEffectFlow: () => flow,
    assignEffectFlowOwner: (_flow, playerId) => calls.push(["owner", playerId]),
    setActionEffectFlowActive: (active) => calls.push(["active", active]),
    renderDebugPlayerSwitch: () => calls.push("debug"),
    renderPlayerStats: () => calls.push("stats"),
    renderPlayerHand: () => calls.push("hand"),
    activateNextActionEffect: () => calls.push("activate"),
  });
  const root = {
    playerState: { currentPlayerId: "p1", players: [{ id: "p1" }, { id: "p2" }] },
    rocketState: {},
  };
  assert.equal(initialIncome.startInitialIncomeEffectFlow(root, [{ playerId: "p2", label: "公司", count: 2 }]), true);
  assert.equal(flow.actionType, "initialIncome");
  assert.equal(flow.effects.length, 2);
  assert.equal(flow.effects[0].undoable, false);
  assert.equal(root.playerState.currentPlayerId, "p2");
  assert.equal(root.rocketState.statusNote, "初始收入增加：请依次点击收入效果");
  assert.deepEqual(calls.slice(-4), ["debug", "stats", "hand", "activate"]);
  assert.equal(initialIncome.startInitialIncomeEffectFlow(root, [{ playerId: null, count: 1 }]), false);
}

console.log("action runtime setup flow tests passed");
