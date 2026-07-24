"use strict";

const assert = require("node:assert/strict");
const cardUi = require("./card-decision-ui");

const presenter = cardUi.createCardDecisionPresenter({
  fallback: (_decision, choice) => ({ choiceId: choice.actionId, label: choice.summary }),
});
const presented = presenter(
  { kind: "choose_card" },
  {
    actionId: "choose_card:p1:card-1",
    summary: "选择卡牌",
    target: { cardInstanceId: "card-1" },
    presentation: { image: "card.webp" },
  },
  0,
);
assert.deepEqual(presented, {
  choiceId: "choose_card:p1:card-1",
  label: "选择卡牌",
  presentation: {
    cardId: "card-1",
    cardName: null,
    image: "card.webp",
    source: null,
  },
  disabledReason: null,
});
assert.equal(Object.hasOwn(cardUi, "createCardSelectionState"), false);
assert.equal(Object.hasOwn(cardUi, "executeChoice"), false);
console.log("card decision UI tests passed");
