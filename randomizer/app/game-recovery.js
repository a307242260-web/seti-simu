(function (root, factory) {
  "use strict";
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiAppGameRecovery = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";
  const BROWSER_CHECKPOINT_SCHEMA_VERSION = "seti-browser-checkpoint-v1";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function failure(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function requireFunction(source, key, label) {
    if (typeof source?.[key] !== "function") throw new TypeError(`${label} 缺少 ${key}()`);
    return source[key].bind(source);
  }

  function createBrowserCheckpointAdapter(options = {}) {
    const lifecycle = options.ruleLifecycle;
    const saveRules = requireFunction(lifecycle, "save", "Rule Composition lifecycle");
    const validateRules = requireFunction(lifecycle, "validateRestore", "Rule Composition lifecycle");
    const restoreRules = requireFunction(lifecycle, "restore", "Rule Composition lifecycle");
    const viewStateStore = options.viewStateStore || null;
    const viewSchemaVersion = options.viewSchemaVersion;
    if (!viewSchemaVersion) throw new TypeError("Browser checkpoint adapter 缺少 ViewState schema");

    function capture(captureOptions = {}) {
      const rules = saveRules(clone(captureOptions.ruleLifecycle || {}));
      if (!rules?.ok || !rules.envelope?.schemaVersion) {
        return failure(rules?.code || "BROWSER_RULES_SAVE_FAILED", rules?.message || "Rule Composition save 失败");
      }
      const view = viewStateStore?.getSnapshot ? clone(viewStateStore.getSnapshot()) : null;
      if (view && view.schemaVersion !== viewSchemaVersion) {
        return failure("BROWSER_VIEW_SCHEMA_UNSUPPORTED", "ViewState schema 不受支持");
      }
      return {
        ok: true,
        envelope: {
          schemaVersion: BROWSER_CHECKPOINT_SCHEMA_VERSION,
          savedAt: (options.now?.() || new Date()).toISOString(),
          rules: { schemaVersion: rules.envelope.schemaVersion, envelope: clone(rules.envelope) },
          view: view == null ? null : { schemaVersion: view.schemaVersion, state: view },
        },
      };
    }

    function validateEnvelope(envelope) {
      if (!envelope || envelope.schemaVersion !== BROWSER_CHECKPOINT_SCHEMA_VERSION) {
        return failure("BROWSER_RECOVERY_SCHEMA_UNSUPPORTED", "Browser recovery envelope schema 不受支持");
      }
      const allowedKeys = ["schemaVersion", "savedAt", "rules", "view"];
      const unknownKeys = Object.keys(envelope).filter((key) => !allowedKeys.includes(key));
      if (unknownKeys.length) {
        return failure("BROWSER_RECOVERY_FIELDS_UNSUPPORTED", "Browser recovery envelope 包含未知字段", { unknownKeys });
      }
      if (!envelope.rules?.envelope || envelope.rules.schemaVersion !== envelope.rules.envelope.schemaVersion) {
        return failure("BROWSER_RECOVERY_RULES_MISSING", "Browser recovery envelope 缺少 Rule Composition 存档");
      }
      const rules = validateRules(clone(envelope.rules.envelope));
      if (!rules?.ok) {
        return failure(rules?.code || "BROWSER_RECOVERY_RULES_INVALID", rules?.message || "Rule Composition 存档无效");
      }
      if (envelope.view != null) {
        if (envelope.view.schemaVersion !== viewSchemaVersion || envelope.view.state?.schemaVersion !== viewSchemaVersion) {
          return failure("BROWSER_RECOVERY_VIEW_INVALID", "ViewState schema 不受支持");
        }
        if (typeof viewStateStore?.validate !== "function" || typeof viewStateStore?.restore !== "function") {
          return failure("BROWSER_RECOVERY_VIEW_PORT_MISSING", "存档包含 ViewState，但宿主没有恢复协议");
        }
        const viewValidation = viewStateStore.validate(clone(envelope.view.state));
        if (!viewValidation?.ok) {
          return failure(
            viewValidation?.code || "BROWSER_RECOVERY_VIEW_INVALID",
            viewValidation?.message || "ViewState snapshot 无效",
          );
        }
      }
      return { ok: true, rules: clone(envelope.rules.envelope), view: clone(envelope.view?.state ?? null) };
    }

    function restore(envelope) {
      const validated = validateEnvelope(envelope);
      if (!validated.ok) return validated;
      const beforeRules = saveRules();
      if (!beforeRules?.ok) {
        return failure(
          beforeRules?.code || "BROWSER_RULES_SAVE_FAILED",
          beforeRules?.message || "恢复前 Rule Composition capture 失败",
        );
      }
      const beforeView = viewStateStore?.getSnapshot ? clone(viewStateStore.getSnapshot()) : null;
      const rulesResult = restoreRules(clone(validated.rules));
      if (!rulesResult?.ok) {
        return failure(
          rulesResult?.code || "BROWSER_RECOVERY_RULES_RESTORE_FAILED",
          rulesResult?.message || "Rule Composition restore 拒绝恢复",
        );
      }
      const viewResult = validated.view != null ? viewStateStore.restore(validated.view) : viewStateStore?.clear?.();
      if (viewResult?.ok === false) {
        const rollback = restoreRules(clone(beforeRules.envelope));
        if (rollback?.ok === false) throw new Error("Rule Composition 恢复回滚失败");
        if (beforeView != null) viewStateStore?.restore?.(beforeView);
        return failure(
          viewResult.code || "BROWSER_RECOVERY_VIEW_RESTORE_FAILED",
          viewResult.message || "ViewState restore port 拒绝恢复",
        );
      }
      return {
        ok: true,
        stateVersion: rulesResult.projection?.stateVersion ?? null,
        sessionRestored: Boolean(validated.rules.session),
        viewRestored: validated.view != null,
      };
    }

    return Object.freeze({ capture, validateEnvelope, restore });
  }

  return Object.freeze({
    BROWSER_CHECKPOINT_SCHEMA_VERSION,
    createBrowserCheckpointAdapter,
  });
});
