(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppIndustryRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SESSION_OWNED_METHODS = Object.freeze([
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

  function createBrowserIndustryStaticContext(dependencies = {}) {
    const missing = BROWSER_STATIC_DEPENDENCY_KEYS.filter((key) => !dependencies[key]);
    if (missing.length) throw new Error(`Browser Industry 静态模块缺少依赖：${missing.join(", ")}`);
    return Object.freeze({ industry: dependencies.industry });
  }

  function createIndustryRuntime(context = {}) {
    const industry = context.industry;
    const hostPort = context.hostPort || context;
    const productionDecisionOwnedBySession = () => ({
      ok: false,
      code: "COMPANY_DECISION_INPUT_OWNED_BY_SESSION",
      message: "公司 Decision 只能通过当前 Effect Session identity 提交",
    });
    function dispatchIndustry() {
      const actions = hostPort.listHumanActions?.("industry") || [];
      return actions.length === 1
        ? hostPort.submitHumanAction(actions[0])
        : { ok: false, code: "COMPANY_ACTION_REQUIRED", message: "当前没有唯一正式公司行动" };
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
      isIndustryFutureSpanHandSelectionActive: () => false,
      isIndustryHandSelectionActive: () => false,
      canBeginIndustryFutureSpanHandSelection: productionDecisionOwnedBySession,
      getStrategyPassiveSelectableSlotIds: () => [],
      createIndustryActionRestoreCommand: () => null,
      recordIndustryActionRestoreCommand: () => null,
      clearIndustryRollbackUi: productionDecisionOwnedBySession,
      rollbackPendingIndustryQuickAction: productionDecisionOwnedBySession,
      cancelIndustryAbilityFlow: productionDecisionOwnedBySession,
      finishIndustryAbilityFlow: productionDecisionOwnedBySession,
      startIndustryAbilityFlow: () => dispatchIndustry(),
      handleCompanyActionMarkerClick: () => dispatchIndustry(),
      executeIndustryFreeMove: productionDecisionOwnedBySession,
    };
    for (const name of SESSION_OWNED_METHODS) {
      if (!runtime[name]) runtime[name] = productionDecisionOwnedBySession;
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
    BROWSER_STATIC_DEPENDENCY_KEYS,
    createBrowserIndustryStaticContext,
    createBrowserIndustryRuntime,
    createIndustryStartupRuntime,
    createIndustryRuntime,
  });
});
