(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  let standardActionSession = root.SetiStandardActionSession;
  let cardPlayDomain = root.SetiCardPlayDomain;
  let scienceSession = root.SetiScienceSession;
  let probeTurnSession = root.SetiProbeTurnSession;
  let residualDomainSession = root.SetiResidualDomainSession;
  let initialSetup = root.SetiInitialSetup;
  if ((!standardAction || !standardActionSession || !cardPlayDomain || !scienceSession
    || !probeTurnSession || !residualDomainSession || !initialSetup)
    && typeof require === "function") {
    standardAction = standardAction || require("./actions/standard-action");
    standardActionSession = standardActionSession || require("./effects/standard-action-session");
    cardPlayDomain = cardPlayDomain || require("./cards/play-domain");
    scienceSession = scienceSession || require("./effects/science-session");
    probeTurnSession = probeTurnSession || require("./effects/probe-turn-session");
    residualDomainSession = residualDomainSession || require("./effects/residual-domain-session");
    initialSetup = initialSetup || require("./initial-setup");
  }

  const api = factory(
    standardAction,
    standardActionSession,
    cardPlayDomain,
    scienceSession,
    probeTurnSession,
    residualDomainSession,
    initialSetup,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiProductionComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction,
  standardActionSession,
  cardPlayDomain,
  scienceSession,
  probeTurnSession,
  residualDomainSession,
  initialSetup,
) {
  "use strict";

  const PACK_ID = "seti-production-domain-pack-v1";
  const QUICK_TRADE_EXECUTOR_ID = `${PACK_ID}:quick_trade:executor`;
  const INITIAL_SETUP_SOURCE_ID = initialSetup.OWNER_ID;
  const INITIAL_SETUP_FAMILIES = initialSetup.FAMILIES;

  function assertNoHostRuleOverrides(options) {
    const forbidden = [
      "actionRegistry",
      "createStandardActionRegistry",
      "effectDomains",
      "standardActionDomain",
      "initialSetupSource",
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
    const initialSetupSource = initialSetup.createSource();
    if (initialSetupSource?.ownerId !== INITIAL_SETUP_SOURCE_ID
      || typeof initialSetupSource.enumerate !== "function"
      || typeof initialSetupSource.validate !== "function"
      || typeof initialSetupSource.execute !== "function") {
      throw new TypeError("Production Domain Pack 缺少正式 initial setup source");
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
      ...probeTurnSession.ACTION_FAMILIES,
      ...residualDomainSession.ACTION_FAMILIES,
    ]);
    const conditionalFamilies = standardAction.ALL_FAMILIES
      .filter((family) => !ownedFamilies.has(family));
    const standardFamilies = Object.freeze(["quick_trade", ...conditionalFamilies]);
    claimFamilies("standard_action", standardFamilies);
    claimFamilies(cardPlayDomain.DOMAIN_ID, cardPlayDomain.ACTION_FAMILIES);
    claimFamilies(scienceSession.DOMAIN_ID, scienceSession.ACTION_FAMILIES);
    claimFamilies(probeTurnSession.DOMAIN_ID, probeTurnSession.ACTION_FAMILIES);
    claimFamilies(residualDomainSession.DOMAIN_ID, residualDomainSession.ACTION_FAMILIES);
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
    const conditionalActions = options.productionRules.conditionalActions || null;
    const findConditionalAction = (context, family, action) => (
      (conditionalActions?.enumerate?.(context, { family }) || []).find((candidate) => (
        JSON.stringify(candidate.target) === JSON.stringify(action?.target)
        && JSON.stringify(candidate.payload || {}) === JSON.stringify(action?.payload || {})
      )) || null
    );
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
    for (const definition of probeTurnSession.createActionDefinitions()) {
      ownedRegistry.register(definition);
    }
    for (const definition of residualDomainSession.createActionDefinitions()) {
      ownedRegistry.register(definition);
    }
    for (const family of conditionalFamilies) {
      ownedRegistry.register(standardAction.createOptionDefinition(family, {
        label: family,
        getOptions(context) {
          if (initialSetupSource.families.includes(family)) {
            const choices = initialSetupSource.enumerate(context, { family });
            if (choices.length) {
              return {
                ok: true,
                choices: choices.map((entry) => ({
                  target: entry.target,
                  payload: entry.payload,
                  decision: entry.decision,
                  label: entry.summary,
                })),
              };
            }
            const sessionChoices = conditionalActions?.enumerate?.(context, { family }) || [];
            return sessionChoices.length
              ? { ok: true, choices: sessionChoices.map((entry) => ({
                target: entry.target,
                payload: entry.payload,
                decision: entry.decision,
                label: entry.summary,
              })) }
              : { ok: false, code: "SESSION_DECISION_ONLY", message: "当前没有 initial setup payment" };
          }
          return { ok: false, code: "SESSION_DECISION_ONLY", message: `${family} 只由 Effect Session Decision 产生` };
        },
        canExecute(context, option) {
          if (initialSetupSource.families.includes(family)) {
            const candidate = initialSetupSource.enumerate(context, { family }).find((entry) => (
              JSON.stringify(entry.target) === JSON.stringify(option.target)
              && JSON.stringify(entry.payload) === JSON.stringify(option.payload)
            ));
            if (candidate) return initialSetupSource.validate(context, candidate);
            const sessionAction = findConditionalAction(context, family, option);
            return (sessionAction && conditionalActions?.validate?.(context, sessionAction))
              || { ok: false, code: "STANDARD_ACTION_NOT_LEGAL", message: "initial setup payment 已失效" };
          }
          return { ok: false, code: "SESSION_DECISION_ONLY", message: `${family} 只由 Effect Session Decision 产生` };
        },
        execute(context, action) {
          if (initialSetupSource.families.includes(family)) {
            const candidate = initialSetupSource.enumerate(context, { family }).find((entry) => (
              JSON.stringify(entry.target) === JSON.stringify(action.target)
              && JSON.stringify(entry.payload) === JSON.stringify(action.payload)
            ));
            if (candidate) return initialSetupSource.execute(context, candidate);
            const sessionAction = findConditionalAction(context, family, action);
            return (sessionAction && conditionalActions?.execute?.(context, sessionAction))
              || { ok: false, code: "STANDARD_ACTION_NOT_LEGAL", message: "initial setup payment 已失效" };
          }
          return { ok: false, code: "SESSION_DECISION_ONLY", message: `${family} 只由 Effect Session Decision 执行` };
        },
      }));
    }
    const actionRegistry = Object.freeze({
      ownerId: PACK_ID,
      enumerate(context, request = {}) {
        if (request.family) return ownedRegistry.enumerate(context, request);
        const quickActions = ownedRegistry.enumerate(context, { ...request, family: "quick_trade" });
        const playActions = ownedRegistry.enumerate(context, { ...request, family: "play_card" });
        const scienceActions = scienceSession.ACTION_FAMILIES.flatMap(
          (family) => ownedRegistry.enumerate(context, { ...request, family }),
        );
        const probeTurnActions = probeTurnSession.ACTION_FAMILIES.flatMap(
          (family) => ownedRegistry.enumerate(context, { ...request, family }),
        );
        const residualActions = residualDomainSession.ACTION_FAMILIES.flatMap(
          (family) => ownedRegistry.enumerate(context, { ...request, family }),
        );
        const conditionalActions = conditionalFamilies.flatMap(
          (family) => ownedRegistry.enumerate(context, { ...request, family }),
        );
        const byFamily = new Map(standardAction.ALL_FAMILIES.map((family) => [family, []]));
        for (const action of [
          ...quickActions,
          ...playActions,
          ...scienceActions,
          ...probeTurnActions,
          ...residualActions,
          ...conditionalActions,
        ]) {
          byFamily.get(action.family)?.push(action);
        }
        return standardAction.ALL_FAMILIES.flatMap((family) => byFamily.get(family));
      },
      validate(context, action) {
        return ownedRegistry.validate(context, action);
      },
      execute(context, action) {
        return ownedRegistry.execute(context, action);
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
        const byFamily = new Map(
          ownedRegistry.coverage().map((entry) => [entry.family, entry]),
        );
        const ownedQuickTrade = ownedRegistry.coverage()
          .find((entry) => entry.family === "quick_trade");
        byFamily.set("quick_trade", ownedQuickTrade);
        const ownedPlayCard = ownedRegistry.coverage()
          .find((entry) => entry.family === "play_card");
        byFamily.set("play_card", ownedPlayCard);
        for (const family of scienceSession.ACTION_FAMILIES) {
          byFamily.set(family, ownedRegistry.coverage().find((entry) => entry.family === family));
        }
        for (const family of probeTurnSession.ACTION_FAMILIES) {
          byFamily.set(family, ownedRegistry.coverage().find((entry) => entry.family === family));
        }
        for (const family of residualDomainSession.ACTION_FAMILIES) {
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
    const hostContinuation = options.standardActionDomainOptions?.continuation || null;
    const productionContinuation = hostContinuation && Object.freeze({
      inspect(context) {
        const setupChoices = INITIAL_SETUP_FAMILIES.flatMap(
          (family) => actionRegistry.enumerate(context, { family }),
        );
        if (setupChoices.length) {
          return {
            ok: true,
            boundary: "conditional_choice",
            decisionType: "conditional_choice",
            ownerId: setupChoices[0].actorId,
            family: setupChoices[0].family,
            choices: setupChoices,
          };
        }
        return hostContinuation.inspect(context?.workingRoot || context);
      },
      executeDeterministic(context, boundary) {
        return hostContinuation.executeDeterministic(context?.workingRoot || context, boundary);
      },
      resolveDecision(context, choice, decisionContext) {
        const descriptor = choice?.standardAction || choice;
        const setupCandidates = INITIAL_SETUP_FAMILIES.includes(descriptor?.family)
          ? actionRegistry.enumerate(context, { family: descriptor.family })
          : [];
        const setupCandidate = setupCandidates.length
          ? setupCandidates
            .find((candidate) => (
              JSON.stringify(candidate.target) === JSON.stringify(descriptor.target)
              && JSON.stringify(candidate.payload || {}) === JSON.stringify(descriptor.payload || {})
            ))
          : null;
        if (setupCandidate) return actionRegistry.execute(context, setupCandidate);
        if (INITIAL_SETUP_FAMILIES.includes(descriptor?.family)) {
          return {
            ok: false,
            code: "INITIAL_SETUP_DECISION_STALE",
            message: "initial_setup Decision 已不在 Production Kernel legal set",
            descriptor,
            candidates: setupCandidates,
          };
        }
        return hostContinuation.resolveDecision(
          context?.workingRoot || context,
          choice,
          decisionContext,
        );
      },
    });

    const standardDomain = Object.freeze({
      id: "standard_action",
      families: standardFamilies,
      create: standardActionSession.createStandardActionDomain,
      options: Object.freeze({
        actionFamilies: standardFamilies,
        ...(options.standardActionDomainOptions || {}),
        ...(productionContinuation ? { continuation: productionContinuation } : {}),
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
    const probeTurnDomain = Object.freeze({
      id: probeTurnSession.DOMAIN_ID,
      families: probeTurnSession.ACTION_FAMILIES,
      create: probeTurnSession.createProbeTurnDomain,
    });
    const residualDomain = Object.freeze({
      id: residualDomainSession.DOMAIN_ID,
      families: residualDomainSession.ACTION_FAMILIES,
      create: residualDomainSession.createResidualDomain,
    });
    const effectDomains = Object.freeze([
      standardDomain,
      cardDomain,
      scienceDomain,
      probeTurnDomain,
      residualDomain,
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
        launch: probeTurnSession.EXECUTOR_ID,
        move: probeTurnSession.EXECUTOR_ID,
        orbit: probeTurnSession.EXECUTOR_ID,
        land: probeTurnSession.EXECUTOR_ID,
        pass: probeTurnSession.EXECUTOR_ID,
        end_turn: probeTurnSession.EXECUTOR_ID,
        industry: residualDomainSession.EXECUTOR_ID,
      }),
      actionExecutorOwners: Object.freeze({
        quick_trade: QUICK_TRADE_EXECUTOR_ID,
        play_card: cardPlayDomain.EXECUTOR_ID,
        scan: scienceSession.EXECUTOR_ID,
        place_data: scienceSession.EXECUTOR_ID,
        analyze: scienceSession.EXECUTOR_ID,
        research_tech: scienceSession.EXECUTOR_ID,
        launch: probeTurnSession.EXECUTOR_ID,
        move: probeTurnSession.EXECUTOR_ID,
        orbit: probeTurnSession.EXECUTOR_ID,
        land: probeTurnSession.EXECUTOR_ID,
        pass: probeTurnSession.EXECUTOR_ID,
        end_turn: probeTurnSession.EXECUTOR_ID,
        industry: residualDomainSession.EXECUTOR_ID,
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
      transformEffectResult: residualDomainSession.augmentEffectResult,
    });
    return Object.freeze({ composition, domainPack });
  }

  return Object.freeze({
    PACK_ID,
    QUICK_TRADE_EXECUTOR_ID,
    INITIAL_SETUP_SOURCE_ID,
    INITIAL_SETUP_FAMILIES,
    createProductionDomainPack,
    createProductionComposition,
  });
});
