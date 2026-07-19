(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiLegacyFlowInventory = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-legacy-flow-inventory-v1";
  const ADAPTER_EXPIRES_ON = "2026-08-31";
  const ADAPTER_OWNER = "SETI-72/browser-host-stages-5-9";

  const DEFAULTS = Object.freeze({
    discardAction: null,
    cardSelectionAction: null,
    passReserveSelection: null,
    passReserveSelectionDismissed: false,
    scanTargetAction: null,
    probeSectorScanAction: null,
    probeLocationRewardAction: null,
    publicScanQueue: null,
    scanRunSequence: 0,
    handScanAction: null,
    alienTraceAction: null,
    landTargetAction: null,
    cardTriggerAction: null,
    cardTriggerFreeMove: null,
    type1TriggerEvents: Object.freeze([]),
    cardTaskCompletion: null,
    jiuzheCardPlay: null,
    jiuzheOpportunityOpen: false,
    jiuzheOpportunityQueue: Object.freeze([]),
    yichangdianCardGain: null,
    yichangdianCornerAction: null,
    banrenmaCardGain: null,
    banrenmaOpportunity: null,
    banrenmaOpportunityQueue: Object.freeze([]),
    chongCardGain: null,
    chongFossilChoice: null,
    chongTaskCompletion: null,
    amibaCardGain: null,
    amibaSymbolChoice: null,
    amibaTraceRemoval: null,
    aomomoCardGain: null,
    runezuCardGain: null,
    runezuSymbolBranch: null,
    runezuFaceSymbolPlacement: null,
    strategyPassiveSlotChoice: null,
    alienTracePickerState: null,
    alienRevealConfirmation: null,
    turnEndAfterRevealContinuation: null,
    actionExecuted: false,
    passPlayerId: null,
    actionEffectFlow: null,
    movePayment: null,
    playCardSelection: null,
    futureSpanPlayBeforePlayer: null,
    handCardPlayAction: null,
    cardCornerQuickAction: null,
    cardCornerFreeMove: null,
    dataPlaceAction: null,
    industryAbility: null,
    piratesRaidPlacement: null,
  });

  const GROUPS = Object.freeze({
    common_choice: ["discardAction", "cardSelectionAction", "passReserveSelection", "passReserveSelectionDismissed"],
    scan: ["scanTargetAction", "probeSectorScanAction", "probeLocationRewardAction", "publicScanQueue", "scanRunSequence", "handScanAction"],
    alien_trace: ["alienTraceAction", "alienTracePickerState", "alienRevealConfirmation", "turnEndAfterRevealContinuation"],
    landing: ["landTargetAction"],
    card_trigger: ["cardTriggerAction", "cardTriggerFreeMove", "type1TriggerEvents", "cardTaskCompletion"],
    jiuzhe: ["jiuzheCardPlay", "jiuzheOpportunityOpen", "jiuzheOpportunityQueue"],
    yichangdian: ["yichangdianCardGain", "yichangdianCornerAction"],
    banrenma: ["banrenmaCardGain", "banrenmaOpportunity", "banrenmaOpportunityQueue"],
    chong: ["chongCardGain", "chongFossilChoice", "chongTaskCompletion"],
    amiba: ["amibaCardGain", "amibaSymbolChoice", "amibaTraceRemoval"],
    aomomo: ["aomomoCardGain"],
    runezu: ["runezuCardGain", "runezuSymbolBranch", "runezuFaceSymbolPlacement"],
    strategy_pirates: ["strategyPassiveSlotChoice", "piratesRaidPlacement"],
    action_flow: ["actionExecuted", "passPlayerId", "actionEffectFlow"],
    movement_cards: ["movePayment", "playCardSelection", "futureSpanPlayBeforePlayer", "handCardPlayAction", "cardCornerQuickAction", "cardCornerFreeMove"],
    data_industry: ["dataPlaceAction", "industryAbility"],
  });

  const HOST_ONLY_FIELDS = new Set(["passReserveSelectionDismissed", "scanRunSequence"]);
  const groupByField = Object.fromEntries(
    Object.entries(GROUPS).flatMap(([group, fields]) => fields.map((field) => [field, group])),
  );
  const INVENTORY = Object.freeze(Object.keys(DEFAULTS).map((field) => Object.freeze({
    field,
    group: groupByField[field],
    status: HOST_ONLY_FIELDS.has(field) ? "host-only" : "dated-adapter",
    target: HOST_ONLY_FIELDS.has(field) ? "Browser ViewState/journal identity" : "Effect/DecisionEffect",
    owner: HOST_ONLY_FIELDS.has(field) ? "Browser Host" : ADAPTER_OWNER,
    expiresOn: HOST_ONLY_FIELDS.has(field) ? null : ADAPTER_EXPIRES_ON,
  })));

  function cloneDefault(value) {
    if (Array.isArray(value)) return [];
    if (value && typeof value === "object") return structuredClone(value);
    return value;
  }

  function createLegacyPendingState() {
    return Object.fromEntries(Object.entries(DEFAULTS).map(([field, value]) => [field, cloneDefault(value)]));
  }

  function isActive(field, value) {
    const initial = DEFAULTS[field];
    if (Array.isArray(initial)) return Array.isArray(value) && value.length > 0;
    return value !== initial;
  }

  function auditLegacyPendingState(state, options = {}) {
    const actual = state && typeof state === "object" ? Object.keys(state).sort() : [];
    const expected = Object.keys(DEFAULTS).sort();
    const unknownFields = actual.filter((field) => !Object.hasOwn(DEFAULTS, field));
    const missingFields = expected.filter((field) => !Object.hasOwn(state || {}, field));
    const asOf = String(options.asOf || "").slice(0, 10);
    const expiredAdapters = asOf
      ? INVENTORY.filter((entry) => entry.expiresOn && entry.expiresOn < asOf).map((entry) => entry.field)
      : [];
    const activeAdapters = INVENTORY
      .filter((entry) => entry.status === "dated-adapter" && isActive(entry.field, state?.[entry.field]))
      .map((entry) => entry.field);
    return Object.freeze({
      ok: unknownFields.length === 0 && missingFields.length === 0 && expiredAdapters.length === 0,
      schemaVersion: SCHEMA_VERSION,
      fieldCount: INVENTORY.length,
      unknownFields,
      missingFields,
      expiredAdapters,
      activeAdapters,
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    ADAPTER_EXPIRES_ON,
    ADAPTER_OWNER,
    GROUPS,
    INVENTORY,
    createLegacyPendingState,
    auditLegacyPendingState,
  });
});
