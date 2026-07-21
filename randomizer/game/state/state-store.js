(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiStateStore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-committed-game-state-v1";
  const REQUIRED_ROOT_SLICES = Object.freeze([
    "meta",
    "match",
    "turn",
    "players",
    "solarSystem",
    "pieces",
    "planets",
    "data",
    "cards",
    "tech",
    "aliens",
    "finalScoring",
  ]);
  const DOMAIN_SLICES = Object.freeze(REQUIRED_ROOT_SLICES.filter((key) => key !== "meta"));

  function isPlainObject(value) {
    if (value == null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function clone(value) {
    return structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function stableSerialize(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`
    )).join(",")}}`;
  }

  function validationError(path, code, message) {
    return Object.freeze({ path, code, message });
  }

  function validateSerializableGraph(value, errors, path = "$", ancestors = new Set()) {
    if (value === null) return;
    const valueType = typeof value;
    if (valueType === "string" || valueType === "boolean") return;
    if (valueType === "number") {
      if (!Number.isFinite(value)) {
        errors.push(validationError(path, "STATE_NON_FINITE_NUMBER", `${path} 必须是有限数字`));
      }
      return;
    }
    if (valueType !== "object") {
      errors.push(validationError(path, "STATE_NOT_SERIALIZABLE", `${path} 包含不可序列化的 ${valueType}`));
      return;
    }
    if (ancestors.has(value)) {
      errors.push(validationError(path, "STATE_CYCLIC_REFERENCE", `${path} 包含循环引用`));
      return;
    }
    if (!Array.isArray(value) && !isPlainObject(value)) {
      errors.push(validationError(path, "STATE_NON_PLAIN_OBJECT", `${path} 必须是普通对象或数组`));
      return;
    }

    ancestors.add(value);
    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (Array.isArray(value) && key === "length") continue;
      const childPath = Array.isArray(value) ? `${path}[${String(key)}]` : `${path}.${String(key)}`;
      if (typeof key === "symbol") {
        errors.push(validationError(childPath, "STATE_SYMBOL_KEY", `${path} 不得包含 Symbol key`));
        continue;
      }
      if (key === "__proto__") {
        errors.push(validationError(childPath, "STATE_UNSAFE_KEY", `${childPath} 是禁止字段`));
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
        errors.push(validationError(childPath, "STATE_ACCESSOR_OR_HIDDEN_FIELD", `${childPath} 必须是可枚举数据字段`));
        continue;
      }
      validateSerializableGraph(descriptor.value, errors, childPath, ancestors);
    }
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          errors.push(validationError(`${path}[${index}]`, "STATE_SPARSE_ARRAY", `${path} 不得包含数组空洞`));
        }
      }
    }
    ancestors.delete(value);
  }

  function validateRootSchema(candidate) {
    const errors = [];
    validateSerializableGraph(candidate, errors);
    if (!isPlainObject(candidate)) {
      errors.push(validationError("$", "STATE_ROOT_INVALID", "CommittedGameState 必须是普通对象"));
      return errors;
    }

    const rootKeys = Object.keys(candidate);
    for (const key of REQUIRED_ROOT_SLICES) {
      if (!Object.hasOwn(candidate, key)) {
        errors.push(validationError(`$.${key}`, "STATE_SLICE_MISSING", `缺少权威状态切片 ${key}`));
      }
    }
    for (const key of rootKeys) {
      if (!REQUIRED_ROOT_SLICES.includes(key)) {
        errors.push(validationError(`$.${key}`, "STATE_ROOT_FIELD_UNKNOWN", `权威状态根不接受未知字段 ${key}`));
      }
    }

    const meta = candidate.meta;
    if (!isPlainObject(meta)) {
      errors.push(validationError("$.meta", "STATE_META_INVALID", "meta 必须是普通对象"));
      return errors;
    }
    if (meta.schemaVersion !== SCHEMA_VERSION) {
      errors.push(validationError(
        "$.meta.schemaVersion",
        "STATE_SCHEMA_VERSION_UNSUPPORTED",
        `schemaVersion 必须是 ${SCHEMA_VERSION}`,
      ));
    }
    if (!Number.isSafeInteger(meta.stateVersion) || meta.stateVersion < 0) {
      errors.push(validationError("$.meta.stateVersion", "STATE_VERSION_INVALID", "stateVersion 必须是非负安全整数"));
    }
    if (typeof meta.gameId !== "string" || !meta.gameId.trim()) {
      errors.push(validationError("$.meta.gameId", "STATE_GAME_ID_INVALID", "gameId 必须是非空字符串"));
    }
    if (typeof meta.rulesetVersion !== "string" || !meta.rulesetVersion.trim()) {
      errors.push(validationError("$.meta.rulesetVersion", "STATE_RULESET_VERSION_INVALID", "rulesetVersion 必须是非空字符串"));
    }
    if (!((typeof meta.seed === "string" && meta.seed.length > 0)
      || (typeof meta.seed === "number" && Number.isFinite(meta.seed)))) {
      errors.push(validationError("$.meta.seed", "STATE_SEED_INVALID", "seed 必须是非空字符串或有限数字"));
    }
    if (!isPlainObject(meta.rngState)) {
      errors.push(validationError("$.meta.rngState", "STATE_RNG_INVALID", "rngState 必须是可恢复的普通对象"));
    }
    if (!isPlainObject(meta.sequences)) {
      errors.push(validationError("$.meta.sequences", "STATE_SEQUENCES_INVALID", "sequences 必须是普通对象"));
    } else {
      for (const [key, sequence] of Object.entries(meta.sequences)) {
        if (!Number.isSafeInteger(sequence) || sequence < 0) {
          errors.push(validationError(
            `$.meta.sequences.${key}`,
            "STATE_SEQUENCE_INVALID",
            `唯一编号序列 ${key} 必须是非负安全整数`,
          ));
        }
      }
    }
    for (const key of DOMAIN_SLICES) {
      if (Object.hasOwn(candidate, key) && !isPlainObject(candidate[key])) {
        errors.push(validationError(`$.${key}`, "STATE_SLICE_INVALID", `${key} 必须是普通对象`));
      }
    }
    return errors;
  }

  function normalizeInvariantErrors(result, index) {
    if (result == null || result === true || result.ok === true) return [];
    if (result === false) {
      return [validationError("$", "STATE_INVARIANT_FAILED", `状态不变量 ${index + 1} 失败`)];
    }
    if (Array.isArray(result.errors)) {
      return result.errors.map((error) => validationError(
        error.path || "$",
        error.code || "STATE_INVARIANT_FAILED",
        error.message || `状态不变量 ${index + 1} 失败`,
      ));
    }
    return [validationError(
      result.path || "$",
      result.code || "STATE_INVARIANT_FAILED",
      result.message || `状态不变量 ${index + 1} 失败`,
    )];
  }

  function createCommittedGameState(options = {}) {
    return {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        stateVersion: options.stateVersion ?? 0,
        gameId: options.gameId || "",
        rulesetVersion: options.rulesetVersion || "",
        seed: options.seed ?? "",
        rngState: clone(options.rngState ?? {}),
        sequences: clone(options.sequences ?? {}),
      },
      match: clone(options.match ?? {}),
      turn: clone(options.turn ?? {}),
      players: clone(options.players ?? {}),
      solarSystem: clone(options.solarSystem ?? {}),
      pieces: clone(options.pieces ?? {}),
      planets: clone(options.planets ?? {}),
      data: clone(options.data ?? {}),
      cards: clone(options.cards ?? {}),
      tech: clone(options.tech ?? {}),
      aliens: clone(options.aliens ?? {}),
      finalScoring: clone(options.finalScoring ?? {}),
    };
  }

  function createStateStore(initialState, options = {}) {
    const invariantValidators = Array.isArray(options.invariantValidators)
      ? [...options.invariantValidators]
      : [];
    const listeners = new Set();
    let committedState;

    for (const validator of invariantValidators) {
      if (typeof validator !== "function") throw new TypeError("invariantValidators 必须只包含函数");
    }

    function validate(candidate) {
      const errors = validateRootSchema(candidate);
      if (!errors.length) {
        for (let index = 0; index < invariantValidators.length; index += 1) {
          try {
            errors.push(...normalizeInvariantErrors(invariantValidators[index](clone(candidate)), index));
          } catch (error) {
            errors.push(validationError(
              "$",
              "STATE_INVARIANT_THROWN",
              error?.message || `状态不变量 ${index + 1} 抛出异常`,
            ));
          }
        }
      }
      return errors.length
        ? { ok: false, code: errors[0].code, errors: Object.freeze(errors) }
        : { ok: true, schemaVersion: SCHEMA_VERSION, stateVersion: candidate.meta.stateVersion };
    }

    function loadCurrent(candidate) {
      let working;
      try {
        working = clone(candidate);
      } catch (error) {
        return { ok: false, code: "STATE_DESERIALIZE_FAILED", message: error?.message || "状态输入不可克隆" };
      }
      const validation = validate(working);
      if (!validation.ok) return validation;
      return {
        ok: true,
        state: deepFreeze(clone(working)),
        schemaVersion: SCHEMA_VERSION,
      };
    }

    function deserialize(serialized) {
      let parsed;
      try {
        parsed = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
      } catch (error) {
        return { ok: false, code: "STATE_DESERIALIZE_FAILED", message: error?.message || "状态 JSON 损坏" };
      }
      return loadCurrent(parsed);
    }

    const initial = loadCurrent(initialState);
    if (!initial.ok) {
      const error = new TypeError(`初始 CommittedGameState 无效: ${initial.code}`);
      error.validation = initial;
      throw error;
    }
    committedState = initial.state;

    function getSnapshot() {
      return deepFreeze(clone(committedState));
    }

    function beginWorkingCopy(baseVersion = committedState.meta.stateVersion) {
      const currentVersion = committedState.meta.stateVersion;
      if (baseVersion !== currentVersion) {
        return {
          ok: false,
          code: "STATE_VERSION_CONFLICT",
          baseVersion,
          currentVersion,
        };
      }
      return {
        ok: true,
        baseVersion: currentVersion,
        state: clone(committedState),
      };
    }

    function compareAndCommit(baseVersion, candidate, metadata = null) {
      const currentVersion = committedState.meta.stateVersion;
      if (baseVersion !== currentVersion) {
        return { ok: false, code: "STATE_VERSION_CONFLICT", baseVersion, currentVersion };
      }

      let isolatedCandidate;
      let isolatedMetadata;
      try {
        isolatedCandidate = clone(candidate);
        isolatedMetadata = clone(metadata);
      } catch (error) {
        return { ok: false, code: "STATE_NOT_SERIALIZABLE", message: error?.message || "候选状态不可克隆" };
      }
      if (isolatedCandidate?.meta?.stateVersion !== baseVersion) {
        return {
          ok: false,
          code: "STATE_CANDIDATE_VERSION_MISMATCH",
          baseVersion,
          candidateVersion: isolatedCandidate?.meta?.stateVersion ?? null,
        };
      }
      const validation = validate(isolatedCandidate);
      if (!validation.ok) return validation;

      isolatedCandidate.meta.stateVersion = currentVersion + 1;
      const nextValidation = validate(isolatedCandidate);
      if (!nextValidation.ok) return nextValidation;

      const previousState = committedState;
      const nextState = deepFreeze(clone(isolatedCandidate));
      committedState = nextState;
      const event = deepFreeze({
        type: "committed",
        previousVersion: currentVersion,
        stateVersion: nextState.meta.stateVersion,
        snapshot: clone(nextState),
        metadata: isolatedMetadata,
      });
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch (error) {
          // 订阅者属于宿主边界；提交已经成立，宿主异常不得制造半提交。
        }
      }
      return {
        ok: true,
        previousVersion: previousState.meta.stateVersion,
        stateVersion: nextState.meta.stateVersion,
        snapshot: getSnapshot(),
      };
    }

    function serialize(candidate = committedState) {
      const validation = validate(candidate);
      if (!validation.ok) return validation;
      return { ok: true, serialized: stableSerialize(candidate) };
    }

    function subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("StateStore subscriber 必须是函数");
      listeners.add(listener);
      return function unsubscribe() {
        listeners.delete(listener);
      };
    }

    return Object.freeze({
      getSnapshot,
      beginWorkingCopy,
      validate,
      compareAndCommit,
      serialize,
      deserialize,
      subscribe,
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    REQUIRED_ROOT_SLICES,
    createCommittedGameState,
    createStateStore,
  });
});
