"use strict";

const assert = require("node:assert/strict");
const { createCardRuntime } = require("./card-runtime");

{
  const opened = [];
  const runtime = createCardRuntime({
    structuredClone,
    uiRuntimeState: {},
    openPendingDecision(workingRoot, kind, pending) {
      opened.push({ workingRoot, kind, pending: structuredClone(pending) });
      return structuredClone(pending);
    },
  });
  const workingRoot = { match: {} };
  const effect = {
    id: "card-move-1",
    options: { movementPoints: 3 },
  };

  const pending = runtime.initCardMoveEffectState(workingRoot, effect);

  assert.equal(effect.badge, "3", "卡牌移动初始化必须在打开 DecisionEffect 前同步移动点 badge");
  assert.deepEqual(pending, {
    effectId: "card-move-1",
    poolRemaining: 3,
    deferredType1Events: [],
    moved: false,
  });
  assert.equal(opened.length, 1);
  assert.equal(opened[0].workingRoot, workingRoot);
  assert.equal(opened[0].kind, "card_move");
  assert.deepEqual(opened[0].pending, pending);
}

console.log("card runtime DecisionEffect tests passed");
