"use strict";

const assert = require("node:assert/strict");
const { createEffectMovementScanExecutors } = require("./movement-scan");
const { createEffectRewardExecutors } = require("./rewards");
const { createEffectAlienExecutors } = require("./aliens");
const { createEffectDispatcher } = require("./dispatcher");

function withWorkingRoot(context = {}) {
  const workingRoot = {
    alienGameState: context.alienGameState || {},
    cardState: context.cardState || { publicCards: [], discardPile: [] },
    nebulaDataState: context.nebulaDataState || {},
    planetStatsState: context.planetStatsState || {},
    playerState: context.playerState || { players: [] },
    rocketState: context.rocketState || { rockets: [], statusNote: "" },
    solarState: context.solarState || {},
    turnState: context.turnState || {},
  };
  return { ...context, getWorkingRoot: () => workingRoot };
}

(() => {
  assert.equal(typeof createEffectMovementScanExecutors(withWorkingRoot()).executeSectorScanAtPlanet, "function");
  assert.equal(typeof createEffectRewardExecutors(withWorkingRoot()).executeGainResourcesRewardEffect, "function");
  assert.equal(typeof createEffectAlienExecutors(withWorkingRoot()).executeAomomoGainFossilsEffect, "function");

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
  const dispatcher = createEffectDispatcher(withWorkingRoot(baseContext));

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
  const effectType = "public_card_scan";
  const effect = { type: effectType, label: "扫描行动公共牌扫描", status: "active" };
  let beganSelection = false;
  const dispatcher = createEffectDispatcher(withWorkingRoot({
    cardEffects: { EFFECT_TYPES: {} },
    scanEffects: { EFFECT_TYPES: { PUBLIC_CARD_SCAN: effectType } },
    planetRewards: { EFFECT_TYPES: {} },
    cardState: { publicCards: [] },
    getPublicScanChoicesForCard: () => ({ ok: false }),
    getCurrentPlayer: () => ({ id: "player-1" }),
    beginCardSelection: () => { beganSelection = true; },
    skipActionEffectWithMessage(_effect, message, payload) {
      return { ok: true, skipped: true, message, payload };
    },
  }));
  const result = dispatcher.executeActionEffectForOwner(effect);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.payload.reason, "no_public_scan_candidate");
  assert.equal(beganSelection, false);

  console.log("scan-action public-scan empty-candidate tests passed");
})();

(() => {
  const calls = [];
  const executors = createEffectRewardExecutors(withWorkingRoot({
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
  }));
  const effect = { label: "科技奖励发射", options: { skipCost: true }, status: "active" };
  const result = executors.executeLaunchRewardEffect(effect);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.match(result.message, /火箭数量已达上限.*已跳过/);
  assert.deepEqual(calls.slice(0, 2), ["begin", "end"]);
  assert.equal(calls[2].effect, effect);

  console.log("launch reward saturation tests passed");
})();

(() => {
  const finished = [];
  const executors = createEffectRewardExecutors(withWorkingRoot({
    abilities: {
      executeAbility() {
        return {
          ok: false,
          abilityId: "researchTechPrepare",
          reason: "no_takeable_tech",
          message: "没有符合颜色限制的可研究科技板块",
        };
      },
    },
    createActionContext: () => ({}),
    finishAutomaticRewardEffect(effect, result) {
      finished.push({ effect, result });
      return result;
    },
    renderStateReadout: () => {},
    rocketState: {},
  }));
  const effect = {
    label: "卡牌科技（仅蓝色）",
    options: { techTypes: ["blue"], skipCost: true },
    status: "active",
  };
  const result = executors.executeCardResearchTechEffect(effect);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.payload.reason, "no_takeable_tech");
  assert.match(result.message, /没有符合颜色限制.*已跳过/);
  assert.equal(finished[0].effect, effect);

  console.log("card research-tech empty-candidate tests passed");
})();

(() => {
  const calls = [];
  const executors = createEffectRewardExecutors(withWorkingRoot({
    cardState: { publicCards: [] },
    getPublicScanChoicesForCard: () => ({ ok: false }),
    getCurrentPlayer: () => ({ id: "player-1" }),
    skipActionEffectWithMessage(effect, message, payload) {
      calls.push({ effect, message, payload });
      return { ok: true, skipped: true, message, payload };
    },
  }));
  const effect = { label: "卡牌公共牌扫描", options: { repeat: 1 }, status: "active" };
  const result = executors.openCardPublicScanEffect(effect);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.payload.reason, "no_public_scan_candidate");
  assert.match(result.message, /公共牌区为空.*已跳过/);
  assert.equal(calls.length, 1);

  console.log("card public-scan empty-candidate tests passed");
})();

(() => {
  let abilityCall = null;
  const chong = {
    EFFECT_TYPES: {
      CHONG_LAND_FOR_PICKUP: "chong_land_for_pickup",
      CHONG_ORBIT_OR_LAND_FOR_PICKUP: "chong_orbit_or_land_for_pickup",
    },
  };
  const executors = createEffectAlienExecutors(withWorkingRoot({
    abilities: {
      executeAbility(abilityId, context, options) {
        abilityCall = { abilityId, context, options };
        return { ok: false, message: "stop after capture" };
      },
    },
    beginEffectHistoryStep: () => {},
    chong,
    createActionContext: () => ({ marker: "context" }),
    endEffectHistoryStep: () => {},
    pendingState: {},
    renderStateReadout: () => {},
    rocketState: {},
  }));
  const effect = {
    type: chong.EFFECT_TYPES.CHONG_LAND_FOR_PICKUP,
    label: "虫族8：登陆",
    options: { allowSatellite: true },
  };
  const choice = {
    kind: "land",
    rocketId: 42,
    target: { type: "planet", planetId: "jupiter", rocketId: 42 },
  };
  executors.executeChongTravelForPickupChoice(effect, choice);
  assert.equal(abilityCall.abilityId, "landProbe");
  assert.equal(abilityCall.options.rocketId, 42);
  assert.deepEqual(abilityCall.options.target, choice.target);

  console.log("Chong landing choice rocket routing tests passed");
})();

(() => {
  const chong = {
    EFFECT_TYPES: {
      CHONG_LAND_FOR_PICKUP: "chong_land_for_pickup",
      CHONG_ORBIT_OR_LAND_FOR_PICKUP: "chong_orbit_or_land_for_pickup",
    },
  };
  const executors = createEffectAlienExecutors(withWorkingRoot({
    abilities: {
      planet: {
        getLandOptions: () => ({ ok: false, message: "当前没有可登陆的行星火箭" }),
      },
    },
    chong,
    createActionContext: () => ({}),
    finishAutomaticRewardEffect: (effect, result) => result,
  }));
  const result = executors.executeChongTravelForPickupEffect({
    type: chong.EFFECT_TYPES.CHONG_LAND_FOR_PICKUP,
    label: "虫族8：登陆",
    options: { allowSatellite: true },
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.payload.reason, "no_chong_land_target");
  assert.match(result.message, /当前没有可登陆的行星火箭.*已跳过/);

  console.log("Chong empty landing target tests passed");
})();
