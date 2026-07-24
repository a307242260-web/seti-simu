(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppIndustryRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const BROWSER_INPUT_NAMES = Object.freeze([
    "cancelIndustryAbilityFlow", "finishIndustryAbilityFlow", "startIndustryAbilityFlow",
    "startIndustryStratusEffectFlow", "startIndustryPublicityPick", "beginIndustryTuringBorrow",
    "failIndustryTuringBorrow", "checkIndustryTuringBorrowTile", "confirmIndustryTuringBorrow",
    "openIndustryHeliosTechPicker", "confirmIndustryHeliosRemoveTech",
    "startIndustryHuanyuMoveEffectFlow", "beginIndustryHuanyuFreeMoves",
    "beginIndustryFutureSpanHandSelection", "handleIndustryFutureSpanHandClick",
    "handleIndustryDeepspaceHandClick", "finalizeIndustryDeepspaceSwap",
    "handleAlienLabPanelClick", "maybeConsumeAlienLabPanelForMainAction",
    "maybeApplyIndustryLaunchScan", "startLaunchSectorFinishEffectFlow",
    "appendIndustryPlayPassiveStatus",
    "applyIndustryPlayCardPassives",
    "completeIndustryAbilityQuickStep", "commitIrreversibleIndustryQuickAction",
    "tryInjectSentinelPlayCornerEffectAfterArm", "executeIndustryStratusCornerEffect",
    "executeIndustrySentinelCornerEffect", "executeIndustryHeliosPassiveRewardEffect",
    "cancelStrategyPassiveSlotChoice", "openStrategyPassiveSlotChoice",
    "confirmStrategyPassiveSlotChoice", "finishIndustryStrategyPassiveRewardEffect",
    "executeIndustryStrategyPassiveRewardEffect", "handleStrategyPassiveSlotClick",
    "handleCompanyActionMarkerClick",
  ]);
  const BROWSER_STATIC_DEPENDENCY_KEYS = Object.freeze(["industry"]);

  function createBrowserInputPort(registry, getTarget) {
    if (typeof registry?.registerTarget !== "function") {
      throw new TypeError("industry_runtime input port 需要已校验 registry");
    }
    return registry.registerTarget("industry_runtime", BROWSER_INPUT_NAMES, getTarget);
  }

  function createBrowserIndustryStaticContext(dependencies = {}) {
    const missing = BROWSER_STATIC_DEPENDENCY_KEYS.filter((key) => !dependencies[key]);
    if (missing.length) throw new Error(`Browser Industry 静态模块缺少依赖：${missing.join(", ")}`);
    return Object.freeze({ industry: dependencies.industry });
  }

  function createIndustryRuntime(context = {}) {
    const industry = context.industry;
    const hostPort = context.hostPort || context;
    function inspectDecision() {
      const inspection = hostPort.inspect?.();
      const decision = inspection?.phase === "awaiting_input" ? inspection.session?.decision : null;
      return decision?.choices?.some((entry) => (
        (entry.target || entry.standardAction?.target)?.kind === "residual-domain"
      )) ? decision : null;
    }
    function submitDecision(...args) {
      const values = args.flatMap((arg) => (
        typeof arg === "string" || typeof arg === "number" ? [String(arg)]
          : arg && typeof arg === "object" ? Object.values(arg).map(String) : []
      ));
      return hostPort.submitActiveDecision?.("residual-domain", (target, candidate) => {
        const serialized = JSON.stringify({ target, payload: candidate?.payload || {} });
        return values.length === 0 || values.every((value) => serialized.includes(value));
      }) || { ok: false, code: "COMPANY_DECISION_REQUIRED", message: "当前没有正式公司 Decision" };
    }
    function dispatchIndustry() {
      const actions = hostPort.listHumanActions?.("industry") || [];
      return actions.length === 1
        ? hostPort.submitHumanAction(actions[0])
        : { ok: false, code: "COMPANY_ACTION_REQUIRED", message: "当前没有唯一正式公司行动" };
    }
    function cancelDecision() {
      const decision = inspectDecision();
      const choice = decision?.choices?.find((entry) => {
        const target = entry.target || entry.standardAction?.target || {};
        const payload = entry.payload || entry.standardAction?.payload || {};
        return ["cancel", "skip"].includes(target.role || payload.role);
      });
      return choice
        ? submitDecision(choice.target?.choiceId || choice.actionId)
        : { ok: false, code: "COMPANY_CANCEL_UNAVAILABLE", message: "当前公司 Decision 不可取消" };
    }
    const runtime = {
      createCompanyCardSummary(card) {
        const label = card?.label || card?.companyLabel || "";
        const definition = industry?.getIndustryDefinition?.(label);
        return definition ? {
          label,
          activeAbilityId: definition.activeAbilityId || null,
          passiveIds: [...(definition.passiveIds || [])],
        } : null;
      },
      isIndustryFutureSpanHandSelectionActive: () => Boolean(inspectDecision()),
      isIndustryHandSelectionActive: () => Boolean(inspectDecision()),
      canBeginIndustryFutureSpanHandSelection: () => (
        inspectDecision() ? { ok: true } : { ok: false, code: "COMPANY_DECISION_REQUIRED" }
      ),
      getStrategyPassiveSelectableSlotIds: () => (
        inspectDecision()?.choices?.map((entry) => entry.target?.slotId).filter(Boolean) || []
      ),
      createIndustryActionRestoreCommand: () => null,
      recordIndustryActionRestoreCommand: () => null,
      clearIndustryRollbackUi: cancelDecision,
      rollbackPendingIndustryQuickAction: cancelDecision,
      cancelIndustryAbilityFlow: cancelDecision,
      finishIndustryAbilityFlow: () => ({ ok: true }),
      startIndustryAbilityFlow: () => dispatchIndustry(),
      handleCompanyActionMarkerClick: () => dispatchIndustry(),
      executeIndustryFreeMove: submitDecision,
    };
    for (const name of BROWSER_INPUT_NAMES) {
      if (!runtime[name]) runtime[name] = name.startsWith("cancel") ? cancelDecision : submitDecision;
    }
    return Object.freeze(runtime);
  }

  function createBrowserIndustryRuntime(options = {}) {
    return createIndustryRuntime({
      ...options.staticContext,
      hostPort: options.hostPort,
    });
  }

  function createIndustryStartupRuntime() {
    return Object.freeze({
      apply() {
        return {
          ok: true,
          message: "公司初始状态由正式初始选择 owner 写入",
        };
      },
    });
  }

  return Object.freeze({
    BROWSER_INPUT_NAMES,
    BROWSER_STATIC_DEPENDENCY_KEYS,
    createBrowserInputPort,
    createBrowserIndustryStaticContext,
    createBrowserIndustryRuntime,
    createIndustryStartupRuntime,
    createIndustryRuntime,
  });
});
