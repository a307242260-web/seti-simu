(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  let standardActionSession = root.SetiStandardActionSession;
  let cardPlayDomain = root.SetiCardPlayDomain;
  let scienceSession = root.SetiScienceSession;
  if ((!standardAction || !standardActionSession || !cardPlayDomain || !scienceSession)
    && typeof require === "function") {
    standardAction = standardAction || require("./actions/standard-action");
    standardActionSession = standardActionSession || require("./effects/standard-action-session");
    cardPlayDomain = cardPlayDomain || require("./cards/play-domain");
    scienceSession = scienceSession || require("./effects/science-session");
  }

  const api = factory(standardAction, standardActionSession, cardPlayDomain, scienceSession);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiProductionComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction,
  standardActionSession,
  cardPlayDomain,
  scienceSession,
) {
  "use strict";

  const PACK_ID = "seti-production-domain-pack-v1";
  const QUICK_TRADE_EXECUTOR_ID = `${PACK_ID}:quick_trade:executor`;

  function assertNoHostRuleOverrides(options) {
    const forbidden = [
      "actionRegistry",
      "createStandardActionRegistry",
      "effectDomains",
      "standardActionDomain",
    ];
    const supplied = forbidden.filter((key) => options[key] != null);
    if (supplied.length) {
      throw new TypeError(
        `Production Composition 禁止 host 自定义规则 owner: ${supplied.join(", ")}`,
      );
    }
    const duplicateExecutors = Object.keys(options.hostFamilyExecutors || {})
      .filter((family) => standardAction.ALL_FAMILIES.includes(family));
    if (duplicateExecutors.length) {
      throw new Error(`重复 Production family executor: ${duplicateExecutors.join(", ")}`);
    }
  }

  function createProductionDomainPack(options = {}) {
    assertNoHostRuleOverrides(options);
    if (typeof options.getStandardActionSource !== "function") {
      throw new TypeError("Production Domain Pack 缺少 legacy Standard Action input source");
    }
    if (!Array.isArray(options.productionRules?.quickTrades?.TRADE_ACTIONS)
      || typeof options.productionRules.quickTrades.canExecuteTrade !== "function"
      || typeof options.productionRules.quickTrades.executeTrade !== "function") {
      throw new TypeError("Production Domain Pack 缺少 quick_trade 生产规则");
    }
    if (typeof standardActionSession?.createStandardActionDomain !== "function") {
      throw new TypeError("Production Domain Pack 缺少 Standard Action Effect domain");
    }
    const familyOwners = new Map();
    const claimFamilies = (owner, families) => {
      for (const family of families || []) {
        const previous = familyOwners.get(family);
        if (previous) throw new Error(`重复 Effect domain family: ${family} (${previous}, ${owner})`);
        familyOwners.set(family, owner);
      }
    };
    const ownedFamilies = new Set([
      "quick_trade",
      "play_card",
      ...scienceSession.ACTION_FAMILIES,
    ]);
    const standardFamilies = standardAction.ALL_FAMILIES
      .filter((family) => !["play_card", ...scienceSession.ACTION_FAMILIES].includes(family));
    claimFamilies("standard_action", standardFamilies);
    claimFamilies(cardPlayDomain.DOMAIN_ID, cardPlayDomain.ACTION_FAMILIES);
    claimFamilies(scienceSession.DOMAIN_ID, scienceSession.ACTION_FAMILIES);
    for (const descriptor of options.additionalDomains || []) {
      claimFamilies(descriptor?.id || "host_domain", descriptor?.families || []);
    }

    const getAuthority = options.getAuthority || ((context) => {
      const explicit = context?.standardActionAuthority || null;
      return {
        actorId: explicit?.actorId || context?.playerState?.currentPlayerId || null,
        stateVersion: explicit?.stateVersion ?? context?.stateVersion ?? 0,
        decisionVersion: explicit?.decisionVersion ?? context?.decisionVersion ?? 0,
      };
    });
    const ownedRegistry = standardAction.createRegistry({ getAuthority });
    const quickTrades = options.productionRules.quickTrades;
    const quickTradeHistory = options.hostServices?.quickTradeHistory || null;
    function executeQuickTrade(actionContext, action) {
      const root = actionContext?.workingRoot || actionContext;
      const beforeDecisionVersion = Number(
        root?.match?.decisionVersion ?? actionContext?.decisionVersion,
      ) || 0;
      const historySnapshot = quickTradeHistory?.capture?.(actionContext, action) || null;
      const result = quickTrades.executeTrade(action.target?.tradeId, actionContext);
      if (!result?.ok) return result;
      if (root?.match && (Number(root.match.decisionVersion) || 0) === beforeDecisionVersion) {
        root.match.decisionVersion = beforeDecisionVersion + 1;
      }
      if (root?.rocketState && result.message) root.rocketState.statusNote = result.message;
      if (result.awaitingDiscard || result.awaitingCardSelection) {
        quickTradeHistory?.attachPending?.(actionContext, action, result, historySnapshot);
      } else {
        quickTradeHistory?.recordCompleted?.(actionContext, action, result, historySnapshot);
      }
      const event = {
        type: "quick_trade",
        tradeId: action.target?.tradeId,
        playerId: action.actorId || actionContext?.playerState?.currentPlayerId || null,
        executorId: QUICK_TRADE_EXECUTOR_ID,
      };
      return {
        ...result,
        progressed: true,
        executorId: QUICK_TRADE_EXECUTOR_ID,
        events: [event],
        journalHistory: [event],
      };
    }
    const quickTradeProvider = standardAction.createQuickTradeProvider({
      quickTrades,
      execute: executeQuickTrade,
    });
    function canOfferQuickTrade(actionContext) {
      const root = actionContext?.workingRoot || actionContext;
      const actorId = actionContext?.standardActionAuthority?.actorId
        || actionContext?.playerState?.currentPlayerId
        || null;
      const actor = actionContext?.playerState?.players
        ?.find((player) => player.id === actorId) || null;
      const passed = root?.turnState?.passedPlayerIds?.includes(actorId);
      return !passed && actor?.passCompletionPending !== true;
    }
    ownedRegistry.register(standardAction.createOptionDefinition("quick_trade", {
      label: quickTradeProvider.label,
      getOptions(actionContext) {
        return canOfferQuickTrade(actionContext)
          ? quickTradeProvider.getOptions(actionContext)
          : { ok: false, message: "已 PASS 的玩家不能执行快速交易" };
      },
      canExecute(actionContext, option) {
        return canOfferQuickTrade(actionContext)
          ? quickTradeProvider.canExecute(actionContext, option)
          : { ok: false, code: "QUICK_TRADE_AFTER_PASS", message: "已 PASS 的玩家不能执行快速交易" };
      },
      execute: executeQuickTrade,
    }));
    const playCardProvider = cardPlayDomain.createPlayCardProvider();
    ownedRegistry.register(standardAction.createOptionDefinition("play_card", playCardProvider));
    for (const definition of scienceSession.createActionDefinitions()) {
      ownedRegistry.register(definition);
    }
    const requireSource = () => {
      const source = options.getStandardActionSource();
      if (typeof source?.enumerate !== "function"
        || typeof source?.validate !== "function"
        || typeof source?.execute !== "function") {
        throw new TypeError("legacy Standard Action input source 尚未装配");
      }
      return source;
    };
    const isOwned = (action) => ownedFamilies.has(action?.family);
    const actionRegistry = Object.freeze({
      ownerId: PACK_ID,
      enumerate(context, request = {}) {
        if (ownedFamilies.has(request.family)) {
          return ownedRegistry.enumerate(context, request);
        }
        if (request.family) {
          return requireSource().enumerate(context, request).filter((action) => !isOwned(action));
        }
        const legacy = standardAction.ALL_FAMILIES
          .filter((family) => !ownedFamilies.has(family))
          .flatMap((family) => requireSource().enumerate(context, { ...request, family }))
          .filter((action) => !isOwned(action));
        const quickActions = ownedRegistry.enumerate(context, { ...request, family: "quick_trade" });
        const playActions = ownedRegistry.enumerate(context, { ...request, family: "play_card" });
        const scienceActions = scienceSession.ACTION_FAMILIES.flatMap(
          (family) => ownedRegistry.enumerate(context, { ...request, family }),
        );
        const byFamily = new Map(standardAction.ALL_FAMILIES.map((family) => [family, []]));
        for (const action of [...legacy, ...quickActions, ...playActions, ...scienceActions]) {
          byFamily.get(action.family)?.push(action);
        }
        return standardAction.ALL_FAMILIES.flatMap((family) => byFamily.get(family));
      },
      validate(context, action) {
        return isOwned(action)
          ? ownedRegistry.validate(context, action)
          : requireSource().validate(context, action);
      },
      execute(context, action) {
        return isOwned(action)
          ? ownedRegistry.execute(context, action)
          : requireSource().execute(context, action);
      },
      resolveIntent(context, family, selector = {}, request = {}) {
        const candidates = this.enumerate(context, { ...request, family });
        const matches = candidates.filter((candidate) => Object.entries(selector).every(([key, value]) => (
          JSON.stringify(candidate.target?.[key]) === JSON.stringify(value)
          || JSON.stringify(candidate.payload?.[key]) === JSON.stringify(value)
        )));
        if (matches.length !== 1) {
          return {
            ok: false,
            code: matches.length ? "STANDARD_ACTION_AMBIGUOUS" : "STANDARD_ACTION_NOT_LEGAL",
            message: matches.length ? `${family} intent 无法唯一确定 action` : `${family} intent 没有合法 action`,
          };
        }
        const validation = this.validate(context, matches[0]);
        return validation.ok ? { ok: true, action: matches[0] } : validation;
      },
      coverage() {
        const legacy = typeof requireSource().coverage === "function"
          ? requireSource().coverage().filter((entry) => (
            entry.registered && !ownedFamilies.has(entry.family)
          ))
          : [];
        const byFamily = new Map(legacy.map((entry) => [entry.family, entry]));
        const ownedQuickTrade = ownedRegistry.coverage()
          .find((entry) => entry.family === "quick_trade");
        byFamily.set("quick_trade", ownedQuickTrade);
        const ownedPlayCard = ownedRegistry.coverage()
          .find((entry) => entry.family === "play_card");
        byFamily.set("play_card", ownedPlayCard);
        for (const family of scienceSession.ACTION_FAMILIES) {
          byFamily.set(family, ownedRegistry.coverage().find((entry) => entry.family === family));
        }
        return standardAction.ALL_FAMILIES.map((family) => (
          byFamily.get(family) || {
            family,
            phase: standardAction.PHASE_BY_FAMILY[family],
            registered: false,
          }
        ));
      },
    });

    const standardDomain = Object.freeze({
      id: "standard_action",
      families: standardFamilies,
      create: standardActionSession.createStandardActionDomain,
      options: Object.freeze({
        actionFamilies: standardFamilies,
        ...(options.standardActionDomainOptions || {}),
      }),
    });
    const cardDomain = Object.freeze({
      id: cardPlayDomain.DOMAIN_ID,
      families: cardPlayDomain.ACTION_FAMILIES,
      create: cardPlayDomain.createExperimentalCardPlayDomain,
    });
    const scienceDomain = Object.freeze({
      id: scienceSession.DOMAIN_ID,
      families: scienceSession.ACTION_FAMILIES,
      create: scienceSession.createScienceDomain,
    });
    const effectDomains = Object.freeze([
      standardDomain,
      cardDomain,
      scienceDomain,
      ...(options.additionalDomains || []),
    ]);
    return Object.freeze({
      packId: PACK_ID,
      actionRegistry,
      effectDomains,
      familyOwners: Object.freeze(Object.fromEntries(familyOwners)),
      actionOwners: Object.freeze({
        quick_trade: `${PACK_ID}:quick_trade`,
        play_card: cardPlayDomain.EXECUTOR_ID,
        scan: scienceSession.EXECUTOR_ID,
        place_data: scienceSession.EXECUTOR_ID,
        analyze: scienceSession.EXECUTOR_ID,
        research_tech: scienceSession.EXECUTOR_ID,
        legacy: "host_input_source",
      }),
      actionExecutorOwners: Object.freeze({
        quick_trade: QUICK_TRADE_EXECUTOR_ID,
        play_card: cardPlayDomain.EXECUTOR_ID,
        scan: scienceSession.EXECUTOR_ID,
        place_data: scienceSession.EXECUTOR_ID,
        analyze: scienceSession.EXECUTOR_ID,
        research_tech: scienceSession.EXECUTOR_ID,
      }),
    });
  }

  function createProductionComposition(options = {}) {
    assertNoHostRuleOverrides(options);
    if (typeof options.ruleCompositionApi?.createRuleComposition !== "function") {
      throw new TypeError("Production Composition 缺少 Rule Composition factory");
    }
    const ruleOptions = { ...(options.ruleOptions || {}) };
    if (ruleOptions.createActionRegistry || ruleOptions.effectDomains) {
      throw new TypeError("Production Composition 的 registry/domain 只能由 Domain Pack 安装");
    }
    const domainPack = createProductionDomainPack(options);
    const composition = options.ruleCompositionApi.createRuleComposition({
      ...ruleOptions,
      createActionRegistry: () => domainPack.actionRegistry,
      effectDomains: domainPack.effectDomains,
    });
    return Object.freeze({ composition, domainPack });
  }

  return Object.freeze({
    PACK_ID,
    QUICK_TRADE_EXECUTOR_ID,
    createProductionDomainPack,
    createProductionComposition,
  });
});
