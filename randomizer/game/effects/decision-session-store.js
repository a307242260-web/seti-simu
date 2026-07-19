(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiDecisionSessionStore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-decision-session-store-v1";

  function createDecisionSessionStore() {
    const sessions = new Map();
    let sequence = 0;

    function open(kind, session = {}) {
      if (!kind) throw new TypeError("Decision Session 缺少 kind");
      const decisionId = session.decisionId || `${kind}:${++sequence}`;
      const entry = {
        ...session,
        kind,
        decisionId,
        decisionVersion: Number.isInteger(session.decisionVersion)
          ? session.decisionVersion
          : 1,
      };
      sessions.set(kind, entry);
      return inspect(kind);
    }

    function peek(kind) {
      return sessions.get(kind) || null;
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
      const entry = peek(kind);
      sessions.delete(kind);
      return entry;
    }

    function has(kind) {
      return sessions.has(kind);
    }

    function clearAll() {
      sessions.clear();
    }

    return Object.freeze({ open, peek, inspect, clear, has, clearAll });
  }

  return Object.freeze({ SCHEMA_VERSION, createDecisionSessionStore });
});
