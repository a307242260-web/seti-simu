(function (root, factory) {
  "use strict";

  let initialCards = root.SetiInitialCards;
  let cards = root.SetiCards;
  let players = root.SetiPlayers;
  let rockets = root.SetiRocketActions;
  let solar = root.SetiSolarSystem;
  let data = root.SetiData;
  let industry = root.SetiIndustry;
  if ((!initialCards || !cards || !players || !rockets || !solar || !data || !industry)
    && typeof require === "function") {
    initialCards = initialCards || require("./initial-cards");
    cards = cards || require("./cards/deck");
    players = players || require("./players");
    rockets = rockets || require("./rockets");
    solar = solar || require("../solar-system/core");
    data = data || require("./data");
    industry = industry || require("./industry");
  }

  const api = factory(initialCards, cards, players, rockets, solar, data, industry);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiInitialSetup = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  initialCards,
  cards,
  players,
  rockets,
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
    if (kind === "industry") {
      return {
        id: `industry:${value}`,
        kind,
        label: stripExtension(value),
        src: `../assets/industry/${value}`,
        width: 1382,
        height: 1054,
      };
    }
    return {
      id: `initial:${value}`,
      kind,
      label: `初始牌 ${value}`,
      src: `../assets/initial_card/split/${value}.png`,
      width: 744,
      height: 1039,
    };
  }

  function activePlayerIds(rootState) {
    const known = new Set((rootState.playerState?.players || []).map((player) => player.id));
    const active = (rootState.turnState?.activePlayerIds || []).filter((playerId) => known.has(playerId));
    return active.length ? active : [rootState.playerState?.currentPlayerId].filter(Boolean);
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

  function selectedIndustryFiles(rootState) {
    const requested = new Set(
      (rootState.match?.initialSetupConfig?.industryLabels || []).map(String),
    );
    const selected = INDUSTRY_CARD_FILES.filter((fileName) => requested.has(stripExtension(fileName)));
    return selected.length >= 2 ? selected : [...INDUSTRY_CARD_FILES];
  }

  function start(rootState, suppliedRandom = null) {
    if (setupState(rootState)?.phase === "selecting") {
      return { ok: false, code: "INITIAL_SETUP_ALREADY_ACTIVE", message: "初始选择已经开始" };
    }
    const playerIds = activePlayerIds(rootState);
    const random = typeof suppliedRandom === "function"
      ? suppliedRandom
      : createRandom(`${rootState.meta?.seed || "browser-host"}:initial-setup`);
    const industryPool = selectedIndustryFiles(rootState);
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
      const player = rootState.playerState.players.find((candidate) => candidate.id === playerId);
      if (player) player.initialSelection = null;
    });
    rootState.match.initialSetup = {
      phase: playerIds.length ? "selecting" : "complete",
      currentPlayerId: playerIds[0] || null,
      playerIds,
      confirmedPlayerIds: [],
      offersByPlayerId,
    };
    if (playerIds[0]) rootState.playerState.currentPlayerId = playerIds[0];
    rootState.rocketState.statusNote = playerIds.length
      ? "请完成初始选择：公司 2 选 1，初始牌 3 选 2。"
      : "没有需要完成初始选择的玩家。";
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
    const earth = solar.createSolarSnapshot(rootState.solarState).planetLocations
      .find((planet) => planet.planetId === "earth");
    return earth ? { x: earth.x, y: earth.y } : { x: 1, y: 1 };
  }

  function resolveSelections(rootState, actionContext) {
    const random = typeof actionContext?.random === "function"
      ? actionContext.random
      : createRandom(`${rootState.meta?.seed || "browser-host"}:initial-settlement`);
    const result = initialCards.resolveInitialSelections({
      playerState: rootState.playerState,
      cardState: rootState.cardState,
      rocketState: rootState.rocketState,
      nebulaDataState: rootState.nebulaDataState,
      planetStatsState: rootState.planetStatsState,
      alienGameState: rootState.alienGameState,
      techGameState: rootState.techGameState,
      blindDrawCard(player) {
        if (typeof actionContext?.blindDrawCard === "function") return actionContext.blindDrawCard(player);
        return cards.blindDraw(
          rootState.cardState,
          rootState.playerState,
          player,
          random,
          typeof cards.createCommittedCardInstance === "function"
            ? {
              createCardInstance: (entry, sequence) => (
                cards.createCommittedCardInstance(rootState, entry, sequence)
              ),
            }
            : {},
        );
      },
      getEarthSectorCoordinate: () => earthCoordinate(rootState),
      launchRocketAtEarth(player) {
        if (typeof actionContext?.launchRocketAtEarth === "function") {
          return actionContext.launchRocketAtEarth(player);
        }
        return rockets.launchRocketAtSector(rootState.rocketState, earthCoordinate(rootState), {
          playerId: player.id,
          color: player.color,
        });
      },
    }, { playerIds: activePlayerIds(rootState) });
    if (!result?.ok) return result;
    rootState.match.initialIncomeQueue = (result.pendingIncomeIncreases || []).flatMap((entry) => (
      Array.from({ length: entry.count }, () => ({ playerId: entry.playerId, label: entry.label }))
    ));
    installNextIncomeDecision(rootState);
    return result;
  }

  function installNextIncomeDecision(rootState) {
    const next = rootState.match.initialIncomeQueue?.[0] || null;
    const player = rootState.playerState.players.find((candidate) => candidate.id === next?.playerId);
    if (!next || !player) {
      delete rootState.match.pendingDecision;
      delete rootState.match.initialIncomeQueue;
      rootState.playerState.currentPlayerId = rootState.turnState.startPlayerId
        || rootState.playerState.currentPlayerId;
      return false;
    }
    rootState.playerState.currentPlayerId = player.id;
    rootState.match.pendingDecision = {
      kind: "discard",
      type: "initial_income",
      playerId: player.id,
      count: 1,
      required: true,
    };
    return true;
  }

  function confirm(rootState, actionContext) {
    const setup = setupState(rootState);
    const player = rootState.playerState.players.find(
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
      industry: clone(selectedIndustry),
      removedInitialCards: clone(selectedInitialCards),
    };
    player.aiDifficulty = rootState.match?.initialSetupConfig?.aiDifficulty || player.aiDifficulty;
    initializeIndustryState(player);
    const nextPlayerId = setup.playerIds.find(
      (playerId) => !setup.confirmedPlayerIds.includes(playerId),
    );
    if (nextPlayerId) {
      setup.currentPlayerId = nextPlayerId;
      rootState.playerState.currentPlayerId = nextPlayerId;
      rootState.rocketState.statusNote = "上一位玩家已确认，轮到下一位玩家完成初始选择。";
      return {
        ok: true,
        progressed: true,
        events: [{ type: "initial_setup_player_confirmed", playerId: player.id }],
      };
    }
    setup.phase = "complete";
    setup.currentPlayerId = null;
    rootState.playerState.currentPlayerId = rootState.turnState.startPlayerId
      || rootState.playerState.currentPlayerId;
    const settlement = resolveSelections(rootState, actionContext);
    if (!settlement?.ok) return settlement;
    rootState.rocketState.statusNote = rootState.match.pendingDecision
      ? "所有玩家已完成初始选择，请完成初始收入结算。"
      : "所有玩家已完成初始选择，游戏开始。";
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
      summary: `选择公司：${card.label}`,
    }));
    const initialChoices = offer.initialOptions.flatMap((card) => {
      const selected = offer.selectedInitialIds.includes(card.id);
      if (!selected && offer.selectedInitialIds.length >= INITIAL_REQUIRED) return [];
      return [{
        target: { kind: "select_initial_card", selectionKind: "initial", cardId: card.id },
        payload: {},
        summary: `${selected ? "取消" : "选择"}：${card.label}`,
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

  function paymentChoices(rootState) {
    const pending = rootState.match?.pendingDecision;
    if (pending?.type !== "initial_income" || pending.kind !== "discard") return [];
    const player = rootState.playerState.players.find((candidate) => candidate.id === pending.playerId);
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

  function executePayment(rootState, actionContext, action) {
    const pending = rootState.match?.pendingDecision;
    const player = rootState.playerState.players.find((candidate) => candidate.id === pending?.playerId);
    const handIndex = action.target?.handIndexes?.[0];
    if (!player || !Number.isInteger(handIndex)
      || (player.hand[handIndex]?.cardId || player.hand[handIndex]?.id) !== action.target?.cardIds?.[0]) {
      return { ok: false, code: "INITIAL_INCOME_PAYMENT_STALE", message: "初始收入弃牌已失效" };
    }
    const discarded = cards.discardFromHandAtIndex(player, handIndex);
    if (!discarded?.ok) return discarded;
    cards.addToDiscardPile(rootState.cardState, discarded.card);
    const gain = cards.getIncomeGainForCard(discarded.card);
    if (gain) {
      players.gainIncome(player, gain, {
        blindDraw: (targetPlayer) => (
          typeof actionContext?.blindDrawCard === "function"
            ? actionContext.blindDrawCard(targetPlayer)
            : cards.blindDraw(
              rootState.cardState,
              rootState.playerState,
              targetPlayer,
              createRandom(`${rootState.meta?.seed || "browser-host"}:initial-income:${player.id}`),
              typeof cards.createCommittedCardInstance === "function"
                ? {
                  createCardInstance: (entry, sequence) => (
                    cards.createCommittedCardInstance(rootState, entry, sequence)
                  ),
                }
                : {},
            )
        ),
        gainData: (targetPlayer) => data.gainData(
          targetPlayer,
          { source: "initial_income", root: rootState },
        ),
      });
    }
    rootState.match.initialIncomeQueue.shift();
    delete rootState.match.pendingDecision;
    installNextIncomeDecision(rootState);
    return {
      ok: true,
      progressed: true,
      events: [{ type: "initial_income_resolved", playerId: player.id }],
    };
  }

  function createSource() {
    return Object.freeze({
      ownerId: OWNER_ID,
      families: FAMILIES,
      enumerate(actionContext, request = {}) {
        const rootState = actionContext?.workingRoot || actionContext;
        return request.family === "choose_card"
          ? selectionChoices(rootState)
          : request.family === "choose_payment"
            ? paymentChoices(rootState)
            : [];
      },
      validate(actionContext, action) {
        const rootState = actionContext?.workingRoot || actionContext;
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
        const rootState = actionContext?.workingRoot || actionContext;
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

  function createViewerPresentation(rootState, viewer) {
    const setup = rootState?.match?.initialSetup || null;
    if (!setup) return { active: false, interactive: false, currentPlayerId: null, offer: null };
    const currentPlayerId = setup.currentPlayerId == null ? null : String(setup.currentPlayerId);
    const viewerPlayerId = viewer?.playerId == null ? null : String(viewer.playerId);
    return {
      active: setup.phase === "selecting",
      interactive: setup.phase === "selecting" && currentPlayerId === viewerPlayerId,
      currentPlayerId,
      offer: setup.phase === "selecting" && currentPlayerId === viewerPlayerId
        ? clone(setup.offersByPlayerId?.[currentPlayerId] || null)
        : null,
      confirmedPlayerIds: clone(setup.confirmedPlayerIds || []),
    };
  }

  return Object.freeze({
    OWNER_ID,
    FAMILIES,
    createSource,
    createViewerPresentation,
    canConfirm,
    cardFromOffer,
  });
});
