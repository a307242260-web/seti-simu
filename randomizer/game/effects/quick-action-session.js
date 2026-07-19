(function (root, factory) {
  "use strict";

  let effectSession = root.SetiEffectSession;
  let standardAction = root.SetiStandardAction;
  if (typeof require === "function") {
    effectSession = effectSession || require("./session-runtime");
    standardAction = standardAction || require("../actions/standard-action");
  }

  const api = factory(effectSession, standardAction);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiQuickActionSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (effectSession, standardAction) {
  "use strict";

  if (!effectSession?.createRuntime) {
    throw new Error("SetiEffectSession is required before SetiQuickActionSession");
  }
  if (!standardAction?.PHASE_BY_FAMILY) {
    throw new Error("SetiStandardAction is required before SetiQuickActionSession");
  }

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function createQuickActionCoordinator(options = {}) {
    const runtime = options.runtime;
    const registry = options.registry;
    const buildEffectGroup = options.buildEffectGroup;
    if (!runtime?.dispatchQuickAction) {
      throw new TypeError("quick action coordinator 缺少 Effect Session runtime");
    }
    if (!registry?.validate) {
      throw new TypeError("quick action coordinator 缺少 Standard Action registry");
    }
    if (typeof buildEffectGroup !== "function") {
      throw new TypeError("quick action coordinator 缺少 buildEffectGroup()");
    }

    function createEffectGroup(workingState, action) {
      if (action?.schemaVersion !== standardAction.SCHEMA_VERSION) {
        return fail("EFFECT_QUICK_ACTION_SCHEMA_MISMATCH", "Quick Action 必须使用 Standard Action descriptor");
      }
      if (standardAction.PHASE_BY_FAMILY[action.family] !== "quick" || action.phase !== "quick") {
        return fail("EFFECT_QUICK_ACTION_FAMILY_INVALID", `非 quick family 不能中断: ${action?.family || "<missing>"}`);
      }
      const validation = registry.validate(workingState, action);
      if (!validation?.ok) return validation;
      let group;
      try {
        group = buildEffectGroup(clone(workingState), clone(action), validation);
      } catch (error) {
        return fail("EFFECT_QUICK_ACTION_BUILD_FAILED", error?.message || "Quick Action Effect Group 构建失败");
      }
      if (group?.ok === false) return group;
      return {
        ...group,
        kind: "quick",
        ownerId: group?.ownerId || action.actorId,
        action: clone(action),
      };
    }

    function interrupt(session, action, interruptOptions = {}) {
      return runtime.dispatchQuickAction(session, action, createEffectGroup, interruptOptions);
    }

    return Object.freeze({ interrupt, createEffectGroup });
  }

  return Object.freeze({ createQuickActionCoordinator });
});
