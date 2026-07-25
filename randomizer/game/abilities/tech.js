(function (root, factory) {
  "use strict";

  let players = root.SetiPlayers;
  let tech = root.SetiTech;
  let rocketAbility = root.SetiAbilityRocket;
  let industryPassives = root.SetiIndustryPassives;

  if ((!players || !tech || !rocketAbility) && typeof require === "function") {
    players = players || require("../players");
    tech = tech || require("../tech");
    rocketAbility = rocketAbility || require("./rocket");
    industryPassives = industryPassives || require("../industry/passives");
  }

  const api = factory(players, tech, rocketAbility, industryPassives);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAbilityTech = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  players,
  tech,
  rocketAbility,
  industryPassives,
) {
  "use strict";

  function restoreObject(target, snapshot) {
    if (!target || !snapshot) return;
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, structuredClone(snapshot));
  }

  function getIndustryPassives() {
    return industryPassives || (typeof globalThis !== "undefined" ? globalThis.SetiIndustryPassives : null);
  }

  function getPlayerTechState(context) {
    const currentPlayer = players.getCurrentPlayer(context.players, context.turn?.currentPlayerId);
    if (!currentPlayer) return { ok: false, message: "没有当前玩家" };
    if (!currentPlayer.techState && context.ensurePlayerTechState) {
      context.ensurePlayerTechState(currentPlayer);
    }
    if (!currentPlayer.techState) return { ok: false, message: "玩家科技状态未初始化" };
    return { ok: true, currentPlayer };
  }

  function buildTechTypeOptions(context, options = {}) {
    const allowedTechTypes = tech.resolver.normalizeTechTypeFilter(options)
      || null;
    return allowedTechTypes ? { techTypes: allowedTechTypes } : {};
  }

  function researchTechPrepare(context, options = {}) {
    const playerResult = getPlayerTechState(context);
    if (!playerResult.ok) return { ok: false, abilityId: "researchTechPrepare", message: playerResult.message };

    const board = context.tech;
    if (!board) return { ok: false, abilityId: "researchTechPrepare", message: "科技版图状态未初始化" };

    const skipCost = Boolean(options.skipCost);
    const researchCost = getIndustryPassives()?.getResearchPublicityCost?.(
      playerResult.currentPlayer,
      tech.RESEARCH_PUBLICITY_COST,
    ) ?? tech.RESEARCH_PUBLICITY_COST;
    if (!skipCost && !players.canAfford(playerResult.currentPlayer, { publicity: researchCost })) {
      const message = `宣传不足，研究科技需要 ${researchCost} 宣传`;
      return { ok: false, abilityId: "researchTechPrepare", message };
    }

    const techTypeOptions = buildTechTypeOptions(context, options);
    const takeable = tech.listTakeableTiles(board, playerResult.currentPlayer.techState, techTypeOptions);
    if (!takeable.length) {
      const message = techTypeOptions.techTypes
        ? "没有符合颜色限制的可研究科技板块"
        : "没有可研究的科技板块";
      return {
        ok: false,
        abilityId: "researchTechPrepare",
        reason: "no_takeable_tech",
        message,
      };
    }

    return {
      ok: true,
      abilityId: "researchTechPrepare",
      message: "请选择要研究的科技板块",
      undoable: true,
      cost: skipCost ? {} : { publicity: researchCost },
      payload: { takeable, allowedTechTypes: techTypeOptions.techTypes || null },
      events: [],
      awaitingTileSelection: true,
      takeable,
      allowedTechTypes: techTypeOptions.techTypes || null,
    };
  }

  function researchTechSelect(context, options = {}) {
    const tileId = options.tileId;
    const playerResult = getPlayerTechState(context);
    if (!playerResult.ok) return { ok: false, abilityId: "researchTechSelect", message: playerResult.message };
    const techTypeOptions = buildTechTypeOptions(context, options);
    const canTake = tech.resolver.canTakeTile(
      context.tech,
      playerResult.currentPlayer.techState,
      tileId,
      techTypeOptions,
    );
    if (!canTake.ok) return { ok: false, abilityId: "researchTechSelect", message: canTake.message };

    let blueSlot = options.blueSlot ?? null;
    if (canTake.techType === "blue" && blueSlot == null) {
      const availableSlots = tech.getAvailableBlueSlots(playerResult.currentPlayer.techState);
      if (availableSlots.length > 1) {
        return {
          ok: true,
          abilityId: "researchTechSelect",
          message: `请选择 ${tileId} 的蓝色放置位置`,
          undoable: true,
          cost: {},
          payload: { tileId, availableSlots },
          events: [],
          needsBlueSlotChoice: true,
          tileId,
          availableSlots,
        };
      }
      blueSlot = availableSlots[0] ?? null;
    }

    const snapshots = {
      player: structuredClone(playerResult.currentPlayer),
      board: structuredClone(context.tech),
    };
    const skipCost = Boolean(options.skipCost);
    const researchCost = getIndustryPassives()?.getResearchPublicityCost?.(
      playerResult.currentPlayer,
      tech.RESEARCH_PUBLICITY_COST,
    ) ?? tech.RESEARCH_PUBLICITY_COST;
    if (!skipCost) {
      const spend = players.spendResources(playerResult.currentPlayer, { publicity: researchCost });
      if (!spend.ok) {
        restoreObject(playerResult.currentPlayer, snapshots.player);
        restoreObject(context.tech, snapshots.board);
        return {
          ok: false,
          abilityId: "researchTechSelect",
          message: spend.message || `宣传不足，研究科技需要 ${researchCost} 宣传`,
        };
      }
    }

    const result = tech.resolver.selectTechTile(context, { tileId, blueSlot, ...techTypeOptions });
    if (!result.ok || result.needsBlueSlotChoice) {
      restoreObject(playerResult.currentPlayer, snapshots.player);
      restoreObject(context.tech, snapshots.board);
      return {
        ok: false,
        abilityId: "researchTechSelect",
        message: result.message || "科技选择失败",
      };
    }

    return {
      ...result,
      ok: true,
      abilityId: "researchTechSelect",
      message: result.message,
      undoable: true,
      cost: skipCost ? {} : { publicity: researchCost },
      payload: {
        tileId: result.tileId,
        techType: result.techType,
        bonusId: result.bonusId,
        blueSlot: result.blueSlot,
        firstTake: result.firstTake,
      },
      events: [],
    };
  }

  function researchTechTake(context, options = {}) {
    const playerResult = getPlayerTechState(context);
    if (!playerResult.ok) return { ok: false, abilityId: "researchTechTake", message: playerResult.message };

    const snapshots = {
      player: structuredClone(playerResult.currentPlayer),
      board: structuredClone(context.tech),
    };

    const result = tech.resolver.takeSelectedTechTile(context, {
      tileId: options.tileId,
      blueSlot: options.blueSlot,
      expectedBonusId: options.bonusId ?? options.expectedBonusId ?? null,
      expectedFirstTake: options.firstTake ?? options.expectedFirstTake ?? null,
      ...buildTechTypeOptions(context, options),
    });

    if (!result.ok || result.needsBlueSlotChoice) {
      restoreObject(playerResult.currentPlayer, snapshots.player);
      restoreObject(context.tech, snapshots.board);
      return {
        ok: false,
        abilityId: "researchTechTake",
        message: result.message || "科技拿取失败",
      };
    }

    return {
      ...result,
      ok: true,
      abilityId: "researchTechTake",
      message: result.message,
      undoable: false,
      irreversible: {
        code: "tech_bonus_reveal",
        reason: "拿取科技后露出下一张 bonus",
      },
      cost: {},
      payload: {
        tileId: result.tileId,
        techType: result.techType,
        bonusId: result.bonusId,
        blueSlot: result.blueSlot,
        firstTake: result.firstTake,
      },
      events: [],
    };
  }

  function researchTechRotate(context) {
    let beforeRotation = null;
    if (context?.solarSystem?.rotation) {
      beforeRotation = structuredClone(context.solarSystem.rotation);
    }
    const result = tech.resolver.rotateForResearch(context, 1);
    let rotationSettlement = null;
    if (
      result.ok
      && beforeRotation
      && !result.payload?.rotationSettlement
      && !result.payload?.rotationSettlements
      && rocketAbility?.settleRocketsAfterSolarRotation
      && context?.solarSystem?.rotation
    ) {
      rotationSettlement = rocketAbility.settleRocketsAfterSolarRotation(
        context,
        beforeRotation,
        context.solarSystem.rotation,
      );
    }
    return {
      ok: result.ok,
      abilityId: "researchTechRotate",
      message: rotationSettlement?.message || result.message,
      undoable: false,
      cost: {},
      payload: {
        ...(result.payload || {}),
        rotationSettlement: rotationSettlement || result.payload?.rotationSettlement || null,
      },
      events: rotationSettlement?.events || result.events || [],
    };
  }

  function researchTechBonus(context, options = {}) {
    const result = tech.resolver.applyTechBonus(context, {
      bonusId: options.bonusId,
      firstTake: Boolean(options.firstTake),
      skipCardSelection: Boolean(options.skipCardSelection),
    });
    return {
      ...result,
      abilityId: "researchTechBonus",
      undoable: false,
      cost: {},
      payload: {
        bonusId: options.bonusId,
        firstTake: Boolean(options.firstTake),
        rewards: result.rewards || {},
      },
      events: [],
    };
  }

  return Object.freeze({
    researchTechPrepare,
    researchTechSelect,
    researchTechTake,
    researchTechRotate,
    researchTechBonus,
  });
});
