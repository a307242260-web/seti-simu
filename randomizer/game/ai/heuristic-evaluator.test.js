"use strict";

const assert = require("node:assert/strict");
const evaluator = require("./heuristic-evaluator");

const context = Object.freeze({
  seatId: "blue",
  observation: {
    publicState: {
      roundNumber: 3,
      players: [{ playerId: "blue", credits: 4, energy: 2, publicity: 5, availableData: 1 }],
      board: {
        publicCards: [{ id: "public-1", cardId: "card-public", price: 3 }],
        techSupply: {
          stacks: {
            orange2: {
              tileId: "orange2",
              techType: "orange",
              stackIndex: 2,
              bonusId: "bonus_1c",
              firstTakeClaimedBy: null,
            },
          },
        },
      },
    },
    selfState: {
      hand: [{ id: "hand-1", cardId: "card-hand", price: 2 }],
    },
  },
});

assert.deepEqual(evaluator.evaluateAction(context, {
  family: "play_card",
  payload: { handIndex: 0 },
}), {
  score: 0,
  cardId: "card-hand",
  price: 2,
  roundNumber: 3,
  resources: { credits: 4, energy: 2, publicity: 5, availableData: 1 },
});

assert.deepEqual(evaluator.evaluateAction(context, {
  family: "research_tech",
  target: { tileId: "orange2" },
}), {
  score: 0,
  tileId: "orange2",
  techType: "orange",
  stackIndex: 2,
  bonusId: "bonus_1c",
  firstTake: true,
  roundNumber: 3,
  resources: { credits: 4, energy: 2, publicity: 5, availableData: 1 },
});

assert.equal(JSON.stringify(context).includes("score"), false, "估值结果不得回写 DecisionContext");
console.log("heuristic-evaluator.test.js ok");
