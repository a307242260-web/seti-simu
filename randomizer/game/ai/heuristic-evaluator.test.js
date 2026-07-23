"use strict";

const assert = require("node:assert/strict");
const evaluator = require("./heuristic-evaluator");

function descriptor(actionId, family, phase, value, overrides = {}) {
  return {
    actionId,
    family,
    phase,
    actorId: "p1",
    target: { value },
    payload: { value },
    summary: `${family}:${value}`,
    ...overrides,
  };
}

const observation = {
  publicState: {
    roundNumber: 2,
    players: [{ id: "p1", resources: { credits: 4, energy: 3, publicity: 2, availableData: 1 } }],
    board: {
      publicCards: [{ id: "market-1", cardId: "c1", price: 2 }],
      techSupply: {
        stacks: {
          orange1: { tileId: "orange1", techType: "orange", stackIndex: 1, bonusId: "bonus_1c" },
        },
      },
    },
  },
  selfState: { hand: [{ id: "hand-1", cardId: "c2", price: 1 }] },
};
const context = {
  seatId: "p1",
  observation,
  legalActions: [
    descriptor("pass", "pass", "main", 1),
    descriptor("launch", "launch", "main", 8),
  ],
};
const before = structuredClone(context);

assert.equal(
  evaluator.selectLegalAction(context, {
    evaluateAction: (_current, action) => ({ score: action.payload.value }),
  }).actionId,
  "launch",
  "顶层 Action 必须按估值选择，不得退化为 legal set 首项",
);
assert.equal(
  evaluator.selectLegalAction({
    ...context,
    legalActions: [
      descriptor("first", "launch", "main", 5),
      descriptor("second", "launch", "main", 5),
    ],
  }, { evaluateAction: (_current, action) => ({ score: action.payload.value }) }).actionId,
  "first",
  "同分时必须保持 legal descriptor 的稳定顺序",
);
assert.deepEqual(context, before, "估值与排序不得修改 observation/legal descriptors");

const cardEvaluation = evaluator.evaluateAction(context, descriptor(
  "play",
  "play_card",
  "main",
  3,
  { target: { cardInstanceId: "hand-1" }, payload: { cardInstanceId: "hand-1", value: 3 } },
));
assert.deepEqual(cardEvaluation.resources, { credits: 4, energy: 3, publicity: 2, availableData: 1 });
assert.equal(cardEvaluation.cardId, "c2");
assert.equal(cardEvaluation.price, 1);

const techEvaluation = evaluator.evaluateAction(context, descriptor(
  "research",
  "research_tech",
  "main",
  0,
  { target: { tileId: "orange1" }, payload: {} },
));
assert.equal(techEvaluation.techType, "orange");
assert.equal(techEvaluation.bonusId, "bonus_1c");
assert.equal(techEvaluation.firstTake, true);

const conditional = {
  legalActions: [
    descriptor("skip", "choose_reward", "conditional", 100, { summary: "跳过奖励" }),
    descriptor("small", "choose_reward", "conditional", 2),
    descriptor("large", "choose_reward", "conditional", 7),
  ],
};
assert.equal(
  evaluator.selectLegalAction(conditional).actionId,
  "large",
  "条件选择必须优先实际奖励并惩罚 skip/cancel 语义",
);
assert.equal(
  evaluator.selectLegalAction(context, { strategyWeights: { pass: 0, launch: 0 } }),
  null,
  "全部 family 被禁用时不得私自回退到首项",
);

console.log("heuristic evaluator behavior tests passed");
