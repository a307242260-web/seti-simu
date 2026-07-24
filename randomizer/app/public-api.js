(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppPublicApi = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-public-facade-v1";

  function clone(value, structuredClone = root.structuredClone) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function requireFunction(value, label) {
    if (typeof value !== "function") {
      throw new TypeError(`SetiRandomizer 缺少 ${label} port`);
    }
    return value;
  }

  function createPublicApi(context = {}) {
    const structuredClone = context.structuredClone || root.structuredClone;
    const inspectProjection = requireFunction(context.inspectProjection, "viewer-safe inspect");
    const inspectInput = requireFunction(context.inspectInput, "input inspect");
    const capture = requireFunction(context.capture, "capture");
    const restore = requireFunction(context.restore, "restore");
    const dispatchAction = requireFunction(context.dispatchAction, "Standard Action");
    const submitDecision = requireFunction(context.submitDecision, "Standard Decision");

    const input = Object.freeze({
      dispatchAction(action) {
        return clone(dispatchAction(clone(action, structuredClone)), structuredClone);
      },
      submitDecision(submission) {
        return clone(submitDecision(clone(submission, structuredClone)), structuredClone);
      },
    });

    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      inspect() {
        return deepFreeze({
          projection: clone(inspectProjection(), structuredClone),
          input: clone(inspectInput(), structuredClone),
        });
      },
      capture() {
        return deepFreeze(clone(capture(), structuredClone));
      },
      restore(envelope) {
        return deepFreeze(clone(restore(clone(envelope, structuredClone)), structuredClone));
      },
      input,
    });
  }

  return Object.freeze({ SCHEMA_VERSION, createPublicApi });
});
