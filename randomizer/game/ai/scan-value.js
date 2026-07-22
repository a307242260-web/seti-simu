(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIScanValue = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createScanValue(context = {}) {
    const {
      solar,
      players,
      rocketActions,
      endGameScoring,
      abilities,
      actions,
      scanEffects,
      cardEffects,
      data,
      aomomo,
      solarState,
      nebulaDataState,
      turnState,
      planetStatsState,
      cardState,
      FINAL_ROUND_NUMBER,
      AI_RESOURCE_VALUES,
      AI_DIFFICULTY_WEAK_START,
    } = context;
    const aiNumber = (...args) => context.aiNumber(...args);
    const applyAiStrategyWeight = (...args) => context.applyAiStrategyWeight(...args);
    const buildSectorScanChoicesForX = (...args) => context.buildSectorScanChoicesForX(...args);
    const buildSectorScanChoicesForXs = (...args) => context.buildSectorScanChoicesForXs(...args);
    const canAiPlanetAcceptLanding = (...args) => context.canAiPlanetAcceptLanding(...args);
    const canAiPlanetAcceptOrbit = (...args) => context.canAiPlanetAcceptOrbit(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const countAiStandardScansThisRound = (...args) => context.countAiStandardScansThisRound(...args);
    const countAiTraceMarkersForPlayer = (...args) => context.countAiTraceMarkersForPlayer(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const getAiAomomoFossilUnitValue = (...args) => context.getAiAomomoFossilUnitValue(...args);
    const getAiLiveScorePaceDeficit = (...args) => context.getAiLiveScorePaceDeficit(...args);
    const getAiMapDemand = (...args) => context.getAiMapDemand(...args);
    const getAiMarkedFinalFormulaEntries = (...args) => context.getAiMarkedFinalFormulaEntries(...args);
    const getAiMoveCountThisTurn = (...args) => context.getAiMoveCountThisTurn(...args);
    const getAiMovePaymentCards = (...args) => context.getAiMovePaymentCards(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiPlanningFinalFormulaEntries = (...args) => context.getAiPlanningFinalFormulaEntries(...args);
    const getAiRequiredMovePointsFromCoordinate = (...args) => context.getAiRequiredMovePointsFromCoordinate(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiSectorDistance = (...args) => context.getAiSectorDistance(...args);
    const getAiStrategyDemand = (...args) => context.getAiStrategyDemand(...args);
    const getAiStrategyWeight = (...args) => context.getAiStrategyWeight(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getEarthSectorCoordinate = (...args) => context.getEarthSectorCoordinate(...args);
    const getMovableTokensForPlayer = (...args) => context.getMovableTokensForPlayer(...args);
    const getPlanetSectorCoordinate = (...args) => context.getPlanetSectorCoordinate(...args);
    const getPublicScanChoicesForCard = (...args) => context.getPublicScanChoicesForCard(...args);
    const hasAiAnalyzeReadyDataSlot = (...args) => context.hasAiAnalyzeReadyDataSlot(...args);
    const listAiMoveCandidates = (...args) => context.listAiMoveCandidates(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiAomomoFossilPlanBonus = (...args) => context.scoreAiAomomoFossilPlanBonus(...args);
    const scoreAiCardCornerOpportunity = (...args) => context.scoreAiCardCornerOpportunity(...args);
    const scoreAiEarlyScanEngineValue = (...args) => context.scoreAiEarlyScanEngineValue(...args);
    const scoreAiHighScorePushValue = (...args) => context.scoreAiHighScorePushValue(...args);
    const scoreAiLaunchAction = (...args) => context.scoreAiLaunchAction(...args);
    const scoreAiLowEngineCatchupValue = (...args) => context.scoreAiLowEngineCatchupValue(...args);
    const scoreAiMidgameResourceContinuationValue = (...args) => context.scoreAiMidgameResourceContinuationValue(...args);
    const scoreAiPlanetTarget = (...args) => context.scoreAiPlanetTarget(...args);
    const scoreAiPlayCardValue = (...args) => context.scoreAiPlayCardValue(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const scoreAiResourceReservePenaltyForCost = (...args) => context.scoreAiResourceReservePenaltyForCost(...args);
    const scoreAiRunezuSourceSymbolValue = (...args) => context.scoreAiRunezuSourceSymbolValue(...args);
    const sumAiDemandMap = (...args) => context.sumAiDemandMap(...args);

    function getAiAvailableDataRoom(player = getCurrentPlayer()) {
      const limit = Math.max(0, Math.round(aiNumber(players.RESOURCE_LIMITS?.availableData) || 6));
      return Math.max(0, limit - Math.max(0, Math.round(aiNumber(player?.resources?.availableData))));
    }

    function aiTokenBelongsToPlayer(token, player = getCurrentPlayer()) {
      if (!token || !player) return false;
      const tokenPlayerId = token.replacedByPlayerId || token.playerId || null;
      const tokenColor = token.replacedByPlayerColor || token.playerColor || null;
      return (tokenPlayerId && tokenPlayerId === player.id)
        || (tokenColor && tokenColor === player.color);
    }

    function aiTokenHasOwner(token) {
      return Boolean(token?.replacedByPlayerColor || token?.playerColor || token?.replacedByPlayerId || token?.playerId);
    }

    function getAiNebulaSignalCounts(nebulaId, player = getCurrentPlayer()) {
      const tokens = data.listNebulaTokens(nebulaDataState, nebulaId);
      const extraMarks = typeof data.listSectorExtraMarks === "function"
        ? data.listSectorExtraMarks(nebulaDataState, nebulaId)
        : [];
      const openCount = tokens.filter((token) => !aiTokenHasOwner(token)).length;
      const ownCount = [...tokens, ...extraMarks]
        .filter((token) => aiTokenBelongsToPlayer(token, player))
        .length;
      const maxOtherCount = Object.values(data.getSectorTokenStats?.(nebulaDataState, nebulaId) || {})
        .filter((entry) => entry.playerId !== player?.id && entry.playerColor !== player?.color)
        .reduce((best, entry) => Math.max(best, Math.max(0, Math.round(aiNumber(entry.count)))), 0);
      return {
        tokens,
        extraMarks,
        openCount,
        ownCount,
        markedCount: tokens.length - openCount + extraMarks.length,
        maxOtherCount,
      };
    }

    function getAiB2FormulaEntries(player = getCurrentPlayer(), options = {}) {
      if (!player) return [];
      const entries = options.requireMarked
        ? getAiMarkedFinalFormulaEntries(player)
        : getAiPlanningFinalFormulaEntries(player, ["b2"]);
      return (entries || []).filter((entry) => entry?.formulaId === "b2");
    }

    function getAiB2SectorBottleneck(player = getCurrentPlayer(), options = {}) {
      if (!player || !endGameScoring?.countSectorWins || !endGameScoring?.countOrbitOrLandMarkers) {
        return { active: false, sectorWins: 0, orbitLandCount: 0, deficit: 0, multiplier: 0, marked: false };
      }
      const entries = getAiB2FormulaEntries(player, options);
      if (!entries.length) {
        return { active: false, sectorWins: 0, orbitLandCount: 0, deficit: 0, multiplier: 0, marked: false };
      }
      const context = createActionContext();
      const sectorWins = Math.max(0, Math.round(aiNumber(endGameScoring.countSectorWins(player, nebulaDataState))));
      const orbitLandCount = Math.max(0, Math.round(aiNumber(
        endGameScoring.countOrbitOrLandMarkers(player, planetStatsState, context),
      )));
      const deficit = Math.max(0, orbitLandCount - sectorWins);
      const multiplier = Math.min(
        10,
        entries.reduce((total, entry) => total + Math.max(0, aiNumber(entry.multiplier)), 0),
      );
      const marked = entries.some((entry) => !entry.potential);
      return {
        active: deficit > 0 && multiplier > 0,
        sectorWins,
        orbitLandCount,
        deficit,
        multiplier,
        marked,
      };
    }

    function scoreAiB2SectorScanRecoveryValue(player = getCurrentPlayer(), options = {}) {
      const bottleneck = getAiB2SectorBottleneck(player, options);
      if (!bottleneck.active) return 0;
      const round = getAiRoundNumber();
      const finalRound = round >= FINAL_ROUND_NUMBER;
      const markedScale = bottleneck.marked ? 1 : 0.55;
      const noSectorWinPressure = bottleneck.sectorWins <= 0 ? bottleneck.multiplier * 0.55 : 0;
      const deficitPressure = Math.min(4, bottleneck.deficit) * (finalRound ? 2.1 : 1.25);
      const base = bottleneck.multiplier * (finalRound ? 1.15 : 0.72)
        + noSectorWinPressure
        + deficitPressure
        + (options.trade ? 3.5 : 0)
        + (options.mainAction ? 2.5 : 0);
      return roundAiScore(Math.min(options.cap ?? 34, Math.max(0, base * markedScale)));
    }

    function getAiBestB2WinningScanPreviewChoice(scanCandidate, options = {}) {
      const requireMarked = options.requireMarked !== false;
      return (scanCandidate?.targetPreview?.topChoices || [])
        .filter((choice) => (
          (!requireMarked || choice?.b2?.marked)
          && choice?.b2?.active
          && choice?.b2?.winsAfterScan
          && Math.max(0, aiNumber(choice.directScoreGain)) >= 2
        ))
        .sort((left, right) => (
          aiNumber(right.score) - aiNumber(left.score)
          || aiNumber(right.directScoreGain) - aiNumber(left.directScoreGain)
        ))[0] || null;
    }

    function isAiFixedNebulaScanPlayCandidate(candidate) {
      const effectTypes = candidate?.effectTypes || [];
      if (!effectTypes.includes(cardEffects.EFFECT_TYPES.SCAN_NEBULA)) return false;
      return !effectTypes.some((type) => (
        type === cardEffects.EFFECT_TYPES.SCAN_ACTION
        || type === cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE
        || type === cardEffects.EFFECT_TYPES.PUBLIC_SCAN
        || type === cardEffects.EFFECT_TYPES.HAND_SCAN
        || type === cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN
        || type === cardEffects.EFFECT_TYPES.PROBE_SECTOR_SCAN
      ));
    }

    function scoreAiWeakFinalB2TargetedScanTieBreak(player, scanCandidate, playCardCandidate) {
      if (!player || player.aiDifficulty !== AI_DIFFICULTY_WEAK_START) return 0;
      if (getAiRoundNumber() < FINAL_ROUND_NUMBER) return 0;
      if (countAiFinalMarksForPlayer(player) < 3) return 0;
      if (!scanCandidate || scanCandidate.available === false || !playCardCandidate || playCardCandidate.available === false) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore < 70 || currentScore > 115) return 0;
      if (Math.max(0, aiNumber(scanCandidate.directScoreGain)) < 2) return 0;
      if (aiNumber(scanCandidate.score) < aiNumber(playCardCandidate.score) - 1) return 0;
      const bestB2Choice = getAiBestB2WinningScanPreviewChoice(scanCandidate);
      if (!bestB2Choice) return 0;
      const bestPlayCard = (playCardCandidate.playableCards || [])
        .filter((candidate) => candidate?.available !== false)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score))[0] || null;
      if (!isAiFixedNebulaScanPlayCandidate(bestPlayCard)) return 0;
      const breakdown = bestPlayCard.valueBreakdown || {};
      if (Math.max(0, aiNumber(bestPlayCard.directScoreGain)) > 0) return 0;
      const concreteCardValue = Math.max(
        0,
        aiNumber(breakdown.c2Type3ProgressValue),
        aiNumber(breakdown.cFinalTaskProgressValue),
        aiNumber(breakdown.endGameExpectedScore),
        aiNumber(breakdown.standardActionPremium),
        aiNumber(breakdown.planScore),
      );
      if (concreteCardValue > 6) return 0;
      const b2 = bestB2Choice.b2 || {};
      const value = 0.85
        + Math.min(0.55, Math.max(0, aiNumber(b2.deficit)) * 0.18)
        + Math.min(0.35, Math.max(0, aiNumber(bestB2Choice.directScoreGain)) * 0.12);
      return roundAiScore(Math.min(1.6, value));
    }

    function scoreAiWeakEarlyB2SetupScanTieBreak(player, scanCandidate, researchTechCandidate) {
      if (!player || player.aiDifficulty !== AI_DIFFICULTY_WEAK_START) return 0;
      if (getAiRoundNumber() !== 2) return 0;
      if (!scanCandidate || scanCandidate.available === false || !researchTechCandidate || researchTechCandidate.available === false) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore < 30 || currentScore > 55) return 0;
      if (Math.max(0, aiNumber(scanCandidate.directScoreGain)) < 2) return 0;
      if (Math.max(0, aiNumber(researchTechCandidate.directScoreGain)) > 0) return 0;
      if (aiNumber(scanCandidate.score) < aiNumber(researchTechCandidate.score) - 24) return 0;
      const bottleneck = getAiB2SectorBottleneck(player);
      if (!bottleneck.active || bottleneck.marked || bottleneck.sectorWins > 0 || bottleneck.deficit !== 1) return 0;
      const bestB2Choice = getAiBestB2WinningScanPreviewChoice(scanCandidate, { requireMarked: false });
      if (!bestB2Choice || bestB2Choice?.b2?.marked) return 0;
      const value = 17.5
        + Math.min(2.8, Math.max(0, aiNumber(bestB2Choice.directScoreGain)) * 0.8)
        + Math.min(1.7, Math.max(0, aiNumber(bestB2Choice.b2?.multiplier)) * 0.22);
      return roundAiScore(Math.min(21.5, value));
    }

    function shouldAiProtectB2SectorScanFromPlanetCap(player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return false;
      const bottleneck = getAiB2SectorBottleneck(player, { requireMarked: true });
      if (!bottleneck.active || !bottleneck.marked) return false;
      if (bottleneck.deficit < 5 || bottleneck.orbitLandCount < 3) return false;
      return scoreAiB2SectorScanRecoveryValue(player, {
        requireMarked: true,
        mainAction: true,
      }) >= 10;
    }

    function isAiB2SectorScanRaceLost(counts = {}, options = {}) {
      const round = Math.max(1, Math.round(aiNumber(options.roundNumber) || 1));
      if (round < FINAL_ROUND_NUMBER || !options.active || !options.marked) return false;
      const openCount = Math.max(0, Math.round(aiNumber(counts.openCount)));
      if (openCount <= 0 || openCount > 2) return false;
      const ownCount = Math.max(0, Math.round(aiNumber(counts.ownCount)));
      const maxOtherCount = Math.max(0, Math.round(aiNumber(counts.maxOtherCount)));
      // Sector ties are broken by the latest replacement, so filling the last
      // open slot can still win when the final counts are equal.
      return ownCount + openCount < maxOtherCount;
    }

    function getAiSectorScanWinState(counts = {}) {
      const openCount = Math.max(0, Math.round(aiNumber(counts.openCount)));
      const ownCount = Math.max(0, Math.round(aiNumber(counts.ownCount)));
      const maxOtherCount = Math.max(0, Math.round(aiNumber(counts.maxOtherCount)));
      const ownAfterScan = ownCount + 1;
      const strictLeadAfterScan = ownAfterScan > maxOtherCount;
      const tieBreakWinAfterScan = openCount <= 1 && ownAfterScan === maxOtherCount;
      return {
        openCount,
        ownCount,
        maxOtherCount,
        ownAfterScan,
        strictLeadAfterScan,
        tieBreakWinAfterScan,
        winsAfterScan: strictLeadAfterScan || tieBreakWinAfterScan,
      };
    }

    function getAiClosedSectorControlMarginValue(counts = {}) {
      const winState = getAiSectorScanWinState(counts);
      if (winState.strictLeadAfterScan) return 10;
      if (winState.tieBreakWinAfterScan) return -2;
      return -8;
    }

    function getAiB2SectorWinExactDelta(options = {}) {
      const sectorWins = Math.max(0, Math.round(aiNumber(options.sectorWins)));
      const orbitLandCount = Math.max(0, Math.round(aiNumber(options.orbitLandCount)));
      const multiplier = Math.max(0, aiNumber(options.multiplier));
      const before = Math.min(sectorWins, orbitLandCount);
      const after = Math.min(sectorWins + 1, orbitLandCount);
      return Math.max(0, after - before) * multiplier;
    }

    function scoreAiB2SectorScanFocus(nebulaId, counts, player = getCurrentPlayer()) {
      if (!nebulaId || !counts || !player || !endGameScoring?.countSectorWins || !endGameScoring?.countOrbitOrLandMarkers) {
        return 0;
      }
      const b2Entries = getAiB2FormulaEntries(player);
      if (!b2Entries.length) return 0;
      const b2Bottleneck = getAiB2SectorBottleneck(player);
      const context = createActionContext();
      const sectorWins = Math.max(0, Math.round(aiNumber(endGameScoring.countSectorWins(player, nebulaDataState))));
      const orbitLandCount = Math.max(0, Math.round(aiNumber(
        endGameScoring.countOrbitOrLandMarkers(player, planetStatsState, context),
      )));
      if (orbitLandCount <= sectorWins && !b2Entries.some((entry) => !entry.potential)) return 0;

      const b2Multiplier = Math.min(
        8,
        b2Entries.reduce((total, entry) => total + Math.max(0, aiNumber(entry.multiplier)), 0),
      );
      if (b2Multiplier <= 0) return 0;

      const closesSector = counts.openCount <= 1;
      const nearClose = counts.openCount === 2;
      const scanWinState = getAiSectorScanWinState(counts);
      const winsAfterScan = scanWinState.winsAfterScan;
      const bottleneckPressure = Math.max(1, orbitLandCount - sectorWins);
      const raceLost = isAiB2SectorScanRaceLost(counts, {
        roundNumber: getAiRoundNumber(),
        active: b2Bottleneck.active,
        marked: b2Bottleneck.marked,
      });
      let value = 0;
      if (closesSector) {
        if (scanWinState.tieBreakWinAfterScan) {
          // A latest-placement tie is a real settlement win, but it is not a
          // strict control lead. Price only the B2 score that this one sector
          // win actually unlocks; the old bottleneck/urgency heuristics would
          // count the same cash-out a second time.
          return getAiB2SectorWinExactDelta({ sectorWins, orbitLandCount, multiplier: b2Multiplier });
        }
        value += winsAfterScan ? b2Multiplier * (1.25 + bottleneckPressure * 0.24) : -b2Multiplier * 0.75;
      } else if (nearClose) {
        value += winsAfterScan
          ? b2Multiplier * 0.62
          : raceLost
            ? -b2Multiplier * 0.6
            : b2Multiplier * 0.28;
      } else if (counts.ownCount > 0) {
        value += b2Multiplier * (b2Bottleneck.marked ? 0.3 : 0.18);
      } else if (sectorWins <= 0 && getAiRoundNumber() >= 3) {
        value += b2Multiplier * (b2Bottleneck.marked ? 0.28 : 0.12);
      }
      if (b2Bottleneck.active && b2Bottleneck.marked && getAiRoundNumber() >= FINAL_ROUND_NUMBER) {
        value += Math.min(8, b2Bottleneck.deficit * 1.15 + (sectorWins <= 0 ? 2.5 : 0));
      }
      return applyAiStrategyWeight(value, "final", 0.75);
    }

    function scoreAiFullSectorExtraMark(nebulaId, counts, player = getCurrentPlayer(), options = {}) {
      const pendingPenalty = options.pendingType === "hand_scan" ? 0.5 : 0;
      if (nebulaId === aomomo?.NEBULA_ID) {
        if (counts.ownCount > 0) return -3;
        const participationValue = getAiAomomoFossilUnitValue(player)
          + scoreAiAomomoFossilPlanBonus(1, player);
        return Math.max(-3, Math.min(6, participationValue - pendingPenalty));
      }

      const ranking = data.getSectorRanking?.(nebulaDataState, nebulaId) || [];
      const currentWinner = ranking[0] || null;
      const alreadyWins = currentWinner
        ? aiTokenBelongsToPlayer(currentWinner, player)
        : counts.ownCount > counts.maxOtherCount;
      const winState = getAiSectorScanWinState(counts);
      if (alreadyWins) return -3;
      if (!winState.winsAfterScan) return Math.max(-3, -2 - pendingPenalty);

      const b2Bottleneck = getAiB2SectorBottleneck(player);
      const b2Delta = b2Bottleneck.active
        ? getAiB2SectorWinExactDelta({
          sectorWins: b2Bottleneck.sectorWins,
          orbitLandCount: b2Bottleneck.orbitLandCount,
          multiplier: Math.min(8, b2Bottleneck.multiplier),
        })
        : 0;
      const runezuDelta = Math.max(0, scoreAiRunezuSourceSymbolValue("sector", nebulaId, player));
      const cap = b2Delta > 0 && b2Bottleneck.marked ? 8 : 6;
      const value = 0.25 + b2Delta + runezuDelta - pendingPenalty;
      return Math.max(-3, Math.min(cap, value));
    }

    function scoreAiNebulaScanChoice(choice, options = {}) {
      const player = options.player || getCurrentPlayer();
      const nebulaId = choice?.nebulaId || null;
      if (!nebulaId || choice?.disabled) return -Infinity;
      const nextToken = data.getNextReplaceableNebulaToken?.(nebulaDataState, nebulaId);
      const tokens = data.listNebulaTokens?.(nebulaDataState, nebulaId) || [];
      const extraMarkOnly = !nextToken;
      if (extraMarkOnly && !tokens.length) return -Infinity;

      const capacity = Math.max(0, Math.round(aiNumber(data.getNebulaCapacity?.(nebulaId))));
      const counts = getAiNebulaSignalCounts(nebulaId, player);
      if (extraMarkOnly) {
        return scoreAiFullSectorExtraMark(nebulaId, counts, player, options);
      }
      const slotScore = nextToken
        ? Math.max(0, aiNumber(data.getNebulaSlotScoreReward?.(nebulaId, nextToken.slotIndex)))
        : 0;
      const gainsData = !extraMarkOnly && options.gainData !== false;
      const dataRoom = getAiAvailableDataRoom(player);
      const dataValue = gainsData
        ? (
          dataRoom > 0
            ? AI_RESOURCE_VALUES.availableData
              + scoreAiMidgameResourceContinuationValue({ availableData: 1 }, player, { scale: 0.45 })
            : -0.75
        )
        : 0;
      const demand = getAiStrategyDemand(player);
      const nebulaColor = data.getNebulaColor?.(nebulaId);
      let value = 3 + slotScore + dataValue;
      value += counts.ownCount > 0 ? Math.min(3, counts.ownCount * 0.8) : 1.4;
      value += Math.min(2.5, Math.max(0, counts.markedCount) * 0.35);
      value += getAiMapDemand(demand.scanColors, nebulaColor) * 0.75 * getAiStrategyWeight("scan");
      value += getAiMapDemand(demand.actions, "scan") * 0.12 * getAiStrategyWeight("scan");
      value += getAiMapDemand(demand.traceTypes, "pink") * 0.42 * getAiStrategyWeight("scan");
      value += getAiMapDemand(demand.traceTypes, "blue") * (gainsData ? 0.34 : 0.12) * getAiStrategyWeight("scan");
      value += scoreAiB2SectorScanFocus(nebulaId, counts, player);
      const runezuSectorSymbolValue = scoreAiRunezuSourceSymbolValue("sector", nebulaId, player);
      if (runezuSectorSymbolValue > 0) {
        const ownAfterScan = counts.ownCount + 1;
        const runezuClaimScale = counts.openCount <= 1
          ? (ownAfterScan >= counts.maxOtherCount ? 1 : 0.18)
          : counts.openCount === 2
            ? (ownAfterScan > counts.maxOtherCount ? 0.45 : 0.18)
            : 0.08;
        value += runezuSectorSymbolValue * runezuClaimScale;
      }

      if (counts.openCount <= 1 && capacity > 0) {
        // This is a generic control-margin heuristic, not the settlement winner
        // test. Exact latest-placement tie wins are already reflected in B2 and
        // species-specific rewards; only a strict lead earns the full premium.
        value += getAiClosedSectorControlMarginValue(counts);
      } else if (counts.openCount === 2) {
        value += counts.ownCount + 1 > counts.maxOtherCount ? 3 : 1;
      }

      if (nebulaId === aomomo?.NEBULA_ID) {
        value += 2 + getAiAomomoFossilUnitValue(player) * 0.22;
        if (counts.openCount <= 1 || counts.ownCount > 0) {
          value += scoreAiAomomoFossilPlanBonus(1, player) * 0.5;
        }
      }
      if (options.pendingType === "hand_scan") value -= 0.5;
      return value;
    }

    function getAiNebulaScanChoiceDirectScore(choice) {
      const nebulaId = choice?.nebulaId || null;
      if (!nebulaId || choice?.disabled) return 0;
      const nextToken = data.getNextReplaceableNebulaToken?.(nebulaDataState, nebulaId);
      if (!nextToken) return 0;
      return Math.max(0, aiNumber(data.getNebulaSlotScoreReward?.(nebulaId, nextToken.slotIndex)));
    }

    function getBestAiNebulaChoiceEntry(choices = [], options = {}) {
      return (choices || [])
        .map((choice) => ({
          choice,
          score: scoreAiNebulaScanChoice(choice, options),
          directScoreGain: getAiNebulaScanChoiceDirectScore(choice),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => (
          right.score - left.score
          || right.directScoreGain - left.directScoreGain
        ))[0] || null;
    }

    function getBestAiNebulaChoiceScore(choices = [], options = {}) {
      return getBestAiNebulaChoiceEntry(choices, options)?.score ?? -Infinity;
    }

    function getAiSectorScanChoicesForEffect(effectType, player = getCurrentPlayer()) {
      if (effectType === scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN) {
        const earth = getEarthSectorCoordinate();
        return buildSectorScanChoicesForXs([(earth.x + 7) % 8, earth.x, (earth.x + 1) % 8]);
      }
      if (effectType === scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN) {
        const mercury = getPlanetSectorCoordinate("mercury");
        return buildSectorScanChoicesForX(mercury.x);
      }
      if (effectType === scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN) {
        const earth = getEarthSectorCoordinate();
        return buildSectorScanChoicesForX(earth.x);
      }
      return [];
    }

    function scoreAiScanCard(card, options = {}) {
      const scanChoices = getPublicScanChoicesForCard(card);
      if (!scanChoices.ok) return -Infinity;
      const bestTargetScore = getBestAiNebulaChoiceScore(scanChoices.choices || [], options);
      if (!Number.isFinite(bestTargetScore)) {
        return (scanChoices.choices || []).length ? 0 : -Infinity;
      }
      const handDiscardPenalty = options.fromHand
        ? Math.max(0, scoreAiPlayCardValue(card, { player: options.player || getCurrentPlayer() })) * 0.25
          + scoreAiCardCornerOpportunity(card) * 0.15
        : 0;
      return bestTargetScore + Math.min(1.5, (scanChoices.choices || []).length * 0.25) - handDiscardPenalty;
    }

    function getAiScanCardDirectScoreGain(card, options = {}) {
      const scanChoices = getPublicScanChoicesForCard(card);
      if (!scanChoices.ok) return 0;
      return Math.max(0, aiNumber(getBestAiNebulaChoiceEntry(scanChoices.choices || [], options)?.directScoreGain));
    }

    function getAiBestPublicScanSlots(player = getCurrentPlayer(), options = {}) {
      const maxSelectable = Math.max(1, Math.round(aiNumber(options.maxSelectable || 1)));
      const activeCardState = options.workingRoot?.cardState || cardState;
      return (activeCardState.publicCards || [])
        .map((card, slotIndex) => ({
          slotIndex,
          card,
          score: card ? scoreAiScanCard(card, { ...options, player, pendingType: "public_scan" }) : -Infinity,
          directScoreGain: card
            ? getAiScanCardDirectScoreGain(card, { ...options, player, pendingType: "public_scan" })
            : 0,
        }))
        .filter((entry) => entry.card && Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score || left.slotIndex - right.slotIndex)
        .slice(0, maxSelectable);
    }

    function getAiBestHandScanIndex(player = getCurrentPlayer(), options = {}) {
      const entries = (player?.hand || [])
        .map((card, handIndex) => ({
          handIndex,
          card,
          score: card ? scoreAiScanCard(card, { ...options, player, pendingType: "hand_scan", fromHand: true }) : -Infinity,
          directScoreGain: card
            ? getAiScanCardDirectScoreGain(card, { ...options, player, pendingType: "hand_scan", fromHand: true })
            : 0,
        }))
        .filter((entry) => entry.card && Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score || left.handIndex - right.handIndex);
      return entries[0] || null;
    }

    function getAiScanDirectScoreGain(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      if (!workingRoot?.turnState) throw new TypeError("AI scan valuation requires an explicit workingRoot");
      const activeTurnState = workingRoot.turnState;
      const effects = scanEffects.buildScanEffectQueue(player, {
        fullScanAction: true,
        turnState: activeTurnState,
        roundNumber: activeTurnState.roundNumber,
        turnNumber: activeTurnState.turnNumber,
      });
      const directScoreGain = effects.reduce((total, effect) => {
        if (
          effect.type === scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN
          || effect.type === scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN
          || effect.type === scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN
        ) {
          const entry = getBestAiNebulaChoiceEntry(
            getAiSectorScanChoicesForEffect(effect.type, player),
            { workingRoot, player, pendingType: "sector_scan" },
          );
          return total + Math.max(0, aiNumber(entry?.directScoreGain));
        }
        if (effect.type === scanEffects.EFFECT_TYPES.PUBLIC_CARD_SCAN) {
          return total;
        }
        if (effect.type === scanEffects.EFFECT_TYPES.HAND_SCAN) {
          return total;
        }
        return total;
      }, 0);
      return Math.min(4, Math.max(0, directScoreGain));
    }

    function scoreAiScanTargetButton(button, options = {}) {
      if (!button || button.disabled) return -Infinity;
      if (button.dataset.conditionalSectorX != null) {
        const sectorX = solar.mod8(Number(button.dataset.conditionalSectorX));
        return getBestAiNebulaChoiceScore(buildSectorScanChoicesForX(sectorX), options);
      }
      if (button.dataset.nebulaId == null) return -Infinity;
      return scoreAiNebulaScanChoice({
        nebulaId: button.dataset.nebulaId,
        sectorX: button.dataset.sectorX,
        disabled: button.disabled,
      }, options);
    }

    function buildAiScanTargetChoiceB2Summary(choice = {}, player = getCurrentPlayer()) {
      const nebulaId = choice?.nebulaId || null;
      if (!nebulaId || !player) return null;
      const counts = getAiNebulaSignalCounts(nebulaId, player);
      const bottleneck = getAiB2SectorBottleneck(player);
      const b2Focus = scoreAiB2SectorScanFocus(nebulaId, counts, player);
      if (!bottleneck.active && !bottleneck.marked && b2Focus <= 0) return null;
      const ownAfterScan = counts.ownCount + 1;
      return {
        focus: roundAiScore(b2Focus),
        active: Boolean(bottleneck.active),
        marked: Boolean(bottleneck.marked),
        sectorWins: Math.max(0, Math.round(aiNumber(bottleneck.sectorWins))),
        orbitLandCount: Math.max(0, Math.round(aiNumber(bottleneck.orbitLandCount))),
        deficit: Math.max(0, Math.round(aiNumber(bottleneck.deficit))),
        multiplier: Math.max(0, Math.round(aiNumber(bottleneck.multiplier))),
        ownCount: Math.max(0, Math.round(aiNumber(counts.ownCount))),
        openCount: Math.max(0, Math.round(aiNumber(counts.openCount))),
        markedCount: Math.max(0, Math.round(aiNumber(counts.markedCount))),
        maxOtherCount: Math.max(0, Math.round(aiNumber(counts.maxOtherCount))),
        winsAfterScan: counts.openCount <= 1
          ? ownAfterScan >= counts.maxOtherCount
          : ownAfterScan > counts.maxOtherCount,
        raceLost: isAiB2SectorScanRaceLost(counts, {
          roundNumber: getAiRoundNumber(),
          active: bottleneck.active,
          marked: bottleneck.marked,
        }),
      };
    }

    function summarizeAiScanTargetChoiceEntry(entry = {}, player = getCurrentPlayer()) {
      const choice = entry.choice || {};
      return {
        nebulaId: choice.nebulaId || null,
        sectorX: choice.sectorX ?? null,
        label: choice.label || null,
        score: roundAiScore(entry.score),
        directScoreGain: roundAiScore(entry.directScoreGain),
        b2: buildAiScanTargetChoiceB2Summary(choice, player),
      };
    }

    function rankAiScanTargetChoices(choices = [], options = {}) {
      return (choices || [])
        .map((choice, index) => ({
          choice,
          index,
          score: scoreAiNebulaScanChoice(choice, options),
          directScoreGain: getAiNebulaScanChoiceDirectScore(choice),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => (
          right.score - left.score
          || right.directScoreGain - left.directScoreGain
          || left.index - right.index
        ));
    }

    function buildAiScanActionTargetPreview(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      if (!workingRoot?.turnState) throw new TypeError("AI scan preview requires an explicit workingRoot");
      const activeTurnState = workingRoot.turnState;
      const effects = scanEffects.buildScanEffectQueue(player, {
        fullScanAction: true,
        turnState: activeTurnState,
        roundNumber: activeTurnState.roundNumber,
        turnNumber: activeTurnState.turnNumber,
      });
      const previewEffects = [];
      const topChoices = [];
      for (const effect of effects) {
        const sectorChoices = getAiSectorScanChoicesForEffect(effect.type, player);
        if (!sectorChoices.length) continue;
        const rankedChoices = rankAiScanTargetChoices(
          sectorChoices,
          { workingRoot, player, pendingType: "sector_scan" },
        );
        if (!rankedChoices.length) continue;
        const summarizedChoices = rankedChoices.slice(0, 6).map((entry) => ({
          ...summarizeAiScanTargetChoiceEntry(entry, player),
          effectType: effect.type,
          pendingType: "sector_scan",
        }));
        previewEffects.push({
          effectType: effect.type,
          pendingType: "sector_scan",
          topChoices: summarizedChoices,
        });
        topChoices.push(...summarizedChoices);
      }
      return {
        effectCount: effects.length,
        effects: previewEffects,
        topChoices: topChoices
          .sort((left, right) => (
            aiNumber(right.score) - aiNumber(left.score)
            || aiNumber(right.directScoreGain) - aiNumber(left.directScoreGain)
            || String(left.nebulaId || "").localeCompare(String(right.nebulaId || ""))
          ))
          .slice(0, 6),
      };
    }

    function rankAiScanTargetButtons(buttons = [], options = {}) {
      return [...(buttons || [])]
        .map((button, index) => {
          if (button?.dataset?.conditionalSectorX != null) {
            const sectorX = solar.mod8(Number(button.dataset.conditionalSectorX));
            const bestEntry = rankAiScanTargetChoices(buildSectorScanChoicesForX(sectorX), options)[0] || null;
            return {
              button,
              index,
              score: bestEntry?.score ?? -Infinity,
              directScoreGain: bestEntry?.directScoreGain ?? 0,
              choice: bestEntry?.choice || { sectorX },
            };
          }
          const choice = {
            nebulaId: button?.dataset?.nebulaId || null,
            sectorX: button?.dataset?.sectorX,
            label: button?.textContent || "",
            disabled: button?.disabled,
          };
          return {
            button,
            index,
            choice,
            score: scoreAiNebulaScanChoice(choice, options),
            directScoreGain: getAiNebulaScanChoiceDirectScore(choice),
          };
        })
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => (
          right.score - left.score
          || right.directScoreGain - left.directScoreGain
          || left.index - right.index
        ));
    }

    function chooseAiScanTargetButton(buttons = [], options = {}) {
      const ranked = rankAiScanTargetButtons(buttons, options);
      return ranked[0]?.button || null;
    }

    function chooseAiScanTargetChoice(choices = [], options = {}) {
      return rankAiScanTargetChoices(choices, options)[0]?.choice || null;
    }

    function scoreAiScanEnergyReservationPenalty(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      if (!workingRoot || typeof workingRoot !== "object") throw new TypeError("AI scan valuation requires an explicit workingRoot");
      if (!player || getAiRoundNumber() > 2) return 0;
      const resources = player.resources || {};
      const currentEnergy = Math.max(0, aiNumber(resources.energy));
      const scanCost = scanEffects.getStandardScanCost(player) || {};
      const scanEnergyCost = Math.max(0, aiNumber(scanCost.energy));
      if (scanEnergyCost <= 0 || currentEnergy <= 0) return 0;
      const energyAfterScan = Math.max(0, currentEnergy - scanEnergyCost);
      const movedThisTurn = getAiMoveCountThisTurn(workingRoot, player.id) > 0;
      const movedThenDrainedEnergyPenalty = movedThisTurn && energyAfterScan <= 0
        ? Math.min(11, 8 + getAiLiveScorePaceDeficit(player) * 0.06)
        : 0;
      const movePaymentCards = getAiMovePaymentCards(player).length;
      const planets = solar.createSolarSnapshot(workingRoot.solarState).planetLocations || [];
      const movableTokens = rocketActions.getMovableTokensForPlayer
        ? rocketActions.getMovableTokensForPlayer(workingRoot.rocketState, player.id)
        : rocketActions.getRocketsForPlayer(workingRoot.rocketState, player.id);
      const bestBlockedCashout = movableTokens
        .reduce((best, rocket) => {
          const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
          if (!coordinate) return best;
          return planets.reduce((innerBest, planet) => {
            if (!planet?.planetId || planet.planetId === "earth") return innerBest;
            const distance = getAiSectorDistance(coordinate, planet);
            if (distance > 1) return innerBest;
            const orbitEnergy = canAiPlanetAcceptOrbit(planet.planetId)
              ? aiNumber(abilities.planet.DEFAULT_ORBIT_COST?.energy)
              : Infinity;
            const landEnergy = canAiPlanetAcceptLanding(planet.planetId, player)
              ? abilities.planet.getLandEnergyCost(createActionContext(workingRoot), planet.planetId)
              : Infinity;
            const cashoutEnergy = Math.min(orbitEnergy, landEnergy);
            if (!Number.isFinite(cashoutEnergy) || cashoutEnergy <= 0) return innerBest;
            const moveEnergy = distance > 0 && movePaymentCards <= 0
              ? getAiRequiredMovePointsFromCoordinate(player, coordinate)
              : 0;
            if (currentEnergy < cashoutEnergy + moveEnergy || energyAfterScan >= cashoutEnergy) {
              return innerBest;
            }
            return Math.max(innerBest, scoreAiPlanetTarget(planet, player));
          }, best);
        }, 0);
      if (bestBlockedCashout <= 0) return movedThenDrainedEnergyPenalty;
      const deficit = getAiLiveScorePaceDeficit(player);
      return Math.max(
        movedThenDrainedEnergyPenalty,
        Math.min(11, 4 + bestBlockedCashout * 0.12 + deficit * 0.06),
      );
    }

    function scoreAiLateScanResourceDrainPenalty(player = getCurrentPlayer()) {
      if (!player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return 0;
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore < 50 || currentScore > 67 || countAiFinalMarksForPlayer(player) !== 2) return 0;
      if (getAiNextMissingFinalScoreThreshold(player) !== 70) return 0;
      const scanCost = scanEffects.getStandardScanCost(player) || {};
      const creditCost = Math.max(0, aiNumber(scanCost.credits));
      const energyCost = Math.max(0, aiNumber(scanCost.energy));
      if (creditCost <= 0 && energyCost <= 0) return 0;
      const resources = player.resources || {};
      const creditsAfter = Math.max(0, aiNumber(resources.credits) - creditCost);
      const energyAfter = Math.max(0, aiNumber(resources.energy) - energyCost);
      const drainsCredits = creditCost > 0 && creditsAfter <= 0;
      const drainsEnergy = energyCost > 0 && energyAfter <= 0;
      if (!drainsCredits && !drainsEnergy) return 0;
      const deficit = Math.max(1, 70 - currentScore);
      const penalty = Math.min(
        20,
        8
          + Math.max(0, deficit - 6) * 0.45
          + (drainsCredits ? 2 : 0)
          + (drainsEnergy ? 4 : 0),
      );
      if (currentScore >= 60 && deficit <= 10) {
        return roundAiScore(penalty * 0.45);
      }
      return penalty;
    }

    function scoreAiScanAction(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      if (!workingRoot?.turnState) throw new TypeError("AI scan valuation requires an explicit workingRoot");
      const activeTurnState = workingRoot.turnState;
      const effects = scanEffects.buildScanEffectQueue(player, {
        fullScanAction: true,
        turnState: activeTurnState,
        roundNumber: activeTurnState.roundNumber,
        turnNumber: activeTurnState.turnNumber,
      });
      const costValue = scoreAiResourceBundle(scanEffects.getStandardScanCost(player));
      let value = 0;
      for (const effect of effects) {
        if (
          effect.type === scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN
          || effect.type === scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN
          || effect.type === scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN
        ) {
          const best = getBestAiNebulaChoiceScore(
            getAiSectorScanChoicesForEffect(effect.type, player),
            { workingRoot, player, pendingType: "sector_scan" },
          );
          if (Number.isFinite(best)) value += best;
        } else if (effect.type === scanEffects.EFFECT_TYPES.PUBLIC_CARD_SCAN) {
          const bestPublicScan = getAiBestPublicScanSlots(player, { workingRoot, maxSelectable: 1 })[0];
          if (bestPublicScan) value += bestPublicScan.score + 1;
        } else if (effect.type === scanEffects.EFFECT_TYPES.HAND_SCAN) {
          const bestHandScan = getAiBestHandScanIndex(player, { workingRoot });
          if (bestHandScan) value += bestHandScan.score;
        } else if (effect.type === scanEffects.EFFECT_TYPES.SCAN_ACTION_4) {
          value += Math.max(0, scoreAiLaunchAction(player) * 0.45);
          const bestMove = listAiMoveCandidates(workingRoot)[0];
          if (bestMove) value += Math.max(0, aiNumber(bestMove.score) * 0.35);
        }
      }
      const earlyEngineValue = scoreAiEarlyScanEngineValue(player);
      const b2SectorScanRecoveryValue = scoreAiB2SectorScanRecoveryValue(player, {
        requireMarked: true,
        mainAction: true,
      });
      const demand = getAiStrategyDemand(player);
      const tracePressure = Math.min(3, sumAiDemandMap(demand.traceTypes) * 0.05);
      const costMultiplier = getAiRoundNumber() <= 2 ? 0.62 : getAiRoundNumber() === 3 ? 0.68 : 0.7;
      const reservePenalty = scoreAiResourceReservePenaltyForCost(
        player,
        scanEffects.getStandardScanCost(player),
        { actionId: "scan" },
      );
      const lateResourceDrainPenalty = scoreAiLateScanResourceDrainPenalty(player);
      const scanCountThisRound = countAiStandardScansThisRound(player);
      const placedComputerCount = Math.max(0, (data.listComputerPlacedTokens?.(player) || []).length);
      const directScoreGain = getAiScanDirectScoreGain(workingRoot, player);
      const traceCount = countAiTraceMarkersForPlayer(player);
      const availableData = Math.max(0, aiNumber(player?.resources?.availableData));
      const dataRoom = getAiAvailableDataRoom(player);
      const canOpenAnalyze = placedComputerCount >= (data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6) - 1;
      const fullDataAnalyzeBacklogPenalty = getAiRoundNumber() >= 3
        && dataRoom <= 0
        && hasAiAnalyzeReadyDataSlot(player)
        ? Math.min(
          18,
          (getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 9 : 5)
            + Math.max(0, availableData - 3) * 1.4
            + (b2SectorScanRecoveryValue > 0 ? 3 : 0),
        )
        : 0;
      const repeatedScanPenalty = Math.max(0, scanCountThisRound) * (getAiRoundNumber() <= 2 ? 7 : 10);
      const earlySetupScanBonus = (
        getAiRoundNumber() <= 2
        && scanCountThisRound <= 0
        && availableData <= 0
        && placedComputerCount < (data.ANALYZE_REQUIRED_COMPUTER_SLOT || 6)
        && traceCount < 2
      )
        ? Math.min(
          5.5,
          2.6
            + (traceCount <= 0 ? 1.4 : 0.6)
            + Math.max(0, 3 - placedComputerCount) * 0.35,
        )
        : 0;
      const lowCashoutScanPenalty = directScoreGain <= 0 && !canOpenAnalyze
        ? (getAiRoundNumber() <= 2 ? 5 : 11)
        : 0;
      const adjustedLowCashoutScanPenalty = Math.max(
        0,
        lowCashoutScanPenalty - earlySetupScanBonus * 0.7 - b2SectorScanRecoveryValue * 0.6,
      );
      const highScorePushValue = scoreAiHighScorePushValue(player, "scan");
      const lowEngineCatchupValue = scoreAiLowEngineCatchupValue(player, "scan");
      const netBeforePace = value + earlyEngineValue * 0.55 + tracePressure + b2SectorScanRecoveryValue + highScorePushValue + lowEngineCatchupValue - costValue * costMultiplier;
      const deficit = getAiLiveScorePaceDeficit(player);
      const paceBonus = netBeforePace > 4 && deficit > 15
        ? Math.min(getAiRoundNumber() >= 3 ? 9 : 5, (deficit - 15) * (getAiRoundNumber() >= 3 ? 0.18 : 0.1))
        : 0;
      return applyAiStrategyWeight(
        value + earlyEngineValue * 0.55 + tracePressure + paceBonus + earlySetupScanBonus + b2SectorScanRecoveryValue + highScorePushValue + lowEngineCatchupValue,
        "scan",
        0.85,
      )
        - costValue * costMultiplier
        - reservePenalty
        - lateResourceDrainPenalty
        - repeatedScanPenalty
        - fullDataAnalyzeBacklogPenalty
        - adjustedLowCashoutScanPenalty;
    }
    return Object.freeze({
      getAiAvailableDataRoom,
      aiTokenBelongsToPlayer,
      aiTokenHasOwner,
      getAiNebulaSignalCounts,
      getAiB2FormulaEntries,
      getAiB2SectorBottleneck,
      scoreAiB2SectorScanRecoveryValue,
      getAiBestB2WinningScanPreviewChoice,
      isAiFixedNebulaScanPlayCandidate,
      scoreAiWeakFinalB2TargetedScanTieBreak,
      scoreAiWeakEarlyB2SetupScanTieBreak,
      shouldAiProtectB2SectorScanFromPlanetCap,
      isAiB2SectorScanRaceLost,
      getAiSectorScanWinState,
      getAiClosedSectorControlMarginValue,
      getAiB2SectorWinExactDelta,
      scoreAiB2SectorScanFocus,
      scoreAiFullSectorExtraMark,
      scoreAiNebulaScanChoice,
      getAiNebulaScanChoiceDirectScore,
      getBestAiNebulaChoiceEntry,
      getBestAiNebulaChoiceScore,
      getAiSectorScanChoicesForEffect,
      scoreAiScanCard,
      getAiScanCardDirectScoreGain,
      getAiBestPublicScanSlots,
      getAiBestHandScanIndex,
      getAiScanDirectScoreGain,
      scoreAiScanTargetButton,
      buildAiScanTargetChoiceB2Summary,
      summarizeAiScanTargetChoiceEntry,
      rankAiScanTargetChoices,
      buildAiScanActionTargetPreview,
      rankAiScanTargetButtons,
      chooseAiScanTargetButton,
      chooseAiScanTargetChoice,
      scoreAiScanEnergyReservationPenalty,
      scoreAiLateScanResourceDrainPenalty,
      scoreAiScanAction,
    });
  }

  return Object.freeze({ createScanValue });
});
