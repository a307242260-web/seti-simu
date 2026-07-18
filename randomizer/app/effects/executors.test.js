"use strict";

const assert = require("node:assert/strict");
const { createEffectMovementScanExecutors } = require("./movement-scan");
const { createEffectRewardExecutors } = require("./rewards");
const { createEffectAlienExecutors } = require("./aliens");
const { createEffectDispatcher } = require("./dispatcher");

(() => {
  assert.equal(typeof createEffectMovementScanExecutors({}).executeSectorScanAtPlanet, "function");
  assert.equal(typeof createEffectRewardExecutors({}).executeGainResourcesRewardEffect, "function");
  assert.equal(typeof createEffectAlienExecutors({}).executeAomomoGainFossilsEffect, "function");

  const outcomes = [
    { ok: true, undoable: true, message: "成功并可撤销" },
    { ok: false, message: "执行失败" },
    { ok: true, skipped: true, message: "没有目标，已跳过" },
    { ok: true, pendingChoice: true, message: "等待玩家继续选择" },
  ];
  const cardEffects = {
    EFFECT_TYPES: {
      SCAN_NEBULA: "scan_nebula",
    },
  };
  const baseContext = {
    cardEffects,
    planetRewards: { EFFECT_TYPES: {} },
    scanEffects: { EFFECT_TYPES: {} },
    banrenma: null,
    jiuzhe: null,
    executeCardFixedNebulaScanEffect: () => outcomes.shift(),
  };
  const dispatcher = createEffectDispatcher(baseContext);

  for (const expected of [...outcomes]) {
    const actual = dispatcher.executeActionEffectForOwner({
      type: cardEffects.EFFECT_TYPES.SCAN_NEBULA,
      status: "active",
    });
    assert.deepEqual(actual, expected);
  }

  assert.deepEqual(
    dispatcher.executeActionEffectForOwner({ type: "unknown", status: "active" }),
    { ok: false, message: "未知效果类型: unknown" },
  );
  assert.equal(dispatcher.executeActionEffectForOwner(null).ok, false);

  console.log("effect executor tests passed");
})();

(() => {
  const calls = [];
  const executors = createEffectRewardExecutors({
    abilities: {
      executeAbility() {
        return {
          ok: false,
          abilityId: "launchProbe",
          message: "火箭数量已达上限（2/2）",
        };
      },
    },
    beginEffectHistoryStep: () => calls.push("begin"),
    createActionContext: () => ({}),
    endEffectHistoryStep: () => calls.push("end"),
    renderStateReadout: () => calls.push("render"),
    rocketState: {},
    skipActionEffectWithMessage(effect, message, payload) {
      calls.push({ effect, message, payload });
      return { ok: true, skipped: true, message };
    },
  });
  const effect = { label: "科技奖励发射", options: { skipCost: true }, status: "active" };
  const result = executors.executeLaunchRewardEffect(effect);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.match(result.message, /火箭数量已达上限.*已跳过/);
  assert.deepEqual(calls.slice(0, 2), ["begin", "end"]);
  assert.equal(calls[2].effect, effect);

  console.log("launch reward saturation tests passed");
})();
