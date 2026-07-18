(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAiActionExecutor = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createActionExecutor(context) {
    if (!context || typeof context !== "object") {
      throw new Error("createActionExecutor requires explicit app context");
    }
    const {
      AI_DIFFICULTY_WEAK_START, FINAL_ROUND_NUMBER, actions, adjustAiActionGraphCandidate, adjustAiActionGraphCandidateForStyle, ai, aiNumber, alienGameState,
      analyzeDataForCurrentPlayer, applyAiStrategyWeight, applyAiTurnActionSelectionPressure, beginPlayCardSelection, beginScanAction, buildAiAnalyzeActionValueBreakdown, buildAiEarlyNoMainPublicRefillDiagnostic, buildAiFinalHighScorePassRecoveryDiagnostic,
      buildAiFinalLowHandPassRecoveryDiagnostic, buildAiIndustryCandidate, buildAiResearchTechCandidate, buildAiResourceLockTradePreviews, buildAiScanActionTargetPreview, canAiAnalyzeData, canStartMainAction, confirmDataPlacement,
      AI_MOVE_DIRECTIONS, aliens, canAiMoveThisTurn, cards, createActionContext, data, dispatchRuntimeAction, endCurrentTurn, finalScoringState, getAiAnalyzeEnergyCost, getAiBestLandDirectScoreGain, getAiCardDisplayLabel, getAiMarkedFinalFormulaEntries,
      getAiNextMissingFinalScoreThreshold, getAiOrbitDirectScoreGain, getAiRoundNumber, getAiScanDirectScoreGain, getAiStrategyWeight, getAiTraceCompetitionState, getCurrentPlayer, handleCompanyActionMarkerClick,
      getMovableTokensForPlayer, hasActivePendingSubFlow, industry, isActionEffectFlowActive, isAiAutoBattlePlayer, landForCurrentPlayer, listAiCardCornerQuickCandidates, listAiDataPlacementCandidates, listAiEmergencyAnalyzeEnergyTradeCandidates, listAiFinalAnalyzeEnergyTradeCandidates,
      listAiFinalReadyTaskCreditChainTradeCandidates, listAiLateResourceRecoveryTradeCandidates, listAiMainUnlockTradeCandidates, listAiMoveCandidates, listAiPlayCardCandidates, listAiResourceLockMainUnlockTradeCandidates, listAiRunezuFaceSymbolQuickCandidates, listAiThirdFinalMarkResourceTradeCandidates,
      orbitForCurrentPlayer, passForCurrentPlayer, playerState, quickTrades, recordAiAutoBattleLog, recoverPendingActionFromOpenHistoryForAi, researchTechForCurrentPlayer, roundAiScore, runezu, runAction,
      runAiCardCornerQuickActionDecision, runAiMoveActionDecision, runAiRunezuFaceSymbolQuickActionDecision, runQuickTrade, scanEffects, scoreAiLandAction, scoreAiLaunchTurnCandidateValue, scoreAiOrbitAction,
      scoreAiPassAction, scoreAiPostLaunchMovePlan, scoreAiScanAction, scoreAiScanEnergyReservationPenalty, scoreAiScanPriorityFloor, scoreAiWeakEarlyB2SetupScanTieBreak, scoreAiWeakFinalB2TargetedScanTieBreak, shouldAiProtectB2SectorScanFromPlanetCap,
      state, turnState,
    } = context;

    function enumerateAiTurnActions() {
      const context = createActionContext();
      const currentPlayer = getCurrentPlayer();
      const candidates = [];
      if (state.pendingActionExecuted && !isActionEffectFlowActive() && !hasActivePendingSubFlow()) {
        const industryCandidate = buildAiIndustryCandidate(currentPlayer);
        if (industryCandidate) candidates.push(industryCandidate);
        candidates.push(...listAiLateResourceRecoveryTradeCandidates(currentPlayer));
        candidates.push(...listAiMoveCandidates());
        candidates.push(...listAiDataPlacementCandidates(currentPlayer));
        candidates.push(...listAiRunezuFaceSymbolQuickCandidates(currentPlayer));
        candidates.push(...listAiCardCornerQuickCandidates(currentPlayer));
        candidates.push({
          id: "end-turn",
          kind: "end-turn",
          available: true,
          reason: null,
          score: scoreAiPassAction(currentPlayer),
        });
        return candidates;
      }
      if (!canStartMainAction()) return candidates;

      const launchCheck = actions.canExecute("launch", context);
      const postLaunchMovePlan = launchCheck.ok ? scoreAiPostLaunchMovePlan(currentPlayer) : null;
      const launchValue = launchCheck.ok
        ? scoreAiLaunchTurnCandidateValue(currentPlayer, postLaunchMovePlan)
        : {};
      const launchCandidate = {
        id: "launch",
        kind: "main",
        available: launchCheck.ok,
        reason: launchCheck.message || null,
        plan: postLaunchMovePlan?.score > 0 ? postLaunchMovePlan : null,
        gain: launchValue.launchGain || 0,
        cost: aiNumber(launchValue.launchCost) + aiNumber(launchValue.launchReservePenalty),
        score: launchValue.score || 0,
        valueBreakdown: {
          launchGain: launchValue.launchGain || 0,
          launchCost: launchValue.launchCost || 0,
          launchReservePenalty: launchValue.launchReservePenalty || 0,
          postLaunchMovePlanScore: postLaunchMovePlan?.score || 0,
          lateLaunchPenalty: launchValue.lateLaunchPenalty || 0,
          extraLaunchPacePenalty: launchValue.extraLaunchPacePenalty || 0,
          finalSecondMarkExtraLaunchPenalty: launchValue.finalSecondMarkExtraLaunchPenalty || 0,
          noRouteLaunchPenalty: launchValue.noRouteLaunchPenalty || 0,
          weakEarlyPostLaunchRoutePenalty: launchValue.weakEarlyPostLaunchRoutePenalty || 0,
        },
      };
      candidates.push(launchCandidate);
      const orbitCheck = actions.canExecute("orbit", context);
      const orbitCandidate = {
        id: "orbit",
        kind: "main",
        available: orbitCheck.ok,
        reason: orbitCheck.message || null,
        planetId: orbitCheck.planet?.planetId || null,
        planetName: orbitCheck.planet?.name || null,
        finalMarkCashoutIncluded: true,
      };
      orbitCandidate.directScoreGain = orbitCheck.ok
        ? getAiOrbitDirectScoreGain(orbitCandidate.planetId, currentPlayer)
        : 0;
      orbitCandidate.valueBreakdown = {
        directScoreGain: orbitCandidate.directScoreGain,
      };
      orbitCandidate.score = scoreAiOrbitAction(orbitCandidate);
      candidates.push(orbitCandidate);
      const landCheck = actions.canExecute("land", context);
      const landCandidate = {
        id: "land",
        kind: "main",
        available: landCheck.ok,
        reason: landCheck.message || null,
        planetId: landCheck.planet?.planetId || null,
        planetName: landCheck.planet?.name || null,
        energyCost: landCheck.energyCost ?? null,
        choices: landCheck.choices || [],
        finalMarkCashoutIncluded: true,
      };
      landCandidate.directScoreGain = landCheck.ok
        ? getAiBestLandDirectScoreGain(landCandidate.planetId, landCandidate.choices, currentPlayer)
        : 0;
      landCandidate.valueBreakdown = {
        directScoreGain: landCandidate.directScoreGain,
      };
      landCandidate.score = scoreAiLandAction(landCandidate);
      candidates.push(landCandidate);
      const researchTechCheck = actions.canExecute("researchTech", context);
      const takeableTech = researchTechCheck.ok
        ? (researchTechCheck.takeable || [])
          .map((tileId) => buildAiResearchTechCandidate(tileId))
          .filter((candidate) => candidate.available !== false)
        : [];
      const bestTechCandidate = [...takeableTech]
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
      const bestTechScore = Number(bestTechCandidate?.score || 0);
      candidates.push({
        id: "researchTech",
        kind: "main",
        available: researchTechCheck.ok && takeableTech.length > 0,
        reason: researchTechCheck.ok && !takeableTech.length
          ? "没有安全的可研究科技"
          : researchTechCheck.message || null,
        takeable: takeableTech,
        plan: bestTechCandidate?.plan || null,
        techType: bestTechCandidate?.techType || null,
        finalFormulaDeltas: bestTechCandidate?.finalFormulaDeltas || null,
        directScoreGain: Math.max(0, aiNumber(bestTechCandidate?.directScoreGain)),
        score: applyAiStrategyWeight(bestTechScore, "engine", 0.5),
        valueBreakdown: {
          directScoreGain: Math.max(0, aiNumber(bestTechCandidate?.directScoreGain)),
          bestTechTileId: bestTechCandidate?.tileId || null,
          bestTechType: bestTechCandidate?.techType || null,
          bestTechBonusId: bestTechCandidate?.bonusId || null,
        },
      });
      const scanCheck = scanEffects.canExecuteScan(getCurrentPlayer(), { standardAction: true });
      const preMoveCandidates = listAiMoveCandidates();
      const bestMoveCandidate = preMoveCandidates.reduce((best, candidate) => (
        aiNumber(candidate?.score) > aiNumber(best?.score) ? candidate : best
      ), null);
      const bestMoveScore = Math.max(0, aiNumber(bestMoveCandidate?.score));
      const analyzeCheck = canAiAnalyzeData(currentPlayer);
      const analyzeBreakdown = analyzeCheck.ok ? buildAiAnalyzeActionValueBreakdown(currentPlayer) : null;
      const analyzeScore = analyzeBreakdown ? analyzeBreakdown.score : 0;
      const analyzeDirectScoreGain = Math.max(0, aiNumber(analyzeBreakdown?.directScoreGain));
      const immediatePlanetActionScore = Math.max(
        orbitCandidate.available ? Number(orbitCandidate.score || 0) : 0,
        landCandidate.available ? Number(landCandidate.score || 0) : 0,
      );
      let scanScore = scanCheck.ok ? scoreAiScanAction(currentPlayer) : 0;
      const scanDirectScoreGain = scanCheck.ok ? getAiScanDirectScoreGain(currentPlayer) : 0;
      const scanPriorityFloor = scanCheck.ok ? scoreAiScanPriorityFloor(currentPlayer) : 0;
      const scanCurrentScore = Math.max(0, aiNumber(currentPlayer?.resources?.score));
      const scanNextThreshold = getAiNextMissingFinalScoreThreshold(currentPlayer);
      const scanScoreToThreshold = scanNextThreshold ? Math.max(1, scanNextThreshold - scanCurrentScore) : Infinity;
      const scanFinalThresholdMiss = scanCheck.ok
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && scanNextThreshold
        && scanCurrentScore < scanNextThreshold
        && scanScoreToThreshold <= 3
        && scanCurrentScore + scanDirectScoreGain < scanNextThreshold;
      const protectB2SectorScanFromPlanetCap = scanCheck.ok
        && shouldAiProtectB2SectorScanFromPlanetCap(currentPlayer);
      if (immediatePlanetActionScore >= 12 && !protectB2SectorScanFromPlanetCap) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, immediatePlanetActionScore - 7)),
        );
      }
      if (getAiRoundNumber() <= 2 && launchCandidate.available && Number(launchCandidate.score || 0) >= 12) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, Number(launchCandidate.score || 0) - 8)),
        );
      }
      if (
        getAiRoundNumber() >= 3
        && Math.max(0, aiNumber(currentPlayer?.resources?.score)) < 25
        && launchCandidate.available
        && Number(launchCandidate.score || 0) >= 10
      ) {
        scanScore = Math.min(scanScore, Math.max(0, Number(launchCandidate.score || 0) - 2));
      }
      const bestEarlyMoveScore = getAiRoundNumber() <= 2 ? bestMoveScore : 0;
      if (bestEarlyMoveScore >= 10) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, bestEarlyMoveScore - 3)),
        );
      }
      const routeCashoutMoveScore = getAiRoundNumber() >= 3
        && Math.max(0, aiNumber(currentPlayer?.resources?.energy)) <= 3
        && bestMoveScore >= 16
        && scanScore <= bestMoveScore + 3
        ? bestMoveScore
        : 0;
      if (routeCashoutMoveScore > 0) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, routeCashoutMoveScore - 3)),
        );
      }
      const analyzeCashoutScore = getAiRoundNumber() >= 2
        && Math.max(0, aiNumber(currentPlayer?.resources?.energy)) <= 2
        && analyzeScore >= 18
        && scanScore <= analyzeScore + 8
        ? analyzeScore
        : 0;
      if (analyzeCashoutScore > 0) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, analyzeCashoutScore - 2)),
        );
      }
      const scanEnergyCost = scanCheck.ok
        ? Math.max(0, aiNumber(scanEffects.getStandardScanCost?.(currentPlayer)?.energy))
        : 0;
      const currentEnergy = Math.max(0, aiNumber(currentPlayer?.resources?.energy));
      const analyzeEnergyCost = Math.max(0, getAiAnalyzeEnergyCost(currentPlayer));
      const weakFinalAnalyzeEnergyCap = scanCheck.ok
        && analyzeCheck.ok
        && currentPlayer?.aiDifficulty === AI_DIFFICULTY_WEAK_START
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && scanEnergyCost > 0
        && analyzeEnergyCost > 0
        && currentEnergy >= scanEnergyCost
        && currentEnergy - scanEnergyCost < analyzeEnergyCost
        && Math.max(0, aiNumber(currentPlayer?.resources?.availableData)) >= 3
        && analyzeScore >= 8
        && analyzeScore < 18
        && scanScore > analyzeScore
        && scanDirectScoreGain <= analyzeDirectScoreGain
        && scanCurrentScore < 170
          ? Math.max(0, analyzeScore - 1)
          : null;
      if (weakFinalAnalyzeEnergyCap !== null) {
        scanScore = Math.min(scanScore, weakFinalAnalyzeEnergyCap);
      }
      const scanEnergyReservationPenalty = scanCheck.ok
        ? scoreAiScanEnergyReservationPenalty(currentPlayer)
        : 0;
      if (scanEnergyReservationPenalty > 0) {
        scanScore = Math.max(0, scanScore - scanEnergyReservationPenalty);
      }
      if (scanFinalThresholdMiss) {
        scanScore = Math.min(scanScore, Math.max(0, scanDirectScoreGain) * 2);
      }
      const scanScoreCapReason = scanFinalThresholdMiss
        ? "终局临门扫描直接分不足"
        : scanCheck.ok && immediatePlanetActionScore >= 12 && !protectB2SectorScanFromPlanetCap
        ? "优先兑现当前位置的环绕/登陆"
          : scanCheck.ok && getAiRoundNumber() <= 2 && launchCandidate.available && Number(launchCandidate.score || 0) >= 12
            ? "优先建立火箭数量"
            : scanCheck.ok
              && getAiRoundNumber() >= 3
              && Math.max(0, aiNumber(currentPlayer?.resources?.score)) < 25
              && launchCandidate.available
              && Number(launchCandidate.score || 0) >= 10
                ? "低于25分时优先发射建立得分路线"
                : scanCheck.ok && bestEarlyMoveScore >= 10
                    ? "优先保持早期移动路线"
                    : scanCheck.ok && routeCashoutMoveScore > 0
                      ? "优先兑现第3轮移动路线"
                      : scanCheck.ok && analyzeCashoutScore > 0
                        ? "优先兑现数据分析"
                        : scanCheck.ok && weakFinalAnalyzeEnergyCap !== null
                          ? "保留终局分析能量"
                          : scanCheck.ok && scanEnergyReservationPenalty > 0
                            ? "保留星球兑现能量"
                            : null;
      candidates.push({
        id: "scan",
        kind: "main",
        available: scanCheck.ok,
        reason: scanCheck.message || null,
        score: scanScore,
        directScoreGain: scanDirectScoreGain,
        scoreCapReason: scanScoreCapReason,
        targetPreview: scanCheck.ok ? buildAiScanActionTargetPreview(currentPlayer) : null,
        valueBreakdown: {
          directScoreGain: scanDirectScoreGain,
          scanEnergyReservationPenalty,
          weakFinalAnalyzeEnergyCap,
        },
      });
      candidates.push({
        id: "analyze",
        kind: "main",
        available: analyzeCheck.ok,
        reason: analyzeCheck.message || null,
        score: analyzeScore,
        directScoreGain: analyzeDirectScoreGain,
        scoreCapReason: analyzeBreakdown?.scoreCapReason || null,
        valueBreakdown: analyzeBreakdown,
      });
      const playCardCandidates = listAiPlayCardCandidates(getCurrentPlayer());
      const bestPlayCardCandidate = [...playCardCandidates]
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
      const bestPlayCardScore = Number(bestPlayCardCandidate?.score || 0);
      const bestPlayCardBreakdown = bestPlayCardCandidate?.valueBreakdown || {};
      candidates.push({
        id: "playCard",
        kind: "main",
        available: playCardCandidates.length > 0,
        reason: playCardCandidates.length > 0
          ? null
          : "没有资源可支付的普通手牌",
        playableCards: playCardCandidates,
        cardId: bestPlayCardCandidate?.cardId || null,
        cardInstanceId: bestPlayCardCandidate?.cardInstanceId || null,
        cardLabel: getAiCardDisplayLabel(bestPlayCardCandidate, currentPlayer),
        plan: bestPlayCardCandidate?.plan || null,
        effectTypes: bestPlayCardCandidate?.effectTypes || [],
        finalFormulaDeltas: bestPlayCardCandidate?.finalFormulaDeltas || null,
        directScoreGain: Math.max(0, aiNumber(bestPlayCardCandidate?.directScoreGain)),
        finalMarkCashoutIncluded: true,
        score: applyAiStrategyWeight(bestPlayCardScore, "engine", 0.5),
        valueBreakdown: {
          directScoreGain: Math.max(0, aiNumber(bestPlayCardCandidate?.directScoreGain)),
          c2Type3ProgressValue: Math.max(0, aiNumber(bestPlayCardBreakdown.c2Type3ProgressValue)),
          cFinalTaskProgressValue: Math.max(0, aiNumber(bestPlayCardBreakdown.cFinalTaskProgressValue)),
          endGameExpectedScore: Math.max(0, aiNumber(bestPlayCardBreakdown.endGameExpectedScore)),
          playCardConversionPressure: Math.max(0, aiNumber(bestPlayCardBreakdown.playCardConversionPressure)),
          finalUnreadyTaskSetupSuppressed: Boolean(bestPlayCardBreakdown.finalUnreadyTaskSetupSuppressed),
        },
      });
      const scanCandidate = candidates.find((candidate) => candidate?.id === "scan");
      const researchTechCandidate = candidates.find((candidate) => candidate?.id === "researchTech");
      const playCardCandidate = candidates.find((candidate) => candidate?.id === "playCard");
      const weakEarlyB2SetupScanTieBreak = scoreAiWeakEarlyB2SetupScanTieBreak(
        currentPlayer,
        scanCandidate,
        researchTechCandidate,
      );
      if (weakEarlyB2SetupScanTieBreak > 0 && scanCandidate) {
        scanCandidate.score = roundAiScore(aiNumber(scanCandidate.score) + weakEarlyB2SetupScanTieBreak);
        scanCandidate.valueBreakdown = {
          ...(scanCandidate.valueBreakdown || {}),
          weakEarlyB2SetupScanTieBreak,
        };
      }
      const weakFinalB2TargetedScanTieBreak = scoreAiWeakFinalB2TargetedScanTieBreak(
        currentPlayer,
        scanCandidate,
        playCardCandidate,
      );
      if (weakFinalB2TargetedScanTieBreak > 0 && scanCandidate) {
        scanCandidate.score = roundAiScore(aiNumber(scanCandidate.score) + weakFinalB2TargetedScanTieBreak);
        scanCandidate.valueBreakdown = {
          ...(scanCandidate.valueBreakdown || {}),
          weakFinalB2TargetedScanTieBreak,
        };
      }
      const strongestNonLaunchMain = candidates
        .filter((candidate) => (
          candidate?.kind === "main"
          && candidate.available !== false
          && candidate.id !== "launch"
        ))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
      const strongestPlanetMain = ["orbit", "land"].includes(strongestNonLaunchMain?.id)
        ? strongestNonLaunchMain
        : null;
      const strongestPlanetScore = Math.max(0, aiNumber(strongestPlanetMain?.score));
      const strongestPlanetDirectScore = Math.max(0, aiNumber(strongestPlanetMain?.directScoreGain));
      const needsFirstThresholdCatchup = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1)) >= FINAL_ROUND_NUMBER
        && Math.max(0, aiNumber(currentPlayer?.resources?.score)) < 25;
      const finalCatchupMoveScoreCap = needsFirstThresholdCatchup && Number(strongestNonLaunchMain?.score || 0) >= 15
        ? Math.max(0, Number(strongestNonLaunchMain.score || 0) - 1)
        : null;
      const immediatePlanetCashoutMoveScoreCap = strongestPlanetDirectScore > 0
        && strongestPlanetScore >= 20
        && getAiRoundNumber() <= 3
        ? Math.max(0, strongestPlanetScore - 0.5)
        : null;
      const moveCandidates = preMoveCandidates.map((candidate) => {
        let scoreCap = null;
        let scoreCapReason = null;
        const candidateScore = Number(candidate.score || 0);
        if (
          finalCatchupMoveScoreCap != null
          && !candidate.followupMainAction?.actionId
          && candidateScore > finalCatchupMoveScoreCap
        ) {
          scoreCap = finalCatchupMoveScoreCap;
          scoreCapReason = `保留强主行动 ${strongestNonLaunchMain.id}`;
        }
        if (immediatePlanetCashoutMoveScoreCap != null) {
          const followupDirectScore = Math.max(0, aiNumber(candidate.followupMainAction?.directScoreGain));
          if (
            strongestPlanetDirectScore > followupDirectScore
            && candidateScore > immediatePlanetCashoutMoveScoreCap
          ) {
            scoreCap = scoreCap == null
              ? immediatePlanetCashoutMoveScoreCap
              : Math.min(scoreCap, immediatePlanetCashoutMoveScoreCap);
            scoreCapReason = `优先兑现当前${strongestPlanetMain.id === "land" ? "登陆" : "环绕"}得分`;
          }
        }
        if (scoreCap == null) {
          return candidate;
        }
        const cappedGain = scoreCap + Math.max(0, aiNumber(candidate.cost));
        return {
          ...candidate,
          uncappedScore: candidate.score,
          uncappedGain: candidate.gain,
          gain: cappedGain,
          score: scoreCap,
          scoreCapReason,
          valueBreakdown: {
            ...(candidate.valueBreakdown || {}),
            uncappedMovementGain: candidate.valueBreakdown?.movementGain,
            movementGain: cappedGain,
          },
        };
      });
      candidates.push(...moveCandidates);
      const industryCandidate = buildAiIndustryCandidate(currentPlayer);
      if (industryCandidate) candidates.push(industryCandidate);
      candidates.push(...listAiEmergencyAnalyzeEnergyTradeCandidates(currentPlayer));
      candidates.push(...listAiFinalAnalyzeEnergyTradeCandidates(currentPlayer));
      candidates.push(...listAiThirdFinalMarkResourceTradeCandidates(currentPlayer));
      candidates.push(...listAiMainUnlockTradeCandidates(currentPlayer, playCardCandidates, candidates));
      candidates.push(...listAiFinalReadyTaskCreditChainTradeCandidates(currentPlayer));
      candidates.push(...listAiResourceLockMainUnlockTradeCandidates(currentPlayer, candidates));
      candidates.push(...listAiLateResourceRecoveryTradeCandidates(currentPlayer, candidates));
      candidates.push(...listAiDataPlacementCandidates(currentPlayer));
      candidates.push(...listAiRunezuFaceSymbolQuickCandidates(currentPlayer));
      candidates.push(...listAiCardCornerQuickCandidates(currentPlayer, playCardCandidates));
      candidates.push({
        id: "pass",
        kind: "pass",
        available: true,
        reason: null,
        score: scoreAiPassAction(currentPlayer) + (getAiStrategyWeight("pass") - 1) * 10,
      });
      return candidates;
    }

    function enumerateHeadlessTurnActions() {
      const actionContext = createActionContext();
      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer || !isAiAutoBattlePlayer(currentPlayer.id)) return [];
      if (isActionEffectFlowActive() || hasActivePendingSubFlow()) return [];

      const candidates = [];
      const add = (candidate) => {
        if (candidate?.available !== false) candidates.push({ ...candidate, available: true });
      };

      if (!state.pendingActionExecuted && canStartMainAction()) {
        for (const id of ["launch", "orbit", "land", "researchTech"]) {
          const check = actions.canExecute(id, actionContext);
          if (!check?.ok) continue;
          add({
            id,
            kind: "main",
            planetId: check.planet?.planetId || null,
            choices: check.choices || null,
            takeable: check.takeable || null,
          });
        }
        const scanCheck = scanEffects.canExecuteScan(currentPlayer, { standardAction: true });
        if (scanCheck?.ok) add({ id: "scan", kind: "main" });
        const analyzeCheck = canAiAnalyzeData(currentPlayer);
        if (analyzeCheck?.ok) add({ id: "analyze", kind: "main" });
        for (const [handIndex, card] of (currentPlayer.hand || []).entries()) {
          add({
            id: "playCard",
            kind: "main",
            handIndex,
            cardId: card?.cardId || card?.id || null,
            cardInstanceId: card?.instanceId || null,
          });
        }
      }

      if (canAiMoveThisTurn?.(currentPlayer.id)) {
        for (const rocket of getMovableTokensForPlayer?.(currentPlayer.id) || []) {
          for (const direction of AI_MOVE_DIRECTIONS || []) {
            add({
              id: "move",
              kind: "quick",
              rocketId: rocket.id,
              direction: direction.id,
              deltaX: direction.deltaX,
              deltaY: direction.deltaY,
            });
          }
        }
      }

      for (const trade of quickTrades?.TRADE_ACTIONS || []) {
        if (quickTrades.canExecuteTrade(trade.id, actionContext)?.ok) {
          add({ id: "quickTrade", kind: "quick", tradeId: trade.id });
        }
      }

      const dataCheck = data?.canPlaceAnyData?.(currentPlayer);
      for (const choice of dataCheck?.ok ? (dataCheck.choices || data.listPlaceDataChoices?.(currentPlayer) || []) : []) {
        add({
          id: "placeData",
          kind: "quick",
          target: choice.target || null,
          blueSlot: choice.blueSlot ?? null,
          placementSlot: choice.placementSlot ?? null,
        });
      }

      const industryCard = currentPlayer.initialSelection?.industry || null;
      const industryLayout = industry?.getIndustryActionMarkerLayout?.(industryCard);
      const industryCheck = industry?.canMarkIndustryAction?.(currentPlayer, turnState.roundNumber, {
        turnNumber: turnState.turnNumber,
        hasMarker: Boolean(industryLayout),
        industryCard,
      });
      if (industryCheck?.ok) {
        add({ id: "industry", kind: "quick", industryCard });
      }

      for (const [handIndex, card] of (currentPlayer.hand || []).entries()) {
        const resourceReward = cards?.getDiscardActionRewardForCard?.(card);
        const moveReward = cards?.getDiscardActionMoveRewardForCard?.(card);
        if (!resourceReward && !moveReward) continue;
        add({
          id: "cardCorner",
          kind: "quick",
          handIndex,
          cardId: card?.cardId || card?.id || null,
          cardInstanceId: card?.instanceId || null,
        });
      }

      for (const alienSlotId of aliens?.ALIEN_SLOT_IDS || []) {
        if (!runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId)) continue;
        for (const position of runezu.FACE_SYMBOL_POSITIONS || []) {
          const check = runezu.canPlaceFaceSymbol?.(alienGameState, position, currentPlayer);
          for (const choice of check?.ok ? (check.choices || []) : []) {
            add({
              id: "runezuFaceSymbol",
              kind: "quick",
              alienSlotId: Number(alienSlotId),
              position: Number(check.position),
              symbolId: choice.symbolId,
            });
          }
        }
      }

      add(state.pendingActionExecuted
        ? { id: "end-turn", kind: "end-turn" }
        : { id: "pass", kind: "pass" });
      return candidates;
    }


    function executeAiTurnAction(action, currentPlayer = getCurrentPlayer()) {
      if (typeof dispatchRuntimeAction === "function" && [
        "end-turn",
        "launch",
        "researchTech",
        "orbit",
        "land",
        "scan",
        "analyze",
        "playCard",
        "pass",
      ].includes(action?.id)) {
        return dispatchRuntimeAction({ kind: action.id, payload: action });
      }
      if (action.id === "end-turn") {
        endCurrentTurn();
        return { ok: true, progressed: true, action };
      }
      if (action.id === "launch") {
        return runAction("launch");
      }
      if (action.id === "researchTech") {
        return researchTechForCurrentPlayer();
      }
      if (action.id === "orbit") {
        return orbitForCurrentPlayer();
      }
      if (action.id === "land") {
        return landForCurrentPlayer();
      }
      if (action.id === "scan") {
        return beginScanAction();
      }
      if (action.id === "analyze") {
        return analyzeDataForCurrentPlayer();
      }
      if (action.id === "playCard") {
        return beginPlayCardSelection();
      }
      if (action.id === "cardCorner") {
        return runAiCardCornerQuickActionDecision(action);
      }
      if (action.id === "runezuFaceSymbol") {
        return runAiRunezuFaceSymbolQuickActionDecision(action);
      }
      if (action.id === "industry") {
        recordAiAutoBattleLog("industry", `${currentPlayer.colorLabel}AI 使用公司 1x：${action.companyLabel}`, {
          action,
        });
        const result = handleCompanyActionMarkerClick(action.industryCard);
        return result || { ok: true, progressed: true, action };
      }
      if (action.id === "move") {
        return runAiMoveActionDecision(action);
      }
      if (action.id === "placeData") {
        return confirmDataPlacement(action.target, action.blueSlot);
      }
      if (action.id === "quickTrade") {
        return runQuickTrade(action.tradeId, {
          preserveHandIndex: action.preserveHandIndex,
          aiReason: action.reason || null,
          preferBlindDraw: action.preferBlindDraw === true,
        });
      }
      if (action.id === "pass") {
        return passForCurrentPlayer();
      }
      return { ok: false, message: `AI 尚不支持行动 ${action.id}` };
    }

    function shouldRetryAiTurnAction(action, result) {
      if (!action || action.id === "end-turn" || action.id === "pass") return false;
      return result?.ok === false && !result.blocked && !result.progressed;
    }

    function rejectAiTurnActionCandidate(candidates, action, result) {
      return (candidates || []).map((candidate) => (
        candidate === action
          ? {
            ...candidate,
            available: false,
            reason: result?.message || candidate.reason || "AI 执行前二次校验失败",
            rejectedByAiExecution: true,
          }
          : candidate
      ));
    }

    function buildAiPlannerShadowDecision(candidates = [], graphState = {}, player = null, selectedAction = null) {
      const plan = ai?.planner?.chooseTurnPlan?.(candidates, graphState, player?.id || null, {
        quickBeamWidth: 3,
        mainBeamWidth: 6,
      }) || null;
      const firstAction = plan?.firstAction || null;
      if (!firstAction) return null;
      return {
        key: plan.key || null,
        type: plan.type || null,
        score: roundAiScore(aiNumber(plan.score)),
        firstAction: {
          id: firstAction.id || null,
          kind: firstAction.kind || null,
          score: roundAiScore(aiNumber(firstAction.score)),
          actionGraphNet: Number.isFinite(Number(firstAction.actionGraph?.net))
            ? roundAiScore(aiNumber(firstAction.actionGraph.net))
            : null,
          planActionId: firstAction.plan?.quickActionId || firstAction.plan?.actionId || null,
        },
        policyActionId: selectedAction?.id || null,
        diverged: Boolean(selectedAction?.id && selectedAction.id !== firstAction.id),
      };
    }

    function buildAiTurnActionCandidates(currentPlayer = getCurrentPlayer()) {
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return {
          ok: false,
          blocked: true,
          message: `${currentPlayer?.colorLabel || "当前玩家"}不是电脑玩家`,
          candidates: [],
        };
      }
      const rawCandidates = enumerateAiTurnActions();
      const markedFinalFormulas = getAiMarkedFinalFormulaEntries(currentPlayer);
      const traceCompetition = getAiTraceCompetitionState(currentPlayer);
      const graphState = {
        playerState,
        turnState,
        alienGameState,
        finalScoringState,
        currentPlayer,
        aiMarkedFinalFormulas: markedFinalFormulas,
        aiTraceCompetition: traceCompetition,
      };
      const graphCandidates = ai?.actionGraph?.buildActionGraph
        ? ai.actionGraph.buildActionGraph(rawCandidates, graphState, currentPlayer?.id, {
          markedFormulas: markedFinalFormulas,
          hasMarkedFinalTile: markedFinalFormulas.length > 0,
          traceCompetition,
        })
        : null;
      const graphAdjustedCandidates = Array.isArray(graphCandidates) && graphCandidates.length === rawCandidates.length
        ? graphCandidates.map((candidate, index) => {
          const adjustedCandidate = adjustAiActionGraphCandidateForStyle(
            rawCandidates[index],
            adjustAiActionGraphCandidate(rawCandidates[index], candidate, currentPlayer),
            currentPlayer,
            markedFinalFormulas,
          );
          return {
            ...rawCandidates[index],
            actionGraph: {
              gain: adjustedCandidate.gain,
              cost: adjustedCandidate.cost,
              finalMarginal: adjustedCandidate.finalMarginal,
              goalBonus: adjustedCandidate.goalBonus,
              feasibility: adjustedCandidate.feasibility,
              net: adjustedCandidate.net,
            },
            breakdown: adjustedCandidate.breakdown,
          };
        })
        : rawCandidates;
      return {
        ok: true,
        currentPlayer,
        rawCandidates,
        graphState,
        candidates: applyAiTurnActionSelectionPressure(graphAdjustedCandidates),
      };
    }

    function runAiTurnActionDecision() {
      const currentPlayer = getCurrentPlayer();
      const buildResult = buildAiTurnActionCandidates(currentPlayer);
      if (!buildResult.ok) return buildResult;
      const { rawCandidates, graphState, candidates } = buildResult;
      let selectableCandidates = candidates;
      const rejectedActions = [];
      const maxAttempts = Math.max(1, candidates.length);

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const action = ai?.policy?.chooseTurnAction?.(selectableCandidates, {
          playerState,
          turnState,
          currentPlayer,
        }) || null;
        if (!action) {
          if (!rawCandidates.length && state.actionHistoryHasSession && !state.pendingActionExecuted) {
            const recovery = recoverPendingActionFromOpenHistoryForAi?.();
            if (recovery?.ok) {
              endCurrentTurn();
              recordAiAutoBattleLog("turn-action", `${currentPlayer.colorLabel}AI 恢复并结束当前行动`, {
                recovery,
                sessionInfo: state.actionHistorySessionInfo || null,
              });
              return {
                ok: true,
                progressed: true,
                action: { id: "end-turn-recovered" },
                recovery,
              };
            }
          }
          return {
            ok: false,
            blocked: true,
            message: rejectedActions.length ? "AI 候选均执行失败" : "AI 没有可执行行动",
            candidates: selectableCandidates,
            rejectedActions,
          };
        }
        const resourceLockTradePreviews = action.id === "pass"
          ? buildAiResourceLockTradePreviews(currentPlayer, selectableCandidates)
          : [];
        const earlyNoMainPublicRefillDiagnostic = action.id === "pass"
          ? buildAiEarlyNoMainPublicRefillDiagnostic(currentPlayer, selectableCandidates)
          : null;
        const finalLowHandPassRecoveryDiagnostic = action.id === "pass"
          ? buildAiFinalLowHandPassRecoveryDiagnostic(currentPlayer, selectableCandidates)
          : null;
        const finalHighScorePassRecoveryDiagnostic = action.id === "pass"
          ? buildAiFinalHighScorePassRecoveryDiagnostic(currentPlayer, selectableCandidates)
          : null;
        const plannerShadow = buildAiPlannerShadowDecision(selectableCandidates, graphState, currentPlayer, action);
        recordAiAutoBattleLog("turn-action", `${currentPlayer.colorLabel}AI 执行 ${action.id}`, {
          action,
          candidates: selectableCandidates,
          ...(plannerShadow ? { plannerShadow } : {}),
          ...(resourceLockTradePreviews.length ? { resourceLockTradePreviews } : {}),
          ...(earlyNoMainPublicRefillDiagnostic ? { earlyNoMainPublicRefillDiagnostic } : {}),
          ...(finalLowHandPassRecoveryDiagnostic ? { finalLowHandPassRecoveryDiagnostic } : {}),
          ...(finalHighScorePassRecoveryDiagnostic ? { finalHighScorePassRecoveryDiagnostic } : {}),
        });
        const result = executeAiTurnAction(action, currentPlayer);
        if (shouldRetryAiTurnAction(action, result)) {
          rejectedActions.push({
            id: action.id || null,
            reason: result?.message || null,
            action,
          });
          recordAiAutoBattleLog("turn-action-retry", `${currentPlayer.colorLabel}AI 剔除失效行动 ${action.id}`, {
            action,
            result,
          });
          selectableCandidates = rejectAiTurnActionCandidate(selectableCandidates, action, result);
          continue;
        }
        return result;
      }

      return {
        ok: false,
        blocked: true,
        message: "AI 候选均执行失败",
        candidates: selectableCandidates,
        rejectedActions,
      };
    }

    return {
      enumerateAiTurnActions,
      enumerateHeadlessTurnActions,
      executeAiTurnAction,
      shouldRetryAiTurnAction,
      rejectAiTurnActionCandidate,
      buildAiPlannerShadowDecision,
      buildAiTurnActionCandidates,
      runAiTurnActionDecision,
    };
  }

  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "AI_DIFFICULTY_WEAK_START", "AI_MOVE_DIRECTIONS", "FINAL_ROUND_NUMBER", "actions", "adjustAiActionGraphCandidate", "adjustAiActionGraphCandidateForStyle", "ai", "aiNumber", "alienGameState", "aliens", "canAiMoveThisTurn", "cards",
    "analyzeDataForCurrentPlayer", "applyAiStrategyWeight", "applyAiTurnActionSelectionPressure", "beginPlayCardSelection", "beginScanAction", "buildAiAnalyzeActionValueBreakdown", "buildAiEarlyNoMainPublicRefillDiagnostic", "buildAiFinalHighScorePassRecoveryDiagnostic",
    "buildAiFinalLowHandPassRecoveryDiagnostic", "buildAiIndustryCandidate", "buildAiResearchTechCandidate", "buildAiResourceLockTradePreviews", "buildAiScanActionTargetPreview", "canAiAnalyzeData", "canStartMainAction", "confirmDataPlacement",
    "createActionContext", "data", "dispatchRuntimeAction", "endCurrentTurn", "finalScoringState", "getAiAnalyzeEnergyCost", "getAiBestLandDirectScoreGain", "getAiCardDisplayLabel", "getAiMarkedFinalFormulaEntries", "getMovableTokensForPlayer",
    "getAiNextMissingFinalScoreThreshold", "getAiOrbitDirectScoreGain", "getAiRoundNumber", "getAiScanDirectScoreGain", "getAiStrategyWeight", "getAiTraceCompetitionState", "getCurrentPlayer", "handleCompanyActionMarkerClick",
    "hasActivePendingSubFlow", "industry", "isActionEffectFlowActive", "isAiAutoBattlePlayer", "landForCurrentPlayer", "listAiCardCornerQuickCandidates", "listAiDataPlacementCandidates", "listAiEmergencyAnalyzeEnergyTradeCandidates", "listAiFinalAnalyzeEnergyTradeCandidates",
    "listAiFinalReadyTaskCreditChainTradeCandidates", "listAiLateResourceRecoveryTradeCandidates", "listAiMainUnlockTradeCandidates", "listAiMoveCandidates", "listAiPlayCardCandidates", "listAiResourceLockMainUnlockTradeCandidates", "listAiRunezuFaceSymbolQuickCandidates", "listAiThirdFinalMarkResourceTradeCandidates",
    "orbitForCurrentPlayer", "passForCurrentPlayer", "playerState", "quickTrades", "recordAiAutoBattleLog", "recoverPendingActionFromOpenHistoryForAi", "researchTechForCurrentPlayer", "roundAiScore", "runezu", "runAction",
    "runAiCardCornerQuickActionDecision", "runAiMoveActionDecision", "runAiRunezuFaceSymbolQuickActionDecision", "runQuickTrade", "scanEffects", "scoreAiLandAction", "scoreAiLaunchTurnCandidateValue", "scoreAiOrbitAction",
    "scoreAiPassAction", "scoreAiPostLaunchMovePlan", "scoreAiScanAction", "scoreAiScanEnergyReservationPenalty", "scoreAiScanPriorityFloor", "scoreAiWeakEarlyB2SetupScanTieBreak", "scoreAiWeakFinalB2TargetedScanTieBreak", "shouldAiProtectB2SectorScanFromPlanetCap",
    "state", "turnState",
  ]);

  return { createActionExecutor, REQUIRED_CONTEXT_KEYS };
});
