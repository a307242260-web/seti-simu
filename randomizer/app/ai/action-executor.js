(function (root, factory) {
  "use strict";

  let heuristicEvaluator = root.SetiHeuristicEvaluator;
  if (!heuristicEvaluator && typeof require === "function") {
    heuristicEvaluator = require("../../game/ai/heuristic-evaluator");
  }
  let turnCandidateEnumerator = root.SetiAITurnCandidateEnumerator;
  if (!turnCandidateEnumerator && typeof require === "function") {
    turnCandidateEnumerator = require("../../game/ai/turn-candidate-enumerator");
  }
  const api = factory(heuristicEvaluator, turnCandidateEnumerator);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAiActionExecutor = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (heuristicEvaluator, turnCandidateEnumerator) {
  "use strict";

  function createActionExecutor(context) {
    if (!context || typeof context !== "object") {
      throw new Error("createActionExecutor requires explicit app context");
    }
    const {
      AI_DIFFICULTY_WEAK_START, FINAL_ROUND_NUMBER, actions, adjustAiActionGraphCandidate, adjustAiActionGraphCandidateForStyle, ai, aiNumber,
      analyzeDataForCurrentPlayer, applyAiStrategyWeight, applyAiTurnActionSelectionPressure, beginPlayCardSelection, beginScanAction, buildAiAnalyzeActionValueBreakdown, buildAiEarlyNoMainPublicRefillDiagnostic, buildAiFinalHighScorePassRecoveryDiagnostic,
      buildAiFinalLowHandPassRecoveryDiagnostic, buildAiIndustryCandidate, buildAiResearchTechCandidate, buildAiResourceLockTradePreviews, buildAiScanActionTargetPreview, canAiAnalyzeData, canPayForMove, canStartMainAction, confirmDataPlacement,
      AI_MOVE_DIRECTIONS, aliens, canAiMoveThisTurn, canUseCardCornerQuickAction, cards, confirmPlayCardSelection, createActionContext, data, dispatchRuntimeAction, endCurrentTurn, getAiAnalyzeEnergyCost, getAiBestLandDirectScoreGain, getAiCardDisplayLabel, getAiMarkedFinalFormulaEntries, handlePlayCardSelect,
      getAiNextMissingFinalScoreThreshold, getAiOrbitDirectScoreGain, getAiRoundNumber, getAiScanDirectScoreGain, getAiStrategyWeight, getAiTraceCompetitionState, getCardPlayCost, getRequiredMovePointsForUi, handleCompanyActionMarkerClick,
      getMovableTokensForPlayer, hasActivePendingSubFlow, industry, isActionEffectFlowActive, isAiAutoBattlePlayer, landForCurrentPlayer, listAiCardCornerQuickCandidates, listAiDataPlacementCandidates, listAiEmergencyAnalyzeEnergyTradeCandidates, listAiFinalAnalyzeEnergyTradeCandidates,
      listAiFinalReadyTaskCreditChainTradeCandidates, listAiLateResourceRecoveryTradeCandidates, listAiMainUnlockTradeCandidates, listAiMoveCandidates, listAiPlayCardCandidates, listAiResourceLockMainUnlockTradeCandidates, listAiRunezuFaceSymbolQuickCandidates, listAiThirdFinalMarkResourceTradeCandidates,
      moveRocket, orbitForCurrentPlayer, passForCurrentPlayer, players, quickTrades, recordAiAutoBattleLog, recoverPendingActionFromOpenHistoryForAi, researchTechForCurrentPlayer, rocketActions, roundAiScore, runezu, runAction,
      runAiCardCornerQuickActionDecision, runAiMoveActionDecision, runAiRunezuFaceSymbolQuickActionDecision, runQuickTrade, scanEffects, scoreAiLandAction, scoreAiLaunchTurnCandidateValue, scoreAiOrbitAction,
      scoreAiPassAction, scoreAiPostLaunchMovePlan, scoreAiScanAction, scoreAiScanEnergyReservationPenalty, scoreAiScanPriorityFloor, scoreAiWeakEarlyB2SetupScanTieBreak, scoreAiWeakFinalB2TargetedScanTieBreak, shouldAiProtectB2SectorScanFromPlanetCap,
      state,
    } = context;

    const { enumerateAiTurnActions } = turnCandidateEnumerator.createTurnCandidateEnumerator(context);
    const selectScoredItem = ai?.heuristicEvaluator?.selectScoredItem || heuristicEvaluator.selectScoredItem;

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("AI action executor requires an explicit workingRoot");
      }
      return workingRoot;
    }

    function enumerateHeadlessTurnActions(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const currentPlayer = players.getCurrentPlayer(playerState);
      if (!currentPlayer || !isAiAutoBattlePlayer(currentPlayer.id)) return [];
      if (isActionEffectFlowActive() || hasActivePendingSubFlow()) return [];
      const result = dispatchRuntimeAction?.(workingRoot, { kind: "standard_enumerate" });
      if (!result?.ok) return [];
      return (result.candidates || [])
        .filter((standardAction) => standardAction.phase !== "conditional")
        .map((standardAction) => ({
          id: standardAction.family,
          kind: standardAction.phase,
          family: standardAction.family,
          actionId: standardAction.actionId,
          actorId: standardAction.actorId,
          target: structuredClone(standardAction.target || null),
          payload: structuredClone(standardAction.payload || {}),
          standardAction: structuredClone(standardAction),
          available: true,
          label: standardAction.summary,
        }));
    }

    function executeAiTurnAction(workingRoot, action) {
      requireWorkingRoot(workingRoot);
      const standardDescriptor = action?.standardAction
        || (action?.schemaVersion === "seti-standard-action-v1" ? action : null);
      if (!standardDescriptor) {
        return {
          ok: false,
          code: "STANDARD_ACTION_DESCRIPTOR_REQUIRED",
          message: "AI 行动必须携带完整 Standard Action descriptor",
        };
      }
      return dispatchRuntimeAction(workingRoot, { standardAction: standardDescriptor });
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

    function buildAiTurnActionCandidates(workingRoot, currentPlayer = players.getCurrentPlayer(requireWorkingRoot(workingRoot).playerState)) {
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return {
          ok: false,
          blocked: true,
          message: `${currentPlayer?.colorLabel || "当前玩家"}不是电脑玩家`,
          candidates: [],
        };
      }
      const rawCandidates = enumerateAiTurnActions(workingRoot);
      const markedFinalFormulas = getAiMarkedFinalFormulaEntries(currentPlayer);
      const traceCompetition = getAiTraceCompetitionState(currentPlayer);
      const graphState = {
        playerState: workingRoot.playerState,
        turnState: workingRoot.turnState,
        alienGameState: workingRoot.alienGameState,
        finalScoringState: workingRoot.finalScoringState,
        currentPlayer,
        aiMarkedFinalFormulas: markedFinalFormulas,
        aiTraceCompetition: traceCompetition,
      };
      const standardListing = dispatchRuntimeAction?.(workingRoot, { kind: "standard_enumerate", candidates: rawCandidates });
      const pipelineResult = heuristicEvaluator.buildTurnDescriptorEvaluations({
        rawCandidates,
        graphState,
        currentPlayer,
        markedFinalFormulas,
        traceCompetition,
        standardActions: standardListing?.ok && Array.isArray(standardListing.candidates)
          ? standardListing.candidates
          : null,
      }, {
        actionGraph: ai?.actionGraph,
        adjust: adjustAiActionGraphCandidate,
        adjustForStyle: adjustAiActionGraphCandidateForStyle,
        applySelectionPressure: applyAiTurnActionSelectionPressure,
        selectScoredItem,
      });
      const { candidates, selectedAction } = pipelineResult;
      return {
        ok: true,
        currentPlayer,
        rawCandidates,
        graphState,
        candidates,
        selectedAction,
      };
    }

    function runAiTurnActionDecision(workingRoot) {
      const currentPlayer = players.getCurrentPlayer(requireWorkingRoot(workingRoot).playerState);
      const buildResult = buildAiTurnActionCandidates(workingRoot, currentPlayer);
      if (!buildResult.ok) return buildResult;
      const { rawCandidates, graphState, candidates, selectedAction } = buildResult;
      let selectableCandidates = candidates;
      const rejectedActions = [];
      const maxAttempts = Math.max(1, candidates.length);

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const action = attempt === 0 && selectedAction
          ? selectedAction
          : selectScoredItem(selectableCandidates);
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
        const result = executeAiTurnAction(workingRoot, action, currentPlayer);
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
    "AI_DIFFICULTY_WEAK_START", "AI_MOVE_DIRECTIONS", "FINAL_ROUND_NUMBER", "actions", "adjustAiActionGraphCandidate", "adjustAiActionGraphCandidateForStyle", "ai", "aiNumber", "aliens", "canAiMoveThisTurn", "canUseCardCornerQuickAction", "cards", "confirmPlayCardSelection",
    "analyzeDataForCurrentPlayer", "applyAiStrategyWeight", "applyAiTurnActionSelectionPressure", "beginPlayCardSelection", "beginScanAction", "buildAiAnalyzeActionValueBreakdown", "buildAiEarlyNoMainPublicRefillDiagnostic", "buildAiFinalHighScorePassRecoveryDiagnostic",
    "buildAiFinalLowHandPassRecoveryDiagnostic", "buildAiIndustryCandidate", "buildAiResearchTechCandidate", "buildAiResourceLockTradePreviews", "buildAiScanActionTargetPreview", "canAiAnalyzeData", "canPayForMove", "canStartMainAction", "confirmDataPlacement",
    "createActionContext", "data", "dispatchRuntimeAction", "endCurrentTurn", "getAiAnalyzeEnergyCost", "getAiBestLandDirectScoreGain", "getAiCardDisplayLabel", "getAiMarkedFinalFormulaEntries", "getMovableTokensForPlayer",
    "getAiNextMissingFinalScoreThreshold", "getAiOrbitDirectScoreGain", "getAiRoundNumber", "getAiScanDirectScoreGain", "getAiStrategyWeight", "getAiTraceCompetitionState", "getCardPlayCost", "getRequiredMovePointsForUi", "handleCompanyActionMarkerClick", "handlePlayCardSelect",
    "hasActivePendingSubFlow", "industry", "isActionEffectFlowActive", "isAiAutoBattlePlayer", "landForCurrentPlayer", "listAiCardCornerQuickCandidates", "listAiDataPlacementCandidates", "listAiEmergencyAnalyzeEnergyTradeCandidates", "listAiFinalAnalyzeEnergyTradeCandidates",
    "listAiFinalReadyTaskCreditChainTradeCandidates", "listAiLateResourceRecoveryTradeCandidates", "listAiMainUnlockTradeCandidates", "listAiMoveCandidates", "listAiPlayCardCandidates", "listAiResourceLockMainUnlockTradeCandidates", "listAiRunezuFaceSymbolQuickCandidates", "listAiThirdFinalMarkResourceTradeCandidates",
    "moveRocket", "orbitForCurrentPlayer", "passForCurrentPlayer", "players", "quickTrades", "recordAiAutoBattleLog", "recoverPendingActionFromOpenHistoryForAi", "researchTechForCurrentPlayer", "rocketActions", "roundAiScore", "runezu", "runAction",
    "runAiCardCornerQuickActionDecision", "runAiMoveActionDecision", "runAiRunezuFaceSymbolQuickActionDecision", "runQuickTrade", "scanEffects", "scoreAiLandAction", "scoreAiLaunchTurnCandidateValue", "scoreAiOrbitAction",
    "scoreAiPassAction", "scoreAiPostLaunchMovePlan", "scoreAiScanAction", "scoreAiScanEnergyReservationPenalty", "scoreAiScanPriorityFloor", "scoreAiWeakEarlyB2SetupScanTieBreak", "scoreAiWeakFinalB2TargetedScanTieBreak", "shouldAiProtectB2SectorScanFromPlanetCap",
    "state",
  ]);

  return { createActionExecutor, REQUIRED_CONTEXT_KEYS };
});
