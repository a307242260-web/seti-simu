"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createEngineActionExecutor, ACTION_FAMILIES } = require("./engine-action-executor");

function root() {
  return {
    meta: { stateVersion: 3 },
    match: { decisionVersion: 2 },
    playerState: { currentPlayerId: "p1", players: [{ id: "p1", resources: { credits: 9, energy: 8 } }] },
    turnState: { roundNumber: 2, turnNumber: 4 },
    cardState: { publicCards: [], discardPile: [] },
    techGameState: { board: { supply: [] }, ui: {} },
    nebulaDataState: { pools: {} },
  };
}

function descriptor(family) {
  return {
    schemaVersion: "seti-standard-action-v1",
    actionId: `${family}:test`,
    family,
    actorId: "p1",
    stateVersion: 3,
    decisionVersion: 2,
    target: { id: `${family}-target` },
    payload: { source: "test" },
  };
}

function createExecutor(trace = [], options = {}) {
  function apply(family, workingRoot, action) {
    trace.push({ family, workingRoot, action });
    workingRoot.playerState.players[0].resources.credits -= 1;
    workingRoot.cardState.discardPile.push(family);
    if (options.failFamily === family) {
      workingRoot.playerState.players[0].resources.energy = 0;
      return { ok: false, code: "RULE_FAILED", message: "failed" };
    }
    return {
      ok: true,
      effects: [{ type: `${family}_effect`, ownerId: action.actorId }],
      history: [{ type: `${family}_history`, stateVersion: workingRoot.meta.stateVersion }],
      result: { family, target: action.target.id },
    };
  }
  return createEngineActionExecutor({
    actions: {
      getAction() {
        return { execute(context, actionOptions) {
          return apply("research_tech", context.workingRoot, {
            ...context.descriptor,
            target: { id: actionOptions.tileId || context.descriptor.target.id },
          });
        } };
      },
    },
    abilities: {
      executeAbility(_abilityId, context) {
        return apply("analyze", context.workingRoot, context.descriptor);
      },
    },
    players: {
      getCurrentPlayer(playerState) {
        return playerState.players.find((player) => player.id === playerState.currentPlayerId);
      },
    },
    createActionContext(workingRoot, action) {
      return { workingRoot, descriptor: action, playerState: workingRoot.playerState };
    },
    getAnalyzeActionOptions(_player, payload) {
      return { ...payload };
    },
    executeScan(workingRoot, action) {
      return apply("scan", workingRoot, action);
    },
    executePlayCard(workingRoot, action) {
      return apply("play_card", workingRoot, action);
    },
  });
}

{
  const trace = [];
  const executor = createExecutor(trace);
  assert.deepEqual(executor.actionFamilies, ACTION_FAMILIES);
  for (const family of ACTION_FAMILIES) {
    const workingRoot = root();
    const result = executor.execute(workingRoot, descriptor(family), {
      validate(receivedRoot, action) {
        assert.equal(receivedRoot, workingRoot);
        assert.equal(action.family, family);
        return { ok: true };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(trace.at(-1).workingRoot, workingRoot, `${family} 必须接收 caller 的 working root`);
    assert.equal(workingRoot.playerState.players[0].resources.credits, 8);
    assert.deepEqual(result.effects, [{ type: `${family}_effect`, ownerId: "p1" }]);
    assert.deepEqual(result.history, [{ type: `${family}_history`, stateVersion: 3 }]);
    assert.deepEqual(result.result, { family, target: `${family}-target` });
  }
}

{
  const executor = createExecutor();
  const workingRoot = root();
  const before = structuredClone(workingRoot);
  const stale = executor.execute(workingRoot, descriptor("scan"), {
    validate() { return { ok: false, code: "STANDARD_ACTION_STALE", message: "stale" }; },
  });
  assert.equal(stale.code, "STANDARD_ACTION_STALE");
  assert.deepEqual(workingRoot, before, "stale 前后完整 working root 必须不变");
}

{
  const executor = createExecutor([], { failFamily: "play_card" });
  const workingRoot = root();
  const before = structuredClone(workingRoot);
  assert.equal(executor.execute(workingRoot, descriptor("play_card")).code, "RULE_FAILED");
  assert.deepEqual(workingRoot, before, "规则失败前后完整 working root 必须不变");
}

{
  const executor = createExecutor();
  for (const family of ACTION_FAMILIES) {
    const browserRoot = root();
    const aiRoot = structuredClone(browserRoot);
    const action = descriptor(family);
    assert.equal(executor.execute(browserRoot, action).ok, true);
    assert.equal(executor.execute(aiRoot, structuredClone(action)).ok, true);
    assert.deepEqual(aiRoot, browserRoot, `${family} Browser/AI 同 descriptor 必须产生相同 working root`);
  }
}

{
  const actionRuntimeSource = fs.readFileSync(path.join(__dirname, "action-runtime.js"), "utf8");
  assert.match(actionRuntimeSource, /ENGINE_ACTION_FAMILIES\.has\(descriptor\?\.family\)/);
  assert.match(actionRuntimeSource, /engineActionExecutor\.execute\(workingRoot, descriptor/);
  assert.doesNotMatch(actionRuntimeSource, /engineActionWorkingRoot|primaryBoardWorkingRoot|quickTurnActionWorkingRoot|conditionalActionWorkingRoot/);
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.equal(/executors:\s*\{/.test(appSource), false, "app.js 不得保留四 family executor 函数体");
  assert.match(appSource, /executeScan: \(workingRoot, descriptor\) => executeMainScanAction\(workingRoot, descriptor\)/);
  assert.match(appSource, /executePlayCard: \(_workingRoot, descriptor\) => executeStandardPlayCard\(descriptor\)/);
  assert.match(appSource, /operation\(workingRoot, \.\.\.\(command\.args \|\| \[\]\)\)/);
  assert.equal(
    /execute\(\) \{ return beginScanAction\(\); \}/.test(appSource),
    false,
    "Standard Action registry 不得保留扫描重复 executor",
  );
}

console.log("engine action executor tests passed");
