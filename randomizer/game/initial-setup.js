(function (root, factory) {
  "use strict";

  let initialCards = root.SetiInitialCards;
  let cards = root.SetiCards;
  let players = root.SetiPlayers;
  let solar = root.SetiSolarSystem;
  let data = root.SetiData;
  let industry = root.SetiIndustry;
  if ((!initialCards || !cards || !players || !solar || !data || !industry)
    && typeof require === "function") {
    initialCards = initialCards || require("./initial-cards");
    cards = cards || require("./cards/deck");
    players = players || require("./players");
    solar = solar || require("../solar-system/core");
    data = data || require("./data");
    industry = industry || require("./industry");
  }

  const api = factory(initialCards, cards, players, solar, data, industry);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiInitialSetup = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  initialCards,
  cards,
  players,
  solar,
  data,
  industry,
) {
  "use strict";

  const OWNER_ID = "seti-production-domain-pack-v1:initial_setup";
  const FAMILIES = Object.freeze(["choose_card", "choose_payment"]);
  const INDUSTRY_CARD_FILES = Object.freeze([
    "层云核心.png", "芬威克研究中心.png", "赫利昂联合体.png", "寰宇动力.png",
    "任务中继站.png", "哨兵探测网络.png", "深空探测.png", "图灵系统.png",
    "未来跨度研究所.png", "异星实验室.png", "宇宙战略集团.png",
  ]);
  const INITIAL_REQUIRED = 2;

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function hashSeed(value) {
    let state = 2166136261;
    for (const character of String(value ?? "seti-initial-setup")) {
      state ^= character.charCodeAt(0);
      state = Math.imul(state, 16777619);
    }
    return state >>> 0 || 1;
  }

  function createRandom(seed) {
    let state = hashSeed(seed);
    return function random() {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(values, random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const selected = Math.floor(random() * (index + 1));
      [result[index], result[selected]] = [result[selected], result[index]];
    }
    return result;
  }

  function stripExtension(value) {
    return String(value || "").replace(/\.[^./\\]+$/, "");
  }

  function createSelectionCard(kind, value) {
    return {
      id: `${kind}:${value}`,
      kind,
      value,
    };
  }

  function selectionLabel(card) {
    return card?.kind === "industry"
      ? stripExtension(card.value)
      : `初始牌 ${card?.value}`;
  }

  function activePlayerIds(rootState) {
    const known = new Set((rootState.players?.players || []).map((player) => player.id));
    const active = (rootState.turn?.activePlayerIds || []).filter((playerId) => known.has(playerId));
    return active.length ? active : [rootState.turn?.currentPlayerId].filter(Boolean);
  }

  function setupState(rootState) {
    return rootState.match?.initialSetup || null;
  }

  function offerFor(rootState, playerId) {
    return setupState(rootState)?.offersByPlayerId?.[playerId] || null;
  }

  function canConfirm(offer) {
    return Boolean(
      offer?.selectedIndustryId
      && Array.isArray(offer.selectedInitialIds)
      && offer.selectedInitialIds.length === INITIAL_REQUIRED,
    );
  }

  function cardFromOffer(offer, kind, cardId) {
    const options = kind === "industry" ? offer?.industryOptions : offer?.initialOptions;
    return (options || []).find((card) => card.id === cardId) || null;
  }

  function start(rootState, suppliedRandom = null) {
    if (setupState(rootState)?.phase === "selecting") {
      return { ok: false, code: "INITIAL_SETUP_ALREADY_ACTIVE", message: "初始选择已经开始" };
    }
    const playerIds = activePlayerIds(rootState);
    const random = typeof suppliedRandom === "function"
      ? suppliedRandom
      : createRandom(`${rootState.meta?.seed || "browser-host"}:initial-setup`);
    const industryPool = [...INDUSTRY_CARD_FILES];
    const industryDeck = industryPool.length >= playerIds.length * 2
      ? shuffle(industryPool, random).slice(0, playerIds.length * 2)
      : null;
    const initialDeck = shuffle(
      Array.from({ length: initialCards.INITIAL_CARD_COUNT }, (_entry, index) => index + 1),
      random,
    );
    const offersByPlayerId = {};
    playerIds.forEach((playerId, index) => {
      const companyFiles = industryDeck
        ? industryDeck.slice(index * 2, index * 2 + 2)
        : shuffle(industryPool, random).slice(0, 2);
      offersByPlayerId[playerId] = {
        playerId,
        industryOptions: companyFiles.map((fileName) => createSelectionCard("industry", fileName)),
        initialOptions: initialDeck.slice(index * 3, index * 3 + 3)
          .map((number) => createSelectionCard("initial", number)),
        selectedIndustryId: null,
        selectedInitialIds: [],
        confirmed: false,
      };
      const player = rootState.players.players.find((candidate) => candidate.id === playerId);
      if (player) player.initialSelection = null;
    });
    rootState.match.initialSetup = {
      phase: playerIds.length ? "selecting" : "complete",
      currentPlayerId: playerIds[0] || null,
      playerIds,
      confirmedPlayerIds: [],
      offersByPlayerId,
    };
    if (playerIds[0]) rootState.turn.currentPlayerId = playerIds[0];
    return {
      ok: true,
      progressed: true,
      events: [{ type: "initial_setup_started", ownerId: OWNER_ID }],
    };
  }

  function initializeIndustryState(player) {
    if (industry.shouldInitializeStrategyPassiveMarkers?.(player)) {
      industry.initializeStrategyPassiveMarkers(player);
    }
    if (industry.shouldInitializeHeliosPassiveMarkers?.(player)) {
      industry.initializeHeliosPassiveMarkers(player);
    }
    if (industry.shouldInitializeAlienLabPanels?.(player)) {
      industry.initializeAlienLabPanels(player);
    }
    if (industry.shouldInitializeFutureSpan?.(player)) {
      industry.initializeFutureSpanState(player);
    }
  }

  function earthCoordinate(rootState) {
    const earth = solar.createSolarSnapshot(rootState.solarSystem).planetLocations
      .find((planet) => planet.planetId === "earth");
    return earth ? { x: earth.x, y: earth.y } : { x: 1, y: 1 };
  }

  function resolveSelections(rootState, actionContext) {
    const random = typeof actionContext?.random === "function"
      ? actionContext.random
      : createRandom(`${rootState.meta?.seed || "browser-host"}:initial-settlement`);
    const result = initialCards.resolveInitialSelections({
      state: rootState,
      players: rootState.players,
      cards: rootState.cards,
      pieces: rootState.pieces,
      data: rootState.data,
      planets: rootState.planets,
      aliens: rootState.aliens,
      tech: rootState.tech,
      turn: rootState.turn,
      blindDrawCard(player) {
        if (typeof actionContext?.blindDrawCard === "function") return actionContext.blindDrawCard(player);
        // 统一抽牌上下文：初始结算盲抽共用 cards.createCardDrawContext
        return cards.createCardDrawContext(
          rootState.cards,
          rootState.players,
          random,
          { root: rootState },
        ).blindDraw(player);
      },
      getEarthSectorCoordinate: () => earthCoordinate(rootState),
    }, { playerIds: activePlayerIds(rootState) });
    return result;
  }

  function confirm(rootState, actionContext) {
    const setup = setupState(rootState);
    const player = rootState.players.players.find(
      (candidate) => candidate.id === setup?.currentPlayerId,
    );
    const offer = offerFor(rootState, player?.id);
    if (!player || !offer || offer.confirmed || !canConfirm(offer)) {
      return {
        ok: false,
        code: "INITIAL_SETUP_CONFIRM_NOT_LEGAL",
        message: "初始选择未完成或已经确认",
      };
    }
    const selectedIndustry = cardFromOffer(offer, "industry", offer.selectedIndustryId);
    const selectedInitialCards = offer.selectedInitialIds
      .map((cardId) => cardFromOffer(offer, "initial", cardId))
      .filter(Boolean);
    offer.confirmed = true;
    setup.confirmedPlayerIds.push(player.id);
    player.initialSelection = {
      industry: { id: selectedIndustry.id },
      removedInitialCards: selectedInitialCards.map((card) => ({ id: card.id })),
    };
    initializeIndustryState(player);
    const nextPlayerId = setup.playerIds.find(
      (playerId) => !setup.confirmedPlayerIds.includes(playerId),
    );
    if (nextPlayerId) {
      setup.currentPlayerId = nextPlayerId;
      rootState.turn.currentPlayerId = nextPlayerId;
      return {
        ok: true,
        progressed: true,
        events: [{ type: "initial_setup_player_confirmed", playerId: player.id }],
      };
    }
    setup.phase = "complete";
    setup.currentPlayerId = null;
    rootState.turn.currentPlayerId = rootState.turn.startPlayerId
      || rootState.turn.currentPlayerId;
    const settlement = resolveSelections(rootState, actionContext);
    if (!settlement?.ok) return settlement;
    if (!(settlement.pendingIncomeIncreases || []).some(
      (entry) => (Number(entry?.count) || 0) > 0,
    )) {
      delete rootState.match.initialSetup;
    }
    return {
      ok: true,
      progressed: true,
      settlement,
      events: [
        { type: "initial_setup_player_confirmed", playerId: player.id },
        { type: "initial_setup_settled", ownerId: OWNER_ID },
      ],
    };
  }

  function selectionChoices(rootState) {
    const setup = setupState(rootState);
    if (!setup) {
      const needsSetup = activePlayerIds(rootState).some((playerId) => {
        const player = rootState.players.players.find((candidate) => candidate.id === playerId);
        return !player?.initialSelection;
      });
      if (!needsSetup) return [];
      return [{
        target: { kind: "start_initial_setup" },
        payload: {},
        summary: "开始初始选择",
      }];
    }
    if (setup.phase !== "selecting") return [];
    const offer = offerFor(rootState, setup.currentPlayerId);
    if (!offer || offer.confirmed) return [];
    const industryChoices = offer.industryOptions.map((card) => ({
      target: { kind: "select_initial_card", selectionKind: "industry", cardId: card.id },
      payload: {},
      summary: `选择公司：${selectionLabel(card)}`,
    }));
    const initialChoices = offer.initialOptions.flatMap((card) => {
      const selected = offer.selectedInitialIds.includes(card.id);
      if (!selected && offer.selectedInitialIds.length >= INITIAL_REQUIRED) return [];
      return [{
        target: { kind: "select_initial_card", selectionKind: "initial", cardId: card.id },
        payload: {},
        summary: `${selected ? "取消" : "选择"}：${selectionLabel(card)}`,
      }];
    });
    return [
      ...industryChoices,
      ...initialChoices,
      ...(canConfirm(offer) ? [{
        target: { kind: "confirm_initial_setup" },
        payload: {},
        summary: "确认初始选择",
      }] : []),
    ];
  }

  function executeSelection(rootState, actionContext, action) {
    const kind = action.target?.kind;
    if (kind === "start_initial_setup") return start(rootState, actionContext?.random);
    if (kind === "confirm_initial_setup") return confirm(rootState, actionContext);
    const setup = setupState(rootState);
    const offer = offerFor(rootState, setup?.currentPlayerId);
    const selectionKind = action.target?.selectionKind;
    const cardId = action.target?.cardId;
    const card = cardFromOffer(offer, selectionKind, cardId);
    if (!offer || offer.confirmed || !card) {
      return { ok: false, code: "INITIAL_SETUP_CARD_STALE", message: "初始选择卡牌已失效" };
    }
    if (selectionKind === "industry") {
      offer.selectedIndustryId = cardId;
    } else {
      const index = offer.selectedInitialIds.indexOf(cardId);
      if (index >= 0) offer.selectedInitialIds.splice(index, 1);
      else if (offer.selectedInitialIds.length < INITIAL_REQUIRED) offer.selectedInitialIds.push(cardId);
      else return { ok: false, code: "INITIAL_SETUP_CARD_LIMIT", message: "初始牌已选满" };
    }
    return {
      ok: true,
      progressed: true,
      events: [{ type: "initial_setup_selection_changed", playerId: setup.currentPlayerId }],
    };
  }

  function paymentChoices(rootState, decisionContext) {
    const pending = decisionContext?.kind === "initial_income"
      ? decisionContext.queue?.[0] || null
      : null;
    if (!pending) return [];
    const player = rootState.players.players.find((candidate) => candidate.id === pending.playerId);
    return (player?.hand || []).map((card, handIndex) => ({
      target: {
        kind: "discard-hand-cards",
        choiceId: String(handIndex),
        cardIds: [card.cardId || card.id],
        handIndexes: [handIndex],
      },
      payload: { handIndexes: [handIndex] },
      summary: cards.getCardLabel(card),
    }));
  }

  function createIncomeDecisionQueue(rootState) {
    const setup = setupState(rootState);
    if (setup?.phase !== "complete") return [];
    return activePlayerIds(rootState).flatMap((playerId) => {
      const player = rootState.players.players.find((candidate) => candidate.id === playerId);
      const effect = initialCards.getIndustryEffect(player?.initialSelection?.industry);
      const required = Math.max(0, Math.round(Number(effect?.incomeIncreaseCount) || 0));
      return Array.from(
        { length: required },
        () => ({ playerId, label: effect?.label || "公司牌" }),
      );
    });
  }

  function executePayment(rootState, actionContext, action) {
    const decisionContext = actionContext?.standardActionDecisionContext;
    const pending = decisionContext?.kind === "initial_income"
      ? decisionContext.queue?.[0] || null
      : null;
    const player = rootState.players.players.find((candidate) => candidate.id === pending?.playerId);
    const handIndex = action.target?.handIndexes?.[0];
    if (!player || !Number.isInteger(handIndex)
      || (player.hand[handIndex]?.cardId || player.hand[handIndex]?.id) !== action.target?.cardIds?.[0]) {
      return { ok: false, code: "INITIAL_INCOME_PAYMENT_STALE", message: "初始收入弃牌已失效" };
    }
    const discarded = cards.discardFromHandAtIndex(player, handIndex);
    if (!discarded?.ok) return discarded;
    // 初始收入牌插入起始收入牌下方，移出游戏（不进弃牌堆、不会被洗回主牌库）。
    cards.addRemovedFromGame(rootState.cards, discarded.card);
    const gain = cards.getIncomeGainForCard(discarded.card);
    if (gain) {
      players.gainIncome(player, gain, {
        blindDraw: (targetPlayer) => (
          typeof actionContext?.blindDrawCard === "function"
            ? actionContext.blindDrawCard(targetPlayer)
            // 统一抽牌上下文：初始收入盲抽共用 cards.createCardDrawContext
            : cards.createCardDrawContext(
              rootState.cards,
              rootState.players,
              createRandom(`${rootState.meta?.seed || "browser-host"}:initial-income:${player.id}`),
              { root: rootState },
            ).blindDraw(targetPlayer)
        ),
        gainData: (targetPlayer) => data.gainData(
          targetPlayer,
          { source: "initial_income", root: rootState },
        ),
      });
    }
    const remainingDecisionQueue = clone(decisionContext.queue.slice(1));
    if (!remainingDecisionQueue.length) {
      delete rootState.match.initialSetup;
    }
    return {
      ok: true,
      progressed: true,
      remainingDecisionQueue,
      events: [{ type: "initial_income_resolved", playerId: player.id }],
    };
  }

  function createSource() {
    return Object.freeze({
      ownerId: OWNER_ID,
      families: FAMILIES,
      enumerate(actionContext, request = {}) {
        const rootState = actionContext?.state || actionContext;
        return request.family === "choose_card"
          ? selectionChoices(rootState)
          : request.family === "choose_payment"
            ? paymentChoices(rootState, actionContext?.standardActionDecisionContext)
            : [];
      },
      validate(actionContext, action) {
        const rootState = actionContext?.state || actionContext;
        const family = action.family || (
          Array.isArray(action.target?.handIndexes) ? "choose_payment" : "choose_card"
        );
        const legal = this.enumerate(actionContext, { family });
        return legal.some((candidate) => (
          JSON.stringify(candidate.target) === JSON.stringify(action.target)
          && JSON.stringify(candidate.payload || {}) === JSON.stringify(action.payload || {})
        ))
          ? { ok: true }
          : { ok: false, code: "INITIAL_SETUP_ACTION_STALE", message: "initial_setup action 已失效" };
      },
      execute(actionContext, action) {
        const rootState = actionContext?.state || actionContext;
        const family = action.family || (
          Array.isArray(action.target?.handIndexes) ? "choose_payment" : "choose_card"
        );
        return family === "choose_card"
          ? executeSelection(rootState, actionContext, action)
          : family === "choose_payment"
            ? executePayment(rootState, actionContext, action)
            : { ok: false, code: "INITIAL_SETUP_FAMILY_INACTIVE", message: "不是 initial_setup family" };
      },
    });
  }

  return Object.freeze({
    OWNER_ID,
    FAMILIES,
    createSource,
    createIncomeDecisionQueue,
    canConfirm,
    cardFromOffer,
  });
});
