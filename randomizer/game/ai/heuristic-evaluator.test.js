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
    selectable: true,
  }),
});
assert.equal(selected.actionId, "a-high", "排序只能消费 action outcome 的 leaf value");
assert.deepEqual(context, before, "估值与排序不得修改 observation/legal descriptors");

const tied = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("z-action"), descriptor("a-action")],
}, {
  evaluateAction: () => ({ score: 5, status: "settled", selectable: true }),
});
assert.equal(tied.actionId, "a-action", "同 Q 必须使用稳定 actionId tie-break，不依赖枚举顺序");

const unresolved = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("z-action"), descriptor("a-action")],
}, {
  evaluateAction: () => ({ score: null, status: "unresolved" }),
});
assert.equal(unresolved, null, "失败或 unresolved 候选必须 fail closed，不能被稳定 tie-break 误选");

const goalBeforePass = evaluator.selectLegalAction({
  ...context,
  legalActions: [descriptor("pass"), { ...descriptor("move"), family: "move" }],
}, {
  evaluateAction: (_current, candidate) => ({
    score: candidate.family === "move" ? 1 : 0,
    status: "settled",
    selectable: true,
    priorityClass: candidate.family === "move" ? 3 : 0,
  }),
});
assert.equal(goalBeforePass.actionId, "move", "已解析正分路线的下一步必须优先于 PASS");

console.log("heuristic evaluator outcome behavior tests passed");
