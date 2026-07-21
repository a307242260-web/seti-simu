(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiStateAuthorityInventory = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-state-authority-inventory-v3";
  const INVENTORY = Object.freeze([
    Object.freeze({
      id: "standard-action",
      status: "formal",
      owner: "Standard Action registry",
      source: "StateSource + actor intent",
      target: "Effect Session dispatch",
      mutationGate: "registry.validate -> registry.execute",
    }),
    Object.freeze({
      id: "effect-session",
      status: "formal",
      owner: "Effect Session runtime",
      source: "StateStore.beginWorkingCopy + Standard Action",
      target: "StateStore.compareAndCommit",
      mutationGate: "stable session with empty queue and no pending Decision",
    }),
    Object.freeze({
      id: "committed-game-state",
      status: "formal",
      owner: "StateStore",
      source: "validated Effect Session working state",
      target: "immutable committed snapshot",
      mutationGate: "compareAndCommit or validated lifecycle restore",
    }),
    Object.freeze({
      id: "browser-host",
      status: "formal",
      owner: "Browser Host",
      source: "StateSource/Effect Session inspect + ViewState",
      target: "BrowserProjection and Standard input ports",
      mutationGate: "none; input is revalidated by Action/Decision owner",
    }),
    Object.freeze({
      id: "machine-player-policy",
      status: "formal",
      owner: "Machine Player Host / Policy port",
      source: "DecisionContext + legal descriptors",
      target: "validated PolicyDecision.actionId",
      mutationGate: "freshness validator -> Standard input port",
    }),
  ]);

  const RESIDUAL_INVENTORY = Object.freeze([]);

  function auditInventory() {
    const missingOwner = INVENTORY.filter((entry) => !entry.owner).map((entry) => entry.id);
    const missingFlow = INVENTORY.filter((entry) => !entry.source || !entry.target || !entry.mutationGate).map((entry) => entry.id);
    const nonFormal = INVENTORY.filter((entry) => entry.status !== "formal").map((entry) => entry.id);
    const duplicateOwners = INVENTORY.filter((entry, index) => (
      INVENTORY.findIndex((candidate) => candidate.owner === entry.owner) !== index
    )).map((entry) => entry.owner);
    return Object.freeze({
      ok: missingOwner.length === 0 && missingFlow.length === 0
        && nonFormal.length === 0 && duplicateOwners.length === 0
        && RESIDUAL_INVENTORY.length === 0,
      schemaVersion: SCHEMA_VERSION,
      total: INVENTORY.length,
      missingOwner,
      missingFlow,
      nonFormal,
      duplicateOwners,
      residual: RESIDUAL_INVENTORY,
    });
  }

  return Object.freeze({ SCHEMA_VERSION, INVENTORY, RESIDUAL_INVENTORY, auditInventory });
});
