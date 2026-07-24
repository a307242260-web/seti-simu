(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiQuickTurnActionExecutor = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const ACTION_FAMILIES = Object.freeze([
    "industry", "card_corner", "runezu_face_symbol",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function replaceMutable(target, source) {
    for (const key of Reflect.ownKeys(target || {})) delete target[key];
    Object.assign(target, clone(source || {}));
  }

  function restoreWorkingRoot(workingRoot, snapshot) {
    for (const key of Reflect.ownKeys(workingRoot)) {
      if (!Object.hasOwn(snapshot, key)) delete workingRoot[key];
    }
    for (const key of Reflect.ownKeys(snapshot)) {
      const current = workingRoot[key];
      const previous = snapshot[key];
      if (current && previous && typeof current === "object" && typeof previous === "object"
        && !Array.isArray(current) && !Array.isArray(previous)) {
        replaceMutable(current, previous);
      } else {
        workingRoot[key] = clone(previous);
      }
    }
  }

  function requireWorkingRoot(root) {
    const required = [
      "playerState", "turnState", "cardState", "techGameState",
      "nebulaDataState", "alienGameState", "rocketState",
    ];
    const missing = required.filter((key) => !root?.[key]);
    return missing.length
      ? fail(
        "QUICK_TURN_WORKING_ROOT_INVALID",
        `Quick/Turn executor 缺少 working root slices: ${missing.join(", ")}`,
        { missing },
      )
      : { ok: true };
  }

  function createQuickTurnActionExecutor(options = {}) {
    const handlers = {
      industry: options.executeIndustry,
      card_corner: options.executeCardCorner,
      runezu_face_symbol: options.executeRunezuFaceSymbol,
    };
    for (const family of ACTION_FAMILIES) {
      if (typeof handlers[family] !== "function") {
        throw new TypeError(`Quick/Turn executor 缺少 ${family} 生产 flow`);
      }
    }

    function execute(workingRoot, descriptor, executeOptions = {}) {
      const rootCheck = requireWorkingRoot(workingRoot);
      if (!rootCheck.ok) return rootCheck;
      if (!ACTION_FAMILIES.includes(descriptor?.family)) {
        return fail(
          "QUICK_TURN_FAMILY_INVALID",
          `Quick/Turn executor 不接受 family: ${descriptor?.family || "<missing>"}`,
        );
      }
      if (typeof executeOptions.validate === "function") {
        const validation = executeOptions.validate(workingRoot, clone(descriptor));
        if (!validation?.ok) return validation;
      }

      const before = clone(workingRoot);
      try {
        const result = handlers[descriptor.family](workingRoot, clone(descriptor));
        if (!result?.ok) {
          restoreWorkingRoot(workingRoot, before);
          return result?.ok === false
            ? result
            : fail("QUICK_TURN_EXECUTION_FAILED", `${descriptor.family} 未返回成功结果`);
        }
        return { ...result, action: clone(descriptor) };
      } catch (error) {
        restoreWorkingRoot(workingRoot, before);
        return fail("QUICK_TURN_EXECUTOR_THROWN", error?.message || `${descriptor.family} executor 执行异常`);
      }
    }

    return Object.freeze({
      actionFamilies: ACTION_FAMILIES,
      execute,
    });
  }

  function createQuickTradeFlow(context = {}) {
    const runQuickTrade = (tradeId) => context.dispatchRuleInput({
      kind: "standard_intent",
      family: "quick_trade",
      selector: { tradeId },
    });

    return Object.freeze({ runQuickTrade });
  }

  return Object.freeze({ ACTION_FAMILIES, createQuickTurnActionExecutor, createQuickTradeFlow });
});
