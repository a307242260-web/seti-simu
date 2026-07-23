"use strict";

const assert = require("node:assert/strict");
const evaluator = require("./heuristic-evaluator");

function descriptor(actionId) {
  return { actionId, family: "pass", phase: "main", actorId: "p1" };
}

const context = {
  seatId: "p1",
  observation: { selfState: { id: "p1" } },
  legalActions: [descriptor("z-low"), descriptor("a-high")],
};
const before = structuredClone(context);
const selected = evaluator.selectLegalAction(context, {
  evaluateAction: (_current, action) => ({
    score: action.actionId === "a-high" ? 8 : 2,
    status: "settled",
  }),
});
assert.equal(selected.actionId, "a-high", "排序只能消费 action outcome 的 leaf value");
assert.deepEqual(context, before, "估值与排序不得修改 observation/legal descriptors");

const tied = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("z-action"), descriptor("a-action")],
}, {
  evaluateAction: () => ({ score: 5, status: "settled" }),
});
assert.equal(tied.actionId, "a-action", "同 Q 必须使用稳定 actionId tie-break，不依赖枚举顺序");

const unresolved = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("z-action"), descriptor("a-action")],
}, {
  evaluateAction: () => ({ score: null, status: "unresolved" }),
});
assert.equal(unresolved.actionId, "a-action", "全部未完成时只能按明确状态与 actionId 稳定选择");

console.log("heuristic evaluator outcome behavior tests passed");
