"use strict";

const assert = require("node:assert/strict");
const { createTechRuntime } = require("./tech-runtime.js");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store");
const { attachDecisionState } = require("./test-decision-state");

function createHarness() {
  const calls = [];
  const techGameState = {
    board: {},
    ui: {
      techSelectionActive: true,
      pendingTileId: null,
      selectedTileId: null,
      selectedBlueSlot: null,
      allowedTechTypes: ["blue"],
      industryBorrowMode: false,
      statusNote: "",
    },
  };
  const pendingState = {
    actionEffectFlow: {
      actionType: "researchTech",
      effects: [],
    },
  };
  const decisionSessions = createDecisionSessionStore();
  attachDecisionState(pendingState, decisionSessions);
  const els = {
    techBlueSlotOverlay: {
      hidden: true,
      dataset: {},
    },
    techBlueSlotActions: {
      replaceChildren(...children) {
        this.children = children;
      },
    },
    techBlueSlotSubtitle: { textContent: "" },
    techTiles: [],
  };
  const document = {
    createElement() {
      return {
        dataset: {},
        className: "",
        textContent: "",
        type: "",
      };
    },
  };
  const context = {
    decisionSessions,
    Array,
    Boolean,
    Math,
    Number,
    String,
    abilities: {
      executeAbility(_abilityId, _actionContext, options) {
        calls.push({ type: "execute", options });
        if (options.blueSlot == null) {
          return {
            ok: false,
            needsBlueSlotChoice: true,
            tileId: options.tileId,
            availableSlots: [1, 2],
          };
        }
        return { ok: false, message: `slot:${options.blueSlot}` };
      },
    },
    cardEffects: { EFFECT_TYPES: { RESEARCH_TECH: "research_tech" } },
    createActionContext: (workingRoot) => ({ playerState: workingRoot.playerState }),
    document,
    els,
    getCurrentPlayer: () => ({ id: "p1", techState: {} }),
    getInterfacePlayer: () => ({ id: "p1", techState: {} }),
    getCurrentActionIrreversibleReason: () => null,
    hasCurrentMainActionIrreversibleBarrier: () => false,
    pendingState,
    playerState: { currentPlayerId: "p1", players: [{ id: "p1", techState: {} }] },
    players: {
      getCurrentPlayer: (state) => state.players.find((player) => player.id === state.currentPlayerId) || null,
    },
    renderStateReadout: () => calls.push({ type: "readout" }),
    renderRunezuBoardSymbols: () => {},
    rocketState: { statusNote: "" },
    setQuickPanelOpen: () => {},
    syncInteractionFocusChrome: () => {},
    syncTechRenderContext: () => {},
    tech: {
      cancelPendingTake: () => calls.push({ type: "cancelTake" }),
      renderAll: () => calls.push({ type: "render" }),
      setTechSelectionActive(state, active) {
        state.ui.techSelectionActive = active;
      },
    },
    techGameState,
    techRenderContext: {},
    updateActionButtons: () => calls.push({ type: "buttons" }),
  };
  return {
    calls,
    context,
    els,
    pendingState,
    rocketState: context.rocketState,
    techGameState,
    workingRoot: {
      cardState: {},
      playerState: context.playerState,
      rocketState: context.rocketState,
      techGameState,
      turnState: { roundNumber: 1, turnNumber: 1 },
    },
  };
}

{
  const harness = createHarness();
  const runtime = createTechRuntime(harness.context);

  const selected = runtime.selectResearchTechTileForCurrentFlow(harness.workingRoot, "blue1");
  assert.equal(selected.needsBlueSlotChoice, true);
  assert.equal(harness.els.techBlueSlotOverlay.hidden, false);
  assert.equal(harness.els.techBlueSlotOverlay.dataset.tileId, "blue1");

  const confirmed = runtime.confirmTechBlueSlotChoice(harness.workingRoot, 2);
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.message, "slot:2");
  assert.deepEqual(
    harness.calls.filter((call) => call.type === "execute").map((call) => call.options),
    [
      { tileId: "blue1", skipCost: false },
      { tileId: "blue1", skipCost: false, blueSlot: 2 },
    ],
  );

  runtime.cancelPendingResearchTechTileChoice(harness.workingRoot);
  assert.equal(harness.techGameState.ui.pendingTileId, null);
  assert.equal(harness.techGameState.ui.statusNote, "请选择要研究的科技板块");
}

{
  const harness = createHarness();
  const runtime = createTechRuntime(harness.context);
  const selectEffect = {
    type: "research_tech_select",
    options: { allowedTechTypes: ["orange"] },
  };
  const generated = {
    type: "gain_resources",
    options: { generatedByResearchTech: true },
  };
  const trailing = { type: "ordinary_followup", options: {} };
  harness.pendingState.actionEffectFlow.effects = [selectEffect, generated, trailing];

  runtime.restoreResearchTechSelectionAfterUndo(harness.workingRoot, selectEffect);

  assert.deepEqual(harness.pendingState.actionEffectFlow.effects, [selectEffect, trailing]);
  assert.deepEqual(harness.techGameState.ui.allowedTechTypes, ["orange"]);
  assert.equal(harness.techGameState.ui.techSelectionActive, true);
  assert.equal(harness.rocketState.statusNote, "科技：请选择要研究的科技片");
}

{
  const harness = createHarness();
  const runtime = createTechRuntime(harness.context);
  const isolatedRoot = structuredClone(harness.workingRoot);
  const beforeBoundTech = structuredClone(harness.techGameState);
  const beforeBoundRocket = structuredClone(harness.rocketState);

  const selected = runtime.selectResearchTechTileForCurrentFlow(isolatedRoot, "blue1");

  assert.equal(selected.needsBlueSlotChoice, true);
  assert.equal(isolatedRoot.techGameState.ui.pendingTileId, "blue1");
  assert.deepEqual(harness.techGameState, beforeBoundTech, "隔离 root 科技选择不得写入闭包 techGameState");
  assert.deepEqual(harness.rocketState, beforeBoundRocket, "隔离 root 科技选择不得写入闭包 rocketState");
  assert.throws(
    () => runtime.selectResearchTechTileForCurrentFlow(undefined, "blue1"),
    /explicit workingRoot/,
    "科技规则 operation 缺 root 必须立即失败",
  );
}

console.log("tech runtime tests passed");
