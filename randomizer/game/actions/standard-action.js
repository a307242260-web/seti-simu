(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiStandardAction = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-standard-action-v1";
  const TOP_LEVEL_FAMILIES = Object.freeze([
    "launch", "orbit", "land", "scan", "analyze", "research_tech", "play_card", "pass",
    "move", "quick_trade", "industry", "card_corner", "place_data", "runezu_face_symbol", "end_turn",
  ]);
  const CONDITIONAL_FAMILIES = Object.freeze([
    "choose_card", "choose_target", "choose_payment", "choose_reward", "choose_branch",
    "choose_final_scoring", "accept_optional_effect",
  ]);
  const ALL_FAMILIES = Object.freeze([...TOP_LEVEL_FAMILIES, ...CONDITIONAL_FAMILIES]);
  const PHASE_BY_FAMILY = Object.freeze(Object.fromEntries(ALL_FAMILIES.map((family, index) => [
    family,
    index < 8 ? "main" : index < 14 ? "quick" : index === 14 ? "turn_control" : "conditional",
  ])));

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function stableHash(value) {
    const input = stableSerialize(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function assertFamilyDefinition(definition) {
    if (!definition || typeof definition !== "object") throw new TypeError("Standard Action definition 必须是对象");
    if (!ALL_FAMILIES.includes(definition.family)) throw new TypeError(`未知 Standard Action family: ${definition.family}`);
    for (const method of ["enumerate", "validate", "execute"]) {
      if (typeof definition[method] !== "function") {
        throw new TypeError(`${definition.family} 缺少 ${method}()`);
      }
    }
    return Object.freeze({
      ...definition,
      phase: PHASE_BY_FAMILY[definition.family],
    });
  }

  function normalizeDescriptor(definition, descriptor, authority) {
    const target = clone(descriptor?.target || null);
    const payload = clone(descriptor?.payload || {});
    const identity = {
      family: definition.family,
      actorId: authority.actorId,
      target,
      payload,
    };
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      family: definition.family,
      phase: definition.phase,
      actionId: `${definition.family}:${stableHash(identity)}`,
      actorId: authority.actorId,
      stateVersion: authority.stateVersion,
      decisionVersion: authority.decisionVersion,
      target,
      payload,
      decision: clone(descriptor?.decision || null),
      summary: descriptor?.summary || definition.label || definition.family,
    });
  }

  function sameAction(left, right) {
    return left?.schemaVersion === right?.schemaVersion
      && left?.actionId === right?.actionId
      && left?.family === right?.family
      && left?.actorId === right?.actorId
      && left?.stateVersion === right?.stateVersion
      && left?.decisionVersion === right?.decisionVersion
      && stableSerialize(left?.target || null) === stableSerialize(right?.target || null)
      && stableSerialize(left?.payload || {}) === stableSerialize(right?.payload || {})
      && stableSerialize(left?.decision || null) === stableSerialize(right?.decision || null);
  }

  function createRegistry(options = {}) {
    if (typeof options.getAuthority !== "function") {
      throw new TypeError("Standard Action registry 需要 getAuthority(context)");
    }
    const definitions = new Map();

    function register(rawDefinition) {
      const definition = assertFamilyDefinition(rawDefinition);
      if (definitions.has(definition.family)) throw new Error(`重复注册 Standard Action family: ${definition.family}`);
      definitions.set(definition.family, definition);
      return definition;
    }

    function enumerate(context, request = {}) {
      const authority = options.getAuthority(context);
      if (!authority?.actorId) return [];
      if (request.actorId != null && request.actorId !== authority.actorId) return [];
      const familyFilter = request.family == null ? null : String(request.family);
      const result = [];
      for (const definition of definitions.values()) {
        if (familyFilter && definition.family !== familyFilter) continue;
        const descriptors = definition.enumerate(context, { authority, request }) || [];
        for (const descriptor of descriptors) result.push(normalizeDescriptor(definition, descriptor, authority));
      }
      return result;
    }

    function validate(context, action) {
      if (action?.schemaVersion !== SCHEMA_VERSION) {
        return fail("STANDARD_ACTION_SCHEMA_MISMATCH", "Standard Action schema 版本不匹配");
      }
      const definition = definitions.get(action.family);
      if (!definition) return fail("STANDARD_ACTION_UNREGISTERED_FAMILY", `未注册 action family: ${action.family}`);
      const authority = options.getAuthority(context);
      if (action.actorId !== authority?.actorId) {
        return fail("STANDARD_ACTION_ACTOR_MISMATCH", "action actor 不是当前决策 owner", { authority });
      }
      if (action.stateVersion !== authority.stateVersion || action.decisionVersion !== authority.decisionVersion) {
        return fail("STANDARD_ACTION_STALE", "action 已过期", { authority });
      }
      const current = enumerate(context, {
        actorId: authority.actorId,
        family: action.family,
        ...(action.payload == null ? {} : { payload: action.payload }),
      })
        .find((candidate) => candidate.actionId === action.actionId);
      if (!current || !sameAction(current, action)) {
        return fail("STANDARD_ACTION_NOT_LEGAL", "action 不在当前合法候选中", {
          submittedAction: action,
          currentAction: current || null,
        });
      }
      const result = definition.validate(context, action, { authority });
      return result?.ok === false ? result : { ok: true, definition, authority, current };
    }

    function execute(context, action) {
      const validation = validate(context, action);
      if (!validation.ok) return validation;
      const result = validation.definition.execute(context, action, { authority: validation.authority });
      if (!result || result.ok !== true) {
        return result?.ok === false
          ? result
          : fail("STANDARD_ACTION_EXECUTION_FAILED", `${action.family} 未返回成功结果`);
      }
      return {
        ...result,
        action,
        events: Array.isArray(result.events) ? result.events : [],
      };
    }

    function coverage() {
      return ALL_FAMILIES.map((family) => ({
        family,
        phase: PHASE_BY_FAMILY[family],
        registered: definitions.has(family),
      }));
    }

    return Object.freeze({ register, enumerate, validate, execute, coverage });
  }

  function createLaunchDefinition(launchAction) {
    if (!launchAction?.canExecute || !launchAction?.execute) {
      throw new TypeError("launch reference action 需要 canExecute/execute");
    }
    return {
      family: "launch",
      label: launchAction.label || "发射",
      enumerate(context) {
        const check = launchAction.canExecute(context);
        return check.ok ? [{ summary: launchAction.label || "发射" }] : [];
      },
      validate(context) {
        return launchAction.canExecute(context);
      },
      execute(context) {
        return launchAction.execute(context);
      },
    };
  }

  function assertReferenceAction(action, family, optionMethod = null) {
    if (!action?.canExecute || !action?.execute || (optionMethod && typeof action[optionMethod] !== "function")) {
      throw new TypeError(`${family} reference action 缺少统一规则接口`);
    }
  }

  function createOrbitDefinition(orbitAction) {
    assertReferenceAction(orbitAction, "orbit", "getOrbitOptions");
    return {
      family: "orbit",
      label: orbitAction.label || "环绕",
      enumerate(context) {
        const options = orbitAction.getOrbitOptions(context);
        if (!options.ok) return [];
        return options.choices.map((choice) => ({
          target: { rocketId: choice.rocketId, planetId: choice.planetId },
          summary: choice.label,
        }));
      },
      validate(context, action) {
        return orbitAction.getOrbitOptions(context, { rocketId: action.target?.rocketId });
      },
      execute(context, action) {
        return orbitAction.execute(context, { rocketId: action.target.rocketId });
      },
    };
  }

  function createLandDefinition(landAction) {
    assertReferenceAction(landAction, "land", "getLandOptions");
    return {
      family: "land",
      label: landAction.label || "登陆",
      enumerate(context) {
        const options = landAction.getLandOptions(context);
        if (!options.ok) return [];
        return options.choices.map((choice) => ({
          target: {
            rocketId: choice.rocketId,
            planetId: choice.planetId,
            type: choice.target.type,
            ...(choice.target.satelliteId ? { satelliteId: choice.target.satelliteId } : {}),
          },
          summary: choice.label,
        }));
      },
      validate(context, action) {
        return landAction.getLandOptions(context, { rocketId: action.target?.rocketId });
      },
      execute(context, action) {
        return landAction.execute(context, {
          rocketId: action.target.rocketId,
          target: {
            type: action.target.type,
            ...(action.target.satelliteId ? { satelliteId: action.target.satelliteId } : {}),
          },
        });
      },
    };
  }

  function createResearchTechDefinition(researchTechAction) {
    assertReferenceAction(researchTechAction, "research_tech", "getResearchOptions");
    return {
      family: "research_tech",
      label: researchTechAction.label || "科技",
      enumerate(context, { request }) {
        const options = researchTechAction.getResearchOptions(context, request?.payload || {});
        if (!options.ok) return [];
        return options.choices.map((choice) => ({
          target: {
            tileId: choice.tileId,
            ...(choice.blueSlot == null ? {} : { blueSlot: choice.blueSlot }),
          },
          payload: {
            ...(request?.payload || {}),
            ...(options.allowedTechTypes ? { allowedTechTypes: [...options.allowedTechTypes] } : {}),
          },
          summary: choice.label,
        }));
      },
      validate(context, action) {
        return researchTechAction.canExecute(context, action.payload || {});
      },
      execute(context, action) {
        return researchTechAction.execute(context, {
          ...(action.payload || {}),
          tileId: action.target.tileId,
          blueSlot: action.target.blueSlot ?? null,
        });
      },
    };
  }

  function createReferenceDefinitions(referenceActions = {}) {
    return Object.freeze([
      createLaunchDefinition(referenceActions.launch),
      createOrbitDefinition(referenceActions.orbit),
      createLandDefinition(referenceActions.land),
      createResearchTechDefinition(referenceActions.researchTech || referenceActions.research_tech),
    ]);
  }

  function createOptionDefinition(family, action) {
    if (!action?.getOptions || !action?.canExecute || !action?.execute) {
      throw new TypeError(`${family} Standard Action 缺少 getOptions/canExecute/execute`);
    }
    return {
      family,
      label: action.label || family,
      enumerate(context) {
        const result = action.getOptions(context);
        if (!result?.ok) return [];
        return (result.choices || []).map((choice) => ({
          target: choice.target || null,
          payload: choice.payload || {},
          decision: choice.decision || null,
          summary: choice.label || action.label || family,
        }));
      },
      validate(context, descriptor) {
        return action.canExecute(context, {
          family,
          actorId: descriptor.actorId,
          stateVersion: descriptor.stateVersion,
          decisionVersion: descriptor.decisionVersion,
          target: descriptor.target || null,
          payload: descriptor.payload || {},
          decision: descriptor.decision || null,
        });
      },
      execute(context, descriptor) {
        return action.execute(context, {
          family,
          actorId: descriptor.actorId,
          stateVersion: descriptor.stateVersion,
          decisionVersion: descriptor.decisionVersion,
          target: descriptor.target || null,
          payload: descriptor.payload || {},
          decision: descriptor.decision || null,
        });
      },
    };
  }

  function createQuickTradeProvider(options = {}) {
    const quickTrades = options.quickTrades;
    if (!Array.isArray(quickTrades?.TRADE_ACTIONS)
      || typeof quickTrades.canExecuteTrade !== "function") {
      throw new TypeError("quick_trade production provider 缺少 QuickTrades 规则端口");
    }
    return Object.freeze({
      label: options.label || "快速交易",
      getOptions(actionContext) {
        const choices = quickTrades.TRADE_ACTIONS
          .filter((trade) => quickTrades.canExecuteTrade(trade.id, actionContext).ok)
          .map((trade) => ({
            target: { tradeId: trade.id },
            payload: { cost: trade.cost, gain: trade.gain },
            label: trade.label,
          }));
        return choices.length
          ? { ok: true, choices }
          : { ok: false, message: "没有可执行的快速交易" };
      },
      canExecute(actionContext, option) {
        const listed = this.getOptions(actionContext);
        return listed.ok && listed.choices.some((choice) => (
          choice.target.tradeId === option.target?.tradeId
        ))
          ? { ok: true }
          : { ok: false, code: "QUICK_TRADE_STALE", message: "快速交易已失效" };
      },
      execute(actionContext, option) {
        if (typeof options.execute !== "function") {
          return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" };
        }
        return options.execute(actionContext, option);
      },
    });
  }

  function createPlayCardProvider(options = {}) {
    const players = options.players;
    const cards = options.cards;
    const getCardPlayCost = options.getCardPlayCost;
    if (typeof players?.getCurrentPlayer !== "function"
      || typeof players?.canAfford !== "function"
      || typeof cards?.getCardLabel !== "function"
      || typeof getCardPlayCost !== "function") {
      throw new TypeError("play_card production provider 缺少 cards/players/cost 规则端口");
    }
    return Object.freeze({
      label: options.label || "打牌",
      getOptions(actionContext) {
        const startCheck = options.canStart?.(actionContext) || { ok: true };
        if (!startCheck.ok) return startCheck;
        const player = players.getCurrentPlayer(actionContext.playerState);
        const choices = (player?.hand || [])
          .map((card, handIndex) => ({ card, handIndex, cost: getCardPlayCost(card) }))
          .filter(({ cost }) => players.canAfford(player, cost))
          .map(({ card, handIndex, cost }) => ({
            target: { cardInstanceId: card.id },
            payload: { cost, handIndex },
            label: cards.getCardLabel(card),
          }));
        return choices.length
          ? { ok: true, choices }
          : { ok: false, message: "没有可支付的手牌" };
      },
      canExecute(actionContext, option) {
        const listed = this.getOptions(actionContext);
        return listed.ok && listed.choices.some((choice) => (
          choice.target.cardInstanceId === option.target?.cardInstanceId
          && stableSerialize(choice.payload.cost) === stableSerialize(option.payload?.cost || {})
        ))
          ? { ok: true }
          : { ok: false, code: "PLAY_CARD_STALE", message: "手牌身份或费用已失效" };
      },
      execute(actionContext, option) {
        if (typeof options.execute !== "function") {
          return { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED" };
        }
        return options.execute(actionContext, option);
      },
    });
  }

  function createStage2Definitions(actions = {}) {
    return Object.freeze([
      createOptionDefinition("scan", actions.scan),
      createOptionDefinition("analyze", actions.analyze),
      createOptionDefinition("play_card", actions.playCard || actions.play_card),
      createOptionDefinition("pass", actions.pass),
    ]);
  }

  function createStage3Definitions(actions = {}, options = {}) {
    const excluded = new Set(options.excludeFamilies || []);
    const entries = [
      ["move", actions.move],
      ["quick_trade", actions.quickTrade || actions.quick_trade],
      ["industry", actions.industry],
      ["card_corner", actions.cardCorner || actions.card_corner],
      ["place_data", actions.placeData || actions.place_data],
      ["runezu_face_symbol", actions.runezuFaceSymbol || actions.runezu_face_symbol],
      ["end_turn", actions.endTurn || actions.end_turn],
    ];
    return Object.freeze(entries
      .filter(([family]) => !excluded.has(family))
      .map(([family, action]) => createOptionDefinition(family, action)));
  }

  function createConditionalDefinition(family, action) {
    if (!CONDITIONAL_FAMILIES.includes(family)) {
      throw new TypeError(`未知 conditional Standard Action family: ${family}`);
    }
    return createOptionDefinition(family, action);
  }

  function createStage4Definitions(actions = {}) {
    return Object.freeze(CONDITIONAL_FAMILIES.map((family) => (
      createConditionalDefinition(family, actions[family])
    )));
  }

  function createReferenceRegistry(referenceActions, options = {}) {
    const registry = createRegistry(options);
    for (const definition of createReferenceDefinitions(referenceActions)) registry.register(definition);
    if (options.stage2Actions) {
      for (const definition of createStage2Definitions(options.stage2Actions)) registry.register(definition);
    }
    if (options.stage3Actions) {
      for (const definition of createStage3Definitions(options.stage3Actions, options)) {
        registry.register(definition);
      }
    }
    if (options.stage4Actions) {
      for (const definition of createStage4Definitions(options.stage4Actions)) registry.register(definition);
    }
    return registry;
  }

  function createRegistryAdapter(registry) {
    if (!registry?.enumerate || !registry?.execute) throw new TypeError("Standard Action adapter 需要 registry");
    function enumerate(context, request = {}) {
      return registry.enumerate(context, request);
    }
    function execute(context, action) {
      return registry.execute(context, action);
    }
    function validate(context, action) {
      return registry.validate(context, action);
    }
    function resolveIntent(context, family, selector = {}, request = {}) {
      const candidates = registry.enumerate(context, { ...request, family });
      const matches = candidates.filter((candidate) => Object.entries(selector).every(([key, value]) => (
        stableSerialize(candidate.target?.[key]) === stableSerialize(value)
        || stableSerialize(candidate.payload?.[key]) === stableSerialize(value)
      )));
      if (matches.length !== 1) {
        return fail(
          matches.length ? "STANDARD_ACTION_AMBIGUOUS" : "STANDARD_ACTION_NOT_LEGAL",
          matches.length ? `${family} intent 无法唯一确定 action` : `${family} intent 没有合法 action`,
        );
      }
      const validation = registry.validate(context, matches[0]);
      return validation.ok ? { ok: true, action: matches[0] } : validation;
    }
    return Object.freeze({ enumerate, validate, execute, resolveIntent });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    TOP_LEVEL_FAMILIES,
    CONDITIONAL_FAMILIES,
    ALL_FAMILIES,
    PHASE_BY_FAMILY,
    createRegistry,
    createLaunchDefinition,
    createOrbitDefinition,
    createLandDefinition,
    createResearchTechDefinition,
    createReferenceDefinitions,
    createOptionDefinition,
    createStage2Definitions,
    createStage3Definitions,
    createConditionalDefinition,
    createQuickTradeProvider,
    createPlayCardProvider,
    createStage4Definitions,
    createReferenceRegistry,
    createRegistryAdapter,
  });
});
