(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppEffectExecutorBootstrap = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createCapabilityScope(owner, capabilities, extensions = {}) {
    return new Proxy(Object.create(null), {
      get(_target, key) {
        if (typeof key === "symbol") return undefined;
        if (Object.prototype.hasOwnProperty.call(extensions, key)) return extensions[key];
        if (Object.prototype.hasOwnProperty.call(capabilities, key)) return capabilities[key];
        throw new Error(`Missing ${owner} effect executor capability: ${String(key)}`);
      },
      has(_target, key) {
        return Object.prototype.hasOwnProperty.call(extensions, key)
          || Object.prototype.hasOwnProperty.call(capabilities, key);
      },
    });
  }

  function requireFactory(moduleApi, factoryName) {
    const factory = moduleApi?.[factoryName];
    if (typeof factory !== "function") {
      throw new TypeError(`effect executor bootstrap requires ${factoryName}`);
    }
    return factory;
  }

  function createEffectExecutorSuite(options = {}) {
    const {
      capabilities,
      movementScanModule,
      rewardModule,
      alienModule,
      dispatcherModule,
    } = options;
    if (!capabilities || typeof capabilities !== "object") {
      throw new TypeError("effect executor bootstrap requires a capability inventory");
    }

    const movementScan = requireFactory(
      movementScanModule,
      "createEffectMovementScanExecutors",
    )(createCapabilityScope("movement/scan", capabilities));
    const rewards = requireFactory(
      rewardModule,
      "createEffectRewardExecutors",
    )(createCapabilityScope("reward", capabilities, movementScan));
    const aliens = requireFactory(
      alienModule,
      "createEffectAlienExecutors",
    )(createCapabilityScope("alien", capabilities, { ...movementScan, ...rewards }));
    const executors = {
      ...movementScan,
      ...rewards,
      ...aliens,
    };
    Object.assign(
      executors,
      requireFactory(dispatcherModule, "createEffectDispatcher")(
        createCapabilityScope("dispatcher", capabilities, executors),
      ),
    );
    return Object.freeze(executors);
  }

  return { createEffectExecutorSuite };
});
