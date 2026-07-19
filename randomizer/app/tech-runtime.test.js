"use strict";

const assert = require("node:assert/strict");
const { createTechRuntime } = require("./tech-runtime.js");

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
    createActionContext: () => ({}),
    document,
    els,
    getCurrentPlayer: () => ({ id: "p1", techState: {} }),
    getInterfacePlayer: () => ({ id: "p1", techState: {} }),
    getCurrentActionIrreversibleReason: () => null,
    hasCurrentMainActionIrreversibleBarrier: () => false,
    pendingState,
    playerState: { players: [] },
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
  };
}

{
  const harness = createHarness();
  const runtime = createTechRuntime(harness.context);

  const selected = runtime.selectResearchTechTileForCurrentFlow("blue1");
  assert.equal(selected.needsBlueSlotChoice, true);
  assert.equal(harness.els.techBlueSlotOverlay.hidden, false);
  assert.equal(harness.els.techBlueSlotOverlay.dataset.tileId, "blue1");

  const confirmed = runtime.confirmTechBlueSlotChoice(2);
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.message, "slot:2");
  assert.deepEqual(
    harness.calls.filter((call) => call.type === "execute").map((call) => call.options),
    [
      { tileId: "blue1", skipCost: false },
      { tileId: "blue1", skipCost: false, blueSlot: 2 },
    ],
  );

  runtime.cancelPendingResearchTechTileChoice();
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

  runtime.restoreResearchTechSelectionAfterUndo(selectEffect);

  assert.deepEqual(harness.pendingState.actionEffectFlow.effects, [selectEffect, trailing]);
  assert.deepEqual(harness.techGameState.ui.allowedTechTypes, ["orange"]);
  assert.equal(harness.techGameState.ui.techSelectionActive, true);
  assert.equal(harness.rocketState.statusNote, "科技：请选择要研究的科技片");
}

console.log("tech runtime tests passed");
