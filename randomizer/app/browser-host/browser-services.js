(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserServices = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-services-v1";
  const VIEW_SCHEMA_VERSION = "seti-browser-host-v1";
  const LEGACY_DOMAIN_COMMANDS = Object.freeze({
    scan_flow: Object.freeze([
      "getPublicScanMaxSelectable", "buildReadySectorFinishEffects", "buildScanFinalizeFollowupEffects",
      "replaceNebulaDataForCurrentPlayer", "getSectorFinishWinnerTarget", "executeScanActionFinalizeEffect",
      "executeSectorFinishScanEffect", "replenishDelayedPublicRefillSlots", "executeScanPublicRefillEffect",
      "settleDelayedPublicRefillsAfterScanFlow", "buildEndOfFlowFollowupEffects",
      "shouldAppendQueuedSectorFinishEffects", "appendEndOfFlowSectorFinishEffects", "discardPublicScanCard",
      "discardHandScanCard", "finalizeScanSourceCard", "restoreYichangdianCornerPickerIfPending",
      "closeScanTargetPicker", "nebulaHasScannableData", "buildNebulaScanChoice", "isAomomoActive",
      "getAomomoPlanetLocation", "getAomomoCurrentX", "getNebulaCurrentX", "getSectorScanTargetLabel",
      "buildAomomoScanChoiceForX", "hasAomomoScanAtX", "buildSectorScanChoicesForX",
      "expandScanChoicesWithAomomoTargets", "confirmScanTarget", "handleDrawnHandScanSkip", "beginSectorScan",
      "getSectorOpenDataCount", "getSectorReplacedCount", "getSectorExtraMarkCount", "getPublicScanChoicesForCard",
      "hasHandScanTargetCard", "createPublicScanPendingAction", "beginPublicDeckScan", "beginPublicScanForSingleCard",
      "confirmPublicScanSelection", "handlePublicScanCardClick", "beginHandScan", "cancelHandScanSelection",
      "handleHandScanCardClick",
    ]),
    alien_ui: Object.freeze([
      "buildAlienRevealNoticeEntry", "getAlienTracePickerPlayer", "canPlaceJiuzheTrace",
      "canPlaceYichangdianTrace", "canPlaceFangzhouTrace", "canPlaceBanrenmaTrace", "canPlaceChongTrace",
      "canPlaceAmibaTrace", "canPlaceAomomoTrace", "canPlaceRunezuTrace", "canPlaceRunezuFaceSymbol",
      "canPlaceStateTrace", "canPlaceAnyStateExtraTrace", "openAlienTracePicker", "beginAlienTraceBoardPlacement",
      "closeAlienTracePicker", "beginJiuzheTraceGridPlacement", "beginYichangdianTraceGridPlacement",
      "beginFangzhouTraceGridPlacement", "beginBanrenmaTraceGridPlacement", "beginAomomoTraceGridPlacement",
      "beginChongTraceGridPlacement", "beginAmibaTraceGridPlacement", "beginRunezuTraceGridPlacement",
      "renderAlienTracePickerColorStep", "openFangzhouTraceUseChoice", "openFangzhouTraceDestinationChoice",
      "handleFangzhouTraceDestinationChoice", "handleFangzhouUnlockTraceChoice", "routeFangzhouAlienTraceGain",
      "handleStateTraceSlotPlacement", "handleFangzhouTraceSlotPlacement", "getEligibleAlienSlotIdsForTraceEffect",
      "getFangzhouUnlockableTraceTypes", "hasAlienTracePanelPlacementTarget",
    ]),
    turn_end: Object.freeze([
      "executePassFirstRotateEffect", "executePassHandLimitEffect", "passForCurrentPlayer",
      "maybeResumeTurnEndAfterReveal", "maybeContinuePendingTurnEndRevealFlow",
      "maybeContinueAlienRevealQueuedOpportunities", "endCurrentTurn",
    ]),
    action_interaction: Object.freeze([
      "getPlutoReservedCards", "removePlutoMarker", "collectPlutoMarkers", "buildPlutoMarkerContext",
      "playerHasOwnPlutoLanding", "buildPlutoMarkerRemovalChoices", "getPlutoCandidateRockets",
      "getPlutoActionCost", "getAvailablePlutoAction", "executePlutoAction", "getCurrentPlanetActionPlacement",
      "openPlutoActionChoicePicker", "scheduleRenderMoveArrows", "clearMoveRocketHighlight", "activateMoveMode",
      "deactivateMoveMode", "openDataPlacePicker", "openAutoDataPlacementPrompt", "cancelDataPlacePicker",
      "confirmDataPlacement",
    ]),
    income_runtime: Object.freeze([
      "applyIndustryRoundStartBonuses", "maybeStartFundamentalismRoundStartIncomeFlow", "beginIncomeForCurrentPlayer",
    ]),
  });

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

  function requireFunction(source, key, label) {
    if (typeof source?.[key] !== "function") throw new TypeError(`${label} 缺少 ${key}()`);
    return source[key].bind(source);
  }

  function createBrowserServices(options = {}) {
    const ruleLifecycle = options.ruleLifecycle;
    const saveRules = requireFunction(ruleLifecycle, "save", "Rule Composition lifecycle");
    const validateRules = requireFunction(ruleLifecycle, "validateRestore", "Rule Composition lifecycle");
    const restoreRules = requireFunction(ruleLifecycle, "restore", "Rule Composition lifecycle");
    const viewStateStore = options.viewStateStore || null;
    const storage = options.storage || null;
    const storageKey = options.storageKey || "seti-browser-state-v1";
    const downloadPort = options.downloadPort || null;
    const debugCommandPort = options.debugCommandPort || null;

    function capture(captureOptions = {}) {
      const rules = saveRules(clone(captureOptions.ruleLifecycle || {}));
      if (!rules?.ok || !rules.envelope?.schemaVersion) {
        return fail(rules?.code || "BROWSER_RULES_SAVE_FAILED", rules?.message || "Rule Composition save 失败");
      }
      const view = viewStateStore?.getSnapshot ? clone(viewStateStore.getSnapshot()) : null;
      if (view && view.schemaVersion !== VIEW_SCHEMA_VERSION) {
        return fail("BROWSER_VIEW_SCHEMA_UNSUPPORTED", "ViewState schema 不受支持");
      }
      return deepFreeze({
        ok: true,
        envelope: {
          schemaVersion: SCHEMA_VERSION,
          savedAt: (options.now?.() || new Date()).toISOString(),
          rules: { schemaVersion: rules.envelope.schemaVersion, envelope: clone(rules.envelope) },
          view: view == null ? null : { schemaVersion: view.schemaVersion, state: view },
        },
      });
    }

    function validateEnvelope(envelope) {
      if (!envelope || envelope.schemaVersion !== SCHEMA_VERSION) {
        return fail("BROWSER_RECOVERY_SCHEMA_UNSUPPORTED", "Browser recovery envelope schema 不受支持");
      }
      const allowedKeys = ["schemaVersion", "savedAt", "rules", "view"];
      const unknownKeys = Object.keys(envelope).filter((key) => !allowedKeys.includes(key));
      if (unknownKeys.length) {
        return fail("BROWSER_RECOVERY_FIELDS_UNSUPPORTED", "Browser recovery envelope 包含未知字段", { unknownKeys });
      }
      if (!envelope.rules?.envelope || envelope.rules.schemaVersion !== envelope.rules.envelope.schemaVersion) {
        return fail("BROWSER_RECOVERY_RULES_MISSING", "Browser recovery envelope 缺少 Rule Composition 存档");
      }
      const rules = validateRules(clone(envelope.rules.envelope));
      if (!rules?.ok) return fail(rules?.code || "BROWSER_RECOVERY_RULES_INVALID", rules?.message || "Rule Composition 存档无效");
      if (envelope.view != null) {
        if (envelope.view.schemaVersion !== VIEW_SCHEMA_VERSION || envelope.view.state?.schemaVersion !== VIEW_SCHEMA_VERSION) {
          return fail("BROWSER_RECOVERY_VIEW_INVALID", "ViewState schema 不受支持");
        }
        if (typeof viewStateStore?.validate !== "function" || typeof viewStateStore?.restore !== "function") {
          return fail("BROWSER_RECOVERY_VIEW_PORT_MISSING", "存档包含 ViewState，但宿主没有恢复协议");
        }
        const viewValidation = viewStateStore.validate(clone(envelope.view.state));
        if (!viewValidation?.ok) return fail(viewValidation?.code || "BROWSER_RECOVERY_VIEW_INVALID", viewValidation?.message || "ViewState snapshot 无效");
      }
      return { ok: true, rules: clone(envelope.rules.envelope), view: clone(envelope.view?.state ?? null) };
    }

    function restore(envelope) {
      const validated = validateEnvelope(envelope);
      if (!validated.ok) return validated;
      const beforeRules = saveRules();
      if (!beforeRules?.ok) return fail(beforeRules?.code || "BROWSER_RULES_SAVE_FAILED", beforeRules?.message || "恢复前 Rule Composition capture 失败");
      const beforeView = viewStateStore?.getSnapshot ? clone(viewStateStore.getSnapshot()) : null;
      const rulesResult = restoreRules(clone(validated.rules));
      if (!rulesResult?.ok) return fail(rulesResult?.code || "BROWSER_RECOVERY_RULES_RESTORE_FAILED", rulesResult?.message || "Rule Composition restore 拒绝恢复");
      const viewResult = validated.view != null ? viewStateStore.restore(validated.view) : viewStateStore?.clear?.();
      if (viewResult?.ok === false) {
        const rollback = restoreRules(clone(beforeRules.envelope));
        if (rollback?.ok === false) throw new Error("Rule Composition 恢复回滚失败");
        if (beforeView != null) viewStateStore?.restore?.(beforeView);
        return fail(viewResult.code || "BROWSER_RECOVERY_VIEW_RESTORE_FAILED", viewResult.message || "ViewState restore port 拒绝恢复");
      }
      return deepFreeze({
        ok: true,
        stateVersion: rulesResult.projection?.stateVersion ?? null,
        sessionRestored: Boolean(validated.rules.session),
        viewRestored: validated.view != null,
      });
    }

    function save() {
      if (!storage?.setItem) return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      const captured = capture();
      if (!captured.ok) return captured;
      try {
        storage.setItem(storageKey, JSON.stringify(captured.envelope));
        return deepFreeze({ ok: true, storageKey, savedAt: captured.envelope.savedAt });
      } catch (error) {
        return fail("BROWSER_STORAGE_WRITE_FAILED", error?.message || "local persistence 写入失败");
      }
    }

    function load() {
      if (!storage?.getItem) return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return fail("BROWSER_STORAGE_EMPTY", "没有本地存档");
        return restore(JSON.parse(raw));
      } catch (error) {
        return fail("BROWSER_STORAGE_READ_FAILED", error?.message || "local persistence 读取失败");
      }
    }

    function clear() {
      if (!storage?.removeItem) return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      try {
        storage.removeItem(storageKey);
        return deepFreeze({ ok: true, storageKey });
      } catch (error) {
        return fail("BROWSER_STORAGE_CLEAR_FAILED", error?.message || "local persistence 清理失败");
      }
    }

    function download(request = {}) {
      if (!downloadPort?.save) return fail("BROWSER_DOWNLOAD_UNAVAILABLE", "download port 不可用");
      if (typeof request.content !== "string" || !request.filename) {
        return fail("BROWSER_DOWNLOAD_REQUEST_INVALID", "下载只接受显式 filename/content");
      }
      const result = downloadPort.save({ filename: String(request.filename), content: request.content, mimeType: request.mimeType || "text/plain;charset=utf-8" });
      return result?.ok === false ? result : deepFreeze({ ok: true, filename: String(request.filename) });
    }

    function dispatchDeveloperCommand(command) {
      if (!debugCommandPort?.dispatch) return fail("BROWSER_DEBUG_PORT_UNAVAILABLE", "debug/failsafe command port 不可用");
      if (!command || typeof command.type !== "string") return fail("BROWSER_DEBUG_COMMAND_INVALID", "debug command 必须有 type");
      return debugCommandPort.dispatch(deepFreeze(clone(command)));
    }

    function createPublicFacade() {
      return Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        capture: () => capture(),
        restore: (envelope) => restore(clone(envelope)),
        save,
        load,
        clear,
        download: (request) => download(clone(request)),
        dispatchDeveloperCommand: (command) => dispatchDeveloperCommand(clone(command)),
      });
    }

    return Object.freeze({ capture, validateEnvelope, restore, save, load, clear, download, dispatchDeveloperCommand, createPublicFacade });
  }

  function createBrowserDownloadPort(options = {}) {
    const { window, document, Blob } = options;
    return Object.freeze({
      save(request = {}) {
        const urlApi = window?.URL || window?.webkitURL;
        if (typeof Blob !== "function" || !urlApi?.createObjectURL || !document?.body) {
          return fail("BROWSER_DOWNLOAD_UNAVAILABLE", "当前浏览器不支持下载");
        }
        const blob = new Blob([request.content], { type: request.mimeType });
        const url = urlApi.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = request.filename;
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => urlApi.revokeObjectURL(url), 0);
        return { ok: true };
      },
    });
  }

  function createLegacyDomainCommandPort(options = {}) {
    const allowedCommands = Object.fromEntries(Object.entries(options.allowedCommands || LEGACY_DOMAIN_COMMANDS)
      .map(([domain, operations]) => [domain, new Set(operations)]));

    function executeBrowserDomainCommand(workingRoot, command = {}) {
      const target = options.getTarget(command.domain);
      const allowed = allowedCommands[command.domain];
      if ((allowed && !allowed.has(command.operation)) || (!allowed && !Object.hasOwn(target || {}, command.operation))) {
        return { ok: false, code: "BROWSER_DOMAIN_COMMAND_UNKNOWN", message: `未知 Browser domain command: ${command.domain}.${command.operation}` };
      }
      const method = target?.[command.operation];
      if (typeof method !== "function") {
        return { ok: false, code: "BROWSER_DOMAIN_COMMAND_UNAVAILABLE", message: `Browser domain command 未装配: ${command.domain}.${command.operation}` };
      }
      const value = method(workingRoot, ...(command.args || []));
      return { ok: value?.ok !== false, value: options.clonePresentation(value) };
    }

    function callBrowserDomainCommand(domain, operation, args = []) {
      try {
        return options.submitHostCommand({ kind: "domain_command", domain, operation, args }).value;
      } catch (error) {
        throw new Error(`${domain}.${operation}: ${error?.message || error}`, { cause: error });
      }
    }

    function callOperation(kind, operation, args = []) {
      return options.submitHostCommand({ kind, operation, args }).value;
    }

    function bindOperationCommands(kind, operations = []) {
      return Object.freeze(Object.fromEntries(operations.map((operation) => [
        operation,
        (...args) => callOperation(kind, operation, args),
      ])));
    }

    return Object.freeze({
      executeBrowserDomainCommand,
      callBrowserDomainCommand,
      bindBrowserDomainCommand: (domain, operation) => (...args) => callBrowserDomainCommand(domain, operation, args),
      bindDomainCommands(domain, operations = []) {
        return Object.freeze(Object.fromEntries(operations.map((operation) => [
          operation,
          (...args) => callBrowserDomainCommand(domain, operation, args),
        ])));
      },
      bindEffectChoiceCommands: (operations = []) => bindOperationCommands("effect_choice_command", operations),
      bindEffectExecutorCommands: (operations = []) => bindOperationCommands("effect_executor_command", operations),
      callEffectChoiceCommand: (operation, args = []) => callOperation("effect_choice_command", operation, args),
      callHandFlowCommand: (operation, args = []) => callOperation("hand_flow_command", operation, args),
      callEffectExecutorCommand: (operation, args = []) => callOperation("effect_executor_command", operation, args),
      callDebugCommand: (operation, args = []) => callOperation("debug_command", operation, args),
      setBrowserStatusNote(message) {
        return options.submitHostCommand({ kind: "ui_set_status_note", message: String(message || "") }).value;
      },
    });
  }

  function subscribeRefresh(options = {}) {
    const refresh = requireFunction(options, "refresh", "Browser refresh subscription");
    const unsubscribers = [];
    const listener = (event) => {
      try { refresh(deepFreeze(clone(event))); } catch (error) { /* 宿主刷新失败不得回滚权威提交。 */ }
    };
    if (typeof options.stateStore?.subscribe === "function") unsubscribers.push(options.stateStore.subscribe((event) => listener({ source: "state", event })));
    if (typeof options.sessionPort?.subscribe === "function") unsubscribers.push(options.sessionPort.subscribe((event) => listener({ source: "session", event })));
    return Object.freeze({ dispose() { for (const unsubscribe of unsubscribers.splice(0)) unsubscribe(); } });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    VIEW_SCHEMA_VERSION,
    createBrowserServices,
    createBrowserDownloadPort,
    createLegacyDomainCommandPort,
    LEGACY_DOMAIN_COMMANDS,
    subscribeRefresh,
  });
});
