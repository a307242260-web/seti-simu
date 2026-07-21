(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiStateAuthorityInventory = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-state-authority-inventory-v2";
  const INVENTORY = Object.freeze([
    Object.freeze({
      id: "committed-game-state-v1",
      status: "formal",
      owner: "StateStore",
      source: "StateStore.getSnapshot/beginWorkingCopy",
      target: "StateStore.compareAndCommit",
    }),
    Object.freeze({
      id: "card-task-index",
      status: "formal",
      owner: "card task query runtime",
      source: "CommittedGameState.cards/players",
      target: "rebuildCardTaskIndex",
    }),
    Object.freeze({
      id: "setup-selection",
      status: "formal",
      owner: "setup session",
      source: "setup Decision/Effect Session",
      target: "confirmed match/players facts",
    }),
    Object.freeze({
      id: "card-tech-rocket-ui",
      status: "formal",
      owner: "Browser ViewState",
      source: "BrowserProjection/ViewState",
      target: "renderer only",
    }),
  ]);

  function auditInventory() {
    const missingOwner = INVENTORY.filter((entry) => !entry.owner).map((entry) => entry.id);
    const nonFormal = INVENTORY.filter((entry) => entry.status !== "formal").map((entry) => entry.id);
    return Object.freeze({
      ok: missingOwner.length === 0 && nonFormal.length === 0,
      schemaVersion: SCHEMA_VERSION,
      total: INVENTORY.length,
      missingOwner,
      nonFormal,
    });
  }

  return Object.freeze({ SCHEMA_VERSION, INVENTORY, auditInventory });
});
