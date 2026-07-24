(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppIncomeRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const BROWSER_INPUT_NAMES = Object.freeze([
    "applyIndustryRoundStartBonuses",
    "beginIncomeForCurrentPlayer",
  ]);

  function createBrowserInputPort(registry, getTarget) {
    if (typeof registry?.registerTarget !== "function") {
      throw new TypeError("income_runtime input port 需要已校验 registry");
    }
    if (typeof getTarget !== "function") {
      throw new TypeError("income_runtime input port 缺少 owner resolver");
    }
    return registry.registerTarget("income_runtime", BROWSER_INPUT_NAMES, getTarget);
  }

  function isIncomeDiscardActionType(type) {
    return [
      "income",
      "planet_reward_income",
      "place_data_income",
      "initial_income",
      "card_income",
      "industry_helios_income",
    ].includes(type);
  }

  function createIncomeRuntime(context = {}) {
    const labels = context.INCOME_GAIN_LABELS || {};
    const hostPort = context.hostPort || context;

    function inspectIncomeDecision() {
      const inspection = hostPort.inspect?.();
      if (inspection?.phase !== "awaiting_input") return null;
      const decision = inspection.session?.decision;
      return decision?.choices?.some((entry) => {
        const target = entry.target || entry.standardAction?.target || {};
        return target.kind === "residual-domain";
      }) ? decision : null;
    }

    function submitIncomeDecision(...hints) {
      const values = hints.flatMap((hint) => (
        ["string", "number"].includes(typeof hint) ? [String(hint)]
          : hint && typeof hint === "object" ? Object.values(hint).map(String) : []
      ));
      return hostPort.submitActiveDecision?.("residual-domain", (target, candidate) => {
        const text = JSON.stringify({ target, payload: candidate?.payload || {} });
        return values.length === 0 || values.every((value) => text.includes(value));
      }) || {
        ok: false,
        code: "INCOME_DECISION_REQUIRED",
        message: "当前没有正式收入 Decision",
      };
    }

    function formatIncomeGain(gain) {
      return Object.entries(gain || {})
        .filter(([, value]) => value)
        .map(([key, value]) => `${labels[key] || key}+${value}`)
        .join("、");
    }

    function getBlindDrawIrreversible(drawnCount) {
      return drawnCount > 0
        ? { code: "hidden_card_reveal", reason: "盲抽翻出新牌" }
        : null;
    }

    function buildIncomeResourceGain(income = {}) {
      return {
        credits: income.credits || 0,
        energy: income.energy || 0,
        publicity: income.publicity || 0,
        availableData: income.availableData || 0,
        additionalPublicScan: income.additionalPublicScan || 0,
      };
    }

    function formatIncomeResourceSummary(resourceIncome, drawnCount, cardCount, drawError) {
      return [
        `信用点+${resourceIncome?.credits || 0}`,
        `能量+${resourceIncome?.energy || 0}`,
        `手牌+${drawnCount || 0}${drawError ? `/${cardCount || 0}` : ""}`,
        `宣传+${resourceIncome?.publicity || 0}`,
        `数据+${resourceIncome?.availableData || 0}`,
        `额外公共扫描+${resourceIncome?.additionalPublicScan || 0}`,
      ].join("、");
    }

    function submitIncomeStandardDecision(_player, payload) {
      return submitIncomeDecision(payload);
    }

    return Object.freeze({
      formatIncomeGain,
      getBlindDrawIrreversible,
      buildIncomeResourceGain,
      formatIncomeResourceSummary,
      applyIncomeGainWithImmediateRewards: submitIncomeStandardDecision,
      applyIncomeFromCard: submitIncomeStandardDecision,
      applyIncomeResourcesForPlayer: submitIncomeStandardDecision,
      applyIndustryRoundStartBonuses() {
        return inspectIncomeDecision()
          ? submitIncomeDecision("round_start")
          : { ok: true, code: "PRODUCTION_INCOME_ALREADY_SETTLED" };
      },
      beginIncomeForCurrentPlayer(_workingRoot, options = {}) {
        return submitIncomeDecision(options.source || "income");
      },
    });
  }

  return Object.freeze({
    BROWSER_INPUT_NAMES,
    createBrowserInputPort,
    createIncomeRuntime,
    isIncomeDiscardActionType,
  });
});
