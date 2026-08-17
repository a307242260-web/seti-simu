(function (root, factory) {
  "use strict";

  let players = root.SetiPlayers;
  let cards = root.SetiCards;
  let data = root.SetiData;
  let planetStats = root.SetiPlanetStats;
  let aliens = root.SetiAliens;
  let rockets = root.SetiRocketActions;
  let techBoard = root.SetiTechBoardState;
  let playerTech = root.SetiPlayerTech;
  let rocketAbility = root.SetiAbilityRocket;
  let scanAbility = root.SetiAbilityScan;

  if ((!players || !cards || !data || !planetStats || !aliens || !rockets || !techBoard || !playerTech) && typeof require === "function") {
    players = players || require("./players");
    cards = cards || require("./cards/deck");
    data = data || require("./data");
    planetStats = planetStats || require("./planet-stats");
    aliens = aliens || require("./aliens");
    rockets = rockets || require("./rockets");
    techBoard = techBoard || require("./tech/board-state");
    playerTech = playerTech || require("./tech/player-tech");
    rocketAbility = rocketAbility || require("./abilities/rocket");
    scanAbility = scanAbility || require("./abilities/scan");
  }

  const api = factory(players, cards, data, planetStats, aliens, rockets, techBoard, playerTech, rocketAbility, scanAbility);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiInitialCards = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  players,
  cards,
  data,
  planetStats,
  aliens,
  rockets,
  techBoard,
  playerTech,
  rocketAbility,
  scanAbility,
) {
  "use strict";

  const INITIAL_CARD_COUNT = 21;
  const NEBULA_BY_KEY = Object.freeze({
    siriusA: "sector-2-a",
    barnard: "sector-2-b",
    vega: "sector-1-b",
    pictorBeta: "sector-4-b",
    virgo61: "sector-4-a",
    procyon: "sector-1-a",
    proxima: "sector-3-b",
    kepler22: "sector-3-a",
  });
  const INITIAL_TURN_ORDER_SCORES = Object.freeze([1, 2, 3, 4]);
  const RESOURCE_GAIN_LABELS = Object.freeze({
    score: "分",
    credits: "信用点",
    energy: "能量",
    publicity: "宣传",
    availableData: "数据",
    additionalPublicScan: "额外公共扫描",
    handSize: "手牌",
  });

  const INITIAL_CARD_EFFECTS = Object.freeze({
    1: Object.freeze({ label: "天狼星A扫描两次", scan: Object.freeze({ nebulaId: NEBULA_BY_KEY.siriusA, count: 2 }) }),
    2: Object.freeze({ label: "3分、1信用点、1盲抽", resources: Object.freeze({ score: 3, credits: 1 }), blindDraw: 1 }),
    3: Object.freeze({
      label: "3分、1盲抽、1宣传、火星环绕器",
      resources: Object.freeze({ score: 3, publicity: 1 }),
      blindDraw: 1,
      orbitPlanetId: "mars",
    }),
    4: Object.freeze({
      label: "3分、1能量、1宣传、金星环绕器",
      resources: Object.freeze({ score: 3, energy: 1, publicity: 1 }),
      orbitPlanetId: "venus",
    }),
    5: Object.freeze({
      label: "4分、2宣传、土星环绕器",
      resources: Object.freeze({ score: 4, publicity: 2 }),
      orbitPlanetId: "saturn",
    }),
    6: Object.freeze({
      label: "织女一扫描一次、1额外公共扫描",
      scan: Object.freeze({ nebulaId: NEBULA_BY_KEY.vega, count: 1 }),
      resources: Object.freeze({ additionalPublicScan: 1 }),
    }),
    7: Object.freeze({
      label: "1数据收入、海王星环绕器",
      income: Object.freeze({ availableData: 1 }),
      orbitPlanetId: "neptune",
    }),
    8: Object.freeze({
      label: "2分、2信用点、1宣传、水星环绕器",
      resources: Object.freeze({ score: 2, credits: 2, publicity: 1 }),
      orbitPlanetId: "mercury",
    }),
    9: Object.freeze({
      label: "1盲抽收入、天王星环绕器",
      income: Object.freeze({ handSize: 1 }),
      orbitPlanetId: "uranus",
    }),
    10: Object.freeze({ label: "外星人2黄色痕迹", alienTrace: Object.freeze({ alienSlotId: 2, traceType: "yellow" }) }),
    11: Object.freeze({ label: "外星人2粉色痕迹", alienTrace: Object.freeze({ alienSlotId: 2, traceType: "pink" }) }),
    12: Object.freeze({ label: "巴纳德扇区扫描两次", scan: Object.freeze({ nebulaId: NEBULA_BY_KEY.barnard, count: 2 }) }),
    13: Object.freeze({ label: "绘架座β扫描两次", scan: Object.freeze({ nebulaId: NEBULA_BY_KEY.pictorBeta, count: 2 }) }),
    14: Object.freeze({ label: "3分、1能量、1盲抽", resources: Object.freeze({ score: 3, energy: 1 }), blindDraw: 1 }),
    15: Object.freeze({
      label: "4分、1额外公共扫描、1宣传",
      resources: Object.freeze({ score: 4, additionalPublicScan: 1, publicity: 1 }),
    }),
    16: Object.freeze({ label: "3分、3宣传", resources: Object.freeze({ score: 3, publicity: 3 }) }),
    17: Object.freeze({ label: "室女座61扫描两次", scan: Object.freeze({ nebulaId: NEBULA_BY_KEY.virgo61, count: 2 }) }),
    18: Object.freeze({ label: "南河三扫描两次", scan: Object.freeze({ nebulaId: NEBULA_BY_KEY.procyon, count: 2 }) }),
    19: Object.freeze({ label: "比邻星扫描两次", scan: Object.freeze({ nebulaId: NEBULA_BY_KEY.proxima, count: 2 }) }),
    20: Object.freeze({ label: "开普勒22扫描两次", scan: Object.freeze({ nebulaId: NEBULA_BY_KEY.kepler22, count: 2 }) }),
    21: Object.freeze({
      label: "3分、1数据、1宣传、木星环绕器",
      resources: Object.freeze({ score: 3, publicity: 1 }),
      dataGain: 1,
      orbitPlanetId: "jupiter",
    }),
  });

  const INDUSTRY_EFFECTS = Object.freeze({
    "层云核心": Object.freeze({
      label: "层云核心",
      resources: Object.freeze({ publicity: 3, credits: 3, energy: 2 }),
      blindDraw: 1,
      incomeIncreaseCount: 3,
      baseIncome: Object.freeze({ credits: 2, energy: 1, handSize: 1 }),
    }),
    "芬威克研究中心": Object.freeze({
      label: "芬威克研究中心",
      resources: Object.freeze({ publicity: 4, credits: 3, energy: 1 }),
      incomeIncreaseCount: 3,
      baseIncome: Object.freeze({ credits: 3, energy: 1, publicity: 1 }),
    }),
    "赫利昂联合体": Object.freeze({
      label: "赫利昂联合体",
      resources: Object.freeze({ publicity: 7, credits: 3, energy: 2 }),
      baseIncome: Object.freeze({ credits: 3, energy: 1, handSize: 1, publicity: 1 }),
    }),
    "寰宇动力": Object.freeze({
      label: "寰宇动力",
      resources: Object.freeze({ publicity: 3, credits: 2, energy: 2 }),
      launchCount: 2,
      incomeIncreaseCount: 2,
      baseIncome: Object.freeze({ credits: 3, energy: 1, handSize: 1 }),
    }),
    "任务中继站": Object.freeze({
      label: "任务中继站",
      resources: Object.freeze({ publicity: 2, credits: 3, energy: 2 }),
      blindDraw: 2,
      incomeIncreaseCount: 3,
      baseIncome: Object.freeze({ credits: 1, energy: 1, handSize: 1 }),
    }),
    "哨兵探测网络": Object.freeze({
      label: "哨兵探测网络",
      resources: Object.freeze({ publicity: 3, credits: 4, energy: 2 }),
      incomeIncreaseCount: 1,
      baseIncome: Object.freeze({ credits: 3, energy: 1, handSize: 1, additionalPublicScan: 1 }),
    }),
    "深空探测": Object.freeze({
      label: "深空探测",
      resources: Object.freeze({ publicity: 3, credits: 3, energy: 2 }),
      dataGain: 1,
      incomeIncreaseCount: 2,
      baseIncome: Object.freeze({ credits: 2, energy: 2, handSize: 1, additionalPublicScan: 1 }),
    }),
    "图灵系统": Object.freeze({
      label: "图灵系统",
      resources: Object.freeze({ publicity: 2, credits: 4, energy: 2 }),
      blindDraw: 1,
      incomeIncreaseCount: 2,
      baseIncome: Object.freeze({ credits: 2, energy: 2, handSize: 1, availableData: 1 }),
    }),
    "未来跨度研究所": Object.freeze({
      label: "未来跨度研究所",
      resources: Object.freeze({ publicity: 3, credits: 3, energy: 3 }),
      blindDraw: 1,
      incomeIncreaseCount: 2,
      baseIncome: Object.freeze({ credits: 2, energy: 1, handSize: 1 }),
    }),
    "异星实验室": Object.freeze({
      label: "异星实验室",
      resources: Object.freeze({ publicity: 1, credits: 2, energy: 2 }),
      blindDraw: 1,
      incomeIncreaseCount: 3,
      baseIncome: Object.freeze({ credits: 2, energy: 1, handSize: 1 }),
    }),
    "宇宙战略集团": Object.freeze({
      label: "宇宙战略集团",
      resources: Object.freeze({ publicity: 1, credits: 4, energy: 2 }),
      blindDraw: 1,
      incomeIncreaseCount: 2,
      baseIncome: Object.freeze({ credits: 2, energy: 1, handSize: 1 }),
    }),
  });

  function getInitialCardNumber(card) {
    if (Number.isInteger(card?.number)) return card.number;
    const idMatch = String(card?.id || "").match(/initial:(\d+)/);
    if (idMatch) return Number(idMatch[1]);
    const srcMatch = String(card?.src || "").match(/\/(\d+)\.[a-z0-9]+$/i);
    if (srcMatch) return Number(srcMatch[1]);
    const labelMatch = String(card?.label || "").match(/(\d+)/);
    return labelMatch ? Number(labelMatch[1]) : null;
  }

  function getInitialCardEffect(cardOrNumber) {
    const number = Number.isInteger(cardOrNumber)
      ? cardOrNumber
      : getInitialCardNumber(cardOrNumber);
    return INITIAL_CARD_EFFECTS[number] || null;
  }

  function normalizeIndustryLabel(cardOrLabel) {
    const label = typeof cardOrLabel === "string"
      ? cardOrLabel
      : (cardOrLabel?.label || cardOrLabel?.id || cardOrLabel?.src || "");
    return String(label || "")
      .replace(/^industry:/, "")
      .replace(/^.*[\\/]/, "")
      .replace(/\.[^.]+$/, "");
  }

  function getIndustryEffect(cardOrLabel) {
    const label = normalizeIndustryLabel(cardOrLabel);
    return INDUSTRY_EFFECTS[label] || null;
  }

  function getEffectiveIndustryEffect(cardOrLabel, player) {
    void player;
    return getIndustryEffect(cardOrLabel);
  }

  function getPlayerById(context, playerId) {
    return (context?.players?.players || []).find((player) => player.id === playerId) || null;
  }

  function attachPlayerResult(result, player) {
    if (!result || !player) return result;
    return {
      ...result,
      playerId: player.id || null,
      playerColor: player.color || null,
      playerColorLabel: player.colorLabel || null,
    };
  }

  function pushResult(results, result) {
    if (result) results.push(result);
    return result;
  }

  function hasNonZeroGain(gain) {
    return Boolean(gain && Object.values(gain).some((value) => Number(value) !== 0));
  }

  function formatResourceGain(gain) {
    return Object.entries(gain || {})
      .map(([key, value]) => `${value}${RESOURCE_GAIN_LABELS[key] || key}`)
      .join("、");
  }

  function applyResources(player, gain, results, scoreSourceKey = null) {
    if (!gain || !Object.keys(gain).length) return;
    players.gainResources(player, gain, scoreSourceKey);
    pushResult(results, {
      ok: true,
      type: "resources",
      gain: { ...gain },
      message: `获得 ${formatResourceGain(gain)}`,
    });
  }

  function getInitialTurnOrderScore(positionIndex) {
    const index = Math.max(0, Math.round(Number(positionIndex) || 0));
    return INITIAL_TURN_ORDER_SCORES[index] || index + 1;
  }

  function resolveTurnOrderScoreEffect(player, positionIndex) {
    const score = getInitialTurnOrderScore(positionIndex);
    const results = [];
    applyResources(player, { score }, results, "initialScore");
    return {
      ok: true,
      type: "turnOrderScore",
      position: positionIndex + 1,
      effect: { label: `顺位默认分 ${score}分` },
      results,
      events: [],
      message: `${positionIndex + 1}号位初始获得 ${score} 分`,
    };
  }

  function resetPlayerStartingResources(player) {
    if (!player) return;
    player.resources = players.normalizeResources({
      credits: 0,
      energy: 0,
      publicity: 0,
      availableData: 0,
      additionalPublicScan: 0,
      handSize: Array.isArray(player.hand) ? player.hand.length : 0,
      score: 0,
    });
    player.income = players.normalizeIncome(null);
    player.dataState = data.createDefaultDataState();
    player.scoreSources = players.normalizeScoreSources(null);
  }

  function setBaseIncome(player, income, results) {
    player.income = players.normalizeIncome(income || null);
    pushResult(results, {
      ok: true,
      type: "baseIncome",
      gain: { ...player.income },
      message: `初始收入水平 ${Object.entries(player.income)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}+${value}`)
        .join("、") || "无"}`,
    });
  }

  function applyIncome(context, player, gain, results) {
    if (!gain || !Object.keys(gain).length) return;
    players.gainIncome(player, gain, {
      blindDraw: (targetPlayer) => (
        typeof context?.blindDrawCard === "function"
          ? context.blindDrawCard(targetPlayer)
          : cards.blindDraw(
            context.cards,
            context.players,
            targetPlayer,
            Math.random,
            { root: context?.state },
          )
      ),
      gainData: (targetPlayer) => data.gainData(targetPlayer, {
        source: "initial_card",
        root: context?.state,
      }),
    });
    const labels = {
      credits: "信用点",
      energy: "能量",
      handSize: "盲抽",
      publicity: "宣传",
      availableData: "数据",
      additionalPublicScan: "额外公共扫描",
    };
    pushResult(results, {
      ok: true,
      type: "income",
      gain: { ...gain },
      message: `收入 +${Object.entries(gain).map(([key, value]) => `${value}${labels[key] || key}`).join("、")}`,
    });
  }

  function applyDataGain(context, player, count, results) {
    const target = Math.max(0, Math.round(Number(count) || 0));
    for (let index = 0; index < target; index += 1) {
      const result = data.gainData(player, { source: "initial_card", root: context?.state });
      pushResult(results, {
        ...result,
        type: "data",
      });
    }
  }

  function applyBlindDraw(context, player, count, results) {
    const target = Math.max(0, Math.round(Number(count) || 0));
    for (let index = 0; index < target; index += 1) {
      const result = typeof context?.blindDrawCard === "function"
        ? context.blindDrawCard(player)
        : cards.blindDraw(
          context.cards,
          context.players,
          player,
          Math.random,
          { root: context?.state },
        );
      pushResult(results, {
        ...result,
        type: "blindDraw",
        message: result.ok
          ? `盲抽 ${cards.getCardLabel(result.card)}`
          : result.message,
      });
    }
  }

  function applyLaunches(context, player, count, results) {
    const target = Math.max(0, Math.round(Number(count) || 0));
    for (let index = 0; index < target; index += 1) {
      // 统一发射内核：寰宇动力开局发射与所有行动性发射共用 launchProbe；
      // 开局免成本，且按文档豁免普通发射行动的探测器数量上限。
      const result = rocketAbility.launchProbe(context, {
        skipCost: true,
        ignoreRocketLimit: true,
        playerId: player.id,
        source: "initial_company",
      });
      pushResult(results, {
        ...result,
        type: "launch",
        message: result.ok ? `初始发射 ${index + 1}/${target}：${result.message}` : result.message,
      });
    }
  }

  function ensurePlayerTechState(context, player) {
    if (!player) return null;
    if (typeof context?.ensurePlayerTechState === "function") {
      context.ensurePlayerTechState(player);
      return player.techState;
    }
    player.techState = playerTech.createPlayerTechState(player.techState || {});
    return player.techState;
  }

  function applyStartupTech(context, player, tileId, results) {
    if (!tileId) return;
    const techState = ensurePlayerTechState(context, player);
    if (!techState) {
      pushResult(results, { ok: false, type: "startupTech", tileId, message: "缺少玩家科技状态" });
      return;
    }

    const board = context?.tech;
    const supplyResult = board && techBoard?.consumeStartupTileWithoutRewards
      ? techBoard.consumeStartupTileWithoutRewards(board, tileId)
      : { ok: true, skippedBonusId: null, message: "未连接科技供应" };
    if (!supplyResult.ok) {
      pushResult(results, { ...supplyResult, type: "startupTech" });
      return;
    }

    const takeResult = playerTech.recordPlayerTake(techState, tileId, null);
    pushResult(results, {
      ok: takeResult.ok,
      type: "startupTech",
      tileId,
      supply: supplyResult,
      message: takeResult.ok
        ? `开局获得 ${tileId}（不获得 bonus、不领取首拿分、不旋转）`
        : takeResult.message,
    });
  }

  function replaceNextSectorData(context, player, nebulaId) {
    // 统一「替换星云数据为自己」原语：与主行动/卡牌/奖励扫描共用
    // abilities.placeNebulaToken（替换下一可替换槽位，无可替换时追加计数标记）。
    // 初始牌不是扫描行动，直接调原语而非 scanNebula；计分来源记 initialScore、
    // 数据来源记 initial_card，免扫描费、不展开完整扫描队列（初始结算豁免）。
    const result = scanAbility.placeNebulaToken(context, {
      nebulaId,
      playerId: player.id,
      source: "initial_card",
      scoreSourceKey: "initialScore",
    });
    return { ...result, type: "scan" };
  }

  function applySectorScan(context, player, scan, results, events) {
    if (!scan?.nebulaId) return;
    const count = Math.max(0, Math.round(Number(scan.count) || 0));
    for (let index = 0; index < count; index += 1) {
      const result = replaceNextSectorData(context, player, scan.nebulaId);
      pushResult(results, result);
      for (const event of result.events || []) events.push(event);
      if (!result.ok) break;
    }
  }

  function applyOrbitMarker(context, player, planetId, results) {
    if (!planetId) return;
    const result = planetStats.addPlanetOrbitMarker(context.planets, planetId, player);
    if (result.ok) {
      players.incrementPlayerOrbitCount(context.players, player.id);
    }
    pushResult(results, {
      ...result,
      type: "orbit",
      planetId,
      noReward: true,
      message: result.ok
        ? `${planetId} 放置环绕器#${result.marker.sequence}（不获得环绕奖励）`
        : result.message,
    });
  }

  function applyAlienTrace(context, player, trace, results, events) {
    if (!trace || !context.aliens) return;
    const result = aliens.placeFirstTrace(
      context.aliens,
      trace.alienSlotId,
      trace.traceType,
      player.color,
    );
    let revealResult = null;
    if (result.ok && result.readyToReveal) {
      revealResult = aliens.revealAlien(context.aliens, trace.alienSlotId);
    }
    pushResult(results, {
      ...result,
      type: "alienTrace",
      trace,
      revealed: revealResult || null,
      // 扩展规则书 P5：快速起始牌（初始牌）上半部分放置生命迹象不给任何奖励。
      message: revealResult?.ok ? `${result.message}；${revealResult.message}` : result.message,
    });
    if (result.ok) {
      events.push({
        type: "alienTracePlaced",
        alienSlotId: trace.alienSlotId,
        traceType: trace.traceType,
        playerId: player.id,
        reward: null,
      });
    }
  }

  function resolveInitialCardEffect(context, player, card) {
    const number = getInitialCardNumber(card);
    const effect = getInitialCardEffect(number);
    const results = [];
    const events = [];

    if (!player) {
      return { ok: false, cardNumber: number, card, results, events, message: "没有玩家" };
    }
    if (!effect) {
      return { ok: false, cardNumber: number, card, results, events, message: `未知初始牌 ${number || ""}` };
    }

    applyResources(player, effect.resources, results, "initialScore");
    applyIncome(context, player, effect.income, results);
    applyDataGain(context, player, effect.dataGain, results);
    applyBlindDraw(context, player, effect.blindDraw, results);
    applySectorScan(context, player, effect.scan, results, events);
    applyOrbitMarker(context, player, effect.orbitPlanetId, results);
    applyAlienTrace(context, player, effect.alienTrace, results, events);

    const failed = results.filter((result) => !result.ok);
    return {
      ok: failed.length === 0,
      cardNumber: number,
      card,
      effect,
      results,
      events,
      message: failed.length
        ? `初始牌${number}：${failed.map((item) => item.message).join("；")}`
        : `初始牌${number}：${effect.label}`,
    };
  }

  function resolveIndustryEffect(context, player, card) {
    const effect = getEffectiveIndustryEffect(card, player);
    const results = [];
    const events = [];

    if (!player) {
      return { ok: false, card, results, events, incomeIncreaseCount: 0, message: "没有玩家" };
    }
    if (!effect) {
      return {
        ok: false,
        card,
        results,
        events,
        incomeIncreaseCount: 0,
        message: `未知公司牌 ${normalizeIndustryLabel(card)}`,
      };
    }

    resetPlayerStartingResources(player);
    setBaseIncome(player, effect.baseIncome, results);
    applyStartupTech(context, player, effect.startupTechTileId, results);
    applyResources(player, effect.resources, results, "industryEffectScore");
    applyDataGain(context, player, effect.dataGain, results);
    applyBlindDraw(context, player, effect.blindDraw, results);
    applyLaunches(context, player, effect.launchCount, results);

    const failed = results.filter((result) => !result.ok);
    return {
      ok: failed.length === 0,
      card,
      effect,
      results,
      events,
      incomeIncreaseCount: Math.max(0, Math.round(Number(effect.incomeIncreaseCount) || 0)),
      message: failed.length
        ? `${effect.label}：${failed.map((item) => item.message).join("；")}`
        : `${effect.label}：公司初始效果已结算`,
    };
  }

  function resolveInitialSelections(context, options = {}) {
    const sourcePlayerIds = Array.isArray(options.playerIds) && options.playerIds.length
      ? options.playerIds
      : (context?.players?.players || []).map((player) => player.id);
    const originalPlayerId = context?.turn?.currentPlayerId || null;
    const results = [];
    const events = [];
    const pendingIncomeIncreases = [];

    for (const [positionIndex, playerId] of sourcePlayerIds.entries()) {
      const player = getPlayerById(context, playerId);
      const selectedInitialCards = player?.initialSelection?.removedInitialCards || [];
      if (!player) continue;

      context.turn.currentPlayerId = player.id;
      const industryResult = resolveIndustryEffect(context, player, player.initialSelection?.industry);
      results.push(attachPlayerResult(industryResult, player));
      results.push(attachPlayerResult(resolveTurnOrderScoreEffect(player, positionIndex), player));
      if (industryResult.incomeIncreaseCount > 0) {
        pendingIncomeIncreases.push({
          playerId: player.id,
          count: industryResult.incomeIncreaseCount,
          label: industryResult.effect?.label || player.initialSelection?.industry?.label || "公司牌",
        });
      }
      for (const card of selectedInitialCards) {
        const result = resolveInitialCardEffect(context, player, card);
        results.push(attachPlayerResult(result, player));
        for (const event of result.events || []) events.push(event);
      }
    }

    if (context?.players && originalPlayerId) {
      context.turn.currentPlayerId = originalPlayerId;
    }

    const failed = results.filter((result) => !result.ok);
    return {
      ok: failed.length === 0,
      results,
      events,
      pendingIncomeIncreases,
      message: results.length
        ? `初始效果结算 ${results.length} 项${failed.length ? `，失败 ${failed.length}` : ""}`
        : "没有需要结算的初始效果",
    };
  }

  return Object.freeze({
    INITIAL_CARD_COUNT,
    INITIAL_CARD_EFFECTS,
    INDUSTRY_EFFECTS,
    NEBULA_BY_KEY,
    INITIAL_TURN_ORDER_SCORES,
    getInitialCardNumber,
    getInitialCardEffect,
    getInitialTurnOrderScore,
    getIndustryEffect,
    getEffectiveIndustryEffect,
    resolveInitialCardEffect,
    resolveIndustryEffect,
    resolveInitialSelections,
  });
});
