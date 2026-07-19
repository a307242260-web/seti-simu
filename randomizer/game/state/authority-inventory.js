(function (root, factory) {
  "use strict";

  let legacyStateAdapter = root.SetiLegacyStateAdapter;
  if (!legacyStateAdapter && typeof require === "function") {
    legacyStateAdapter = require("./legacy-state-adapter");
  }
  const api = factory(legacyStateAdapter);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiStateAuthorityInventory = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (legacyStateAdapter) {
  "use strict";

  if (!legacyStateAdapter) throw new Error("SetiLegacyStateAdapter is required before SetiStateAuthorityInventory");

  const SCHEMA_VERSION = "seti-state-authority-inventory-v1";
  const INVENTORY = Object.freeze([
    Object.freeze({
      id: "committed-game-state-v1",
      status: "store-owned",
      owner: "StateStore",
      expiresOn: null,
      source: "StateStore.getSnapshot/beginWorkingCopy",
      target: "StateStore.compareAndCommit",
    }),
    Object.freeze({
      id: "legacy-recovery-v1-read",
      status: "dated-adapter",
      ...legacyStateAdapter.ADAPTER_CONTRACT,
    }),
    Object.freeze({
      id: "browser-runtime-working-projection",
      status: "dated-adapter",
      ...legacyStateAdapter.CURRENT_RUNTIME_ADAPTER_CONTRACT,
    }),
    Object.freeze({
      id: "card-task-index",
      status: "derived",
      owner: "card task query runtime",
      expiresOn: null,
      source: "CommittedGameState.cards/players",
      target: "rebuildCardTaskIndex",
    }),
    Object.freeze({
      id: "setup-selection",
      status: "session-owned",
      owner: "setup session",
      expiresOn: null,
      source: "setup Decision/Effect Session",
      target: "confirmed match/players facts",
    }),
    Object.freeze({
      id: "card-tech-rocket-ui",
      status: "host-only",
      owner: "Browser ViewState",
      expiresOn: null,
      source: "BrowserProjection/ViewState",
      target: "renderer only",
    }),
  ]);

  function auditInventory(options = {}) {
    const asOf = String(options.asOf || "").slice(0, 10);
    const missingOwner = INVENTORY.filter((entry) => !entry.owner).map((entry) => entry.id);
    const undatedAdapters = INVENTORY
      .filter((entry) => entry.status === "dated-adapter" && !entry.expiresOn)
      .map((entry) => entry.id);
    const expiredAdapters = asOf
      ? INVENTORY.filter((entry) => entry.expiresOn && entry.expiresOn < asOf).map((entry) => entry.id)
      : [];
    return Object.freeze({
      ok: missingOwner.length === 0 && undatedAdapters.length === 0 && expiredAdapters.length === 0,
      schemaVersion: SCHEMA_VERSION,
      total: INVENTORY.length,
      missingOwner,
      undatedAdapters,
      expiredAdapters,
    });
  }

  return Object.freeze({ SCHEMA_VERSION, INVENTORY, auditInventory });
});
