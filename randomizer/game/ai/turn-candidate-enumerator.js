(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAITurnCandidateEnumerator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createTurnCandidateEnumerator(context) {
    if (!context || typeof context !== "object") {
      throw new Error("createTurnCandidateEnumerator requires explicit app context");
    }
    const bindings = Object.fromEntries(REQUIRED_CONTEXT_KEYS.map((key) => [key, context[key]]));
    const {
      AI_DIFFICULTY_WEAK_START, FINAL_ROUND_NUMBER, actions, aiNumber, applyAiStrategyWeight,
      buildAiAnalyzeActionValueBreakdown, buildAiIndustryCandidate, buildAiResearchTechCandidate,
      buildAiScanActionTargetPreview, canAiAnalyzeData, canStartMainAction, createActionContext,
      getAiAnalyzeEnergyCost, getAiBestLandDirectScoreGain, getAiCardDisplayLabel,
      getAiNextMissingFinalScoreThreshold, getAiOrbitDirectScoreGain, getAiRoundNumber,
      getAiScanDirectScoreGain, getAiStrategyWeight, hasActivePendingSubFlow,
      isActionEffectFlowActive, listAiCardCornerQuickCandidates, listAiDataPlacementCandidates,
      listAiEmergencyAnalyzeEnergyTradeCandidates, listAiFinalAnalyzeEnergyTradeCandidates,
      listAiFinalReadyTaskCreditChainTradeCandidates, listAiLateResourceRecoveryTradeCandidates,
      listAiMainUnlockTradeCandidates, listAiMoveCandidates, listAiPlayCardCandidates,
      listAiResourceLockMainUnlockTradeCandidates, listAiRunezuFaceSymbolQuickCandidates,
      listAiThirdFinalMarkResourceTradeCandidates, roundAiScore, scanEffects, scoreAiLandAction,
      scoreAiLaunchTurnCandidateValue, scoreAiOrbitAction, scoreAiPassAction,
      scoreAiPostLaunchMovePlan, scoreAiScanAction, scoreAiScanEnergyReservationPenalty,
      scoreAiScanPriorityFloor, scoreAiWeakEarlyB2SetupScanTieBreak,
      scoreAiWeakFinalB2TargetedScanTieBreak, shouldAiProtectB2SectorScanFromPlanetCap,
      players, state,
    } = bindings;

    function enumerateAiTurnActions(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("AI turn candidate enumeration requires an explicit workingRoot");
      }
      const context = createActionContext(workingRoot);
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const candidates = [];
      if (state.pendingActionExecuted && !isActionEffectFlowActive() && !hasActivePendingSubFlow()) {
        const industryCandidate = buildAiIndustryCandidate(workingRoot, currentPlayer);
        if (industryCandidate) candidates.push(industryCandidate);
        candidates.push(...listAiLateResourceRecoveryTradeCandidates(workingRoot, currentPlayer));
        candidates.push(...listAiMoveCandidates(workingRoot));
        candidates.push(...listAiDataPlacementCandidates(currentPlayer));
        candidates.push(...listAiRunezuFaceSymbolQuickCandidates(workingRoot, currentPlayer));
        candidates.push(...listAiCardCornerQuickCandidates(workingRoot, currentPlayer));
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
          .map((tileId) => buildAiResearchTechCandidate(workingRoot, tileId))
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
      const scanCheck = scanEffects.canExecuteScan(currentPlayer, { standardAction: true });
      const preMoveCandidates = listAiMoveCandidates(workingRoot);
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
      let scanScore = scanCheck.ok ? scoreAiScanAction(workingRoot, currentPlayer) : 0;
      const scanDirectScoreGain = scanCheck.ok ? getAiScanDirectScoreGain(workingRoot, currentPlayer) : 0;
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
        ? scoreAiScanEnergyReservationPenalty(workingRoot, currentPlayer)
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
        targetPreview: scanCheck.ok ? buildAiScanActionTargetPreview(workingRoot, currentPlayer) : null,
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
      const playCardCandidates = listAiPlayCardCandidates(workingRoot, currentPlayer);
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
      const needsFirstThresholdCatchup = Math.max(1, Math.round(aiNumber(workingRoot.turnState.roundNumber) || 1)) >= FINAL_ROUND_NUMBER
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
      const industryCandidate = buildAiIndustryCandidate(workingRoot, currentPlayer);
      if (industryCandidate) candidates.push(industryCandidate);
      candidates.push(...listAiEmergencyAnalyzeEnergyTradeCandidates(workingRoot, currentPlayer));
      candidates.push(...listAiFinalAnalyzeEnergyTradeCandidates(workingRoot, currentPlayer));
      candidates.push(...listAiThirdFinalMarkResourceTradeCandidates(workingRoot, currentPlayer));
      candidates.push(...listAiMainUnlockTradeCandidates(workingRoot, currentPlayer, playCardCandidates, candidates));
      candidates.push(...listAiFinalReadyTaskCreditChainTradeCandidates(workingRoot, currentPlayer));
      candidates.push(...listAiResourceLockMainUnlockTradeCandidates(workingRoot, currentPlayer, candidates));
      candidates.push(...listAiLateResourceRecoveryTradeCandidates(workingRoot, currentPlayer, candidates));
      candidates.push(...listAiDataPlacementCandidates(currentPlayer));
      candidates.push(...listAiRunezuFaceSymbolQuickCandidates(workingRoot, currentPlayer));
      candidates.push(...listAiCardCornerQuickCandidates(workingRoot, currentPlayer, playCardCandidates));
      candidates.push({
        id: "pass",
        kind: "pass",
        available: true,
        reason: null,
        score: scoreAiPassAction(currentPlayer) + (getAiStrategyWeight("pass") - 1) * 10,
      });
      return candidates;
    }

    return Object.freeze({
      enumerateAiTurnActions,
    });
  }

  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "AI_DIFFICULTY_WEAK_START", "FINAL_ROUND_NUMBER", "actions", "aiNumber", "applyAiStrategyWeight",
    "buildAiAnalyzeActionValueBreakdown", "buildAiIndustryCandidate", "buildAiResearchTechCandidate",
    "buildAiScanActionTargetPreview", "canAiAnalyzeData", "canStartMainAction", "createActionContext",
    "getAiAnalyzeEnergyCost", "getAiBestLandDirectScoreGain", "getAiCardDisplayLabel",
    "getAiNextMissingFinalScoreThreshold", "getAiOrbitDirectScoreGain", "getAiRoundNumber",
    "getAiScanDirectScoreGain", "getAiStrategyWeight", "hasActivePendingSubFlow",
    "isActionEffectFlowActive", "listAiCardCornerQuickCandidates", "listAiDataPlacementCandidates",
    "listAiEmergencyAnalyzeEnergyTradeCandidates", "listAiFinalAnalyzeEnergyTradeCandidates",
    "listAiFinalReadyTaskCreditChainTradeCandidates", "listAiLateResourceRecoveryTradeCandidates",
    "listAiMainUnlockTradeCandidates", "listAiMoveCandidates", "listAiPlayCardCandidates",
    "listAiResourceLockMainUnlockTradeCandidates", "listAiRunezuFaceSymbolQuickCandidates",
    "listAiThirdFinalMarkResourceTradeCandidates", "roundAiScore", "scanEffects", "scoreAiLandAction",
    "scoreAiLaunchTurnCandidateValue", "scoreAiOrbitAction", "scoreAiPassAction",
    "scoreAiPostLaunchMovePlan", "scoreAiScanAction", "scoreAiScanEnergyReservationPenalty",
    "scoreAiScanPriorityFloor", "scoreAiWeakEarlyB2SetupScanTieBreak",
    "scoreAiWeakFinalB2TargetedScanTieBreak", "shouldAiProtectB2SectorScanFromPlanetCap", "players", "state",
  ]);

  return Object.freeze({ createTurnCandidateEnumerator, REQUIRED_CONTEXT_KEYS });
});
