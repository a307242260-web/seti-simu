(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  let standardActionSession = root.SetiStandardActionSession;
  let cardPlayDomain = root.SetiCardPlayDomain;
  let scienceSession = root.SetiScienceSession;
  let probeTurnSession = root.SetiProbeTurnSession;
  let residualDomainSession = root.SetiResidualDomainSession;
  let initialSetup = root.SetiInitialSetup;
  let cards = root.SetiCards;
  let quickTradeRules = root.SetiQuickTrades;
  let rocketAbility = root.SetiAbilityRocket;
  let chong = root.SetiAlienChong;
  if ((!standardAction || !standardActionSession || !cardPlayDomain || !scienceSession
    || !probeTurnSession || !residualDomainSession || !initialSetup || !cards || !quickTradeRules)
    && typeof require === "function") {
    standardAction = standardAction || require("./actions/standard-action");
    standardActionSession = standardActionSession || require("./effects/standard-action-session");
    cardPlayDomain = cardPlayDomain || require("./cards/play-domain");
    scienceSession = scienceSession || require("./effects/science-session");
    probeTurnSession = probeTurnSession || require("./effects/probe-turn-session");
    residualDomainSession = residualDomainSession || require("./effects/residual-domain-session");
    initialSetup = initialSetup || require("./initial-setup");
    cards = cards || require("./cards/deck");
    quickTradeRules = quickTradeRules || require("./actions/quick-trades");
    chong = chong || require("./aliens/chong");
    rocketAbility = rocketAbility || require("./abilities/rocket");
  }

  const api = factory(
    standardAction,
    standardActionSession,
    cardPlayDomain,
    scienceSession,
    probeTurnSession,
    residualDomainSession,
    initialSetup,
    cards,
    quickTradeRules,
    rocketAbility,
    chong,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiProductionComposition = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction,
  standardActionSession,
  cardPlayDomain,
  scienceSession,
  probeTurnSession,
  residualDomainSession,
  initialSetup,
  cards,
  quickTradeRules,
  rocketAbility,
  chong,
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
    const nestedRuleOverrides = [
      ...(options.productionRules?.conditionalActions ? ["productionRules.conditionalActions"] : []),
      ...(options.productionRules && !options.productionRules.conditionalActions ? ["productionRules"] : []),
      ...(options.hostServices?.quickTradeHistory ? ["hostServices.quickTradeHistory"] : []),
      ...(options.standardActionDomainOptions ? ["standardActionDomainOptions"] : []),
    ];
    if (nestedRuleOverrides.length) {
      throw new TypeError(
        `Production Composition 禁止 host 注入 Decision/事务规则: ${nestedRuleOverrides.join(", ")}`,
      );
    }
  }

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function sameDescriptor(left, right) {
    return JSON.stringify(left?.target) === JSON.stringify(right?.target)
      && JSON.stringify(left?.payload || {}) === JSON.stringify(right?.payload || {});
  }

  function createQuickTradeDecisionSource(quickTrades) {
    const FAMILIES = Object.freeze(["choose_card", "choose_payment", "choose_target"]);

    function currentPending(context) {
      return context?.standardActionDecisionContext?.type === "trade"
        ? context.standardActionDecisionContext
        : null;
    }

    function resolvePlayer(root, pending) {
      return root?.players?.players
        ?.find((player) => player.id === pending?.playerId) || null;
    }

    function openDiscard(root, count, input = {}) {
      const player = input.player
        || root.players?.players?.find((entry) => entry.id === input.playerId)
        || root.players?.players?.find(
          (entry) => entry.id === root.turn?.currentPlayerId,
        );
      const required = Math.max(1, Math.round(Number(count) || 0));
      if (!player || (player.hand || []).length < required) {
        return { ok: false, code: "QUICK_TRADE_DISCARD_UNAVAILABLE", message: "快速交易弃牌不足" };
      }
      const decisionContext = {
        kind: "discard",
        type: "trade",
        tradeId: input.tradeId,
        playerId: player.id,
        count: required,
        required: true,
        // 选中待弃的手牌卡 instance id（点选切换，弃满后确认结算）
        selected: [],
      };
      return {
        ok: true,
        decisionContext,
        message: `请选择 ${required} 张牌作为快速交易费用`,
      };
    }

    function openMoveSelection(root, input = {}) {
      const player = input.player
        || root.players?.players?.find((entry) => entry.id === input.playerId)
        || root.players?.players?.find(
          (entry) => entry.id === root.turn?.currentPlayerId,
        );
      if (!player) {
        return { ok: false, code: "QUICK_TRADE_MOVE_OWNER_MISSING", message: "快速移动 owner 不存在" };
      }
      const hasMove = (root.pieces?.rockets || []).some((rocket) => (
        rocket.playerId === player.id && rocket.surface === "solar-board"
      ));
      if (!hasMove) {
        return { ok: false, code: "QUICK_TRADE_MOVE_UNAVAILABLE", message: "没有可移动的探测器" };
      }
      return {
        ok: true,
        decisionContext: {
          kind: "move",
          type: "trade",
          tradeId: input.tradeId,
          playerId: player.id,
        },
        message: "请选择要移动的探测器与方向（1 步）",
      };
    }

    function moveChoices(root, pending) {
      const player = resolvePlayer(root, pending);
      if (!player) return [];
      // 统一移动入口：与卡牌/紫4/probe turn/残余域共用 listPlayerMoveChoices
      const moves = typeof rocketAbility?.listPlayerMoveChoices === "function"
        ? rocketAbility.listPlayerMoveChoices(root, player, { maxPoints: 1 })
        : [];
      return moves.map((move) => ({
        target: {
          kind: "quick-move",
          choiceId: `move:${move.rocketId}:${move.directionId}`,
          rocketId: move.rocketId,
          deltaX: move.deltaX,
          deltaY: move.deltaY,
          direction: move.directionId,
        },
        payload: { direction: move.directionId },
        summary: `移动探测器 ${move.rocketId} ${move.label}`,
      }));
    }

    function openCardSelection(root, input = {}) {
      const player = input.player
        || root.players?.players?.find((entry) => entry.id === input.playerId)
        || root.players?.players?.find(
          (entry) => entry.id === root.turn?.currentPlayerId,
        );
      if (!player) {
        return { ok: false, code: "QUICK_TRADE_CARD_OWNER_MISSING", message: "快速交易选牌 owner 不存在" };
      }
      const hasPublicCard = (root.cards?.publicCards || []).some(Boolean);
      if (!hasPublicCard && input.allowBlindDraw === false) {
        return { ok: false, code: "QUICK_TRADE_CARD_UNAVAILABLE", message: "没有可选公共牌" };
      }
      const decisionContext = {
        kind: "card_selection",
        type: "trade",
        tradeId: input.tradeId,
        playerId: player.id,
        allowBlindDraw: input.allowBlindDraw !== false,
      };
      return { ok: true, decisionContext, message: "请选择 1 张公共牌或盲抽" };
    }

    function discardChoices(root, pending) {
      const player = resolvePlayer(root, pending);
      // 快速交易弃牌候选包含全部手牌（含外星牌）。说明书 P20/P28 只豁免
      // 「钻探者卡牌」（=九折牌，不进手牌），虫（硫铵虫）等外星牌无豁免，
      // 按普通手牌可作弃牌/资源转换费用。
      const hand = player?.hand || [];
      const required = Math.max(1, Math.round(Number(pending?.count) || 1));
      const selected = [...(pending?.selected || [])].filter((id) => (
        hand.some((card) => String(card.id) === String(id))
      ));
      // 每张手牌一个选项（显示卡面，选中状态高亮），与精选/初始资源牌同一 UI 部件。
      const cardChoices = hand.map((card) => ({
        target: {
          kind: "discard-hand-card",
          cardInstanceId: card.id,
          select: true,
        },
        payload: {},
        summary: cards.getCardLabel(card),
        ...(cards.getCardPickPresentation(card) ? {
          presentation: {
            ...cards.getCardPickPresentation(card),
            selected: selected.some((id) => String(id) === String(card.id)),
          },
        } : {}),
      }));
      // Decision 只提供可执行输入；选满后才出现确认（提交仍校验费用）。
      if (selected.length === required) cardChoices.push({
        target: { kind: "confirm", confirm: true },
        payload: {},
        summary: `确认弃牌（${required}/${required}）`,
      });
      return cardChoices;
    }

    function cardChoices(root, pending) {
      const publicChoices = (root.cards?.publicCards || []).flatMap((card, slotIndex) => {
        if (!card) return [];
        return [{
          target: {
            kind: "trade-card-selection",
            choiceId: `public:${slotIndex}`,
            source: "public",
            slotIndex,
            cardInstanceId: card.id,
          },
          payload: { slotIndex },
          summary: cards.getCardLabel(card),
          // 精选牌卡面统一由 cards.getPublicCardPickPresentation 提供
          presentation: cards.getPublicCardPickPresentation(card),
        }];
      });
      return pending.allowBlindDraw
        ? [...publicChoices, {
          target: {
            kind: "trade-card-selection",
            choiceId: "blind",
            source: "blind",
          },
          payload: {},
          summary: "盲抽 1 张牌",
        }]
        : publicChoices;
    }

    function enumerate(context, request = {}) {
      const root = context?.state || context;
      const pending = currentPending(context);
      if (!pending) return [];
      if (request.family === "choose_payment" && pending.kind === "discard") {
        return discardChoices(root, pending);
      }
      if (request.family === "choose_card" && pending.kind === "card_selection") {
        return cardChoices(root, pending);
      }
      if (request.family === "choose_target" && pending.kind === "move") {
        return moveChoices(root, pending);
      }
      return [];
    }

    function validate(context, action) {
      return enumerate(context, { family: action.family }).some(
        (candidate) => sameDescriptor(candidate, action),
      )
        ? { ok: true }
        : { ok: false, code: "QUICK_TRADE_DECISION_STALE", message: "快速交易 Decision 已失效" };
    }

    function executeDiscard(context, action, pending) {
      const root = context?.state || context;
      const player = resolvePlayer(root, pending);
      const required = Math.max(1, Math.round(Number(pending?.count) || 1));
      const selected = [...(pending?.selected || [])];
      if (action.target?.kind === "discard-hand-card") {
        // 点选/取消一张手牌：切换选中状态后继续同一弃牌决策。
        const cardInstanceId = action.target.cardInstanceId;
        const inHand = (player?.hand || []).some((card) => String(card.id) === String(cardInstanceId));
        if (!inHand) {
          return { ok: false, code: "QUICK_TRADE_DISCARD_STALE", message: "弃牌目标已失效" };
        }
        const index = selected.findIndex((id) => String(id) === String(cardInstanceId));
        if (index >= 0) selected.splice(index, 1);
        else if (selected.length < required) selected.push(cardInstanceId);
        return {
          ok: true,
          progressed: true,
          nextDecisionContext: { ...clone(pending), selected },
          events: [{
            type: "quick_trade_discard_selection",
            tradeId: pending.tradeId,
            playerId: player.id,
            cardInstanceId,
            selected: clone(selected),
          }],
        };
      }
      if (action.target?.confirm) {
        if (selected.length !== required) {
          return {
            ok: false,
            code: "QUICK_TRADE_DISCARD_INCOMPLETE",
            message: `还需选择 ${Math.max(0, required - selected.length)} 张牌`,
          };
        }
        const discardedCardIds = [];
        for (const cardInstanceId of selected) {
          const index = (player?.hand || []).findIndex((card) => (
            String(card.id) === String(cardInstanceId)
          ));
          if (index < 0) {
            return { ok: false, code: "QUICK_TRADE_DISCARD_STALE", message: "弃牌目标已失效" };
          }
          const removed = cards.discardFromHandAtIndex(player, index);
          if (!removed?.ok) return removed;
          cards.addToDiscardPile(root.cards, removed.card);
          discardedCardIds.push(removed.card?.id || cardInstanceId);
        }
        let openedDecisionContext = null;
        const result = quickTrades.finalizeTradeAfterDiscard(
          pending.tradeId,
          {
            ...context,
            beginCardSelection(input) {
              const opened = openCardSelection(root, input);
              if (opened?.ok) openedDecisionContext = opened.decisionContext;
              return opened;
            },
          },
          player,
        );
        if (!result?.ok) return result;
        return {
          ...result,
          progressed: true,
          nextDecisionContext: clone(openedDecisionContext),
          events: [{
            type: "quick_trade_payment",
            tradeId: pending.tradeId,
            playerId: player.id,
            cardInstanceIds: discardedCardIds,
          }],
        };
      }
      return { ok: false, code: "QUICK_TRADE_DISCARD_STALE", message: "弃牌目标已失效" };
    }

    function executeCardSelection(context, action, pending) {
      const root = context?.state || context;
      const player = resolvePlayer(root, pending);
      if (!player) {
        return { ok: false, code: "QUICK_TRADE_CARD_OWNER_MISSING", message: "快速交易选牌 owner 不存在" };
      }
      // 统一抽牌上下文：快速交易获得牌（精选/盲抽）共用 cards.createCardDrawContext
      const drawContext = cards.createCardDrawContext(
        root.cards,
        root.players,
        context.random,
        { root },
      );
      const picked = action.target?.source === "blind"
        ? (typeof context.blindDrawCard === "function"
          ? context.blindDrawCard(player)
          : drawContext.blindDraw(player))
        : drawContext.pickFromPublic(player, Number(action.target?.slotIndex));
      if (!picked?.ok) return picked;
      return {
        ok: true,
        progressed: true,
        message: "快速交易选牌完成",
        irreversible: action.target?.source === "blind"
          ? { code: "hidden_card_draw", reason: "快速交易盲抽翻出隐藏牌" }
          : { code: "hidden_card_reveal", reason: "快速交易取牌后公共牌补牌" },
        events: [{
          type: "quick_trade_card_selected",
          tradeId: pending.tradeId,
          playerId: player.id,
          cardInstanceId: picked.card?.id || null,
        }],
      };
    }

    function executeMove(context, action, pending) {
      const root = context?.state || context;
      const player = resolvePlayer(root, pending);
      if (!player) {
        return { ok: false, code: "QUICK_TRADE_MOVE_OWNER_MISSING", message: "快速移动 owner 不存在" };
      }
      if (typeof rocketAbility?.moveProbe !== "function") {
        return { ok: false, code: "QUICK_TRADE_MOVE_UNAVAILABLE", message: "移动能力不可用" };
      }
      const result = rocketAbility.moveProbe(root, {
        rocketId: Number(action.target?.rocketId),
        deltaX: Number(action.target?.deltaX),
        deltaY: Number(action.target?.deltaY),
        movementPoints: 1,
        cost: {},
        source: "quick_move",
      });
      if (!result?.ok) return result;
      return {
        ok: true,
        progressed: true,
        message: "快速移动完成",
        // 移动及到达事件交由共享后继处理器触发任务/本回合奖励，不能只留下交易审计。
        events: [...result.events, {
          type: "quick_move",
          tradeId: pending.tradeId,
          playerId: player.id,
          rocketId: Number(action.target?.rocketId),
          direction: action.target?.direction || null,
        }],
      };
    }

    function execute(context, action) {
      const pending = currentPending(context);
      const validation = validate(context, action);
      if (!validation.ok) return validation;
      if (pending.kind === "discard") return executeDiscard(context, action, pending);
      if (pending.kind === "card_selection") return executeCardSelection(context, action, pending);
      return executeMove(context, action, pending);
    }

    return Object.freeze({
      families: FAMILIES,
      enumerate,
      validate,
      execute,
      openDiscard,
      openCardSelection,
      openMoveSelection,
    });
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
    if (!Array.isArray(quickTradeRules?.TRADE_ACTIONS)
      || typeof quickTradeRules.canExecuteTrade !== "function"
      || typeof quickTradeRules.executeTrade !== "function") {
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
        actorId: explicit?.actorId || context?.turn?.currentPlayerId || null,
        stateVersion: explicit?.stateVersion ?? context?.stateVersion ?? 0,
        decisionVersion: explicit?.decisionVersion ?? context?.decisionVersion ?? 0,
      };
    });
    const ownedRegistry = standardAction.createRegistry({ getAuthority });
    const quickTrades = quickTradeRules;
    const quickTradeDecisionSource = createQuickTradeDecisionSource(quickTrades);
    const conditionalSources = Object.freeze([initialSetupSource, quickTradeDecisionSource]);
    const enumerateSourceChoices = (context, family) => conditionalSources.flatMap(
      (source) => source.families.includes(family)
        ? source.enumerate(context, { family }).map((candidate) => ({ source, candidate }))
        : [],
    );
    const findSourceChoice = (context, family, action) => enumerateSourceChoices(context, family)
      .find(({ candidate }) => sameDescriptor(candidate, action)) || null;

    function createDecisionActionContext(actionContext, decisionContext) {
      const root = actionContext?.state || actionContext;
      const actorId = decisionContext?.kind === "initial_income"
        ? decisionContext.queue?.[0]?.playerId || null
        : decisionContext?.playerId || null;
      if (!root || !actorId) return null;
      return {
        ...(actionContext?.state ? actionContext : {
          state: root,
          players: root.players,
          cards: root.cards,
          turn: root.turn,
          match: root.match,
        }),
        standardActionAuthority: {
          actorId,
          stateVersion: actionContext?.stateVersion ?? root.meta?.stateVersion ?? 0,
          decisionVersion: root.match?.decisionVersion ?? actionContext?.decisionVersion ?? 0,
        },
        standardActionDecisionContext: clone(decisionContext),
      };
    }

    function createSessionDecisionEffect(actionContext, decisionContext) {
      const decisionActionContext = createDecisionActionContext(actionContext, decisionContext);
      if (!decisionActionContext) return null;
      const family = decisionContext.kind === "card_selection"
        ? "choose_card"
        : decisionContext.kind === "move"
          ? "choose_target"
          : "choose_payment";
      const choices = ownedRegistry.enumerate(decisionActionContext, { family });
      if (!choices.length) return null;
      return {
        type: standardActionSession.DECISION_EFFECT_TYPE,
        kind: "decision",
        ownerId: decisionActionContext.standardActionAuthority.actorId,
        decisionKind: family,
        payload: {
          choices: clone(choices),
          decisionContext: clone(decisionContext),
        },
      };
    }

    function incomeDecisionContext(entries) {
      const queue = (entries || []).flatMap((entry) => (
        Array.from(
          { length: Math.max(0, Math.round(Number(entry?.count) || 0)) },
          () => ({ playerId: entry.playerId, label: entry.label }),
        )
      ));
      return queue.length ? { kind: "initial_income", queue } : null;
    }

    function attachNextDecision(actionContext, result) {
      if (!result?.ok) return result;
      const nextDecisionContext = result.nextDecisionContext
        || (Array.isArray(result.remainingDecisionQueue)
          ? (result.remainingDecisionQueue.length
            ? { kind: "initial_income", queue: result.remainingDecisionQueue }
            : null)
          : incomeDecisionContext(result.settlement?.pendingIncomeIncreases));
      const {
        nextDecisionContext: _nextDecisionContext,
        remainingDecisionQueue: _remainingDecisionQueue,
        ...cleanResult
      } = result;
      const decisionEffect = createSessionDecisionEffect(actionContext, nextDecisionContext);
      if (nextDecisionContext && !decisionEffect) {
        return {
          ok: false,
          code: "PRODUCTION_SESSION_DECISION_EMPTY",
          message: "规则要求继续选择，但当前 Session Decision 没有合法项",
        };
      }
      return decisionEffect ? { ...cleanResult, decisionEffect } : cleanResult;
    }

    function attachOpeningDecision(actionContext, result) {
      const attached = attachNextDecision(actionContext, result);
      if (!attached?.ok || attached.decisionEffect) return attached;
      const decisionEffect = createOpeningDecisionEffect(actionContext);
      return decisionEffect ? { ...attached, decisionEffect } : attached;
    }

    const OPENING_EFFECT_TYPE = "production_opening_session";

    function createOpeningDecisionEffect(actionContext) {
      const root = actionContext?.state || actionContext;
      const setupPlayerId = root?.match?.initialSetup?.currentPlayerId || null;
      const openingActorId = setupPlayerId || root?.turn?.currentPlayerId || null;
      const setupActionContext = openingActorId
        ? createDecisionActionContext(actionContext, {
          kind: "initial_setup",
          playerId: openingActorId,
        })
        : null;
      const setupChoices = setupActionContext
        ? INITIAL_SETUP_FAMILIES.flatMap(
          (family) => actionRegistry.enumerate(setupActionContext, { family }),
        )
        : [];
      if (setupChoices.length) {
        return {
          type: standardActionSession.DECISION_EFFECT_TYPE,
          kind: "decision",
          ownerId: setupChoices[0].actorId,
          decisionKind: setupChoices[0].family,
          payload: { choices: clone(setupChoices) },
        };
      }
      const incomeQueue = initialSetup.createIncomeDecisionQueue(
        root,
      );
      return createSessionDecisionEffect(
        actionContext,
        incomeQueue.length ? { kind: "initial_income", queue: incomeQueue } : null,
      );
    }

    function createOpeningEffectDomain({ runtime }) {
      runtime.registerExecutor(OPENING_EFFECT_TYPE, (canonicalState) => {
        const decisionEffect = createOpeningDecisionEffect(canonicalState);
        return {
          ok: true,
          nextState: clone(canonicalState),
          spawnedEffects: decisionEffect
            ? [{ priority: "direct", effect: decisionEffect }]
            : [],
        };
      });
      return Object.freeze({
        actionFamilies: [],
        createEffectGroup() {
          return {
            ok: false,
            code: "OPENING_EFFECT_ACTION_UNSUPPORTED",
            message: "Opening Effect domain 不接受玩家 Action",
          };
        },
        createDrainEffectGroup() {
          return {
            kind: "internal",
            effects: [{ type: OPENING_EFFECT_TYPE }],
          };
        },
      });
    }

    function executeQuickTrade(actionContext, action) {
      const root = actionContext?.state || actionContext;
      const beforeDecisionVersion = Number(
        root?.match?.decisionVersion ?? actionContext?.decisionVersion,
      ) || 0;
      let openedDecisionContext = null;
      const result = quickTrades.executeTrade(action.target?.tradeId, {
        ...actionContext,
        beginDiscardSelection(count, input) {
          const opened = quickTradeDecisionSource.openDiscard(root, count, input);
          if (opened?.ok) openedDecisionContext = opened.decisionContext;
          return opened;
        },
        beginCardSelection(input) {
          const opened = quickTradeDecisionSource.openCardSelection(root, input);
          if (opened?.ok) openedDecisionContext = opened.decisionContext;
          return opened;
        },
        beginMoveSelection(input) {
          const opened = quickTradeDecisionSource.openMoveSelection(root, input);
          if (opened?.ok) openedDecisionContext = opened.decisionContext;
          return opened;
        },
      });
      if (!result?.ok) return result;
      if (root?.match && (Number(root.match.decisionVersion) || 0) === beforeDecisionVersion) {
        root.match.decisionVersion = beforeDecisionVersion + 1;
      }
      const event = {
        type: "quick_trade",
        tradeId: action.target?.tradeId,
        playerId: action.actorId || actionContext?.turn?.currentPlayerId || null,
        executorId: QUICK_TRADE_EXECUTOR_ID,
      };
      return attachNextDecision(actionContext, {
        ...result,
        nextDecisionContext: openedDecisionContext,
        progressed: true,
        executorId: QUICK_TRADE_EXECUTOR_ID,
        events: [event],
        journalHistory: [event],
      });
    }
    const quickTradeProvider = standardAction.createQuickTradeProvider({
      quickTrades,
      execute: executeQuickTrade,
    });
    function canOfferQuickTrade(actionContext) {
      const root = actionContext?.state || actionContext;
      const actorId = actionContext?.standardActionAuthority?.actorId
        || actionContext?.turn?.currentPlayerId
        || null;
      const actor = actionContext?.players?.players
        ?.find((player) => player.id === actorId) || null;
      const passed = root?.turn?.passedPlayerIds?.includes(actorId);
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
          if (conditionalSources.some((source) => source.families.includes(family))) {
            const choices = enumerateSourceChoices(context, family);
            return choices.length
              ? { ok: true, choices: choices.map(({ candidate }) => ({
                target: candidate.target,
                payload: candidate.payload,
                decision: candidate.decision,
                label: candidate.summary,
                // 卡面/禁用原因随决策透传（弃牌换奖励、精选等 UI 依赖）
                ...(candidate.presentation ? { presentation: candidate.presentation } : {}),
                ...(candidate.disabledReason ? { disabledReason: candidate.disabledReason } : {}),
              })) }
              : { ok: false, code: "SESSION_DECISION_ONLY", message: `当前没有 ${family} source` };
          }
          return { ok: false, code: "SESSION_DECISION_ONLY", message: `${family} 只由 Effect Session Decision 产生` };
        },
        canExecute(context, option) {
          const resolved = findSourceChoice(context, family, option);
          return resolved
            ? resolved.source.validate(context, { ...option, family })
            : { ok: false, code: "STANDARD_ACTION_NOT_LEGAL", message: `${family} source 已失效` };
        },
        execute(context, action) {
          const resolved = findSourceChoice(context, family, action);
          if (!resolved) {
            return { ok: false, code: "STANDARD_ACTION_NOT_LEGAL", message: `${family} source 已失效` };
          }
          return resolved.source === initialSetupSource
            ? attachOpeningDecision(
              context,
              resolved.source.execute(context, { ...action, family }),
            )
            : attachNextDecision(
              context,
              resolved.source.execute(context, { ...action, family }),
            );
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
    const standardDomain = Object.freeze({
      id: "standard_action",
      families: standardFamilies,
      create: standardActionSession.createStandardActionDomain,
      options: Object.freeze({
        actionFamilies: standardFamilies,
      }),
    });
    const openingDomain = Object.freeze({
      id: "opening_session",
      families: Object.freeze([]),
      create: createOpeningEffectDomain,
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
      openingDomain,
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
