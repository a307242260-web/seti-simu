(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiCompositionDecisionAccess = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-composition-decision-access-v1";
  const MATCH_FIELDS = Object.freeze({
    discard_action: "discardActionContinuation",
    card_selection_action: "cardSelectionContinuation",
    alien_trace_action: "alienTraceContinuation",
    alien_trace_picker_state: "alienTracePickerContinuation",
    action_effect_flow: "actionEffectFlowContinuation",
    land_target: "landTargetContinuation",
    pirates_raid_placement: "piratesRaidContinuation",
    strategy_passive_slot: "strategySlotContinuation",
    industry_ability: "industryAbilityContinuation",
    data_placement: "dataPlacementContinuation",
  });

  function createCompositionDecisionAccess() {
    const isolatedTestRoot = { match: {} };
    let activeRoot = null;
    let rootProvider = null;
    let sequence = 0;

    function resolveRoot() {
      const workingRoot = activeRoot || rootProvider?.() || isolatedTestRoot;
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("Composition decision access 缺少 workingRoot");
      }
      workingRoot.match ||= {};
      return workingRoot;
    }

    function fieldFor(kind) {
      const field = MATCH_FIELDS[kind];
      if (!field) throw new TypeError(`未知 Composition decision kind：${kind}`);
      return field;
    }

    function setRootProvider(provider) {
      if (provider != null && typeof provider !== "function") throw new TypeError("root provider 必须是函数");
      rootProvider = provider || null;
    }

    function runWithWorkingRoot(workingRoot, operation) {
      if (typeof operation !== "function") throw new TypeError("working root operation 必须是函数");
      const previous = activeRoot;
      activeRoot = workingRoot;
      try {
        return operation();
      } finally {
        activeRoot = previous;
      }
    }

    function open(kind, session = {}) {
      const field = fieldFor(kind);
      const decisionId = session.decisionId || `${kind}:${++sequence}`;
      resolveRoot().match[field] = {
        ...session,
        kind,
        decisionId,
        decisionVersion: Number.isInteger(session.decisionVersion) ? session.decisionVersion : 1,
      };
      return inspect(kind);
    }

    function peek(kind) {
      return resolveRoot().match[fieldFor(kind)] || null;
    }

    function inspect(kind) {
      const entry = peek(kind);
      if (!entry) return null;
      return Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        kind: entry.kind,
        decisionId: entry.decisionId,
        decisionVersion: entry.decisionVersion,
        ownerId: entry.ownerId || entry.playerId || null,
        ownerColor: entry.ownerColor || entry.playerColor || null,
        optional: Boolean(entry.optional || entry.allowSkip),
      });
    }

    function clear(kind) {
      const root = resolveRoot();
      const field = fieldFor(kind);
      const entry = root.match[field] || null;
      delete root.match[field];
      return entry;
    }

    function has(kind) {
      return Boolean(peek(kind));
    }

    function clearAll() {
      const match = resolveRoot().match;
      for (const field of Object.values(MATCH_FIELDS)) delete match[field];
    }

    function createFacade(definitions = {}) {
      const facade = {};
      for (const [field, kind] of Object.entries(definitions)) {
        Object.defineProperty(facade, field, {
          enumerable: true,
          get: () => peek(kind),
          set: (value) => {
            if (value == null) clear(kind);
            else open(kind, value);
          },
        });
      }
      return Object.freeze(facade);
    }

    return Object.freeze({
      setRootProvider,
      runWithWorkingRoot,
      open,
      peek,
      inspect,
      clear,
      has,
      clearAll,
      createFacade,
    });
  }

  return Object.freeze({ SCHEMA_VERSION, createCompositionDecisionAccess });
});
