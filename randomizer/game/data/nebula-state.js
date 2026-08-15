(function (root, factory) {
  "use strict";

  let nebulaPlacement = root.SetiNebulaDataPlacement;
  let stateSequences = root.SetiStateSequences;

  if (typeof require === "function") {
    nebulaPlacement = nebulaPlacement || require("./nebula-placement");
    stateSequences = stateSequences || require("../state/sequences");
  }

  const api = factory(nebulaPlacement, stateSequences);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiNebulaDataState = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (nebulaPlacement, stateSequences) {
  "use strict";

  function takeSequence(state, options, key) {
    return stateSequences.take(options?.root, key);
  }
  const AOMOMO_NEBULA_ID = "aomomo";
  const NEBULA_SECOND_SLOT_INDEX = 2;
  const NEBULA_SECOND_SLOT_SCORE = 2;
  const SECTOR_WIN_REWARDS = Object.freeze({
    "sector-1-b": Object.freeze({
      first: Object.freeze([{ resource: "score", amount: 2 }, { traceType: "pink" }]),
      repeat: Object.freeze([{ resource: "score", amount: 5 }]),
    }),
    "sector-4-b": Object.freeze({
      first: Object.freeze([{ resource: "score", amount: 3 }, { traceType: "pink" }]),
      repeat: Object.freeze([{ traceType: "pink" }]),
    }),
    "sector-2-b": Object.freeze({
      first: Object.freeze([{ traceType: "pink" }]),
      repeat: Object.freeze([{ resource: "score", amount: 3 }]),
    }),
    "sector-3-a": Object.freeze({
      first: Object.freeze([{ traceType: "pink" }]),
      repeat: Object.freeze([{ resource: "score", amount: 3 }]),
    }),
    "sector-1-a": Object.freeze({
      first: Object.freeze([{ traceType: "pink" }]),
      repeat: Object.freeze([{ resource: "score", amount: 3 }]),
    }),
    "sector-4-a": Object.freeze({
      first: Object.freeze([{ traceType: "pink" }]),
      repeat: Object.freeze([{ traceType: "pink" }]),
    }),
    "sector-2-a": Object.freeze({
      first: Object.freeze([{ traceType: "pink" }]),
      repeat: Object.freeze([{ traceType: "pink" }]),
    }),
    "sector-3-b": Object.freeze({
      first: Object.freeze([{ traceType: "pink" }]),
      repeat: Object.freeze([{ traceType: "pink" }]),
    }),
  });

  function getSectorWinnerRewardKey(settlement) {
    const config = nebulaPlacement.getSectorWinMarkerConfig?.(settlement?.sectorId);
    return config?.firstKind === "circle" && Number(settlement?.settlementNumber) === 1
      ? "first"
      : "repeat";
  }

  function buildSectorRewardDescriptors(settlement) {
    if (!settlement?.ok) return [];
    if (settlement.sectorId === AOMOMO_NEBULA_ID) {
      return (settlement.participants || []).map((owner) => ({
        kind: "resource",
        owner: { ...owner },
        gain: { aomomoFossils: 1 },
      }));
    }
    const descriptors = (settlement.participants || []).map((owner) => ({
      kind: "resource",
      owner: { ...owner },
      gain: { publicity: 1 },
    }));
    for (const reward of SECTOR_WIN_REWARDS[settlement.sectorId]?.[getSectorWinnerRewardKey(settlement)] || []) {
      descriptors.push(reward.resource
        ? {
          kind: "resource",
          owner: { ...(settlement.winner || {}) },
          gain: { [reward.resource]: reward.amount },
        }
        : {
          kind: "alien_trace",
          owner: { ...(settlement.winner || {}) },
          traceType: reward.traceType,
        });
    }
    return descriptors;
  }

  function getNebulaSecondSlotScoreReward(slotIndex) {
    return Number(slotIndex) === NEBULA_SECOND_SLOT_INDEX ? NEBULA_SECOND_SLOT_SCORE : 0;
  }

  function getNebulaSlotScoreReward(nebulaId, slotIndex) {
    if (nebulaId === AOMOMO_NEBULA_ID) {
      if (Number(slotIndex) === 1) return 1;
      if (Number(slotIndex) === 3) return 2;
      return 0;
    }
    return getNebulaSecondSlotScoreReward(slotIndex);
  }

  function createDefaultNebulaDataState() {
    return {
      nebulae: {},
      sectorExtraMarks: {},
      sectorSettlements: createDefaultSectorSettlementState(),
    };
  }

  function createDefaultSectorSettlementState() {
    return {
      sectors: {},
      winsByPlayerId: {},
    };
  }

  function ensureSectorSettlementState(state) {
    if (!state.sectorSettlements || typeof state.sectorSettlements !== "object") {
      state.sectorSettlements = createDefaultSectorSettlementState();
    }
    if (!state.sectorSettlements.sectors || typeof state.sectorSettlements.sectors !== "object") {
      state.sectorSettlements.sectors = {};
    }
    if (!state.sectorSettlements.winsByPlayerId || typeof state.sectorSettlements.winsByPlayerId !== "object") {
      state.sectorSettlements.winsByPlayerId = {};
    }
    return state.sectorSettlements;
  }

  function ensureSectorSettlementRecord(state, sectorId) {
    const settlements = ensureSectorSettlementState(state);
    const key = normalizeSettlementSectorId(sectorId);
    if (!settlements.sectors[key]) {
      settlements.sectors[key] = {
        sectorId: key,
        settlementCount: 0,
        winners: [],
      };
    }
    if (!Array.isArray(settlements.sectors[key].winners)) {
      settlements.sectors[key].winners = [];
    }
    return settlements.sectors[key];
  }

  function ensureSectorExtraMarkList(state, sectorId) {
    if (!state.sectorExtraMarks || typeof state.sectorExtraMarks !== "object") {
      state.sectorExtraMarks = {};
    }
    const key = normalizeSettlementSectorId(sectorId);
    if (!Array.isArray(state.sectorExtraMarks[key])) {
      state.sectorExtraMarks[key] = [];
    }
    return state.sectorExtraMarks[key];
  }

  function normalizeSettlementSectorId(sectorId) {
    const key = String(sectorId || "");
    return nebulaPlacement.getNebulaCapacity(key) ? key : "";
  }

  function listSettlementSectorIds(sectorIds) {
    const source = Array.isArray(sectorIds) && sectorIds.length
      ? sectorIds
      : nebulaPlacement.NEBULA_IDS;
    return source
      .map(normalizeSettlementSectorId)
      .filter(Boolean);
  }

  function getTokenOwnerColor(token) {
    return token?.replacedByPlayerColor || token?.playerColor || null;
  }

  function deriveNebulaStats(bucket) {
    const counts = {};
    let lastReplacedPlayerId = null;
    let lastReplacedPlayerColor = null;

    for (const token of bucket.tokens || []) {
      const color = getTokenOwnerColor(token);
      if (!color) continue;
      counts[color] = (counts[color] || 0) + 1;
      lastReplacedPlayerId = token.replacedByPlayerId || token.playerId || null;
      lastReplacedPlayerColor = color;
    }

    return {
      playerTokenCounts: counts,
      lastReplacedPlayerId,
      lastReplacedPlayerColor,
    };
  }

  function ensureNebulaBucket(state, nebulaId) {
    if (!state.nebulae[nebulaId]) {
      state.nebulae[nebulaId] = {
        tokens: [],
      };
    } else if (!Array.isArray(state.nebulae[nebulaId].tokens)) {
      state.nebulae[nebulaId].tokens = [];
    }
    return state.nebulae[nebulaId];
  }

  function normalizeNebulaToken(token, nebulaId, index) {
    const slotIndex = Number(token?.slotIndex);
    return {
      id: token?.id || `nebula-data-${nebulaId}-${index + 1}`,
      index: Number.isInteger(token?.index) ? token.index : index + 1,
      nebulaId,
      slotIndex,
      replacedByPlayerId: token?.replacedByPlayerId || token?.playerId || null,
      replacedByPlayerColor: token?.replacedByPlayerColor || token?.playerColor || null,
      replacementOrder: Number.isFinite(Number(token?.replacementOrder)) ? Number(token.replacementOrder) : null,
    };
  }

  function normalizeNebulaDataState(source) {
    const nebulae = {};
    const sourceNebulae = source?.nebulae && typeof source.nebulae === "object" ? source.nebulae : {};
    for (const nebulaId of nebulaPlacement.NEBULA_IDS) {
      const bucket = sourceNebulae[nebulaId];
      if (!bucket) continue;
      const tokens = Array.isArray(bucket.tokens) ? bucket.tokens : [];
      nebulae[nebulaId] = {
        tokens: tokens.map((token, index) => normalizeNebulaToken(token, nebulaId, index)),
      };
    }
    const normalized = {
      nebulae,
      sectorSettlements: createDefaultSectorSettlementState(),
    };
    const sourceSettlements = source?.sectorSettlements;
    if (sourceSettlements && typeof sourceSettlements === "object") {
      normalized.sectorSettlements.sectors = structuredClone(sourceSettlements.sectors || {});
      normalized.sectorSettlements.winsByPlayerId = structuredClone(sourceSettlements.winsByPlayerId || {});
    }
    normalized.sectorExtraMarks = structuredClone(source?.sectorExtraMarks || {});
    return normalized;
  }

  function listNebulaTokens(state, nebulaId) {
    const bucket = state?.nebulae?.[nebulaId];
    return bucket ? [...bucket.tokens] : [];
  }

  function listAllNebulaTokens(state) {
    const all = [];
    for (const nebulaId of nebulaPlacement.NEBULA_IDS) {
      for (const token of listNebulaTokens(state, nebulaId)) {
        all.push(token);
      }
    }
    return all;
  }

  function getNextNebulaDataIndex(state) {
    const all = listAllNebulaTokens(state);
    if (!all.length) return 1;
    return Math.max(...all.map((token) => token.index)) + 1;
  }

  function findOpenNebulaSlotIndex(state, nebulaId) {
    const occupied = new Set(listNebulaTokens(state, nebulaId).map((token) => token.slotIndex));
    const layouts = nebulaPlacement.listNebulaSlotLayouts(nebulaId);
    for (const layout of layouts) {
      if (!occupied.has(layout.slotIndex)) return layout.slotIndex;
    }
    return null;
  }

  function fillNebulaData(state, nebulaId, options = {}) {
    const capacity = nebulaPlacement.getNebulaCapacity(nebulaId);
    if (!capacity) {
      return { ok: false, message: `未知星云 ${nebulaId}` };
    }

    const bucket = ensureNebulaBucket(state, nebulaId);
    const added = [];

    while (bucket.tokens.length < capacity) {
      const slotIndex = findOpenNebulaSlotIndex(state, nebulaId);
      const layout = nebulaPlacement.getNebulaDataSlotLayout(nebulaId, slotIndex);
      if (!slotIndex || !layout) break;

      const sequence = takeSequence(state, options, "nebulaToken");
      const token = normalizeNebulaToken({
        id: `nebula-data-${sequence}`,
        index: getNextNebulaDataIndex(state),
        slotIndex,
      }, nebulaId, bucket.tokens.length);

      bucket.tokens.push(token);
      added.push({ token, layout });
    }

    if (!added.length) {
      return {
        ok: false,
        message: `${nebulaPlacement.getNebulaLabel(nebulaId)} 数据已满（${capacity}/${capacity}）`,
      };
    }

    const label = nebulaPlacement.getNebulaLabel(nebulaId);
    const sourceLabel = options.source === "setup"
        ? "设置填充"
        : "填充";
    const slotLines = added.map(({ token }) =>
      `序号${token.index} 槽位${token.slotIndex}`,
    );

    return {
      ok: true,
      nebulaId,
      added,
      message: `${sourceLabel} ${label} +${added.length}：${slotLines.join("；")}`,
    };
  }

  function fillAllNebulaData(state, options = {}) {
    const results = [];
    for (const nebulaId of nebulaPlacement.NEBULA_IDS) {
      const result = fillNebulaData(state, nebulaId, options);
      if (result.ok) results.push(result);
    }

    if (!results.length) {
      return { ok: false, message: "所有星云数据槽位均已填满" };
    }

    const totalAdded = results.reduce((sum, result) => sum + result.added.length, 0);
    const batchLabel = options.source === "setup" ? "设置填充" : "调试填充";
    return {
      ok: true,
      results,
      totalAdded,
      message: `${batchLabel}星云数据共 ${totalAdded} 个`,
    };
  }

  function clearNebulaData(state, nebulaId) {
    if (nebulaId) {
      if (state.nebulae[nebulaId]) {
        state.nebulae[nebulaId].tokens = [];
      }
      if (state.sectorExtraMarks?.[nebulaId]) {
        state.sectorExtraMarks[nebulaId] = [];
      }
      return;
    }
    state.nebulae = {};
    state.sectorExtraMarks = {};
    state.sectorSettlements = createDefaultSectorSettlementState();
  }

  function getNebulaReplacementStats(state, nebulaId) {
    const bucket = state?.nebulae?.[nebulaId];
    if (!bucket) {
      return {
        playerTokenCounts: {},
        lastReplacedPlayerId: null,
        lastReplacedPlayerColor: null,
      };
    }
    return deriveNebulaStats(bucket);
  }

  function getNextReplaceableNebulaToken(state, nebulaId) {
    return listNebulaTokens(state, nebulaId)
      .filter((token) => !getTokenOwnerColor(token))
      .sort((a, b) => a.slotIndex - b.slotIndex || a.index - b.index)[0] || null;
  }

  function getTokenReplacementRank(token) {
    if (Number.isFinite(Number(token?.replacementOrder))) return Number(token.replacementOrder);
    return 0;
  }

  function addPlayerCountEntry(countsByPlayer, mark) {
    const color = mark?.replacedByPlayerColor || mark?.playerColor || null;
    if (!color) return;
    const key = mark.replacedByPlayerId || mark.playerId || color;
    const rank = getTokenReplacementRank(mark);
    if (!countsByPlayer[key]) {
      countsByPlayer[key] = {
        playerKey: key,
        playerId: mark.replacedByPlayerId || mark.playerId || null,
        playerColor: color,
        playerLabel: color,
        count: 0,
        latestReplacementOrder: rank,
      };
    }
    countsByPlayer[key].count += 1;
    if (rank >= countsByPlayer[key].latestReplacementOrder) {
      countsByPlayer[key].latestReplacementOrder = rank;
      countsByPlayer[key].playerId = mark.replacedByPlayerId || mark.playerId || countsByPlayer[key].playerId;
      countsByPlayer[key].playerColor = color;
      countsByPlayer[key].playerLabel = color;
    }
  }

  function listSectorExtraMarks(state, sectorId) {
    const key = normalizeSettlementSectorId(sectorId);
    const marks = state?.sectorExtraMarks?.[key];
    return Array.isArray(marks) ? [...marks] : [];
  }

  function getSectorTokenStats(state, sectorId) {
    const countsByPlayer = {};
    const nebulaId = normalizeSettlementSectorId(sectorId);
    if (!nebulaId) return countsByPlayer;

    for (const token of listNebulaTokens(state, nebulaId)) {
      addPlayerCountEntry(countsByPlayer, token);
    }
    for (const mark of listSectorExtraMarks(state, nebulaId)) {
      addPlayerCountEntry(countsByPlayer, mark);
    }

    return countsByPlayer;
  }

  function addSectorExtraMark(state, sectorId, player, options = {}) {
    if (!player) {
      return { ok: false, message: "没有当前玩家" };
    }
    const normalizedSectorId = normalizeSettlementSectorId(sectorId);
    if (!normalizedSectorId) {
      return { ok: false, message: `未知扇区 ${sectorId}` };
    }

    const replacementSequence = takeSequence(state, options, "nebulaReplacement");
    const playerColor = options.playerColor || player.color || null;
    const mark = {
      id: options.id || `sector-extra-mark-${normalizedSectorId}-${replacementSequence}`,
      sectorId: normalizedSectorId,
      replacedByPlayerId: player.id || null,
      replacedByPlayerColor: playerColor,
      replacementOrder: options.replacementOrder || replacementSequence,
    };
    ensureSectorExtraMarkList(state, normalizedSectorId).push(mark);
    return {
      ok: true,
      sectorId: normalizedSectorId,
      extra: true,
      mark,
      player,
      stats: getSectorTokenStats(state, normalizedSectorId),
      message: `扇区${normalizedSectorId} 额外标记已添加为${playerColor || "玩家"}token`,
    };
  }

  function removeSectorExtraMark(state, sectorId, markId) {
    const key = normalizeSettlementSectorId(sectorId);
    const marks = state?.sectorExtraMarks?.[key];
    if (!Array.isArray(marks)) return { ok: false, message: `扇区${sectorId}没有额外标记` };
    const index = marks.findIndex((mark) => mark.id === markId);
    if (index < 0) return { ok: false, message: `未找到额外标记 ${markId}` };
    const [mark] = marks.splice(index, 1);
    return { ok: true, sectorId: key, mark };
  }

  function isSectorReadyToSettle(state, sectorId) {
    const nebulaId = normalizeSettlementSectorId(sectorId);
    if (!nebulaId) return false;
    const capacity = nebulaPlacement.getNebulaCapacity(nebulaId);
    const tokens = listNebulaTokens(state, nebulaId);
    if (!capacity || tokens.length !== capacity) return false;
    if (tokens.some((token) => !getTokenOwnerColor(token))) return false;
    return true;
  }

  function hasFirstWinCircle(sectorId) {
    return nebulaPlacement.getSectorWinMarkerConfig?.(sectorId)?.firstKind === "circle";
  }

  function getSettlementWinMarkerSlot(sectorId, settlementNumber) {
    const normalizedSectorId = normalizeSettlementSectorId(sectorId);
    const index = Math.max(1, Math.round(Number(settlementNumber) || 1));
    if (hasFirstWinCircle(normalizedSectorId) && index === 1) {
      return { slotKind: "circle", markerIndex: 1 };
    }
    return {
      slotKind: "bar",
      markerIndex: hasFirstWinCircle(normalizedSectorId) ? Math.max(1, index - 1) : index,
    };
  }

  function createRetainedSectorToken(state, nebulaId, participant, options = {}) {
    const layout = nebulaPlacement.getNebulaDataSlotLayout(nebulaId, 1);
    if (!layout || !participant) return null;

    const tokenSequence = takeSequence(state, options, "nebulaToken");
    return normalizeNebulaToken({
      id: `nebula-data-${tokenSequence}`,
      index: getNextNebulaDataIndex(state),
      slotIndex: 1,
      replacedByPlayerId: participant.playerId,
      replacedByPlayerColor: participant.playerColor,
      replacementOrder: participant.latestReplacementOrder,
    }, nebulaId, 0);
  }

  function resetSectorNebulaData(state, sectorId, retainedParticipant, options = {}) {
    const nebulaId = normalizeSettlementSectorId(sectorId);
    if (!nebulaId) return [];
    const bucket = ensureNebulaBucket(state, nebulaId);
    bucket.tokens = [];
    if (state.sectorExtraMarks) {
      state.sectorExtraMarks[nebulaId] = [];
    }

    if (retainedParticipant) {
      const token = createRetainedSectorToken(state, nebulaId, retainedParticipant, options);
      if (token) {
        bucket.tokens.push(token);
      }
    }

    const fillResults = [];
    const fillResult = fillNebulaData(state, nebulaId, {
      source: options.source || "sectorSettlement",
      root: options.root,
    });
    if (fillResult.ok) fillResults.push(fillResult);
    return fillResults;
  }

  function getSectorRanking(state, sectorId) {
    return Object.values(getSectorTokenStats(state, sectorId))
      .sort((a, b) => (
        b.count - a.count
        || b.latestReplacementOrder - a.latestReplacementOrder
        || String(a.playerKey).localeCompare(String(b.playerKey))
      ));
  }

  function orderSectorIdsByPlayerWinPriority(state, sectorIds, player) {
    const playerKeys = new Set([
      player?.id,
      player?.color,
    ].filter(Boolean).map(String));
    return (sectorIds || [])
      .map((sectorId, index) => {
        const normalizedSectorId = normalizeSettlementSectorId(sectorId);
        const winner = normalizedSectorId === AOMOMO_NEBULA_ID
          ? null
          : getSectorRanking(state, normalizedSectorId)[0] || null;
        const wonByPlayer = Boolean(winner && [
          winner.playerId,
          winner.playerKey,
          winner.playerColor,
        ].filter(Boolean).some((key) => playerKeys.has(String(key))));
        return { sectorId, index, wonByPlayer };
      })
      .sort((left, right) => Number(right.wonByPlayer) - Number(left.wonByPlayer) || left.index - right.index)
      .map((entry) => entry.sectorId);
  }

  function settleSector(state, sectorId, options = {}) {
    const normalizedSectorId = normalizeSettlementSectorId(sectorId);
    if (!isSectorReadyToSettle(state, normalizedSectorId)) {
      return {
        ok: false,
        sectorId: normalizedSectorId || sectorId,
        message: `扇区${sectorId}尚未满足结算条件`,
      };
    }

    const ranking = getSectorRanking(state, normalizedSectorId);
    const participants = ranking.filter((item) => item.count > 0);
    const winner = participants[0] || null;
    const second = participants[1] || null;
    if (!winner) {
      return {
        ok: false,
        sectorId: normalizedSectorId,
        message: `扇区${sectorId}没有玩家标记`,
      };
    }

    if (normalizedSectorId === AOMOMO_NEBULA_ID) {
      const sectorRecord = ensureSectorSettlementRecord(state, normalizedSectorId);
      sectorRecord.settlementCount += 1;
      const settlementNumber = sectorRecord.settlementCount;
      const fillResults = resetSectorNebulaData(state, normalizedSectorId, null, options);

      return {
        ok: true,
        sectorId: normalizedSectorId,
        settlementNumber,
        winner: null,
        second: null,
        participants,
        fillResults,
        message: `${nebulaPlacement.getNebulaLabel(normalizedSectorId)}第${settlementNumber}次结算：参与玩家各获得1化石`,
      };
    }

    const sectorRecord = ensureSectorSettlementRecord(state, normalizedSectorId);
    sectorRecord.settlementCount += 1;
    const settlementNumber = sectorRecord.settlementCount;
    const markerSlot = getSettlementWinMarkerSlot(normalizedSectorId, settlementNumber);
    const winnerRecord = {
      sectorId: normalizedSectorId,
      settlementNumber,
      playerId: winner.playerId,
      playerColor: winner.playerColor,
      slotKind: markerSlot.slotKind,
      markerIndex: markerSlot.markerIndex,
    };
    sectorRecord.winners.push(winnerRecord);
    const winnerKey = winner.playerId || winner.playerColor;
    const settlements = ensureSectorSettlementState(state);
    if (!settlements.winsByPlayerId[winnerKey]) settlements.winsByPlayerId[winnerKey] = [];
    settlements.winsByPlayerId[winnerKey].push({
      sectorId: normalizedSectorId,
      settlementNumber,
    });

    const fillResults = resetSectorNebulaData(state, normalizedSectorId, second, options);

    return {
      ok: true,
      sectorId: normalizedSectorId,
      settlementNumber,
      winner,
      second,
      participants,
      fillResults,
      message: `${nebulaPlacement.getNebulaLabel(normalizedSectorId)}第${settlementNumber}次结算：${winner.playerLabel}获胜`
        + (second ? `，${second.playerLabel}保留1枚标记` : "，无第二名保留标记"),
    };
  }

  function settleCompletedSectors(state, options = {}) {
    const settlements = [];
    for (const sectorId of listSettlementSectorIds(options.sectorIds)) {
      if (!isSectorReadyToSettle(state, sectorId)) continue;
      const result = settleSector(state, sectorId, options);
      if (result.ok) settlements.push(result);
    }

    return {
      ok: settlements.length > 0,
      settlements,
      message: settlements.length
        ? settlements.map((item) => item.message).join("；")
        : "没有需要结算的扇区",
    };
  }

  function listSectorWinRecords(state, sectorId) {
    const key = normalizeSettlementSectorId(sectorId);
    const winners = state?.sectorSettlements?.sectors?.[key]?.winners;
    return Array.isArray(winners) ? winners.map((winner) => ({ ...winner })) : [];
  }

  function replaceNextNebulaDataToken(state, nebulaId, player, options = {}) {
    const capacity = nebulaPlacement.getNebulaCapacity(nebulaId);
    if (!capacity) {
      return { ok: false, message: `未知星云 ${nebulaId}` };
    }

    if (!player) {
      return { ok: false, message: "没有当前玩家" };
    }

    const bucket = ensureNebulaBucket(state, nebulaId);
    if (!bucket.tokens.length) {
      return {
        ok: false,
        message: `${nebulaPlacement.getNebulaLabel(nebulaId)} 没有可替换的数据`,
      };
    }

    const next = getNextReplaceableNebulaToken(state, nebulaId);
    if (!next) {
      return {
        ok: false,
        message: `${nebulaPlacement.getNebulaLabel(nebulaId)} 已没有未替换的数据`,
      };
    }

    const token = bucket.tokens.find((item) => item.id === next.id);
    const playerColor = options.playerColor || player.color || null;
    const playerLabel = options.playerLabel || player.colorLabel || player.name || playerColor || "玩家";
    token.replacedByPlayerId = player.id || null;
    token.replacedByPlayerColor = playerColor;
    const replacementSequence = takeSequence(state, options, "nebulaReplacement");
    token.replacementOrder = options.replacementOrder || replacementSequence;

    const label = nebulaPlacement.getNebulaLabel(nebulaId);
    const scoreReward = getNebulaSlotScoreReward(nebulaId, token.slotIndex);
    if (scoreReward && options.awardSecondSlotScore !== false) {
      if (!player.resources) player.resources = {};
      player.resources.score = (Number(player.resources.score) || 0) + scoreReward;
    }
    return {
      ok: true,
      nebulaId,
      token,
      slotIndex: token.slotIndex,
      secondSlotScore: scoreReward,
      scoreAwarded: options.awardSecondSlotScore === false ? 0 : scoreReward,
      player,
      stats: getNebulaReplacementStats(state, nebulaId),
      message: `${label} 槽位${token.slotIndex} 数据已替换为${playerLabel}token`
        + (scoreReward ? `；槽位${token.slotIndex} +${scoreReward}分` : ""),
    };
  }

  return Object.freeze({
    AOMOMO_NEBULA_ID,
    SECTOR_WIN_REWARDS,
    getSectorWinnerRewardKey,
    buildSectorRewardDescriptors,
    NEBULA_SECOND_SLOT_INDEX,
    NEBULA_SECOND_SLOT_SCORE,
    getNebulaSecondSlotScoreReward,
    getNebulaSlotScoreReward,
    createDefaultNebulaDataState,
    createDefaultSectorSettlementState,
    normalizeNebulaDataState,
    listNebulaTokens,
    listAllNebulaTokens,
    fillNebulaData,
    fillAllNebulaData,
    clearNebulaData,
    addSectorExtraMark,
    removeSectorExtraMark,
    listSectorExtraMarks,
    isSectorReadyToSettle,
    getSectorTokenStats,
    getSectorRanking,
    orderSectorIdsByPlayerWinPriority,
    getSettlementWinMarkerSlot,
    listSectorWinRecords,
    settleSector,
    settleCompletedSectors,
    getNebulaReplacementStats,
    getNextReplaceableNebulaToken,
    replaceNextNebulaDataToken,
  });
});
