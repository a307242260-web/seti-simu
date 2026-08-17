(function (root, factory) {
  "use strict";

  let solar = root.SetiSolarSystem;
  let players = root.SetiPlayers;
  let data = root.SetiData;
  let rocketAbility = root.SetiAbilityRocket;

  if ((!solar || !players || !data || !rocketAbility) && typeof require === "function") {
    solar = solar || require("../../solar-system/core");
    players = players || require("../players");
    data = data || require("../data");
    rocketAbility = rocketAbility || require("./rocket");
  }

  const api = factory(solar, players, data, rocketAbility);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiAbilityScan = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  solar,
  players,
  data,
  rocketAbility,
) {
  "use strict";

  const SCAN_ACTION_4_LAUNCH_COST = Object.freeze({ energy: 1 });
  const SCAN_COST = Object.freeze({ credits: 1, energy: 2 });

  function getCurrentPlayer(context) {
    return players.getCurrentPlayer(context.players, context.turn?.currentPlayerId);
  }

  function getPlayerTokenSrc(context, player, options) {
    if (options.playerTokenSrc || options.tokenSrc) return options.playerTokenSrc || options.tokenSrc;
    if (typeof context.getPlayerTokenSrc === "function") {
      return context.getPlayerTokenSrc(player);
    }
    return players.getPlayerColorDefinition(player?.color)?.normalTokenAsset || null;
  }

  function resolveNebulaId(context, options = {}) {
    if (options.nebulaId) return options.nebulaId;
    if (options.sectorX != null) {
      const nebula = solar.getNebulaAtCoordinate(
        Number(options.sectorX),
        5,
        context.solarSystem?.sectorBySlot,
      );
      return nebula?.id || null;
    }
    return null;
  }

  function hasScannableNebulaData(context, nebulaId) {
    return (data.listNebulaTokens?.(context.data, nebulaId) || []).length > 0;
  }

  // 通用「替换星云数据 token 为自己」原语：不止扫描使用——卡牌、环绕奖励、
  // 初始牌等任何往星云放置自己 token 的来源都调用它。行为：替换下一个可替换
  // 槽位（可选获得数据）；无可替换时追加扇区额外计数标记且不获得数据。
  // scanNebula 只是它之上的扫描编排（定位/文案/事件来源），非扫描来源直接调本原语。
  function placeNebulaToken(context, options = {}) {
    const currentPlayer = options.playerId != null
      ? (context.players?.players || []).find(
        (player) => String(player.id) === String(options.playerId),
      ) || null
      : getCurrentPlayer(context);
    const nebulaId = options.nebulaId;
    if (!currentPlayer) {
      return { ok: false, abilityId: "placeNebulaToken", message: "没有当前玩家" };
    }
    if (!context.data) {
      return { ok: false, abilityId: "placeNebulaToken", message: "星云状态未初始化" };
    }
    if (!nebulaId) {
      return { ok: false, abilityId: "placeNebulaToken", message: "没有可替换星云" };
    }

    const tokenOptions = {
      playerColor: options.playerColor || currentPlayer.color,
      playerLabel: options.playerLabel || currentPlayer.colorLabel,
      playerTokenSrc: getPlayerTokenSrc(context, currentPlayer, options),
      ...(context.state ? { root: context.state } : {}),
      // 终局计分来源拆分：默认记 scanScore；初始牌等来源可覆盖（如 initialScore）。
      scoreSourceKey: options.scoreSourceKey || "scanScore",
    };

    const nextToken = data.getNextReplaceableNebulaToken(context.data, nebulaId);
    if (nextToken) {
      const replaceResult = data.replaceNextNebulaDataToken(
        context.data,
        nebulaId,
        currentPlayer,
        tokenOptions,
      );
      if (!replaceResult.ok) return { ...replaceResult, abilityId: "placeNebulaToken" };
      const shouldGainData = options.gainData !== false;
      const gainResult = shouldGainData
        ? data.gainData(currentPlayer, {
          source: options.source || "nebula",
          ...(context.state ? { root: context.state } : {}),
        })
        : { ok: true, skipped: true, message: "未获得数据" };
      return {
        ok: true,
        abilityId: "placeNebulaToken",
        message: replaceResult.message,
        undoable: true,
        cost: {},
        payload: {
          nebulaId,
          replaced: replaceResult,
          gainedData: gainResult,
          gainData: shouldGainData,
          card: options.card || null,
        },
        events: [{
          type: "signalMarked",
          nebulaId,
          slotIndex: replaceResult.slotIndex,
          playerId: currentPlayer.id,
        }],
        nebulaId,
        replaced: replaceResult,
        gainedData: gainResult,
      };
    }

    if (!hasScannableNebulaData(context, nebulaId) || typeof data.addSectorExtraMark !== "function") {
      return {
        ok: false,
        abilityId: "placeNebulaToken",
        message: `${data.getNebulaLabel(nebulaId)} 没有可扫描数据`,
      };
    }
    const extraResult = data.addSectorExtraMark(context.data, nebulaId, currentPlayer, tokenOptions);
    if (!extraResult.ok) return { ...extraResult, abilityId: "placeNebulaToken" };
    return {
      ok: true,
      abilityId: "placeNebulaToken",
      message: "无可替换数据，追加扫描计数；不获得数据",
      undoable: true,
      cost: {},
      payload: {
        nebulaId,
        replaced: null,
        extraMark: extraResult,
        gainedData: { ok: true, skipped: true, message: "无可替换数据，未获得数据" },
        gainData: false,
        card: options.card || null,
      },
      events: [{
        type: "signalMarked",
        nebulaId,
        playerId: currentPlayer.id,
        extra: true,
        markId: extraResult.mark?.id,
      }],
      nebulaId,
      replaced: null,
      extraMark: extraResult,
      gainedData: { ok: true, skipped: true, message: "无可替换数据，未获得数据" },
    };
  }

  function scanNebula(context, options = {}) {
    const currentPlayer = getCurrentPlayer(context);
    const nebulaId = resolveNebulaId(context, options);

    if (!currentPlayer) {
      return { ok: false, abilityId: "scanNebula", message: "没有当前玩家" };
    }
    if (!context.data) {
      return { ok: false, abilityId: "scanNebula", message: "星云状态未初始化" };
    }
    if (!nebulaId) {
      return { ok: false, abilityId: "scanNebula", message: "没有可扫描星云" };
    }

    // 记录本次扫描目标星云，供异常点 y0「异常扇区信号得分」等卡牌效果读取
    // （随 undo frame 一并恢复）。
    if (context.state?.match) {
      context.state.match.cardPlayContext = context.state.match.cardPlayContext || {};
      context.state.match.cardPlayContext.lastScanNebulaId = nebulaId;
    }

    // 扫描编排：实际替换/追加计数由通用原语 placeNebulaToken 完成。
    const placed = placeNebulaToken(context, {
      ...options,
      nebulaId,
      source: options.source || "scan",
    });
    if (!placed.ok) return { ...placed, abilityId: "scanNebula" };

    const label = data.getNebulaLabel(nebulaId);
    const color = players.getPlayerColorDefinition(currentPlayer.color);
    const playerLabel = color?.label || currentPlayer.colorLabel || "当前玩家";
    const prefix = options.prefix || "扫描";
    let message;
    if (placed.extraMark) {
      message = `${prefix}：${label} 已无未替换数据，追加${playerLabel}扫描计数；不获得数据`;
    } else {
      const dataMessage = placed.payload.gainData
        ? (placed.gainedData.ok ? "获得数据" : placed.gainedData.message)
        : "不获得数据";
      const scoreMessage = placed.replaced?.scoreAwarded
        ? `；槽位${placed.replaced.slotIndex} +${placed.replaced.scoreAwarded}分`
        : "";
      message = `${prefix}：${label} 槽位${placed.replaced.slotIndex}`
        + ` 替换为${playerLabel}token${scoreMessage}；${dataMessage}`;
    }
    return { ...placed, abilityId: "scanNebula", message };
  }

  function scanSector(context, options = {}) {
    const result = scanNebula(context, options);
    return {
      ...result,
      abilityId: "scanSector",
    };
  }

  function scanPublicCard(context, options = {}) {
    const result = scanNebula(context, options);
    if (!result.ok) {
      return {
        ...result,
        abilityId: "scanPublicCard",
      };
    }

    const slotIndex = Number(options.publicSlotIndex);
    const cardsState = context.cards;
    const card = options.card || cardsState?.publicCards?.[slotIndex] || null;
    if (cardsState && card && Number.isInteger(slotIndex)) {
      if (!Array.isArray(cardsState.discardPile)) cardsState.discardPile = [];
      cardsState.discardPile.push(card);
      let replenished = null;
      if (cardsState.publicCards?.[slotIndex]?.id === card.id) {
        cardsState.publicCards[slotIndex] = null;
        if (typeof context.replenishPublicSlot === "function") {
          replenished = context.replenishPublicSlot(slotIndex);
        }
      }

      result.payload.card = card;
      result.payload.replenished = replenished;
      result.message += replenished
        ? `；弃除 ${card.cardName || card.cardId || card.id}，公共区补牌`
        : `；弃除 ${card.cardName || card.cardId || card.id}`;
      if (replenished) {
        result.undoable = false;
        result.irreversible = {
          code: "hidden_card_reveal",
          reason: "公共牌补牌翻出新牌",
        };
      }
    }

    return {
      ...result,
      abilityId: "scanPublicCard",
    };
  }

  function scanHandCard(context, options = {}) {
    const result = scanNebula(context, options);
    if (!result.ok) {
      return {
        ...result,
        abilityId: "scanHandCard",
      };
    }

    const player = options.player || getCurrentPlayer(context);
    const handIndex = Number(options.handIndex);
    const card = options.card || player?.hand?.[handIndex] || null;
    if (context.cards && player && card && Number.isInteger(handIndex)) {
      const discardIndex = player.hand?.findIndex((item) => item.id === card.id);
      const resolvedIndex = discardIndex >= 0 ? discardIndex : handIndex;
      const discarded = player.hand.splice(resolvedIndex, 1)[0];
      player.resources.handSize = player.hand.length;
      if (!Array.isArray(context.cards.discardPile)) context.cards.discardPile = [];
      context.cards.discardPile.push(discarded);

      result.payload.card = discarded;
      result.message += `；弃除手牌 ${discarded.cardName || discarded.cardId || discarded.id}`;
    }

    return {
      ...result,
      abilityId: "scanHandCard",
    };
  }

  function scanAction4(context, options = {}) {
    if (options.choice === "launch" || options.mode === "launch") {
      return {
        ...rocketAbility.launchProbe(context, {
          ...options,
          cost: options.cost ?? SCAN_ACTION_4_LAUNCH_COST,
          historyLabel: options.historyLabel || "发射/移动：发射消耗 1 能量",
        }),
        abilityId: "scanAction4",
        undoable: true,
      };
    }

    if (options.choice === "move" || options.mode === "move") {
      return {
        ...rocketAbility.moveProbe(context, {
          ...options,
          cost: options.cost ?? {},
          historyLabel: options.historyLabel || "发射/移动：移动",
        }),
        abilityId: "scanAction4",
        undoable: true,
      };
    }

    return { ok: false, abilityId: "scanAction4", message: "未知发射/移动选择" };
  }

  function payScanCost(context, options = {}) {
    const currentPlayer = getCurrentPlayer(context);
    const cost = options.skipCost ? {} : { ...(options.cost || SCAN_COST) };
    if (!currentPlayer) return { ok: false, abilityId: "payScanCost", message: "没有当前玩家" };
    if (Object.keys(cost).length && !players.canAfford(currentPlayer, cost)) {
      return {
        ok: false,
        abilityId: "payScanCost",
        message: `资源不足，需要 ${players.formatResourceCost(cost)}`,
      };
    }
    const spend = Object.keys(cost).length ? players.spendResources(currentPlayer, cost) : { ok: true };
    if (!spend.ok) return { ok: false, abilityId: "payScanCost", message: spend.message };

    const message = Object.keys(cost).length
      ? `扫描消耗 ${players.formatResourceCost(cost)}`
      : "扫描免费";
    return {
      ok: true,
      abilityId: "payScanCost",
      message,
      undoable: true,
      cost,
      payload: {},
      events: [],
    };
  }

  return Object.freeze({
    SCAN_ACTION_4_LAUNCH_COST,
    SCAN_COST,
    payScanCost,
    placeNebulaToken,
    scanSector,
    scanNebula,
    scanPublicCard,
    scanHandCard,
    scanAction4,
  });
});
