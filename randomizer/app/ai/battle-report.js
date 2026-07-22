(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SetiAppAiBattleReport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createAiBattleReport(context) {
    if (!context || !context.aiAutoBattleState) {
      throw new Error("createAiBattleReport requires explicit AI battle context");
    }
    with (context) {
        function getAiAutoBattlePlayerResults() {
          const { rocketState, turnState } = getRuleReadout();
          return getActivePlayers().map((player) => {
            const finalScoreBreakdown = computePlayerFinalScoreBreakdown(player);
            const rocketsForPlayer = rocketActions.getRocketsForPlayer
              ? rocketActions.getRocketsForPlayer(rocketState, player.id)
              : [];
            const finalMarks = getAiMarkedFinalFormulaEntries(player);
            const finalFormulaProgress = getAiFinalFormulaProgressForPlayer(player, finalMarks);
            return {
              playerId: player.id,
              playerLabel: player.colorLabel || player.name || player.id,
              companyLabel: getAiIndustryCard(player)?.label || null,
              color: player.color,
              finalScore: finalScoreBreakdown.totalScore ?? player.resources?.score ?? 0,
              baseScore: finalScoreBreakdown.baseScore ?? player.resources?.score ?? 0,
              tileScore: finalScoreBreakdown.tileScore ?? 0,
              cardScore: finalScoreBreakdown.cardScore ?? 0,
              resources: {
                score: player.resources?.score || 0,
                credits: player.resources?.credits || 0,
                energy: player.resources?.energy || 0,
                publicity: player.resources?.publicity || 0,
                availableData: player.resources?.availableData || 0,
                handSize: player.resources?.handSize || 0,
              },
              income: { ...(player.income || {}) },
              completedTaskCount: player.completedTaskCount || 0,
              reservedCount: Array.isArray(player.reservedCards) ? player.reservedCards.length : 0,
              handSize: Array.isArray(player.hand) ? player.hand.length : player.resources?.handSize || 0,
              handCards: summarizeAiResultCards(player.hand, player),
              reservedCards: summarizeAiResultCards(player.reservedCards, player),
              techCount: countAiPlayerTech(player),
              techTypeCounts: getAiPlayerTechTypeCounts(player),
              traceTypeCounts: getAiB1TraceCounts(player),
              finalMarkCount: finalMarks.length,
              finalFormulas: finalMarks.map((entry) => entry.formulaId),
              finalFormulaProgress,
              b2Progress: finalFormulaProgress.b2,
              rocketCount: rocketsForPlayer.length,
              passed: (turnState.passedPlayerIds || []).includes(player.id),
            };
          });
        }

        function getAiAutoBattlePendingState() {
          const currentEffect = getCurrentActionEffect();
          return {
            actionEffectFlowActive: isActionEffectFlowActive(),
            currentEffect: currentEffect
              ? {
                id: currentEffect.id || null,
                type: currentEffect.type || null,
                label: currentEffect.label || null,
                status: currentEffect.status || null,
              }
              : null,
            pendingScanTargetType: state.pendingScanTargetAction?.type || null,
            pendingPublicScanQueue: Boolean(state.pendingPublicScanQueue),
            pendingHandScan: Boolean(state.pendingHandScanAction),
            pendingPassReserve: Boolean(state.pendingPassReserveSelection),
            pendingCardSelection: Boolean(state.pendingCardSelectionAction),
            pendingPlayCardSelection: Boolean(state.pendingPlayCardSelection),
            pendingMovePayment: Boolean(state.pendingMovePayment),
            pendingCardTrigger: Boolean(state.pendingCardTriggerAction),
            pendingCardTriggerFreeMove: Boolean(state.pendingCardTriggerFreeMove),
            pendingCardCornerFreeMove: Boolean(state.pendingCardCornerFreeMove),
            pendingCardTaskCompletion: Boolean(state.pendingCardTaskCompletion),
            pendingStrategyPassiveSlotChoice: Boolean(state.pendingStrategyPassiveSlotChoice),
            pendingJiuzheCardPlay: Boolean(state.pendingJiuzheCardPlay),
            pendingYichangdianCardGain: Boolean(state.pendingYichangdianCardGain),
            pendingYichangdianCornerAction: Boolean(state.pendingYichangdianCornerAction),
            pendingBanrenmaCardGain: Boolean(state.pendingBanrenmaCardGain),
            pendingBanrenmaOpportunity: Boolean(state.pendingBanrenmaOpportunity),
            pendingChongTaskCompletion: Boolean(state.pendingChongTaskCompletion),
            pendingChongCardGain: Boolean(state.pendingChongCardGain),
            pendingChongFossilChoice: Boolean(state.pendingChongFossilChoice),
            pendingAmibaCardGain: Boolean(state.pendingAmibaCardGain),
            pendingAmibaSymbolChoice: Boolean(state.pendingAmibaSymbolChoice),
            pendingAmibaTraceRemoval: Boolean(state.pendingAmibaTraceRemoval),
            pendingAomomoCardGain: Boolean(state.pendingAomomoCardGain),
            pendingRunezuCardGain: Boolean(state.pendingRunezuCardGain),
            pendingRunezuSymbolBranch: Boolean(state.pendingRunezuSymbolBranch),
            pendingRunezuFaceSymbolPlacement: Boolean(state.pendingRunezuFaceSymbolPlacement),
            pendingAlienTrace: Boolean(els.alienTraceOverlay && !els.alienTraceOverlay.hidden),
            pendingLandTarget: Boolean(els.landTargetOverlay && !els.landTargetOverlay.hidden),
            pendingScanAction4: Boolean(els.scanAction4Overlay && !els.scanAction4Overlay.hidden),
            pendingDataPlacement: Boolean(els.dataPlaceOverlay && !els.dataPlaceOverlay.hidden),
            pendingDataPlacementAction: Boolean(state.pendingDataPlaceAction),
            pendingActionEffectCardMove: Boolean(state.pendingActionEffectFlow?.cardMoveEffect),
            pendingActionEffectFreeMove: Boolean(state.pendingActionEffectFlow?.freeMoveMode),
            pendingIndustryAbility: Boolean(state.pendingIndustryAbility),
            pendingIndustryFreeMove: Boolean(state.industryFreeMoveState),
            pendingIndustryHandSelection: isIndustryHandSelectionActive(),
          };
        }

        function buildAiAutoBattleReport(options = {}) {
          const includeAnalysis = options.includeAnalysis !== false;
          const includeDiagnostics = options.includeDiagnostics !== false;
          const report = {
            enabled: aiAutoBattleState.enabled,
            running: aiAutoBattleState.running,
            pausedOnBug: isAiAutomationPaused(),
            playerIds: aiAutoBattleState.playerIds,
            aiDifficulty: aiAutoBattleState.aiDifficulty,
            aiDifficultyLabel: getAiDifficultyLabel(),
            logs: aiAutoBattleState.logs,
            bugs: aiAutoBattleState.bugs,
            lastSummary: aiAutoBattleState.lastSummary,
            playerResults: getAiAutoBattlePlayerResults(),
            pendingState: getAiAutoBattlePendingState(),
            strategyWeights: getAiStrategyWeights(),
            strategyTuningHistory: getAiStrategyTuningHistory().slice(-10),
            strategyTuningRecommendation: getAiStrategyTuningRecommendation(),
          };
          if (includeAnalysis && ai?.analytics?.analyzeBattleReport) {
            report.analysis = ai.analytics.analyzeBattleReport(report);
          }
          if (includeDiagnostics) {
            const lowMarkPlayerDiagnosticsList = buildAiLowMarkPlayerDiagnostics(report);
            report.lowMarkPlayerDiagnostics = lowMarkPlayerDiagnosticsList[0] || null;
            report.lowMarkPlayerDiagnosticsList = lowMarkPlayerDiagnosticsList;
          }
          return report;
        }

        function getAiAutoBattleReport(options = {}) {
          return structuredClone(buildAiAutoBattleReport(options));
        }

        function getAiAutoBattleProgress() {
          const summary = aiAutoBattleState.lastSummary;
          return {
            enabled: aiAutoBattleState.enabled,
            running: aiAutoBattleState.running,
            pausedOnBug: isAiAutomationPaused(),
            logCount: aiAutoBattleState.logs.length,
            bugCount: aiAutoBattleState.bugs.length,
            lastSummary: summary
              ? {
                ok: summary.ok,
                steps: summary.steps,
                stopped: summary.stopped,
                blocked: summary.blocked,
                gameEnded: summary.gameEnded,
                stoppedBeforeRound: summary.stoppedBeforeRound,
                seed: summary.seed,
                message: summary.message,
              }
              : null,
            pendingState: getAiAutoBattlePendingState(),
          };
        }

        function getAiAutoBattleAnalysis() {
          return structuredClone(buildAiAutoBattleReport().analysis || null);
        }

      return { getAiAutoBattlePlayerResults, getAiAutoBattlePendingState, buildAiAutoBattleReport, getAiAutoBattleReport, getAiAutoBattleProgress, getAiAutoBattleAnalysis };
    }
  }

  return { createAiBattleReport };
});
