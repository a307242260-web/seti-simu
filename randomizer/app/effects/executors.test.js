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
