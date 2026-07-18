(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SetiAppAiTuningHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createAiTuningHistory(context) {
    if (!context || !context.aiAutoBattleState) {
      throw new Error("createAiTuningHistory requires explicit AI battle context");
    }
    with (context) {
        function loadAiStrategyTuningHistory() {
          if (aiAutoBattleState.strategyTuningHistoryLoaded) return aiAutoBattleState.strategyTuningHistory;
          aiAutoBattleState.strategyTuningHistoryLoaded = true;
          try {
            const raw = windowRef.localStorage?.getItem(AI_STRATEGY_TUNING_HISTORY_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            aiAutoBattleState.strategyTuningHistory = Array.isArray(parsed) ? parsed.slice(-50) : [];
            const maxId = aiAutoBattleState.strategyTuningHistory.reduce((best, entry) => (
              Math.max(best, Math.round(Number(entry?.id)) || 0)
            ), 0);
            aiAutoBattleState.nextStrategyTuningHistoryId = maxId + 1;
          } catch (_error) {
            aiAutoBattleState.strategyTuningHistory = [];
            aiAutoBattleState.nextStrategyTuningHistoryId = 1;
          }
          return aiAutoBattleState.strategyTuningHistory;
        }

        function saveAiStrategyTuningHistory() {
          try {
            windowRef.localStorage?.setItem(
              AI_STRATEGY_TUNING_HISTORY_STORAGE_KEY,
              JSON.stringify(aiAutoBattleState.strategyTuningHistory.slice(-50)),
            );
          } catch (_error) {
            // Ignore storage failures; in-memory history remains available for the current page.
          }
        }

        function compactAiStrategyTuningHistoryEntry(summary, options = {}) {
          return {
            id: aiAutoBattleState.nextStrategyTuningHistoryId++,
            createdAt: new Date().toISOString(),
            label: options.label || null,
            gamesRequested: Math.round(Number(options.gamesRequested) || Number(summary?.gameCount) || 0),
            gamesRun: Math.round(Number(options.gamesRun) || Number(summary?.gameCount) || 0),
            appliedWeights: options.appliedWeights ? normalizeAiStrategyWeights(options.appliedWeights) : getAiStrategyWeights(),
            summary: {
              gameCount: summary?.gameCount || 0,
              completedGames: summary?.completedGames || 0,
              blockedGames: summary?.blockedGames || 0,
              completionRate: summary?.completionRate || 0,
              averageSteps: summary?.averageSteps || 0,
              averageWinnerScore: summary?.averageWinnerScore || 0,
              averagePlayerScore: summary?.averagePlayerScore || 0,
              averageMinimumPlayerScore: summary?.averageMinimumPlayerScore || 0,
              p25PlayerScore: summary?.p25PlayerScore || 0,
              playersAtLeast270: summary?.playersAtLeast270 || 0,
              gamesWinnerAtLeast270: summary?.gamesWinnerAtLeast270 || 0,
              maxScore: summary?.maxScore || 0,
              incompleteGames: summary?.incompleteGames || 0,
              bugCount: summary?.bugCount || 0,
              turnActionCount: summary?.turnActionCount || 0,
              actionCategoryRatios: summary?.actionCategoryRatios || {},
              winnerProfileDeltas: summary?.winnerProfileDeltas || {},
              scoreOpportunities: summary?.scoreOpportunities || {},
              topScoreGaps: summary?.topScoreGaps || [],
              routeTargets: summary?.routeTargets || [],
              moveFollowups: summary?.moveFollowups || [],
              turnPlans: summary?.turnPlans || [],
              turnPlanTypes: summary?.turnPlanTypes || [],
              turnPlanActions: summary?.turnPlanActions || [],
              topBugs: summary?.topBugs || [],
              strategyTuning: summary?.strategyTuning || null,
            },
            strategyTuning: summary?.strategyTuning || null,
          };
        }

        function recordAiStrategyTuningSummary(summary, options = {}) {
          if (!summary?.strategyTuning) return null;
          loadAiStrategyTuningHistory();
          const entry = compactAiStrategyTuningHistoryEntry(summary, options);
          aiAutoBattleState.strategyTuningHistory.push(entry);
          const maxHistory = Math.max(1, Math.round(Number(options.maxHistory) || 30));
          aiAutoBattleState.strategyTuningHistory = aiAutoBattleState.strategyTuningHistory.slice(-maxHistory);
          saveAiStrategyTuningHistory();
          return structuredClone(entry);
        }

        function compactAiStrategyABHistoryEntry(comparison, options = {}) {
          const improved = Boolean(comparison?.verdict?.improved);
          const selectedVariant = improved ? "tuned" : "baseline";
          const selectedComparison = improved ? comparison?.tuned : comparison?.baseline;
          const selectedWeights = improved
            ? normalizeAiStrategyWeights(options.tunedWeights, { merge: false })
            : normalizeAiStrategyWeights(options.baselineWeights, { merge: false });
          const gameCount = Math.max(0, Math.round(Number(comparison?.gameCount) || Number(options.gamesRun) || 0));
          const scoreDelta = comparison?.verdict?.averagePlayerScoreDelta != null
            ? aiNumber(comparison.verdict.averagePlayerScoreDelta)
            : aiNumber(comparison?.deltas?.averagePlayerScore ?? comparison?.verdict?.scoreDelta ?? comparison?.deltas?.averageWinnerScore);
          const blockedDelta = aiNumber(comparison?.verdict?.blockedDelta ?? comparison?.deltas?.blockedGames);
          const completionDelta = aiNumber(comparison?.verdict?.completionDelta ?? comparison?.deltas?.completionRate);
          const confidence = improved
            ? Math.min(1, 0.35 + Math.max(0, scoreDelta) * 0.05 + gameCount * 0.05)
            : Math.max(0.1, 0.35 - Math.max(0, -scoreDelta) * 0.04 - Math.max(0, blockedDelta) * 0.1);
          const rationale = [{
            key: improved ? "ab-tuned" : "ab-baseline",
            delta: Math.round(scoreDelta * 1000) / 1000,
            reason: improved
              ? "同 seed A/B 中 tuned 全员均分提高，且低尾、高分产出与可靠性未退化"
              : "同 seed A/B 中 tuned 未同时改善全员均分、低尾、高分产出与可靠性，回退长期权重置信度",
          }];
          return {
            kind: "ab-test",
            id: aiAutoBattleState.nextStrategyTuningHistoryId++,
            createdAt: new Date().toISOString(),
            label: options.label || null,
            aiDifficulty: options.aiDifficulty || null,
            gamesRequested: gameCount,
            gamesRun: gameCount,
            seedBase: comparison?.seedBase || options.seedBase || null,
            selectedVariant,
            baselineWeights: normalizeAiStrategyWeights(options.baselineWeights, { merge: false }),
            tunedWeights: normalizeAiStrategyWeights(options.tunedWeights, { merge: false }),
            appliedWeights: selectedWeights,
            abComparison: comparison || null,
            summary: {
              gameCount,
              completedGames: selectedComparison?.completedGames || 0,
              blockedGames: selectedComparison?.blockedGames || 0,
              completionRate: selectedComparison?.completionRate || 0,
              averageWinnerScore: selectedComparison?.averageWinnerScore || 0,
              averagePlayerScore: selectedComparison?.averagePlayerScore || 0,
              averageMinimumPlayerScore: selectedComparison?.averageMinimumPlayerScore || 0,
              p25PlayerScore: selectedComparison?.p25PlayerScore || 0,
              playersAtLeast270: selectedComparison?.playersAtLeast270 || 0,
              gamesWinnerAtLeast270: selectedComparison?.gamesWinnerAtLeast270 || 0,
              maxScore: selectedComparison?.maxScore || 0,
              incompleteGames: selectedComparison?.incompleteGames || 0,
              bugCount: selectedComparison?.bugCount || 0,
              winnerProfileDeltas: selectedComparison?.winnerProfileDeltas || {},
              actionCategoryRatios: selectedComparison?.actionCategoryRatios || {},
              strategyTuning: {
                id: improved ? "ab-tuned-v1" : "ab-baseline-v1",
                confidence,
                weights: selectedWeights,
                baselineWeights: normalizeAiStrategyWeights(options.baselineWeights, { merge: false }),
                deltas: comparison?.deltas?.winnerProfileDeltas || {},
                rationale,
              },
            },
            strategyTuning: {
              id: improved ? "ab-tuned-v1" : "ab-baseline-v1",
              confidence,
              weights: selectedWeights,
              baselineWeights: normalizeAiStrategyWeights(options.baselineWeights, { merge: false }),
              deltas: comparison?.deltas?.winnerProfileDeltas || {},
              rationale,
            },
          };
        }

        function recordAiStrategyABComparison(comparison, options = {}) {
          if (!comparison) return null;
          loadAiStrategyTuningHistory();
          const entry = compactAiStrategyABHistoryEntry(comparison, options);
          aiAutoBattleState.strategyTuningHistory.push(entry);
          const maxHistory = Math.max(1, Math.round(Number(options.maxHistory) || 30));
          aiAutoBattleState.strategyTuningHistory = aiAutoBattleState.strategyTuningHistory.slice(-maxHistory);
          saveAiStrategyTuningHistory();
          return structuredClone(entry);
        }

        function getAiStrategyTuningHistory() {
          return structuredClone(loadAiStrategyTuningHistory());
        }

        function clearAiStrategyTuningHistory() {
          aiAutoBattleState.strategyTuningHistoryLoaded = true;
          aiAutoBattleState.strategyTuningHistory = [];
          aiAutoBattleState.nextStrategyTuningHistoryId = 1;
          try {
            windowRef.localStorage?.removeItem(AI_STRATEGY_TUNING_HISTORY_STORAGE_KEY);
          } catch (_error) {
            // Ignore storage failures.
          }
          return { ok: true, history: [] };
        }

        function getAiStrategyTuningRecommendation(options = {}) {
          const history = loadAiStrategyTuningHistory();
          const recommendation = ai?.analytics?.summarizeStrategyTuningHistory
            ? ai.analytics.summarizeStrategyTuningHistory(history, {
              baseWeights: options.baseWeights || getAiStrategyWeights(),
              learningRate: options.learningRate,
            })
            : null;
          return structuredClone(recommendation);
        }

        function applyAiStrategyTuningRecommendation(options = {}) {
          const recommendation = getAiStrategyTuningRecommendation(options);
          if (!recommendation?.weights) {
            return { ok: false, message: "没有可用的 AI 策略调参历史" };
          }
          const applied = applyAiStrategyTuning(recommendation);
          return {
            ok: true,
            applied,
            recommendation,
          };
        }

      return { loadAiStrategyTuningHistory, saveAiStrategyTuningHistory, compactAiStrategyTuningHistoryEntry, recordAiStrategyTuningSummary, compactAiStrategyABHistoryEntry, recordAiStrategyABComparison, getAiStrategyTuningHistory, clearAiStrategyTuningHistory, getAiStrategyTuningRecommendation, applyAiStrategyTuningRecommendation };
    }
  }

  return { createAiTuningHistory };
});
