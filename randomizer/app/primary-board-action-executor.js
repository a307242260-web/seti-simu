(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiPrimaryBoardActionExecutor = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const ACTION_FAMILIES = Object.freeze(["launch", "move", "orbit", "land"]);

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
      "playerState", "turnState", "solarState", "rocketState", "planetStatsState",
      "alienGameState", "cardState", "techGameState", "nebulaDataState",
    ];
    const missing = required.filter((key) => !root?.[key]);
    if (missing.length) {
      return fail(
        "PRIMARY_BOARD_WORKING_ROOT_INVALID",
        `Primary Board executor 缺少 working root slices: ${missing.join(", ")}`,
        { missing },
      );
    }
    return { ok: true };
  }

  function createPrimaryBoardActionExecutor(options = {}) {
    const actions = options.actions;
    const abilities = options.abilities;
    const solar = options.solar;
    if (typeof actions?.getAction !== "function") {
      throw new TypeError("Primary Board executor 缺少 actions registry");
    }
    if (typeof abilities?.executeAbility !== "function") {
      throw new TypeError("Primary Board executor 缺少 abilities executor");
    }
    if (typeof solar?.createSolarSnapshot !== "function") {
      throw new TypeError("Primary Board executor 缺少 solar snapshot capability");
    }

    function createActionContext(workingRoot, descriptor) {
      const playerState = descriptor.actorId === workingRoot.playerState.currentPlayerId
        ? workingRoot.playerState
        : {
          ...workingRoot.playerState,
          currentPlayerId: descriptor.actorId,
          players: workingRoot.playerState.players,
        };
      const getPlanetLocations = () => solar.createSolarSnapshot(workingRoot.solarState).planetLocations;
      const getEarthSectorCoordinate = () => {
        const earth = getPlanetLocations().find((planet) => planet.planetId === "earth");
        if (!earth) throw new Error("Earth position was not found in the current solar snapshot");
        return { x: earth.x, y: earth.y };
      };
      return {
        solarState: workingRoot.solarState,
        playerState,
        cardState: workingRoot.cardState,
        rocketState: workingRoot.rocketState,
        nebulaDataState: workingRoot.nebulaDataState,
        planetStatsState: workingRoot.planetStatsState,
        alienGameState: workingRoot.alienGameState,
        techBoardState: workingRoot.techGameState.board,
        techUiState: workingRoot.techGameState.ui,
        techGameState: workingRoot.techGameState,
        turnState: workingRoot.turnState,
        stateVersion: workingRoot.meta?.stateVersion ?? 0,
        decisionVersion: workingRoot.match?.decisionVersion ?? 0,
        roundNumber: workingRoot.turnState.roundNumber,
        turnNumber: workingRoot.turnState.turnNumber,
        getEarthSectorCoordinate,
        getPlanetLocations,
      };
    }

    function executeFamily(context, descriptor, executionOptions) {
      if (descriptor.family === "move") {
        return abilities.executeAbility("moveProbe", context, {
          ...(executionOptions || {}),
          rocketId: descriptor.target?.rocketId,
          deltaX: descriptor.target?.deltaX,
          deltaY: descriptor.target?.deltaY,
        });
      }
      const action = actions.getAction(descriptor.family);
      if (!action?.execute) {
        return fail("PRIMARY_BOARD_EXECUTOR_MISSING", `缺少 ${descriptor.family} 生产 executor`);
      }
      if (descriptor.family === "orbit") {
        return action.execute(context, { rocketId: descriptor.target?.rocketId });
      }
      if (descriptor.family === "land") {
        return action.execute(context, {
          rocketId: descriptor.target?.rocketId,
          target: {
            type: descriptor.target?.type,
            ...(descriptor.target?.satelliteId ? { satelliteId: descriptor.target.satelliteId } : {}),
          },
        });
      }
      return action.execute(context);
    }

    function execute(workingRoot, descriptor, executeOptions = {}) {
      const rootCheck = requireWorkingRoot(workingRoot);
      if (!rootCheck.ok) return rootCheck;
      if (!ACTION_FAMILIES.includes(descriptor?.family)) {
        return fail(
          "PRIMARY_BOARD_FAMILY_INVALID",
          `Primary Board executor 不接受 family: ${descriptor?.family || "<missing>"}`,
        );
      }
      const context = createActionContext(workingRoot, descriptor);
      if (typeof executeOptions.validate === "function") {
        const validation = executeOptions.validate(context, clone(descriptor));
        if (!validation?.ok) return validation;
      }

      const before = clone(workingRoot);
      try {
        const result = executeFamily(context, descriptor, executeOptions.executionOptions);
        if (!result?.ok) {
          restoreWorkingRoot(workingRoot, before);
          return result?.ok === false
            ? result
            : fail("PRIMARY_BOARD_EXECUTION_FAILED", `${descriptor.family} 未返回成功结果`);
        }
        return { ...result, action: clone(descriptor) };
      } catch (error) {
        restoreWorkingRoot(workingRoot, before);
        return fail(
          "PRIMARY_BOARD_EXECUTOR_THROWN",
          error?.message || `${descriptor.family} executor 执行异常`,
        );
      }
    }

    return Object.freeze({ actionFamilies: ACTION_FAMILIES, execute });
  }

  return Object.freeze({ ACTION_FAMILIES, createPrimaryBoardActionExecutor });
});
