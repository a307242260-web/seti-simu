"use strict";

const assert = require("node:assert/strict");
const { createAlienUiHelpers } = require("./alien-ui");

function createClassList() {
  return {
    removed: [],
    remove(name) {
      this.removed.push(name);
    },
  };
}

function createElement(tagName, overlays) {
  return {
    tagName,
    children: [],
    dataset: {},
    className: "",
    textContent: "",
    hidden: true,
    disabled: false,
    title: "",
    innerHTML: "",
    classList: createClassList(),
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      node.parentNode = this;
      this.children.push(node);
      if (node.className === "alien-reveal-notice-overlay") overlays.push(node);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener() {},
    remove() {
      this.removed = true;
      this.parentNode = null;
    },
  };
}

function createHarness() {
  const overlays = [];
  const document = {
    body: createElement("body", overlays),
    createElement(tagName) {
      return createElement(tagName, overlays);
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: text };
    },
    querySelectorAll(selector) {
      if (selector !== ".alien-reveal-notice-overlay") return [];
      return overlays.filter((node) => !node.removed);
    },
  };

  const pendingState = {
    alienTracePickerState: null,
    alienTraceAction: { targetPlayerId: "p1", targetPlayerColor: "white" },
    alienRevealConfirmation: null,
  };
  const rocketState = { statusNote: "" };
  const alienGameState = {
    fangzhou: { revealedSlotId: 2 },
    aliens: {},
    slots: {
      1: { revealed: false, traces: { yellow: { firstPlaced: false, extraCount: 0 }, pink: { firstPlaced: false, extraCount: 0 }, blue: { firstPlaced: false, extraCount: 0 } } },
      2: { revealed: true, alienId: "fangzhou", traces: { yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 }, pink: { firstPlaced: false, extraCount: 0 }, blue: { firstPlaced: false, extraCount: 0 } } },
    },
  };
  const player = { id: "p1", color: "white", colorLabel: "白色", resources: {} };
  const els = {
    alienTraceOverlay: { hidden: true },
    alienTraceActions: createElement("div", overlays),
    alienTraceTitle: { textContent: "" },
    alienTraceSubtitle: { textContent: "", classList: createClassList() },
    alienTraceCancel: { hidden: false },
  };
  const calls = { renderPanels: 0, readout: 0, unlock: [] };

  const helpers = createAlienUiHelpers({
    document,
    structuredClone: global.structuredClone,
    alienTraceRewardFlow: {
      resolveAllowedAlienSlotIds: (allowed, fallback) => allowed || fallback || [],
    },
    aliens: {
      TRACE_TYPES: ["yellow", "pink", "blue"],
      ALIEN_SLOT_IDS: [1, 2],
      getAlienSlot: (state, id) => state.slots[id] || null,
      getAlienSlotLabel: (id) => `外星人 ${id}`,
      getTraceTypeLabel: (type) => ({ yellow: "黄色", pink: "粉色", blue: "蓝色" }[type] || type),
      countPlacedFirstTraces: (slot) => ["yellow", "pink", "blue"].filter((type) => slot?.traces?.[type]?.firstPlaced).length,
      getAlienLabel: (id) => (id === "fangzhou" ? "方舟" : id),
      canPlaceAnyRevealedAlienTrace: () => false,
      getExtraTraceMarker: () => null,
    },
    fangzhou: {
      isFangzhouRevealedSlot: (_state, id) => id === 2,
      canUnlockCard2ForTrace: (_state, currentPlayer, traceType) => currentPlayer?.id === "p1" && traceType === "yellow",
      canPlaceAnyFangzhouTrace: () => false,
    },
    pendingState,
    alienGameState,
    playerState: { players: [player] },
    rocketState,
    els,
    renderAlienPanels: () => { calls.renderPanels += 1; },
    renderStateReadout: () => { calls.readout += 1; },
    getCurrentPlayer: () => player,
    getAlienTraceActionPlayer: () => player,
    getAvailableDataTokenCount: () => 0,
    resolvePlayerReference: (ref) => ((ref?.playerId || ref?.playerColor) ? player : null),
    confirmFangzhouCard2Unlock: (alienSlotId, traceType) => {
      calls.unlock.push({ alienSlotId, traceType });
      return { ok: true };
    },
    confirmAlienTracePlacement: () => ({ ok: true }),
    confirmFangzhouTracePlacement: () => ({ ok: true }),
    isDebugAlienTraceMode: () => false,
    isActionEffectFlowActive: () => false,
    isCardSelectionActive: () => false,
    isDiscardSelectionActive: () => false,
    getPlayerColorDefinition: (color) => ({ label: color === "white" ? "白色" : color }),
  });

  return { helpers, pendingState, rocketState, els, calls };
}

{
  const { helpers, pendingState, els } = createHarness();
  const result = helpers.openAlienTracePicker({ allowedTraceTypes: ["yellow"] });
  assert.equal(result.ok, true);
  assert.equal(els.alienTraceOverlay.hidden, false);
  assert.deepEqual(pendingState.alienTracePickerState.allowedTraceTypes, ["yellow"]);
  assert.equal(els.alienTraceActions.children.length, 2);
  assert.equal(els.alienTraceActions.children[0].dataset.alienPickerStep, "alien");
}

{
  const { helpers, pendingState } = createHarness();
  const notice = helpers.buildAlienRevealNoticeEntry(2, { alienId: "fangzhou" });
  const result = helpers.openAlienRevealConfirmation([notice]);
  assert.equal(result.ok, true);
  assert.equal(result.noticeVisible, true);
  assert.equal(pendingState.alienRevealConfirmation.entries.length, 1);
  const confirm = helpers.confirmAlienRevealNotice();
  assert.equal(confirm.ok, true);
  assert.equal(pendingState.alienRevealConfirmation, null);
}

{
  const { helpers, pendingState, els } = createHarness();
  pendingState.alienTracePickerState = {
    allowedTraceTypes: ["yellow"],
    allowedAlienSlotIds: [2],
    targetPlayerId: "p1",
    targetPlayerColor: "white",
  };
  const result = helpers.openFangzhouTraceDestinationChoice({ alienSlotId: 2, allowedTraceTypes: ["yellow"] });
  assert.equal(result.ok, true);
  assert.equal(pendingState.alienTracePickerState.mode, "fangzhou-destination");
  assert.equal(els.alienTraceActions.children.length, 2);
  assert.equal(els.alienTraceActions.children[0].dataset.fangzhouDestination, "panel");
  assert.equal(els.alienTraceActions.children[1].dataset.fangzhouDestination, "unlock");
}

{
  const { helpers, pendingState, els } = createHarness();
  pendingState.alienTracePickerState = { mode: "trace-board" };
  pendingState.alienTraceAction = { targetPlayerId: "p1" };
  els.alienTraceOverlay = null;
  helpers.closeAlienTracePicker();
  assert.equal(pendingState.alienTracePickerState, null);
  assert.equal(pendingState.alienTraceAction, null);
}

console.log("alien-ui tests passed");
