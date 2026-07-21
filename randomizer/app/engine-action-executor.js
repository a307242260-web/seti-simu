(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiEngineActionExecutor = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const ACTION_FAMILIES = Object.freeze(["research_tech", "scan", "analyze", "play_card"]);

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
    const required = ["playerState", "turnState", "cardState", "techGameState", "nebulaDataState"];
    const missing = required.filter((key) => !root?.[key]);
    return missing.length
      ? fail(
        "ENGINE_ACTION_WORKING_ROOT_INVALID",
        `Engine Action executor 缺少 working root slices: ${missing.join(", ")}`,
        { missing },
      )
      : { ok: true };
  }

  function createEngineActionExecutor(options = {}) {
    const executors = options.executors || {};
    for (const family of ACTION_FAMILIES) {
      if (typeof executors[family] !== "function") {
        throw new TypeError(`Engine Action executor 缺少 ${family} 生产实现`);
      }
    }

    function execute(workingRoot, descriptor, executeOptions = {}) {
      const rootCheck = requireWorkingRoot(workingRoot);
      if (!rootCheck.ok) return rootCheck;
      if (!ACTION_FAMILIES.includes(descriptor?.family)) {
        return fail(
          "ENGINE_ACTION_FAMILY_INVALID",
          `Engine Action executor 不接受 family: ${descriptor?.family || "<missing>"}`,
        );
      }
      if (typeof executeOptions.validate === "function") {
        const validation = executeOptions.validate(workingRoot, clone(descriptor));
        if (!validation?.ok) return validation;
      }

      const before = clone(workingRoot);
      try {
        const result = executors[descriptor.family](workingRoot, clone(descriptor));
        if (!result?.ok) {
          restoreWorkingRoot(workingRoot, before);
          return result?.ok === false
            ? result
            : fail("ENGINE_ACTION_EXECUTION_FAILED", `${descriptor.family} 未返回成功结果`);
        }
        return { ...result, action: clone(descriptor) };
      } catch (error) {
        restoreWorkingRoot(workingRoot, before);
        return fail(
          "ENGINE_ACTION_EXECUTOR_THROWN",
          error?.message || `${descriptor.family} executor 执行异常`,
        );
      }
    }

    return Object.freeze({ actionFamilies: ACTION_FAMILIES, execute });
  }

  return Object.freeze({ ACTION_FAMILIES, createEngineActionExecutor });
});
