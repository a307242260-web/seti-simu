(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiFinalReadModel = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-final-read-model-v1";
  const TILE_IDS = Object.freeze(["a", "b", "c", "d"]);
  const FORMULA_IDS = Object.freeze(["a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2"]);
  const TRACE_TYPES = Object.freeze(["yellow", "pink", "blue"]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function number(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function getNextSlotIndex(tile) {
    const marks = tile?.marks || [];
    if (!marks.some((mark) => Number(mark?.slotIndex) === 1)) return 1;
    if (!marks.some((mark) => Number(mark?.slotIndex) === 2)) return 2;
    return 3;
  }

  function listPlayers(state) {
    return Array.isArray(state?.players?.players) ? state.players.players : [];
  }

  function createRuleContext(state, context) {
    const players = { ...(state?.players || {}), players: listPlayers(state) };
    const pieces = state?.pieces || {};
    const probeLocationData = context.buildProbeLocationIndex?.(
      pieces,
      state?.solarSystem || {},
    ) || { index: {}, details: [] };
    return {
      solarSystem: state?.solarSystem || {},
      players: players,
      cards: state?.cards || {},
      pieces: pieces,
      planets: state?.planets || {},
      data: state?.data || {},
      aliens: state?.aliens || {},
      finalScoring: state?.finalScoring || {},
      tech: state?.tech || {},
      turn: state?.turn || {},
      matchState: state?.match || {},
      roundNumber: state?.turn?.roundNumber ?? state?.turn?.round ?? 1,
      turnNumber: state?.turn?.turnNumber ?? state?.turn?.turn ?? 1,
      plutoMarkers: context.collectPlutoMarkers?.(players) || [],
      probeLocations: probeLocationData.index || {},
      probeLocationDetails: probeLocationData.details || [],
      cardEffects: context.cardEffects,
      getCardTypeCode: context.getCardTypeCode,
      getPlayerCompanyBaseIncome: context.getPlayerCompanyBaseIncome,
    };
  }

  function createPlayerMetrics(player, ruleContext, context) {
    const endGameScoring = context.endGameScoring;
    const getCardTypeCode = context.getCardTypeCode;
    const reservedCards = Array.isArray(player?.reservedCards) ? player.reservedCards : [];
    const hand = Array.isArray(player?.hand) ? player.hand : [];
    const countOpenTasks = (card) => {
      const model = context.cardEffects?.getCardModel?.(card) || null;
      const completed = new Set(card?.cardEffectState?.completedTaskIds || []);
      return (model?.tasks || []).filter((task) => task?.id && !completed.has(task.id)).length;
    };
    const traceCounts = Object.fromEntries(TRACE_TYPES.map((traceType) => [
      traceType,
      Math.max(0, Math.round(number(endGameScoring.countTraceMarkers(
        player,
        ruleContext.aliens,
        traceType,
      )))),
    ]));
    const techCounts = Object.fromEntries(["orange", "purple", "blue"].map((techType) => [
      techType,
      Math.max(0, Math.round(number(endGameScoring.countOwnedTech(player, techType)))),
    ]));
    return {
      completedTaskCount: Math.max(0, Math.round(number(player?.completedTaskCount))),
      reservedTaskCount: reservedCards.reduce((total, card) => total + countOpenTasks(card), 0),
      handTaskCount: hand.reduce((total, card) => total + countOpenTasks(card), 0),
      type3Reserved: Math.max(0, Math.round(number(endGameScoring.countType3Cards(player, getCardTypeCode)))),
      type3InHand: hand.reduce((total, card) => (
        total + (Math.round(number(getCardTypeCode?.(card))) === 3 ? 1 : 0)
      ), 0),
      traceCounts,
      techCounts,
      orbitLandCount: Math.max(0, Math.round(number(endGameScoring.countOrbitOrLandMarkers(
        player,
        ruleContext.planets,
        ruleContext,
      )))),
      sectorWins: Math.max(0, Math.round(number(endGameScoring.countSectorWins(
        player,
        ruleContext.data,
      )))),
    };
  }

  function createFinalReadModelOwner(context = {}) {
    const { endGameScoring, finalScoring } = context;
    if (!endGameScoring?.computePlayerFinalScore || !finalScoring?.canMarkTile) {
      throw new TypeError("FinalReadModel owner 缺少终局规则模块");
    }

    function project(state) {
      if (!state || typeof state !== "object" || Array.isArray(state)) {
        throw new TypeError("FinalReadModel owner 需要 StateSource state");
      }
      const ruleContext = createRuleContext(state, context);
      const players = listPlayers(state);
      const finalState = ruleContext.finalScoring;
      const thresholds = Array.isArray(finalState.thresholds)
        ? finalState.thresholds.map(number)
        : [...(finalScoring.FINAL_SCORE_THRESHOLDS || [])];
      const playerViews = [];
      const pendingByPlayerId = {};
      const claimedThresholdsByPlayerId = {};
      const candidatesByPlayerId = {};

      for (const player of players) {
        const playerId = String(player?.id || player?.color || "");
        if (!playerId) continue;
        const metrics = createPlayerMetrics(player, ruleContext, context);
        const breakdown = endGameScoring.computePlayerFinalScore({
          ...ruleContext,
          currentPlayer: player,
        });
        const pending = finalScoring.getPendingMarksForPlayer(finalState, player).map((entry) => ({
          id: entry.id || null,
          playerId,
          threshold: number(entry.threshold),
        }));
        const claimedThresholds = (finalScoring.listMarks(finalState) || [])
          .filter((mark) => String(mark?.playerId) === playerId)
          .map((mark) => number(mark.threshold));
        pendingByPlayerId[playerId] = pending;
        claimedThresholdsByPlayerId[playerId] = claimedThresholds;
        candidatesByPlayerId[playerId] = {};

        for (const tileId of TILE_IDS) {
          const availability = finalScoring.canMarkTile(finalState, tileId, player);
          const variant = finalScoring.getTileVariant(finalState, tileId);
          const formulaId = endGameScoring.getFormulaId(tileId, variant);
          const slotIndex = availability.ok
            ? availability.slotIndex
            : getNextSlotIndex(finalState.tiles?.[tileId]);
          const baseValue = Math.max(0, number(endGameScoring.getFormulaBaseValue(
            formulaId,
            player,
            ruleContext,
            {
              getCardTypeCode: context.getCardTypeCode,
              getPlayerCompanyBaseIncome: context.getPlayerCompanyBaseIncome,
            },
          )));
          const multiplier = Math.max(0, number(endGameScoring.getSlotMultiplier(formulaId, slotIndex)));
          candidatesByPlayerId[playerId][tileId] = {
            tileId,
            variant,
            formulaId,
            available: Boolean(availability.ok),
            reason: availability.ok ? null : (availability.message || "不可标记"),
            slotIndex,
            baseValue,
            multiplier,
            immediateScore: baseValue * multiplier,
          };
        }

        playerViews.push({
          id: playerId,
          color: player?.color || null,
          colorLabel: player?.name || player?.id || null,
          name: player?.name || null,
          score: number(player?.resources?.score),
          publicity: number(player?.resources?.publicity),
          industryId: player?.industryCard?.id || null,
          industryLabel: player?.industryCard?.label || null,
          passed: Boolean(state?.turn?.passedPlayerIds?.includes(playerId)),
          scoreSources: clone(player?.scoreSources || {}),
          metrics,
          breakdown: clone(breakdown),
        });
      }

      const turn = {
        roundNumber: number(state?.turn?.roundNumber ?? state?.turn?.round ?? 1),
        turnNumber: number(state?.turn?.turnNumber ?? state?.turn?.turn ?? 1),
        displayedTurnNumber: Math.floor((
          Math.max(1, number(state?.turn?.turnNumber ?? state?.turn?.turn ?? 1)) - 1
        ) / Math.max(1, state?.turn?.activePlayerIds?.length || players.length || 1)) + 1,
        actionCycleNumber: number(state?.turn?.actionCycleNumber ?? state?.turn?.actionCycle ?? 1),
        currentPlayerId: state?.turn?.currentPlayerId ?? null,
        activePlayerIds: clone(state?.turn?.activePlayerIds || []),
        passedPlayerIds: clone(state?.turn?.passedPlayerIds || []),
        completedTurnPlayerIds: clone(state?.turn?.completedTurnPlayerIds || []),
        gameEnded: Boolean(state?.turn?.gameEnded),
        gameEndReason: state?.turn?.gameEndReason || null,
      };
      const tiles = Object.fromEntries(TILE_IDS.map((tileId) => [
        tileId,
        {
          id: tileId,
          variant: finalScoring.getTileVariant(finalState, tileId),
          marks: clone(finalState.tiles?.[tileId]?.marks || []),
        },
      ]));

      return deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        turn,
        players: playerViews,
        finalBoard: {
          thresholds,
          tiles,
          formulaMultipliers: Object.fromEntries(FORMULA_IDS.map((formulaId) => [
            formulaId,
            Object.fromEntries([1, 2, 3].map((slotIndex) => [
              slotIndex,
              number(endGameScoring.getSlotMultiplier(formulaId, slotIndex)),
            ])),
          ])),
          pendingByPlayerId,
          claimedThresholdsByPlayerId,
          markedTileIdsByPlayerId: Object.fromEntries(playerViews.map((player) => [
            player.id,
            TILE_IDS.filter((tileId) => (
              finalState.tiles?.[tileId]?.marks?.some((mark) => String(mark?.playerId) === player.id)
            )),
          ])),
          legalTilesByPlayerId: Object.fromEntries(Object.entries(candidatesByPlayerId).map(
            ([playerId, candidates]) => [
              playerId,
              Object.fromEntries(Object.entries(candidates).map(([tileId, candidate]) => [
                tileId,
                {
                  ok: candidate.available,
                  reason: candidate.reason,
                  slotIndex: candidate.slotIndex,
                },
              ])),
            ],
          )),
        },
        candidatesByPlayerId,
        revealFlags: {
          jiuzhe: Boolean(state?.aliens?.jiuzhe?.revealInitialized),
          runezu: Boolean(state?.aliens?.runezu?.revealInitialized),
        },
      });
    }

    return Object.freeze({ project });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    TILE_IDS,
    FORMULA_IDS,
    TRACE_TYPES,
    createFinalReadModelOwner,
  });
});
