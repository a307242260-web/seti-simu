(function (root, factory) {
  "use strict";

  let cards = root.SetiCards;

  if (!cards && typeof require === "function") {
    cards = require("./cards/deck");
  }

  const api = factory(cards);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiBasicCards = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (cards) {
  "use strict";

  const BASIC_CARD_COUNT = 140;
  const BASIC_CARD_BASE_PATH = "../assets/cards/basic/split/b_";

  function getBasicCardSrc(cardIndex) {
    return `${BASIC_CARD_BASE_PATH}${cardIndex}.webp`;
  }

  function createBasicHandCard(cardIndex, sequence) {
    if (cards?.createCardInstance) {
      const entry = cards.CARD_CATALOG.find((item) => item.card_id === `b_${cardIndex}.webp`);
      if (entry) {
        return {
          ...cards.createCardInstance(entry, sequence),
          cardIndex,
        };
      }
    }

    return {
      id: `basic-${cardIndex}-${sequence}`,
      cardId: `b_${cardIndex}.webp`,
      set: "basic",
      src: getBasicCardSrc(cardIndex),
      faceUp: true,
      cardIndex,
    };
  }

  function getHandCardIds(hand) {
    if (!Array.isArray(hand)) return [];
    return hand
      .map((card) => {
        if (card?.cardId) return card.cardId;
        if (Number.isInteger(card?.cardIndex)) return `b_${card.cardIndex}.webp`;
        return null;
      })
      .filter(Boolean);
  }

  function getHandCardIndexes(hand) {
    return getHandCardIds(hand)
      .map((cardId) => {
        const match = /^b_(\d+)\.webp$/.exec(cardId);
        return match ? Number(match[1]) : null;
      })
      .filter((cardIndex) => Number.isInteger(cardIndex));
  }

  function buildBasicCardPool(excludeCardIndexes) {
    const excluded = new Set(
      (Array.isArray(excludeCardIndexes) ? excludeCardIndexes : [])
        .map((cardIndex) => `b_${cardIndex}.webp`),
    );
    const pool = [];

    for (let cardIndex = 1; cardIndex <= BASIC_CARD_COUNT; cardIndex += 1) {
      const cardId = `b_${cardIndex}.webp`;
      if (!excluded.has(cardId)) pool.push(cardIndex);
    }

    return pool;
  }

  function pickRandomBasicCard(excludeCardIndexes, random = Math.random) {
    const pool = buildBasicCardPool(excludeCardIndexes);
    if (!pool.length) return null;

    const pickIndex = Math.floor(random() * pool.length);
    return createBasicHandCard(pool[pickIndex], pickIndex);
  }

  function drawRandomBasicCardToHand(hand, random = Math.random) {
    if (!Array.isArray(hand)) {
      return { ok: false, message: "手牌状态无效", card: null };
    }

    const card = pickRandomBasicCard(getHandCardIndexes(hand), random);
    if (!card) {
      return { ok: false, message: "牌库已无可用基础牌", card: null };
    }

    hand.push(card);
    return { ok: true, message: null, card };
  }

  function pickRandomBasicCards(count, random = Math.random) {
    const pool = buildBasicCardPool();
    const picked = [];
    const target = Math.max(0, Math.round(count));

    for (let index = 0; index < target && pool.length > 0; index += 1) {
      const pickIndex = Math.floor(random() * pool.length);
      picked.push(createBasicHandCard(pool.splice(pickIndex, 1)[0], index));
    }

    return picked;
  }

  return Object.freeze({
    BASIC_CARD_COUNT,
    BASIC_CARD_BASE_PATH,
    getBasicCardSrc,
    createBasicHandCard,
    pickRandomBasicCard,
    pickRandomBasicCards,
    getHandCardIds,
    getHandCardIndexes,
    drawRandomBasicCardToHand,
  });
});
