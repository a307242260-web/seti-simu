(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SetiAppAiExperimentRunner = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createAiExperimentRunner(context) {
    if (!context || !context.aiAutoBattleState) {
      throw new Error("createAiExperimentRunner requires explicit AI battle context");
    }
    with (context) {
        function waitAiAutoBattleDelay(delayMs, options = {}) {
          const delay = Math.max(0, Math.round(Number(delayMs) || 0));
          if (delay <= 0 && !options.forceYield) return Promise.resolve();
          return new Promise((resolve) => windowRef.setTimeout(resolve, delay));
        }

        async function runAiAutoBattle(options = {}) {
          const randomSeed = options.seed ?? options.randomSeed ?? null;
          if (randomSeed != null && randomSeed !== "" && !options.__aiSeedApplied) {
            return runWithAiRandomSeed(randomSeed, () => runAiAutoBattle({
              ...options,
              __aiSeedApplied: true,
            }));
          }
          if (aiAutoBattleState.running) {
            return { ok: false, message: "AI 自动对战已经在运行" };
          }
          const configResult = configureAiAutoBattle({
            ...options,
            reset: options.reset === true,
            suppressAutoSchedule: true,
          });
          if (!configResult.ok) return configResult;

          const maxSteps = Math.max(1, Math.round(Number(options.maxSteps) || 200));
          const delayMs = options.stepDelayMs ?? aiAutoBattleState.stepDelayMs;
          const yieldEverySteps = Math.max(0, Math.round(Number(options.yieldEverySteps ?? 80) || 0));
          const stopBeforeRound = Math.max(0, Math.round(Number(options.stopBeforeRound) || 0));
          const shouldStopBeforeRound = () => (
            stopBeforeRound > 0
            && !isGameEnded()
            && Math.max(1, Math.round(Number(turnState.roundNumber) || 1)) >= stopBeforeRound
          );
          aiAutoBattleState.running = true;
          const summary = {
            ok: true,
            steps: 0,
            stopped: false,
            blocked: false,
            gameEnded: false,
            stoppedBeforeRound: null,
            seed: randomSeed,
            message: null,
          };
          recordAiAutoBattleLog("start", `AI 自动对战开始，最多 ${maxSteps} 步`, { maxSteps, seed: randomSeed });

          while (aiAutoBattleState.running && summary.steps < maxSteps) {
            if (shouldStopBeforeRound()) {
              summary.stopped = true;
              summary.stoppedBeforeRound = stopBeforeRound;
              summary.message = `已到第 ${turnState.roundNumber} 轮起始，按配置停止`;
              break;
            }
            const beforeLogCount = aiAutoBattleState.logs.length;
            let result = runAiAutomationStep();
            summary.steps += 1;
            if (
              aiAutoBattleState.logs.length === beforeLogCount
              && result?.ok === true
              && !result?.progressed
              && !result?.done
            ) {
              const recoveryResult = recoverAiIdleActionEffectStep();
              if (recoveryResult) result = recoveryResult;
            }
            if (typeof options.onStep === "function") {
              options.onStep({
                steps: summary.steps,
                roundNumber: turnState.roundNumber,
                turnNumber: turnState.turnNumber,
                currentPlayerId: playerState.currentPlayerId,
              });
            }
            if (result?.done || isGameEnded()) {
              summary.gameEnded = true;
              summary.message = result?.message || "游戏已结束";
              break;
            }
            if (shouldStopBeforeRound()) {
              summary.stopped = true;
              summary.stoppedBeforeRound = stopBeforeRound;
              summary.message = `已到第 ${turnState.roundNumber} 轮起始，按配置停止`;
              break;
            }
            if (result?.blocked || result?.ok === false) {
              const bug = recordAiAutoBattleBug(result.message || "AI 自动对战阻塞", { result });
              summary.blocked = true;
              summary.ok = false;
              summary.message = bug.message;
              if (bug.details?.repeatCount >= aiAutoBattleState.maxBugRepeats) {
                break;
              }
            }
            if (aiAutoBattleState.logs.length === beforeLogCount && !result?.progressed && result?.ok !== true) {
              summary.blocked = true;
              summary.ok = false;
              summary.message = result?.message || "AI 没有推进游戏状态";
              break;
            }
            await waitAiAutoBattleDelay(delayMs, {
              forceYield: Math.max(0, Math.round(Number(delayMs) || 0)) <= 0
                && yieldEverySteps > 0
                && summary.steps % yieldEverySteps === 0,
            });
          }

          if (!aiAutoBattleState.running) {
            summary.stopped = true;
            summary.message = summary.message || "AI 自动对战已停止";
          } else if (summary.steps >= maxSteps && !summary.message) {
            summary.ok = false;
            summary.message = `达到最大步数 ${maxSteps}`;
          }
          aiAutoBattleState.running = false;
          aiAutoBattleState.lastSummary = summary;
          recordAiAutoBattleLog("finish", summary.message, summary);
          return getAiAutoBattleReport({
            includeAnalysis: options.retainAnalysis !== false && options.includeAnalysis !== false,
            includeDiagnostics: options.includeSampleDiagnostics !== false && options.includeDiagnostics !== false,
          });
        }

        function stopAiAutoBattle() {
          aiAutoBattleState.running = false;
          recordAiAutoBattleLog("stop", "AI 自动对战停止");
          return getAiAutoBattleReport();
        }

        function getAiCandidateRankScore(candidate = {}) {
          const graphNet = Number(candidate.actionGraph?.net);
          if (Number.isFinite(graphNet)) return graphNet;
          const explicitScore = Number(candidate.score);
          return Number.isFinite(explicitScore) ? explicitScore : 0;
        }

        function normalizeAiKnownCardId(value) {
          const text = String(value ?? "").trim();
          if (!text) return null;
          if (/^\d+$/.test(text)) {
            const index = Number(text);
            if (Number.isInteger(index) && index >= 1 && index <= 140) return `b_${index}.webp`;
          }
          return text;
        }

        function normalizeAiReadableCardLabel(value) {
          const text = String(value ?? "").trim();
          if (!text || /^\d+$/.test(text)) return null;
          return text;
        }

        function getAiCardDisplayLabel(candidate = {}, player = null) {
          const handIndex = Number(candidate?.handIndex);
          const handCard = player && Number.isInteger(handIndex) ? player.hand?.[handIndex] : null;
          const card = candidate?.card || handCard || null;
          const directLabel = normalizeAiReadableCardLabel(candidate?.cardLabel);
          if (directLabel) return directLabel;
          const catalogLabel = normalizeAiReadableCardLabel(cards.getCatalogEntryForCard?.(card)?.card_name);
          if (catalogLabel) return catalogLabel;
          const cardLabel = normalizeAiReadableCardLabel(cards.getCardLabel?.(card));
          if (cardLabel) return cardLabel;
          const cardId = normalizeAiKnownCardId(candidate?.cardId || card?.cardId || card?.id);
          const catalogByIdLabel = cardId
            ? normalizeAiReadableCardLabel(cards.getCatalogEntryForCard?.({ cardId })?.card_name)
            : null;
          if (catalogByIdLabel) return catalogByIdLabel;
          const referenceLabel = cardId
            ? normalizeAiReadableCardLabel(cardEffects.getCardReference?.(cardId)?.referenceName)
            : null;
          if (referenceLabel) return referenceLabel;
          return cardId || null;
        }

        function summarizeAiTurnActionCandidate(candidate = {}) {
          const breakdown = candidate.breakdown || candidate.valueBreakdown || null;
          const compactBreakdown = breakdown
            ? Object.fromEntries(Object.entries(breakdown).filter(([, value]) => (
              Number.isFinite(Number(value)) || typeof value === "string" || typeof value === "boolean"
            )).map(([key, value]) => [
              key,
              Number.isFinite(Number(value)) ? roundAiScore(value) : value,
            ]))
            : null;
          return {
            id: candidate.id || null,
            tradeId: candidate.tradeId || null,
            label: candidate.label || getAiCardDisplayLabel(candidate) || candidate.planetName || null,
            cardId: candidate.cardId || null,
            cardInstanceId: candidate.cardInstanceId || null,
            score: roundAiScore(getAiCandidateRankScore(candidate)),
            directScoreGain: roundAiScore(candidate.directScoreGain || 0),
            finalMarginal: roundAiScore(candidate.actionGraph?.finalMarginal ?? candidate.finalMarginal ?? 0),
            goalBonus: roundAiScore(candidate.actionGraph?.goalBonus ?? candidate.goalBonus ?? 0),
            reason: candidate.reason || null,
            breakdown: compactBreakdown,
          };
        }

        function getAiLowTailDiagnosticsReasons(player = {}) {
          const reasons = [];
          const finalMarkCount = aiNumber(player.finalMarkCount);
          const finalScore = aiNumber(player.finalScore);
          const baseScore = aiNumber(player.baseScore);
          const techCount = aiNumber(player.techCount);
          const completedTaskCount = aiNumber(player.completedTaskCount);
          if (Number.isFinite(Number(player.finalMarkCount)) && finalMarkCount < 3) {
            reasons.push("missing-final-marks");
          }
          if (Number.isFinite(Number(player.finalScore)) && finalScore < 230) {
            reasons.push("low-final-score");
          }
          if (Number.isFinite(Number(player.baseScore)) && baseScore < 150) {
            reasons.push("low-base-score");
          }
          if (Number.isFinite(Number(player.techCount)) && techCount < 9) {
            reasons.push("low-tech-count");
          }
          if (
            Number.isFinite(Number(player.completedTaskCount))
            && completedTaskCount <= 1
            && finalScore < 230
          ) {
            reasons.push("low-task-count");
          }
          return reasons;
        }

        function summarizeAiDiagnosticCard(card) {
          if (!card) return null;
          const model = cardEffects.getCardModel?.(card) || null;
          const completedTaskIds = new Set(card.cardEffectState?.completedTaskIds || []);
          const consumedTriggerIds = new Set(card.cardEffectState?.consumedTriggerIds || []);
          const tasks = model?.tasks || [];
          const triggers = model?.triggers || [];
          return {
            cardId: card.cardId || card.id || null,
            cardInstanceId: card.id || null,
            cardName: card.cardName || card.name || cards.getCardLabel?.(card) || null,
            price: getCardPrice(card),
            typeCode: getCardTypeCode(card),
            discardActionCode: card.discardActionCode ?? null,
            scanActionCode: card.scanActionCode ?? null,
            incomeCode: card.incomeCode ?? null,
            taskCount: tasks.length,
            remainingTaskCount: tasks.filter((task) => !completedTaskIds.has(task.id)).length,
            triggerCount: triggers.length,
            remainingTriggerCount: triggers.filter((trigger) => !consumedTriggerIds.has(trigger.id)).length,
            endGameScoring: Boolean(model?.endGameScoring),
          };
        }

        function summarizeAiDiagnosticCards(cardList = [], limit = 8) {
          return (cardList || [])
            .slice(0, limit)
            .map(summarizeAiDiagnosticCard)
            .filter(Boolean);
        }

        function buildAiLowMarkPlayerDiagnostics(report = {}) {
          const players = Array.isArray(report.playerResults) ? report.playerResults : [];
          const logs = Array.isArray(report.logs) ? report.logs : [];
          const lowPlayers = [...players]
            .map((player) => ({
              player,
              lowTailReasons: getAiLowTailDiagnosticsReasons(player),
            }))
            .filter((entry) => entry.lowTailReasons.length > 0)
            .sort((leftEntry, rightEntry) => {
              const left = leftEntry.player;
              const right = rightEntry.player;
              return (
                aiNumber(left.finalMarkCount) - aiNumber(right.finalMarkCount)
                || aiNumber(left.finalScore) - aiNumber(right.finalScore)
                || aiNumber(left.baseScore) - aiNumber(right.baseScore)
                || aiNumber(left.techCount) - aiNumber(right.techCount)
              );
            });
          return lowPlayers.map(({ player: lowPlayer, lowTailReasons }) => {
            const lowLogs = logs.filter((entry) => (
              String(entry.playerId || "") === String(lowPlayer.playerId || "")
              || (lowPlayer.playerLabel && String(entry.message || "").includes(lowPlayer.playerLabel))
            ));
            const turnActionLogs = lowLogs.filter((entry) => entry.type === "turn-action");
            const playCardTail = lowLogs
              .filter((entry) => (
                entry.type === "play-card"
                || entry.type === "card-corner"
                || entry.type === "alien-trace"
                || entry.type === "scan-target"
              ))
              .slice(-16)
              .map((entry) => ({
                type: entry.type,
                roundNumber: entry.roundNumber,
                turnNumber: entry.turnNumber,
                message: entry.message,
                details: (entry.type === "alien-trace" || entry.type === "scan-target") ? entry.details : undefined,
              }));
            const actionCounts = turnActionLogs.reduce((counts, entry) => {
              const actionId = entry.details?.action?.id || "unknown";
              counts[actionId] = (counts[actionId] || 0) + 1;
              return counts;
            }, {});
            const selectedActionTail = turnActionLogs.slice(-40).map((entry) => {
              const candidates = Array.isArray(entry.details?.candidates)
                ? [...entry.details.candidates]
                  .filter((candidate) => candidate?.available !== false)
                  .sort((left, right) => getAiCandidateRankScore(right) - getAiCandidateRankScore(left))
                  .slice(0, 3)
                  .map(summarizeAiTurnActionCandidate)
                : [];
              return {
                roundNumber: entry.roundNumber,
                turnNumber: entry.turnNumber,
                action: summarizeAiTurnActionCandidate(entry.details?.action || {}),
                resources: entry.playerResources || null,
                topCandidates: candidates,
              };
            });
            const livePlayer = getPlayerById(lowPlayer.playerId);

            return {
              playerId: lowPlayer.playerId || null,
              playerLabel: lowPlayer.playerLabel || null,
              finalScore: lowPlayer.finalScore,
              baseScore: lowPlayer.baseScore,
              tileScore: lowPlayer.tileScore,
              cardScore: lowPlayer.cardScore,
              finalMarkCount: lowPlayer.finalMarkCount,
              finalFormulas: lowPlayer.finalFormulas || [],
              finalFormulaProgress: lowPlayer.finalFormulaProgress || null,
              b2Progress: lowPlayer.b2Progress || null,
              completedTaskCount: lowPlayer.completedTaskCount,
              techCount: lowPlayer.techCount,
              handSize: lowPlayer.handSize,
              reservedCount: lowPlayer.reservedCount,
              lowTailReasons,
              resources: lowPlayer.resources || null,
              income: lowPlayer.income || null,
              handCards: summarizeAiDiagnosticCards(livePlayer?.hand || [], 8),
              reservedCards: summarizeAiDiagnosticCards(livePlayer?.reservedCards || [], 10),
              actionCounts,
              passCount: actionCounts.pass || 0,
              selectedActionTail,
              playCardTail,
            };
          });
        }

        function summarizeAiFinalScoreMarkCandidate(candidate = {}) {
          const pipeline = candidate.scoreBreakdown?.cFormulaPipeline || null;
          return {
            tileId: candidate.tileId || null,
            formulaId: candidate.formulaId || null,
            slotIndex: candidate.slotIndex ?? null,
            threshold: candidate.threshold ?? null,
            baseValue: candidate.baseValue ?? null,
            multiplier: candidate.multiplier ?? null,
            immediateScore: candidate.immediateScore ?? null,
            score: candidate.score ?? null,
            scoreBreakdown: candidate.scoreBreakdown
              ? {
                zeroBaseLatePenalty: candidate.scoreBreakdown.zeroBaseLatePenalty,
                weakCFormulaPenalty: candidate.scoreBreakdown.weakCFormulaPenalty,
                b1FeasibilityPenalty: candidate.scoreBreakdown.b1FeasibilityPenalty,
                b2FeasibilityPenalty: candidate.scoreBreakdown.b2FeasibilityPenalty,
                cFormulaPipeline: pipeline
                  ? {
                    completedTaskCount: pipeline.completedTaskCount,
                    reservedTaskCount: pipeline.reservedTaskCount,
                    handTaskCount: pipeline.handTaskCount,
                    type3Reserved: pipeline.type3Reserved,
                    type3InHand: pipeline.type3InHand,
                    pipelineScale: pipeline.pipelineScale,
                    expectedNewTasks: pipeline.expectedNewTasks,
                    expectedNewType3: pipeline.expectedNewType3,
                    projectedBase: pipeline.projectedBase,
                  }
                  : null,
              }
              : null,
          };
        }

        function summarizeAiFinalScoreMarkDecision(entry = {}) {
          const candidates = Array.isArray(entry.details?.candidates)
            ? entry.details.candidates.filter((candidate) => candidate?.available !== false)
            : [];
          return {
            roundNumber: entry.roundNumber ?? null,
            turnNumber: entry.turnNumber ?? null,
            playerId: entry.playerId || null,
            playerLabel: entry.playerLabel || null,
            resources: entry.playerResources || null,
            selected: summarizeAiFinalScoreMarkCandidate(entry.details?.selected || entry.details?.mark || {}),
            candidates: candidates.map(summarizeAiFinalScoreMarkCandidate),
          };
        }

        function compactAiAutoBattleSample(report, gameIndex, options = {}) {
          const analysis = report?.analysis || null;
          const includeDiagnostics = options.includeDiagnostics !== false;
          const lowMarkPlayerDiagnosticsList = includeDiagnostics
            ? buildAiLowMarkPlayerDiagnostics(report)
            : [];
          const reportLogs = Array.isArray(report?.logs) ? report.logs : [];
          const finalScoreMarkDecisions = includeDiagnostics && Array.isArray(report?.logs)
            ? reportLogs
              .filter((entry) => entry?.type === "final-score-mark")
              .map(summarizeAiFinalScoreMarkDecision)
            : [];
          const grandStrategyPickDecisions = includeDiagnostics ? reportLogs
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => (
              entry?.type === "pick-card"
              && entry.details?.pendingType === "industry_strategy_pick"
            ))
            .map(({ entry, index }) => {
              const selectedCard = entry.details?.selectedCard || entry.details?.skippedPublicCard || null;
              const selectedCardId = selectedCard?.cardInstanceId || selectedCard?.cardId || null;
              const laterCardUse = selectedCardId
                ? reportLogs.slice(index + 1).map((laterEntry) => {
                  if (laterEntry?.playerId !== entry.playerId) return null;
                  const usedCards = laterEntry.type === "play-card"
                    ? [laterEntry.details?.selected || laterEntry.details?.card || null]
                    : laterEntry.type === "card-corner"
                      ? [laterEntry.details?.action || null]
                    : laterEntry.type === "discard" || laterEntry.type === "move-payment"
                        ? (laterEntry.details?.selectedCards || [])
                        : [];
                  const usedCard = usedCards.find((card) => {
                    const usedCardId = card?.cardInstanceId || card?.cardId || null;
                    return String(usedCardId || "") === String(selectedCardId);
                  }) || null;
                  if (!usedCard) return null;
                  return {
                    type: laterEntry.type,
                    roundNumber: laterEntry.roundNumber ?? null,
                    turnNumber: laterEntry.turnNumber ?? null,
                    actionId: laterEntry.details?.action?.id || null,
                    reason: laterEntry.details?.action?.reason || laterEntry.details?.pendingType || null,
                    tradeId: laterEntry.details?.tradeId || laterEntry.details?.action?.tradeId || null,
                    score: laterEntry.details?.action?.score ?? laterEntry.details?.selected?.score ?? null,
                  };
                }).find(Boolean)
                : null;
              const playedLater = laterCardUse?.type === "play-card";
              return {
                roundNumber: entry.roundNumber ?? null,
                turnNumber: entry.turnNumber ?? null,
                playerId: entry.playerId || null,
                playerLabel: entry.playerLabel || null,
                selectedCard,
                selectedScore: entry.details?.score ?? null,
                playedLater,
                laterCardUse,
                topPublicCandidates: entry.details?.topPublicCandidates || [],
              };
            }) : [];
          const grandStrategyPassiveDecisions = includeDiagnostics ? reportLogs
            .filter((entry) => entry?.type === "industry" && entry.details?.slotId)
            .map((entry) => ({
              roundNumber: entry.roundNumber ?? null,
              turnNumber: entry.turnNumber ?? null,
              playerId: entry.playerId || null,
              playerLabel: entry.playerLabel || null,
              resources: entry.playerResources || null,
              selectedSlotId: entry.details.slotId,
              selectedScore: entry.details.score ?? null,
              rewardLabel: entry.details.rewardLabel || null,
              choices: entry.details.choices || [],
            })) : [];
          const initialIncomeDiscardDecisions = includeDiagnostics ? reportLogs
            .filter((entry) => (
              entry?.type === "discard"
              && entry.details?.pendingType === "initial_income"
            ))
            .map((entry) => ({
              roundNumber: entry.roundNumber ?? null,
              turnNumber: entry.turnNumber ?? null,
              playerId: entry.playerId || null,
              playerLabel: entry.playerLabel || null,
              resources: entry.playerResources || null,
              selectedCards: entry.details?.selectedCards || [],
              incomeGainByIndex: entry.details?.incomeGainByIndex || [],
              incomeDiscardPreview: entry.details?.incomeDiscardPreview || null,
            })) : [];
          return {
            gameIndex,
            summary: report?.lastSummary || null,
            seed: report?.lastSummary?.seed || null,
            bugCount: Array.isArray(report?.bugs) ? report.bugs.length : 0,
            playerResults: report?.playerResults || [],
            pendingState: report?.pendingState || null,
            lowMarkPlayerDiagnostics: lowMarkPlayerDiagnosticsList[0] || null,
            lowMarkPlayerDiagnosticsList,
            finalScoreMarkDecisions,
            grandStrategyPickDecisions,
            grandStrategyPassiveDecisions,
            initialIncomeDiscardDecisions,
            tailLogs: Array.isArray(report?.logs) ? report.logs.slice(-5) : [],
            ...(options.includeLogs && Array.isArray(report?.logs) ? { logs: report.logs } : {}),
            analysis: includeDiagnostics && analysis
              ? {
                turnActionCount: analysis.turnActionCount,
                actionCounts: analysis.actionCounts,
                actionCategoryRatios: analysis.actionCategoryRatios,
                playerProfiles: analysis.playerProfiles,
                opportunities: analysis.opportunities,
                passOpportunitySamples: analysis.passOpportunitySamples,
                passResourceLockSamples: analysis.passResourceLockSamples,
                openingPlanNearMissSamples: analysis.openingPlanNearMissSamples,
                openingPlanConversionSamples: analysis.openingPlanConversionSamples,
                passReserveResourcePressureMissSamples: analysis.passReserveResourcePressureMissSamples,
                finalLowHandPassRecoverySamples: analysis.finalLowHandPassRecoverySamples,
                finalHighScorePassRecoverySamples: analysis.finalHighScorePassRecoverySamples,
                earlyPassNoMainSamples: analysis.earlyPassNoMainSamples,
                quickBeforePassNoMainSamples: analysis.quickBeforePassNoMainSamples,
                preNoMainPassResourceDrainSamples: analysis.preNoMainPassResourceDrainSamples,
                postPassQuickNoMainSamples: analysis.postPassQuickNoMainSamples,
                postPassQuickSamples: analysis.postPassQuickSamples,
                negativeCardCornerGraphLiftSamples: analysis.negativeCardCornerGraphLiftSamples,
                negativePlayCardGraphLiftSamples: analysis.negativePlayCardGraphLiftSamples,
                endTurnMoveOpportunitySamples: analysis.endTurnMoveOpportunitySamples,
                lowEngineThroughputSamples: analysis.lowEngineThroughputSamples,
                highScoreNearMissSamples: analysis.highScoreNearMissSamples,
                d1TechBalanceBottleneckSamples: analysis.d1TechBalanceBottleneckSamples,
                researchTechCompoundCardSamples: analysis.researchTechCompoundCardSamples,
                orange4RaceSensitiveTechSamples: analysis.orange4RaceSensitiveTechSamples,
                orange4RaceSensitiveTechTagCounts: analysis.orange4RaceSensitiveTechTagCounts,
                playCardNearMissSamples: analysis.playCardNearMissSamples,
                b2ScanNearMissSamples: analysis.b2ScanNearMissSamples,
                b2TradeNearMissSamples: analysis.b2TradeNearMissSamples,
                resourceLockMainUnlockSamples: analysis.resourceLockMainUnlockSamples,
                mainUnlockLowConcretePlaySamples: analysis.mainUnlockLowConcretePlaySamples,
                nonPositivePublicRefillSamples: analysis.nonPositivePublicRefillSamples,
                highHandDrainEnergyTradeSamples: analysis.highHandDrainEnergyTradeSamples,
                highHandDrainEnergyTradeUnfollowedPlanSamples: analysis.highHandDrainEnergyTradeUnfollowedPlanSamples,
                lastCardPreserveEnergyMoveSamples: analysis.lastCardPreserveEnergyMoveSamples,
                negativeThirdFinalMarkSamples: analysis.negativeThirdFinalMarkSamples,
                lowPlayerCandidateStats: analysis.lowPlayerCandidateStats,
                lowUnplayedCardSamples: analysis.lowUnplayedCardSamples,
                finalReadyTaskCreditShortfallSamples: analysis.finalReadyTaskCreditShortfallSamples,
                finalReadyTaskTradeUnlockMissSamples: analysis.finalReadyTaskTradeUnlockMissSamples,
                scoreOpportunities: analysis.scoreOpportunities,
                topScoreGaps: analysis.topScoreGaps,
                movePayment: analysis.movePayment,
                routeTargets: analysis.routeTargets,
                moveFollowups: analysis.moveFollowups,
                turnPlans: analysis.turnPlans,
                turnPlanTypes: analysis.turnPlanTypes,
                turnPlanActions: analysis.turnPlanActions,
                finalScoreMarks: analysis.finalScoreMarks,
                finalScoreFormulas: analysis.finalScoreFormulas,
                actionSequences: analysis.actionSequences
                  ? {
                    windowTurns: analysis.actionSequences.windowTurns,
                    winnerTopSequences: analysis.actionSequences.winnerTopSequences,
                    nonWinnerTopSequences: analysis.actionSequences.nonWinnerTopSequences,
                    winnerDeltaSequences: analysis.actionSequences.winnerDeltaSequences,
                    mainActionTopSequences: analysis.actionSequences.mainActionTopSequences,
                    globalTopSequences: analysis.actionSequences.globalTopSequences,
                  }
                  : null,
                scoreBuckets: analysis.scoreBuckets,
                topMissedCandidates: analysis.topMissedCandidates,
                paceSummary: analysis.paceSummary,
                roundPaceSummary: analysis.roundPaceSummary,
                lowRoundActionTailSamples: analysis.lowRoundActionTailSamples,
                winnerProfileDeltas: analysis.winnerProfileDeltas,
                winner: analysis.winner,
                strategyTuning: analysis.strategyTuning,
                recommendations: analysis.recommendations,
                bugs: analysis.bugs,
              }
              : null,
          };
        }

        async function runAiAutoBattleBatch(options = {}) {
          if (aiAutoBattleState.running) {
            return { ok: false, message: "AI 自动对战已经在运行" };
          }
          const games = Math.min(100, Math.max(1, Math.round(Number(options.games) || 5)));
          const samples = [];
          const analyses = [];
          const retainAnalysis = options.retainAnalysis !== false;
          const includeSampleDiagnostics = options.includeSampleDiagnostics !== false;
          const stopOnBlocked = options.stopOnBlocked !== false;

          for (let index = 0; index < games; index += 1) {
            const seed = getAiBatchSeed(options, index);
            const report = await runAiAutoBattle({
              ...options,
              seed,
              reset: true,
              compactLogs: options.compactLogs !== false,
            });
            if (!report?.logs) {
              return report;
            }
            const analysisOptions = { sequenceWindowTurns: options.sequenceWindowTurns };
            const analysis = retainAnalysis
              ? options.sequenceWindowTurns != null
                ? ai?.analytics?.analyzeBattleReport?.(report, analysisOptions) || null
                : report.analysis || ai?.analytics?.analyzeBattleReport?.(report, analysisOptions) || null
              : null;
            if (analysis && retainAnalysis) analyses.push(analysis);
            samples.push(compactAiAutoBattleSample({ ...report, analysis }, index + 1, {
              includeLogs: options.includeLogs === true,
              includeDiagnostics: includeSampleDiagnostics,
            }));
            if (stopOnBlocked && (
              report.lastSummary?.blocked
              || report.lastSummary?.ok === false
              || (!report.lastSummary?.gameEnded && !report.lastSummary?.stoppedBeforeRound)
              || report.bugs?.length
            )) {
              break;
            }
          }

          const summary = retainAnalysis && ai?.analytics?.summarizeBattleAnalyses
            ? ai.analytics.summarizeBattleAnalyses(analyses, { sequenceWindowTurns: options.sequenceWindowTurns })
            : null;
          const blockedGames = samples.filter((sample) => sample.summary?.blocked || sample.bugCount > 0).length;
          const incompleteGames = samples.filter((sample) => (
            (!sample.summary?.gameEnded && !sample.summary?.stoppedBeforeRound)
            || sample.summary?.ok === false
          )).length;
          const strategyTuningHistoryEntry = summary && options.recordStrategyTuning !== false
            ? recordAiStrategyTuningSummary(summary, {
              label: options.strategyTuningLabel || options.label || null,
              gamesRequested: games,
              gamesRun: samples.length,
              appliedWeights: getAiStrategyWeights(),
              maxHistory: options.strategyTuningHistoryLimit,
            })
            : null;
          const strategyTuningRecommendation = getAiStrategyTuningRecommendation({
            learningRate: options.tuningLearningRate,
          });
          if (options.applyHistoryRecommendation && strategyTuningRecommendation?.weights) {
            applyAiStrategyTuning(strategyTuningRecommendation);
          }
          return structuredClone({
            ok: blockedGames === 0 && incompleteGames === 0 && samples.length === games,
            gamesRequested: games,
            gamesRun: samples.length,
            stoppedEarly: samples.length < games || incompleteGames > 0,
            summary,
            strategyTuningHistoryEntry,
            strategyTuningRecommendation,
            samples,
          });
        }

        async function runAiStrategyABTest(options = {}) {
          if (aiAutoBattleState.running) {
            return { ok: false, message: "AI 自动对战已经在运行" };
          }
          const games = Math.min(50, Math.max(1, Math.round(Number(options.games) || 3)));
          const seedBase = options.seed ?? options.randomSeed ?? `strategy-ab-${Date.now()}`;
          const seeds = Array.isArray(options.seeds) && options.seeds.length
            ? options.seeds.slice(0, games)
            : Array.from({ length: games }, (_item, index) => `${seedBase}:${index + 1}`);
          while (seeds.length < games) {
            seeds.push(`${seedBase}:${seeds.length + 1}`);
          }

          const originalWeights = getConfiguredAiStrategyWeights();
          const originalWeightsUseDifficultyDefaults = usesDifficultyDefaultStrategyWeights();
          const aiDifficulty = normalizeAiDifficulty(options.aiDifficulty || aiAutoBattleState.aiDifficulty);
          const difficultyDefaultWeights = getAiStrategyWeightDefaultsForDifficulty(aiDifficulty);
          const baselineWeights = normalizeAiStrategyWeights(
            options.baselineWeights || difficultyDefaultWeights,
            { merge: false, baseWeights: difficultyDefaultWeights },
          );
          const recommendation = options.strategyTuning
            || options.tunedStrategyTuning
            || getAiStrategyTuningRecommendation({ learningRate: options.tuningLearningRate });
          const tunedWeights = normalizeAiStrategyWeights(
            options.tunedWeights
              || recommendation?.weights
              || (originalWeightsUseDifficultyDefaults ? difficultyDefaultWeights : originalWeights),
            { merge: false, baseWeights: difficultyDefaultWeights },
          );
          const sharedOptions = {
            aiDifficulty,
            activePlayerCount: options.activePlayerCount,
            maxSteps: options.maxSteps,
            stepDelayMs: options.stepDelayMs,
            maxBugRepeats: options.maxBugRepeats,
            maxMovesPerTurn: options.maxMovesPerTurn,
            stopOnBlocked: options.stopOnBlocked,
            tuningLearningRate: options.tuningLearningRate,
            recordStrategyTuning: options.recordStrategyTuning === true,
            strategyTuningHistoryLimit: options.strategyTuningHistoryLimit,
          };

          try {
            configureAiStrategyWeights(baselineWeights, { merge: false });
            const baseline = await runAiAutoBattleBatch({
              ...sharedOptions,
              games,
              seeds,
              strategyWeights: baselineWeights,
              mergeStrategyWeights: false,
              strategyTuningLabel: options.baselineLabel || "ab-baseline",
            });

            configureAiStrategyWeights(tunedWeights, { merge: false });
            const tuned = await runAiAutoBattleBatch({
              ...sharedOptions,
              games,
              seeds,
              strategyWeights: tunedWeights,
              mergeStrategyWeights: false,
              strategyTuningLabel: options.tunedLabel || "ab-tuned",
            });

            const comparison = ai?.analytics?.compareStrategyBatchResults
              ? ai.analytics.compareStrategyBatchResults(
                {
                  ...baseline,
                  strategyWeights: baselineWeights,
                },
                {
                  ...tuned,
                  strategyWeights: tunedWeights,
                },
                {
                  label: options.label || null,
                  seedBase,
                },
              )
              : null;

            if (options.keepTunedWeights) {
              configureAiStrategyWeights(tunedWeights, { merge: false });
            } else {
              configureAiStrategyWeights(originalWeights, {
                merge: false,
                useDifficultyDefaults: originalWeightsUseDifficultyDefaults,
              });
            }
            const strategyABHistoryEntry = comparison && options.recordABResult !== false
              ? recordAiStrategyABComparison(comparison, {
                label: options.strategyTuningLabel || options.label || null,
                seedBase,
                gamesRun: games,
                aiDifficulty,
                baselineWeights,
                tunedWeights,
                maxHistory: options.strategyTuningHistoryLimit,
              })
              : null;
            const strategyTuningRecommendation = getAiStrategyTuningRecommendation({
              learningRate: options.tuningLearningRate,
            });
            if (options.applyHistoryRecommendation && strategyTuningRecommendation?.weights) {
              applyAiStrategyTuning(strategyTuningRecommendation);
            }

            return structuredClone({
              ok: Boolean(baseline?.ok && tuned?.ok),
              games,
              aiDifficulty,
              seedBase,
              seeds,
              baselineWeights,
              tunedWeights,
              recommendation,
              comparison,
              strategyABHistoryEntry,
              strategyTuningRecommendation,
              baseline,
              tuned,
            });
          } catch (error) {
            configureAiStrategyWeights(originalWeights, {
              merge: false,
              useDifficultyDefaults: originalWeightsUseDifficultyDefaults,
            });
            throw error;
          }
        }

        async function runAiStrategyTuningCycle(options = {}) {
          if (aiAutoBattleState.running) {
            return { ok: false, message: "AI 自动对战已经在运行" };
          }
          const originalWeights = getConfiguredAiStrategyWeights();
          const originalWeightsUseDifficultyDefaults = usesDifficultyDefaultStrategyWeights();
          const aiDifficulty = normalizeAiDifficulty(options.aiDifficulty || aiAutoBattleState.aiDifficulty);
          const difficultyDefaultWeights = getAiStrategyWeightDefaultsForDifficulty(aiDifficulty);
          const baselineWeights = normalizeAiStrategyWeights(
            options.baselineWeights
              || (originalWeightsUseDifficultyDefaults ? difficultyDefaultWeights : originalWeights),
            { merge: false, baseWeights: difficultyDefaultWeights },
          );
          const seedBase = options.seed ?? options.randomSeed ?? `strategy-cycle-${Date.now()}`;
          const games = Math.min(100, Math.max(1, Math.round(Number(options.games ?? options.batchGames) || 5)));
          const abGames = Math.min(50, Math.max(1, Math.round(Number(options.abGames) || games)));
          const sharedOptions = {
            aiDifficulty,
            activePlayerCount: options.activePlayerCount,
            maxSteps: options.maxSteps,
            stepDelayMs: options.stepDelayMs,
            maxBugRepeats: options.maxBugRepeats,
            maxMovesPerTurn: options.maxMovesPerTurn,
            stopOnBlocked: options.stopOnBlocked,
            tuningLearningRate: options.tuningLearningRate,
            strategyTuningHistoryLimit: options.strategyTuningHistoryLimit,
          };

          try {
            configureAiStrategyWeights(baselineWeights, { merge: false });
            const baselineBatch = await runAiAutoBattleBatch({
              ...sharedOptions,
              games,
              seed: `${seedBase}:baseline`,
              strategyWeights: baselineWeights,
              mergeStrategyWeights: false,
              recordStrategyTuning: options.recordBaselineTuning !== false,
              strategyTuningLabel: options.baselineLabel || "cycle-baseline",
            });

            if (!baselineBatch?.ok && options.continueOnBaselineBlocked !== true) {
              if (options.restoreWeights !== false) {
                configureAiStrategyWeights(originalWeights, {
                  merge: false,
                  useDifficultyDefaults: originalWeightsUseDifficultyDefaults,
                });
              }
              return structuredClone({
                ok: false,
                phase: "baseline",
                seedBase,
                aiDifficulty,
                games,
                abGames,
                baselineWeights,
                originalWeights,
                baselineBatch,
                message: baselineBatch?.summary?.topBugs?.[0]?.key
                  || baselineBatch?.samples?.[0]?.summary?.message
                  || "baseline 批量对战未完整通过，跳过 A/B",
              });
            }

            const recommendation = options.strategyTuning
              || options.tunedStrategyTuning
              || baselineBatch?.summary?.strategyTuning
              || baselineBatch?.strategyTuningRecommendation
              || getAiStrategyTuningRecommendation({ learningRate: options.tuningLearningRate });
            const tunedWeights = normalizeAiStrategyWeights(
              options.tunedWeights || recommendation?.weights || baselineWeights,
              { merge: false, baseWeights: difficultyDefaultWeights },
            );

            const abTest = await runAiStrategyABTest({
              ...sharedOptions,
              games: abGames,
              seed: `${seedBase}:ab`,
              baselineWeights,
              tunedWeights,
              strategyTuning: recommendation,
              recordABResult: options.recordABResult !== false,
              recordStrategyTuning: options.recordABBatchTuning === true,
              keepTunedWeights: false,
              baselineLabel: options.abBaselineLabel || "cycle-ab-baseline",
              tunedLabel: options.abTunedLabel || "cycle-ab-tuned",
              strategyTuningLabel: options.strategyTuningLabel || options.label || "cycle-ab",
            });
            const selectedVariant = abTest?.strategyABHistoryEntry?.selectedVariant
              || (abTest?.comparison?.verdict?.improved ? "tuned" : "baseline");
            const selectedWeights = selectedVariant === "tuned" ? tunedWeights : baselineWeights;
            let appliedWeights = null;
            if (options.applySelectedWeights || (options.applyImprovedWeights && selectedVariant === "tuned")) {
              appliedWeights = configureAiStrategyWeights(selectedWeights, { merge: false }).weights;
            } else if (options.restoreWeights !== false) {
              configureAiStrategyWeights(originalWeights, {
                merge: false,
                useDifficultyDefaults: originalWeightsUseDifficultyDefaults,
              });
            }

            return structuredClone({
              ok: Boolean(baselineBatch?.ok && abTest?.ok),
              aiDifficulty,
              seedBase,
              games,
              abGames,
              originalWeights,
              baselineWeights,
              tunedWeights,
              selectedVariant,
              selectedWeights,
              appliedWeights,
              recommendation,
              baselineBatch,
              abTest,
            });
          } catch (error) {
            if (options.restoreWeights !== false) {
              configureAiStrategyWeights(originalWeights, {
                merge: false,
                useDifficultyDefaults: originalWeightsUseDifficultyDefaults,
              });
            }
            throw error;
          }
        }

      return { waitAiAutoBattleDelay, runAiAutoBattle, stopAiAutoBattle, getAiCandidateRankScore, normalizeAiKnownCardId, normalizeAiReadableCardLabel, getAiCardDisplayLabel, summarizeAiTurnActionCandidate, getAiLowTailDiagnosticsReasons, summarizeAiDiagnosticCard, summarizeAiDiagnosticCards, buildAiLowMarkPlayerDiagnostics, summarizeAiFinalScoreMarkCandidate, summarizeAiFinalScoreMarkDecision, compactAiAutoBattleSample, runAiAutoBattleBatch, runAiStrategyABTest, runAiStrategyTuningCycle };
    }
  }

  return { createAiExperimentRunner };
});
