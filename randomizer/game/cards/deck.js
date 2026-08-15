(function (root, factory) {
  "use strict";

  let catalog = root.SetiCardCatalog;
  let stateSequences = root.SetiStateSequences;

  if ((!catalog || !stateSequences) && typeof require === "function") {
    try {
      catalog = catalog || require("../../../assets/cards/card_model.json");
    } catch (_error) {
      catalog = [];
    }
    stateSequences = stateSequences || require("../state/sequences");
  }

  const api = factory(Array.isArray(catalog) ? catalog : [], stateSequences);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiCards = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (CARD_CATALOG, stateSequences) {
  "use strict";

  const PUBLIC_CARD_COUNT = 3;
  const CARD_BASE_PATH = "../assets/cards";
  const INCOME_CODE_GAINS = Object.freeze({
    0: Object.freeze({ credits: 1 }),
    1: Object.freeze({ energy: 1 }),
    2: Object.freeze({ handSize: 1 }),
    3: Object.freeze({ availableData: 1 }),
    4: Object.freeze({ publicity: 1 }),
  });
  const DISCARD_ACTION_REWARDS = Object.freeze({
    0: Object.freeze({
      code: 0,
      label: "弃牌换1宣传",
      gain: Object.freeze({ publicity: 1 }),
      dataCount: 0,
    }),
    1: Object.freeze({
      code: 1,
      label: "弃牌换1数据",
      gain: Object.freeze({}),
      dataCount: 1,
    }),
    3: Object.freeze({
      code: 3,
      label: "弃牌换2宣传",
      gain: Object.freeze({ publicity: 2 }),
      dataCount: 0,
    }),
    4: Object.freeze({
      code: 4,
      label: "弃牌换1数据+1分",
      gain: Object.freeze({ score: 1 }),
      dataCount: 1,
    }),
  });
  const DISCARD_ACTION_MOVE_REWARDS = Object.freeze({
    2: Object.freeze({
      code: 2,
      label: "弃牌换1移动",
      movementPoints: 1,
      gain: Object.freeze({}),
    }),
    5: Object.freeze({
      code: 5,
      label: "弃牌换1移动+1分",
      movementPoints: 1,
      gain: Object.freeze({ score: 1 }),
    }),
  });
  const DISCARD_ACTION_TRIGGER_CODE_EQUIVALENTS = Object.freeze({
    3: 0,
    4: 1,
    5: 2,
  });
  const CARD_CATALOG_BY_ID = new Map(CARD_CATALOG.map((entry) => [entry.card_id, entry]));

  function getCardSrc(entry) {
    return `${CARD_BASE_PATH}/${entry.set}/split/${entry.card_id}`;
  }

  // 统一卡面展示：任意要选牌的卡（手牌/公共牌/保留牌/弃牌角标等）都用它，
  // 避免各选牌场景重复配置卡面。
  // 外星人牌（set: alien:*）不在标准卡表，按 alienCardId 生成 `../assets/aliens/<物种>/cards/<index>.webp`。
  function getAlienCardImageSrc(card) {
    if (!card) return null;
    const set = String(card.set || "");
    if (!set.startsWith("alien:")) return null;
    const speciesName = set.slice("alien:".length);
    if (!speciesName || !["阿米巴", "虫", "奥陌陌", "半人马", "符文族", "异常点", "方舟", "九折"].includes(speciesName)) {
      return card.src || null;
    }
    const index = Number.isInteger(Number(card.alienCardId))
      ? Number(card.alienCardId)
      : /_(\d+)\.webp$/.exec(String(card.cardId || ""))?.[1];
    if (index == null) return card.src || null;
    return `../assets/aliens/${speciesName}/cards/${index}.webp`;
  }

  function getCardPickPresentation(card) {
    if (!card) return null;
    const entry = getCatalogEntryForCard(card);
    return {
      cardKind: "pick",
      cardId: String(card.id),
      imageSrc: entry
        ? getCardSrc(entry)
        : (getAlienCardImageSrc(card) || card.src || null),
      imageAlt: getCardLabel(card),
    };
  }

  // 精选公共牌的统一卡面展示（交易精选与卡牌效果精选共用，避免两处重复配置）
  function getPublicCardPickPresentation(card) {
    return getCardPickPresentation(card);
  }

  function getCardId(value) {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value.card_id) return value.card_id;
    if (value.cardId) return value.cardId;
    if (Number.isInteger(value.cardIndex)) return `b_${value.cardIndex}.webp`;
    return null;
  }

  function getCatalogEntryByCardId(cardId) {
    if (!cardId) return null;
    return CARD_CATALOG_BY_ID.get(String(cardId)) || null;
  }

  function createCardInstance(entry, sequence) {
    if (sequence == null || String(sequence).length === 0) {
      throw new TypeError("创建非权威卡牌实例需要显式测试序列");
    }
    return {
      id: `card-${sequence}`,
      cardId: entry.card_id,
      set: entry.set,
      cardName: entry.card_name,
      src: getCardSrc(entry),
      faceUp: true,
      price: entry.price,
      cardTypeCode: entry.card_type_code,
      discardActionCode: entry.discard_action_code,
      scanActionCode: entry.scan_action_code,
      incomeCode: entry.income_code,
    };
  }

  function createCommittedCardInstance(root, entry, sequence) {
    const nextSequence = stateSequences.take(root, "card");
    const { cardName: _cardName, src: _src, ...instance } = createCardInstance(
      entry,
      `${nextSequence}-${sequence ?? 0}`,
    );
    return instance;
  }

  function resolveCreateCardInstance(options = {}) {
    if (typeof options.createCardInstance === "function") return options.createCardInstance;
    if (options.root) {
      return (entry, sequence) => createCommittedCardInstance(options.root, entry, sequence);
    }
    throw new TypeError("创建规则卡牌实体需要 canonical root");
  }

  function getCatalogEntryForCard(card) {
    if (!card) return null;
    const cardId = getCardId(card);
    if (!cardId) return null;
    return getCatalogEntryByCardId(cardId);
  }

  function getIncomeCodeForCard(card) {
    if (Number.isInteger(card?.incomeCode)) return card.incomeCode;
    const entry = getCatalogEntryForCard(card);
    return Number.isInteger(entry?.income_code) ? entry.income_code : null;
  }

  function getIncomeGainForCard(card) {
    const incomeCode = getIncomeCodeForCard(card);
    const gain = INCOME_CODE_GAINS[incomeCode];
    return gain ? { ...gain } : null;
  }

  function getDiscardActionCodeForCard(card) {
    if (Number.isInteger(card?.discardActionCode)) return card.discardActionCode;
    const entry = getCatalogEntryForCard(card);
    return Number.isInteger(entry?.discard_action_code) ? entry.discard_action_code : null;
  }

  function cloneDiscardActionReward(reward) {
    if (!reward) return null;
    return {
      code: reward.code,
      label: reward.label,
      gain: { ...reward.gain },
      dataCount: reward.dataCount,
    };
  }

  function cloneDiscardActionMoveReward(reward) {
    if (!reward) return null;
    return {
      code: reward.code,
      label: reward.label,
      movementPoints: reward.movementPoints,
      gain: { ...reward.gain },
    };
  }

  function getDiscardActionRewardForCode(actionCode) {
    const reward = DISCARD_ACTION_REWARDS[actionCode];
    return cloneDiscardActionReward(reward);
  }

  function getDiscardActionMoveRewardForCode(actionCode) {
    const reward = DISCARD_ACTION_MOVE_REWARDS[actionCode];
    return cloneDiscardActionMoveReward(reward);
  }

  function getDiscardActionRewardForCard(card) {
    return getDiscardActionRewardForCode(getDiscardActionCodeForCard(card));
  }

  function getDiscardActionMoveRewardForCard(card) {
    return getDiscardActionMoveRewardForCode(getDiscardActionCodeForCard(card));
  }

  // 统一奖励转换：reward 对象（gain / dataCount / drawCards / blindDraw / pickCard / movementPoints）→ 效果数组。
  // 弃牌角标（资源/数据/移动）、外星人奖励、任务奖励等所有奖励共用这一条路径，
  // 新增奖励类型只改这一处，不再逐调用点手写分支。
  function buildRewardEffects(reward, prefix = "reward") {
    const effects = [];
    if (Object.keys(reward?.gain || {}).length) {
      effects.push({
        id: `${prefix}:gain`,
        type: "gain_resources",
        label: reward.label || undefined,
        options: { gain: { ...(reward.gain || {}) } },
      });
    }
    if (Number(reward?.dataCount) > 0) {
      effects.push({
        id: `${prefix}:data`,
        type: "gain_data",
        label: reward.label || undefined,
        options: { count: Number(reward.dataCount) },
      });
    }
    const drawCount = Number(reward?.drawCards || reward?.blindDraw);
    if (drawCount > 0) {
      effects.push({
        id: `${prefix}:draw`,
        type: "draw_cards",
        label: reward.label || undefined,
        options: { count: drawCount },
      });
    }
    if (reward?.pickCard) {
      effects.push({
        id: `${prefix}:pick`,
        type: "pick_card",
        label: reward.label || undefined,
        options: { count: 1 },
      });
    }
    if (Number(reward?.movementPoints) > 0) {
      effects.push({
        id: `${prefix}:move`,
        type: "card_move",
        label: reward.label || undefined,
        options: { movementPoints: Number(reward.movementPoints) },
      });
    }
    return effects;
  }

  function normalizeDiscardActionTriggerCode(actionCode) {
    if (actionCode == null || actionCode === "") return null;
    const numericCode = Number(actionCode);
    if (!Number.isInteger(numericCode)) return actionCode;
    return Object.prototype.hasOwnProperty.call(DISCARD_ACTION_TRIGGER_CODE_EQUIVALENTS, numericCode)
      ? DISCARD_ACTION_TRIGGER_CODE_EQUIVALENTS[numericCode]
      : numericCode;
  }

  function getDiscardActionTriggerCodeForCard(card) {
    return normalizeDiscardActionTriggerCode(getDiscardActionCodeForCard(card));
  }

  function getDiscardActionTriggerRewardForCode(actionCode) {
    return getDiscardActionRewardForCode(normalizeDiscardActionTriggerCode(actionCode));
  }

  function getDiscardActionTriggerMoveRewardForCode(actionCode) {
    return getDiscardActionMoveRewardForCode(normalizeDiscardActionTriggerCode(actionCode));
  }

  function getDiscardActionTriggerRewardForCard(card) {
    return getDiscardActionRewardForCode(getDiscardActionTriggerCodeForCard(card));
  }

  function getDiscardActionTriggerMoveRewardForCard(card) {
    return getDiscardActionMoveRewardForCode(getDiscardActionTriggerCodeForCard(card));
  }

  function createCardState() {
    return {
      publicCards: Array.from({ length: PUBLIC_CARD_COUNT }, () => null),
      discardPile: [],
      drawPileCardIds: [],
      passReservePiles: {},
    };
  }

  function collectPlayerCardIds(playersState) {
    const ids = new Set();
    if (!playersState || !Array.isArray(playersState.players)) return ids;

    for (const player of playersState.players) {
      for (const cardList of [player.hand, player.reservedCards]) {
        if (!Array.isArray(cardList)) continue;
        for (const card of cardList) {
          const cardId = getCardId(card);
          if (cardId) ids.add(cardId);
        }
      }
      const futureSpanCard = player.industryFutureSpan?.card;
      const futureSpanCardId = getCardId(futureSpanCard);
      if (futureSpanCardId) ids.add(futureSpanCardId);
    }

    return ids;
  }

  function collectPassReserveCardIds(cardsState) {
    const ids = new Set();
    const piles = cardsState?.passReservePiles;
    if (!piles || typeof piles !== "object") return ids;

    for (const pile of Object.values(piles)) {
      if (!Array.isArray(pile)) continue;
      for (const card of pile) {
        const cardId = getCardId(card);
        if (cardId) ids.add(cardId);
      }
    }

    return ids;
  }

  function collectLiveCardIds(cardsState, playersState) {
    const ids = collectPlayerCardIds(playersState);

    if (cardsState?.publicCards) {
      for (const card of cardsState.publicCards) {
        const cardId = getCardId(card);
        if (cardId) ids.add(cardId);
      }
    }

    for (const cardId of collectPassReserveCardIds(cardsState)) {
      ids.add(cardId);
    }

    return ids;
  }

  function collectDiscardCardIds(cardsState) {
    const ids = new Set();
    if (Array.isArray(cardsState?.discardPile)) {
      for (const card of cardsState.discardPile) {
        const cardId = getCardId(card);
        if (cardId) ids.add(cardId);
      }
    }
    return ids;
  }

  function collectRemovedFromGameCardIds(cardsState) {
    const ids = new Set();
    for (const cardId of cardsState?.removedFromGameCardIds || []) {
      if (cardId) ids.add(String(cardId));
    }
    return ids;
  }

  function collectClaimedCardIds(cardsState, playersState) {
    const ids = collectLiveCardIds(cardsState, playersState);
    for (const cardId of collectDiscardCardIds(cardsState)) {
      ids.add(cardId);
    }
    for (const cardId of collectRemovedFromGameCardIds(cardsState)) {
      ids.add(cardId);
    }
    return ids;
  }

  /**
   * 将卡牌移出游戏：收入牌「插入起始收入牌下方」、完成任务牌「翻面保留在玩家面前」
   * 均不再参与牌库循环（不进弃牌堆、不会被洗回主牌库、同名牌不再可被抽到）。
   */
  function addRemovedFromGame(cardsState, card) {
    if (!card) return;
    if (!Array.isArray(cardsState.removedFromGameCardIds)) cardsState.removedFromGameCardIds = [];
    const cardId = getCardId(card);
    if (!cardId) return;
    if (!cardsState.removedFromGameCardIds.includes(cardId)) {
      cardsState.removedFromGameCardIds.push(cardId);
    }
    removeCardIdFromDrawPile(cardsState, cardId);
  }

  function ensureDrawPileCardIds(cardsState) {
    if (!Array.isArray(cardsState.drawPileCardIds)) cardsState.drawPileCardIds = [];
    return cardsState.drawPileCardIds;
  }

  function getDrawPileCardIds(cardsState) {
    return Array.isArray(cardsState?.drawPileCardIds)
      ? cardsState.drawPileCardIds.slice()
      : [];
  }

  function sanitizeDrawPileCardIds(cardsState, playersState) {
    const drawPile = ensureDrawPileCardIds(cardsState);
    const live = collectLiveCardIds(cardsState, playersState);
    const removed = collectRemovedFromGameCardIds(cardsState);
    const seen = new Set();
    const sanitized = [];

    for (const rawCardId of drawPile) {
      const cardId = String(rawCardId || "");
      if (!cardId || seen.has(cardId) || live.has(cardId) || removed.has(cardId) || !getCatalogEntryByCardId(cardId)) continue;
      seen.add(cardId);
      sanitized.push(cardId);
    }

    if (sanitized.length !== drawPile.length || sanitized.some((cardId, index) => cardId !== drawPile[index])) {
      cardsState.drawPileCardIds = sanitized;
    }
    return cardsState.drawPileCardIds;
  }

  function removeCardIdFromDrawPile(cardsState, cardId) {
    if (!cardId || !Array.isArray(cardsState?.drawPileCardIds)) return;
    cardsState.drawPileCardIds = cardsState.drawPileCardIds.filter((item) => item !== cardId);
  }

  function getActiveDrawPool(cardsState, playersState) {
    const drawPile = sanitizeDrawPileCardIds(cardsState, playersState);
    return drawPile
      .map((cardId) => getCatalogEntryByCardId(cardId))
      .filter(Boolean);
  }

  function getFreshAvailablePool(cardsState, playersState) {
    const unavailable = collectClaimedCardIds(cardsState, playersState);
    for (const cardId of getDrawPileCardIds(cardsState)) {
      unavailable.add(cardId);
    }
    return CARD_CATALOG.filter((entry) => !unavailable.has(entry.card_id));
  }

  function getDiscardRecycleCardIds(cardsState, playersState) {
    const live = collectLiveCardIds(cardsState, playersState);
    const activeDrawPile = new Set(getDrawPileCardIds(cardsState));
    const seen = new Set();
    const cardIds = [];

    if (!Array.isArray(cardsState?.discardPile)) return cardIds;
    for (const card of cardsState.discardPile) {
      const cardId = getCardId(card);
      if (!cardId || seen.has(cardId) || live.has(cardId) || activeDrawPile.has(cardId)) continue;
      if (!getCatalogEntryByCardId(cardId)) continue;
      seen.add(cardId);
      cardIds.push(cardId);
    }
    return cardIds;
  }

  function getDiscardRecyclePool(cardsState, playersState) {
    return getDiscardRecycleCardIds(cardsState, playersState)
      .map((cardId) => getCatalogEntryByCardId(cardId))
      .filter(Boolean);
  }

  function getAvailablePool(cardsState, playersState) {
    const activeDrawPool = getActiveDrawPool(cardsState, playersState);
    if (activeDrawPool.length) return activeDrawPool;

    const freshPool = getFreshAvailablePool(cardsState, playersState);
    if (freshPool.length) return freshPool;

    return getDiscardRecyclePool(cardsState, playersState);
  }

  function pickRandomEntry(pool, random = Math.random) {
    if (!pool.length) return null;
    return pool[Math.floor(random() * pool.length)];
  }

  function takeRandomEntryFromDrawPile(cardsState, playersState, random = Math.random) {
    const drawPile = sanitizeDrawPileCardIds(cardsState, playersState);
    if (!drawPile.length) return null;

    const index = Math.floor(random() * drawPile.length);
    const [cardId] = drawPile.splice(index, 1);
    return getCatalogEntryByCardId(cardId);
  }

  function recycleDiscardPileIntoDrawPile(cardsState, playersState) {
    const cardIds = getDiscardRecycleCardIds(cardsState, playersState);
    if (!cardIds.length) return false;

    const recycled = new Set(cardIds);
    cardsState.discardPile = (cardsState.discardPile || [])
      .filter((card) => !recycled.has(getCardId(card)));
    cardsState.drawPileCardIds = cardIds;
    return true;
  }

  function takeRandomEntryForDraw(cardsState, playersState, random = Math.random) {
    const activeEntry = takeRandomEntryFromDrawPile(cardsState, playersState, random);
    if (activeEntry) return { entry: activeEntry, reshuffled: false };

    const freshPool = getFreshAvailablePool(cardsState, playersState);
    const freshEntry = pickRandomEntry(freshPool, random);
    if (freshEntry) return { entry: freshEntry, reshuffled: false };

    if (!recycleDiscardPileIntoDrawPile(cardsState, playersState)) return null;
    const recycledEntry = takeRandomEntryFromDrawPile(cardsState, playersState, random);
    return recycledEntry ? { entry: recycledEntry, reshuffled: true } : null;
  }

  function addCardToHand(player, card) {
    if (!Array.isArray(player.hand)) player.hand = [];
    player.hand.push(card);
    player.resources.handSize = player.hand.length;
    return card;
  }

  function normalizePassReserveRounds(rounds) {
    const source = Array.isArray(rounds) && rounds.length ? rounds : [1, 2, 3];
    return [...new Set(source
      .map((round) => Math.round(Number(round)))
      .filter((round) => Number.isInteger(round) && round > 0))]
      .sort((a, b) => a - b);
  }

  function ensurePassReservePiles(cardsState) {
    if (!cardsState.passReservePiles || typeof cardsState.passReservePiles !== "object") {
      cardsState.passReservePiles = {};
    }
    return cardsState.passReservePiles;
  }

  function preparePassReservePiles(cardsState, playersState, options = {}) {
    const rounds = normalizePassReserveRounds(options.rounds);
    const activePlayerCount = Math.max(1, Math.round(Number(options.activePlayerCount) || 1));
    const cardsPerPile = activePlayerCount + 1;
    const random = options.random || Math.random;
    const createInstance = resolveCreateCardInstance(options);

    cardsState.passReservePiles = {};
    const piles = ensurePassReservePiles(cardsState);

    for (const roundNumber of rounds) {
      const pile = [];
      piles[String(roundNumber)] = pile;
      for (let index = 0; index < cardsPerPile; index += 1) {
        const result = takeRandomEntryForDraw(cardsState, playersState, random);
        if (!result?.entry) break;
        pile.push(createInstance(result.entry, `pass-${roundNumber}-${index + 1}`));
      }
    }

    return {
      ok: true,
      rounds,
      cardsPerPile,
      piles,
    };
  }

  function getPassReservePile(cardsState, roundNumber) {
    const round = Math.round(Number(roundNumber));
    if (!Number.isInteger(round) || round <= 0) return [];
    const pile = cardsState?.passReservePiles?.[String(round)];
    return Array.isArray(pile) ? pile : [];
  }

  function pickPassReserveCard(cardsState, player, roundNumber, cardId) {
    if (!player) {
      return { ok: false, message: "没有当前玩家", card: null };
    }

    const pile = getPassReservePile(cardsState, roundNumber);
    if (!pile.length) {
      return { ok: false, message: "本轮没有可选 PASS 预留牌", card: null };
    }

    const targetId = String(cardId || "");
    const index = pile.findIndex((card) => card?.id === targetId || card?.cardId === targetId);
    if (index < 0) {
      return { ok: false, message: "请选择一张本轮 PASS 预留牌", card: null };
    }

    const [card] = pile.splice(index, 1);
    addCardToHand(player, card);
    return {
      ok: true,
      card,
      remaining: pile.slice(),
      message: `PASS 精选：${getCardLabel(card)}`,
    };
  }

  function discardUnusedPassReserveCards(cardsState, roundNumber) {
    const pile = getPassReservePile(cardsState, roundNumber);
    if (!pile.length) {
      return { ok: true, cards: [], message: "本轮没有剩余 PASS 预留牌" };
    }

    const discarded = pile.splice(0);
    for (const card of discarded) {
      addToDiscardPile(cardsState, card);
    }
    return {
      ok: true,
      cards: discarded,
      message: `弃置剩余 PASS 预留牌：${discarded.map(getCardLabel).join("、")}`,
    };
  }

  function blindDraw(cardsState, playersState, player, random = Math.random, options = {}) {
    if (!player) {
      return { ok: false, message: "没有当前玩家", card: null };
    }

    const result = takeRandomEntryForDraw(cardsState, playersState, random);
    if (!result?.entry) {
      return { ok: false, message: "牌库已无可用卡牌", card: null };
    }

    const createInstance = resolveCreateCardInstance(options);
    const card = createInstance(result.entry);
    addCardToHand(player, card);
    return { ok: true, message: null, card, reshuffled: Boolean(result.reshuffled) };
  }

  function replenishPublicSlot(cardsState, playersState, slotIndex, random = Math.random, options = {}) {
    const result = takeRandomEntryForDraw(cardsState, playersState, random);
    const createInstance = resolveCreateCardInstance(options);
    cardsState.publicCards[slotIndex] = result?.entry ? createInstance(result.entry) : null;
    return cardsState.publicCards[slotIndex];
  }

  function pickFromPublic(cardsState, playersState, player, slotIndex, random = Math.random, options = {}) {
    if (!player) {
      return { ok: false, message: "没有当前玩家", card: null };
    }

    const index = Number(slotIndex);
    if (!Number.isInteger(index) || index < 0 || index >= PUBLIC_CARD_COUNT) {
      return { ok: false, message: "无效的公共牌位置", card: null };
    }

    const card = cardsState.publicCards[index];
    if (!card) {
      return { ok: false, message: "该公共牌位没有卡牌", card: null };
    }

    addCardToHand(player, card);
    const replenished = replenishPublicSlot(cardsState, playersState, index, random, options);

    return {
      ok: true,
      message: null,
      card,
      replenished,
      publicCards: cardsState.publicCards.slice(),
    };
  }

  function countPublicCards(cardsState) {
    if (!Array.isArray(cardsState?.publicCards)) return 0;
    return cardsState.publicCards.filter(Boolean).length;
  }

  function normalizeSkipSlotIndexes(options = {}) {
    return new Set((options.skipSlotIndexes || [])
      .map((slotIndex) => Number(slotIndex))
      .filter((slotIndex) => Number.isInteger(slotIndex)));
  }

  function fillPublicCards(cardsState, playersState, random = Math.random, options = {}) {
    const skipSlotIndexes = normalizeSkipSlotIndexes(options);
    for (let index = 0; index < PUBLIC_CARD_COUNT; index += 1) {
      if (skipSlotIndexes.has(index)) continue;
      if (!cardsState.publicCards[index]) {
        replenishPublicSlot(cardsState, playersState, index, random, options);
      }
    }
    return cardsState.publicCards.slice();
  }

  function ensurePublicCardsFilled(cardsState, playersState, random = Math.random, options = {}) {
    return fillPublicCards(cardsState, playersState, random, options);
  }

  function drawCardsToHand(cardsState, playersState, player, count, random = Math.random, options = {}) {
    const drawn = [];
    const target = Math.max(0, Math.round(count));

    for (let index = 0; index < target; index += 1) {
      const result = blindDraw(cardsState, playersState, player, random, options);
      if (!result.ok) {
        return {
          ok: drawn.length > 0,
          message: result.message,
          cards: drawn,
        };
      }
      drawn.push(result.card);
    }

    return { ok: true, message: null, cards: drawn };
  }

  // 统一抽牌/精选上下文：封装 cardsState/playersState/random/root，
  // 各处（卡牌效果、公司能力、精选、盲抽）不再手动拼 blindDraw/pickFromPublic 参数。
  function createCardDrawContext(cardsState, playersState, random, options = {}) {
    const root = options.root || null;
    const randomFn = typeof random === "function" ? random : Math.random;
    const drawOptions = root
      ? { root }
      : (options.createCardInstance ? { createCardInstance: options.createCardInstance } : {});
    return {
      createCardInstance: resolveCreateCardInstance({ root, ...(options.createCardInstance ? { createCardInstance: options.createCardInstance } : {}) }),
      blindDraw(player, extra = {}) {
        return blindDraw(cardsState, playersState, player, randomFn, { ...drawOptions, ...extra });
      },
      pickFromPublic(player, slotIndex, extra = {}) {
        return pickFromPublic(cardsState, playersState, player, slotIndex, randomFn, { ...drawOptions, ...extra });
      },
    };
  }

  function discardFromHand(player, cardIndexFromEnd = 0) {
    if (!player || !Array.isArray(player.hand) || !player.hand.length) {
      return { ok: false, message: "手牌为空，无法弃牌", card: null };
    }

    const removeIndex = player.hand.length - 1 - Math.max(0, Math.round(cardIndexFromEnd));
    return discardFromHandAtIndex(player, removeIndex);
  }

  function discardFromHandAtIndex(player, handIndex) {
    if (!player || !Array.isArray(player.hand) || !player.hand.length) {
      return { ok: false, message: "手牌为空，无法弃牌", card: null };
    }

    const removeIndex = Math.round(handIndex);
    if (removeIndex < 0 || removeIndex >= player.hand.length) {
      return { ok: false, message: "无效的手牌位置", card: null };
    }

    const [discarded] = player.hand.splice(removeIndex, 1);
    player.resources.handSize = player.hand.length;
    return { ok: true, message: null, card: discarded };
  }

  function addToDiscardPile(cardsState, card) {
    if (!card) return;
    if (!Array.isArray(cardsState.discardPile)) cardsState.discardPile = [];
    removeCardIdFromDrawPile(cardsState, getCardId(card));
    cardsState.discardPile.push(card);
  }

  function initializeDeck(cardsState, playersState, options = {}) {
    const random = options.random || Math.random;
    const handCount = Math.max(0, Math.round(options.handCount ?? 0));
    const player = options.player;

    if (player && handCount > 0) {
      drawCardsToHand(cardsState, playersState, player, handCount, random, options);
    }

    ensurePublicCardsFilled(cardsState, playersState, random, options);

    return cardsState;
  }

  function getCatalogSize() {
    return CARD_CATALOG.length;
  }

  function getCardLabel(card) {
    if (!card) return "";
    return card.cardName || card.cardId || card.src?.split("/").pop() || card.id || "";
  }

  return Object.freeze({
    CARD_CATALOG,
    PUBLIC_CARD_COUNT,
    CARD_BASE_PATH,
    INCOME_CODE_GAINS,
    DISCARD_ACTION_REWARDS,
    DISCARD_ACTION_MOVE_REWARDS,
    DISCARD_ACTION_TRIGGER_CODE_EQUIVALENTS,
    getCardSrc,
    getCardPickPresentation,
    getPublicCardPickPresentation,
    createCardInstance,
    createCommittedCardInstance,
    getCatalogEntryForCard,
    getIncomeCodeForCard,
    getIncomeGainForCard,
    getDiscardActionCodeForCard,
    getDiscardActionRewardForCode,
    getDiscardActionMoveRewardForCode,
    getDiscardActionRewardForCard,
    getDiscardActionMoveRewardForCard,
    buildRewardEffects,
    normalizeDiscardActionTriggerCode,
    getDiscardActionTriggerCodeForCard,
    getDiscardActionTriggerRewardForCode,
    getDiscardActionTriggerMoveRewardForCode,
    getDiscardActionTriggerRewardForCard,
    getDiscardActionTriggerMoveRewardForCard,
    createCardState,
    collectClaimedCardIds,
    getDrawPileCardIds,
    getAvailablePool,
    addCardToHand,
    preparePassReservePiles,
    getPassReservePile,
    pickPassReserveCard,
    discardUnusedPassReserveCards,
    blindDraw,
    createCardDrawContext,
    pickFromPublic,
    replenishPublicSlot,
    countPublicCards,
    fillPublicCards,
    ensurePublicCardsFilled,
    drawCardsToHand,
    discardFromHand,
    discardFromHandAtIndex,
    addToDiscardPile,
    addRemovedFromGame,
    collectRemovedFromGameCardIds,
    initializeDeck,
    getCatalogSize,
    getCardLabel,
  });
});
