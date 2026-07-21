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
    const { actions, abilities, players } = options;
    if (typeof actions?.getAction !== "function") {
      throw new TypeError("Engine Action executor 缺少 actions registry");
    }
    if (typeof abilities?.executeAbility !== "function") {
      throw new TypeError("Engine Action executor 缺少 abilities executor");
    }
    if (typeof players?.getCurrentPlayer !== "function") {
      throw new TypeError("Engine Action executor 缺少 players capability");
    }
    if (typeof options.createActionContext !== "function") {
      throw new TypeError("Engine Action executor 缺少 working-root action context factory");
    }
    if (typeof options.executeScan !== "function") {
      throw new TypeError("Engine Action executor 缺少 scan production flow");
    }
    if (typeof options.executePlayCard !== "function") {
      throw new TypeError("Engine Action executor 缺少 play_card production flow");
    }

    function executeFamily(workingRoot, descriptor) {
      const context = options.createActionContext(workingRoot, descriptor);
      if (descriptor.family === "research_tech") {
        const action = actions.getAction("researchTech");
        if (!action?.execute) return fail("ENGINE_ACTION_EXECUTOR_MISSING", "缺少 research_tech 生产 executor");
        return action.execute(context, {
          ...(descriptor.payload || {}),
          tileId: descriptor.target?.tileId,
          blueSlot: descriptor.target?.blueSlot ?? null,
        });
      }
      if (descriptor.family === "scan") {
        return options.executeScan(workingRoot, clone(descriptor));
      }
      if (descriptor.family === "analyze") {
        const player = players.getCurrentPlayer(context.playerState);
        const actionOptions = typeof options.getAnalyzeActionOptions === "function"
          ? options.getAnalyzeActionOptions(player, descriptor.payload || {}, workingRoot)
          : { ...(descriptor.payload || {}) };
        const result = abilities.executeAbility("analyzeData", context, actionOptions);
        if (result?.ok && typeof options.afterAnalyze === "function") {
          options.afterAnalyze(workingRoot, result, clone(descriptor));
        }
        return result;
      }
      return options.executePlayCard(workingRoot, clone(descriptor));
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
        const result = executeFamily(workingRoot, clone(descriptor));
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
