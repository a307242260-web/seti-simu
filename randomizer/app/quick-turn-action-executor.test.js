"use strict";

const assert = require("node:assert/strict");
const {
  ACTION_FAMILIES,
  createQuickTurnActionExecutor,
} = require("./quick-turn-action-executor");

function createRoot() {
  return {
    meta: { stateVersion: 8 },
    match: { decisionVersion: 5 },
    playerState: {
      currentPlayerId: "p1",
      players: [{
        id: "p1",
        resources: { credits: 7, energy: 4 },
        hand: [{ id: "card-1" }],
        initialSelection: { industry: { label: "测试公司" } },
      }, { id: "p2", resources: { credits: 3, energy: 3 }, hand: [] }],
    },
    turnState: {
      roundNumber: 2,
      turnNumber: 6,
      activePlayerIds: ["p1", "p2"],
      passedPlayerIds: [],
      completedTurnPlayerIds: [],
    },
    cardState: { publicCards: [], discardPile: [] },
    techGameState: { board: {}, ui: {} },
    nebulaDataState: { pools: {} },
    alienGameState: { slots: [] },
    rocketState: { statusNote: "" },
  };
}

function descriptor(family) {
  return {
    schemaVersion: "seti-standard-action-v1",
    actionId: `${family}:fixture`,
    family,
    actorId: "p1",
    stateVersion: 8,
    decisionVersion: 5,
    target: {
      tradeId: "energy-for-credit",
      cardInstanceId: "card-1",
      companyLabel: "测试公司",
      target: "slot-a",
      alienSlotId: 1,
      position: 2,
      symbolId: "symbol-a",
    },
  };
}

function createExecutor(trace = [], failFamily = null) {
  function executeFamily(family, workingRoot, action) {
    trace.push({ family, workingRoot, action });
    const player = workingRoot.playerState.players[0];
    if (family === failFamily) {
      player.resources.credits = 0;
      workingRoot.turnState.turnNumber = 99;
      return { ok: false, code: "RULE_FAILED", message: "failed" };
    }
    if (family === "end_turn") {
      workingRoot.turnState.turnNumber += 1;
      workingRoot.playerState.currentPlayerId = "p2";
      return { ok: true, progressed: true, history: [{ type: "turn_end" }] };
    }
    if (family === "pass") {
      workingRoot.turnState.passedPlayerIds.push(player.id);
      return { ok: true, events: [{ type: "pass", playerId: player.id }], history: [{ type: "pass" }] };
    }
    player.resources.credits += 1;
    return {
      ok: true,
      effects: [{ type: `${family}_effect` }],
      history: [{ type: `${family}_quick`, consumesMainAction: false }],
    };
  }
  return createQuickTurnActionExecutor({
    executeQuickTrade: (root, action) => executeFamily("quick_trade", root, action),
    executeIndustry: (root, action) => executeFamily("industry", root, action),
    executeCardCorner: (root, action) => executeFamily("card_corner", root, action),
    executePlaceData: (root, action) => executeFamily("place_data", root, action),
    executeRunezuFaceSymbol: (root, action) => executeFamily("runezu_face_symbol", root, action),
    executePass: (root, action) => executeFamily("pass", root, action),
    executeEndTurn: (root, action) => executeFamily("end_turn", root, action),
  });
}

{
  const trace = [];
  const executor = createExecutor(trace);
  assert.deepEqual(executor.actionFamilies, ACTION_FAMILIES);
  for (const family of ACTION_FAMILIES) {
    const workingRoot = createRoot();
    const turnBefore = workingRoot.turnState.turnNumber;
    const result = executor.execute(workingRoot, descriptor(family));
    assert.equal(result.ok, true, family);
    assert.equal(trace.at(-1).workingRoot, workingRoot, `${family} 必须取得 caller working root`);
    if (!["pass", "end_turn"].includes(family)) {
      assert.equal(workingRoot.turnState.turnNumber, turnBefore, `${family} quick 不得推进回合`);
      assert.equal(result.history[0].consumesMainAction, false, `${family} 必须记录 quick history`);
    }
    if (family === "pass") assert.equal(workingRoot.turnState.turnNumber, turnBefore, "PASS 只完成主行动，不直接推进回合");
    if (family === "end_turn") assert.equal(workingRoot.turnState.turnNumber, turnBefore + 1, "end_turn 必须推进回合");
  }
}

{
  const workingRoot = createRoot();
  const before = structuredClone(workingRoot);
  const result = createExecutor().execute(workingRoot, descriptor("quick_trade"), {
    validate() { return { ok: false, code: "STANDARD_ACTION_STALE", message: "stale" }; },
  });
  assert.equal(result.code, "STANDARD_ACTION_STALE");
  assert.deepEqual(workingRoot, before, "stale 不得污染 working root");
}

{
  const workingRoot = createRoot();
  const before = structuredClone(workingRoot);
  const result = createExecutor([], "industry").execute(workingRoot, descriptor("industry"));
  assert.equal(result.code, "RULE_FAILED");
  assert.deepEqual(workingRoot, before, "失败必须原子恢复完整 working root");
}

{
  const executor = createExecutor();
  for (const family of ACTION_FAMILIES) {
    const browserRoot = createRoot();
    const aiRoot = structuredClone(browserRoot);
    assert.equal(executor.execute(browserRoot, descriptor(family)).ok, true);
    assert.equal(executor.execute(aiRoot, structuredClone(descriptor(family))).ok, true);
    assert.deepEqual(aiRoot, browserRoot, `${family} Browser/AI parity`);
  }
}

console.log("quick/turn action executor tests passed");
