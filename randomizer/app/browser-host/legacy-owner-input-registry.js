(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiLegacyBrowserOwnerInputRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, extra = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(extra) });
  }

  // SETI-170 删除的临时兼容 owner。它不是 Browser service，也不得新增 consumer。
  function createOwnerInputRegistry(options = {}) {
    if (typeof options.submit !== "function") throw new TypeError("OwnerInputRegistry 需要 submit port");
    if (typeof options.clonePresentation !== "function") {
      throw new TypeError("OwnerInputRegistry 需要 clonePresentation port");
    }
    const handlers = new Map();
    const owners = new Map();

    function assertOwner(owner) {
      if (typeof owner !== "string" || !/^[a-z][a-z0-9_]*$/.test(owner)) {
        throw new TypeError(`Owner input registry 的 owner 非法: ${String(owner)}`);
      }
    }

    function register(owner, inputHandlers = {}) {
      assertOwner(owner);
      if (owners.has(owner)) throw new Error(`Owner input registry 重复 owner: ${owner}`);
      const names = Object.keys(inputHandlers);
      if (!names.length) throw new TypeError(`Owner input registry ${owner} 没有声明 input`);
      const port = {};
      for (const name of names) {
        if (typeof name !== "string" || !/^[a-z][A-Za-z0-9]*$/.test(name)) {
          throw new TypeError(`Owner input registry ${owner} 的 input 名非法: ${String(name)}`);
        }
        const handler = inputHandlers[name];
        if (typeof handler !== "function") throw new TypeError(`${owner}.${name} input handler 不是函数`);
        const kind = `${owner}.${name}`;
        if (handlers.has(kind)) throw new Error(`Owner input registry 重复 kind: ${kind}`);
        handlers.set(kind, Object.freeze({ owner, handler }));
        port[name] = (...args) => {
          const result = options.submit({ kind, args });
          return result?.ok === false ? result : result?.value;
        };
      }
      owners.set(owner, Object.freeze(new Set(names)));
      return Object.freeze(port);
    }

    function registerTarget(owner, inputNames, getTarget) {
      if (!Array.isArray(inputNames) || !inputNames.length || new Set(inputNames).size !== inputNames.length) {
        throw new TypeError(`Owner input registry ${owner} 的 input schema 非法或重复`);
      }
      if (typeof getTarget !== "function") throw new TypeError(`${owner} 缺少 target resolver`);
      return register(owner, Object.fromEntries(inputNames.map((name) => [
        name,
        (workingRoot, command) => {
          const target = getTarget();
          const method = target?.[name];
          if (typeof method !== "function") {
            return fail("BROWSER_OWNER_INPUT_UNAVAILABLE", `Browser owner input 未装配: ${owner}.${name}`);
          }
          const value = method(workingRoot, ...(command.args || []));
          return { ok: value?.ok !== false, value: options.clonePresentation(value) };
        },
      ])));
    }

    function execute(workingRoot, command = {}) {
      if (Object.hasOwn(command, "domain") || Object.hasOwn(command, "operation")) {
        return fail("BROWSER_OWNER_INPUT_CROSS_DOMAIN", "Browser owner input 不接受 domain/operation 逃生字段");
      }
      const entry = handlers.get(command.kind);
      if (!entry) return fail("BROWSER_OWNER_INPUT_UNKNOWN", `未知 Browser owner input: ${command.kind || "<missing>"}`);
      const separator = command.kind.indexOf(".");
      if (separator < 1 || command.kind.slice(0, separator) !== entry.owner) {
        return fail("BROWSER_OWNER_INPUT_CROSS_DOMAIN", `Browser owner input 越权: ${command.kind}`);
      }
      return entry.handler(workingRoot, command);
    }

    return Object.freeze({ register, registerTarget, execute });
  }

  return Object.freeze({ createOwnerInputRegistry });
});
