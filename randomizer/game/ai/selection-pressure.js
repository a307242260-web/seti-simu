(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAISelectionPressure = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createSelectionPressure(context = {}) {
    const {
      state,
      players,
      rocketActions,
      abilities,
      scanEffects,
      quickTrades,
      cards,
      turnState,
      rocketState,
      cardState,
      FINAL_ROUND_NUMBER,
      runQuickTrade,
      AI_DIFFICULTY_WEAK_START,
      aiAutoBattleState,
    } = context;
    const aiNumber = (...args) => context.aiNumber(...args);
    const buildAiPlayCardCandidate = (...args) => context.buildAiPlayCardCandidate(...args);
    const canAiAnalyzeData = (...args) => context.canAiAnalyzeData(...args);
    const canStartMainAction = (...args) => context.canStartMainAction(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const createAiPlayerAfterQuickTrade = (...args) => context.createAiPlayerAfterQuickTrade(...args);
    const getAiHighScorePushProfile = (...args) => context.getAiHighScorePushProfile(...args);
    const getAiLaunchPaymentCost = (...args) => context.getAiLaunchPaymentCost(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiProjectedFinalScore = (...args) => context.getAiProjectedFinalScore(...args);
    const getAiPublicPickConcreteProfile = (...args) => context.getAiPublicPickConcreteProfile(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiScanDirectScoreGain = (...args) => context.getAiScanDirectScoreGain(...args);
    const getCardPrice = (...args) => context.getCardPrice(...args);
    const getCardTypeCode = (...args) => context.getCardTypeCode(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const listAiLateResourceRecoveryTradeCandidates = (...args) => context.listAiLateResourceRecoveryTradeCandidates(...args);
    const normalizeAiDifficulty = (...args) => context.normalizeAiDifficulty(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiAnalyzeAction = (...args) => context.scoreAiAnalyzeAction(...args);
    const scoreAiEnergyTradePlanetCashoutRecovery = (...args) => context.scoreAiEnergyTradePlanetCashoutRecovery(...args);
    const scoreAiLaunchTurnCandidateValue = (...args) => context.scoreAiLaunchTurnCandidateValue(...args);
    const scoreAiPostLaunchMovePlan = (...args) => context.scoreAiPostLaunchMovePlan(...args);
    const scoreAiPublicPickCard = (...args) => context.scoreAiPublicPickCard(...args);
    const scoreAiScanAction = (...args) => context.scoreAiScanAction(...args);
    const summarizeAiTradeDiscardPlan = (...args) => context.summarizeAiTradeDiscardPlan(...args);

    function isRawNegativeResourceCardCornerAction(action = {}) {
      return action?.id === "cardCorner"
        && action.actionKind === "resource"
        && aiNumber(action.score) < 0;
    }

    function countAiRepeatedNegativeResourceCardCornersThisTurn(playerId = getCurrentPlayer()?.id) {
      if (!playerId) return 0;
      return (aiAutoBattleState.logs || []).filter((entry) => (
        entry?.type === "turn-action"
        && entry.roundNumber === turnState.roundNumber
        && entry.rawTurnNumber === turnState.turnNumber
        && entry.playerId === playerId
        && isRawNegativeResourceCardCornerAction(entry.details?.action)
      )).length;
    }

    function shouldCapRepeatedNegativeResourceCardCorner(candidate = {}, priorCount = 0) {
      if (priorCount <= 0 || !isRawNegativeResourceCardCornerAction(candidate)) return false;
      const breakdown = candidate.valueBreakdown || {};
      const graph = candidate.actionGraph || {};
      const directScoreGain = Math.max(0, aiNumber(candidate.directScoreGain));
      const followupMainActionScore = Math.max(0, aiNumber(breakdown.followupMainActionScore));
      const stagedTechSetupScore = Math.max(0, aiNumber(breakdown.stagedTechSetupScore));
      const moveFollowupScore = Math.max(0, aiNumber(breakdown.moveFollowupScore));
      const graphFinalMarginal = Math.max(0, aiNumber(graph.finalMarginal));
      if (directScoreGain > 0) return false;
      if (followupMainActionScore > 0 || stagedTechSetupScore > 0 || moveFollowupScore > 0) return false;
      return graphFinalMarginal <= 4;
    }

    function hasAiPassActionThisTurn(playerId = getCurrentPlayer()?.id) {
      if (!playerId) return false;
      return (aiAutoBattleState.logs || []).some((entry) => (
        entry?.type === "turn-action"
        && entry.roundNumber === turnState.roundNumber
        && entry.rawTurnNumber === turnState.turnNumber
        && entry.playerId === playerId
        && entry.details?.action?.id === "pass"
      ));
    }

    function shouldCapPostPassNoCashoutCardCorner(candidate = {}, player = getCurrentPlayer()) {
      if (!player || candidate?.id !== "cardCorner") return false;
      const alreadyPassed = (turnState.passedPlayerIds || []).includes(player.id)
        || hasAiPassActionThisTurn(player.id);
      if (!alreadyPassed) return false;
      if (normalizeAiDifficulty(player?.aiDifficulty || aiAutoBattleState.aiDifficulty) !== AI_DIFFICULTY_WEAK_START) {
        return false;
      }
      const currentScore = Math.max(0, aiNumber(player.resources?.score));
      if (currentScore > 65) return false;

      const breakdown = candidate.valueBreakdown || {};
      const directScoreGain = Math.max(0, aiNumber(candidate.directScoreGain));
      const followupMainActionScore = Math.max(0, aiNumber(breakdown.followupMainActionScore));
      const stagedTechSetupScore = Math.max(0, aiNumber(breakdown.stagedTechSetupScore));
      const moveFollowupScore = Math.max(0, aiNumber(breakdown.moveFollowupScore));
      const moveFollowupDirectScore = Math.max(0, aiNumber(breakdown.moveFollowupDirectScore));
      if (
        directScoreGain > 0
        || followupMainActionScore > 0
        || stagedTechSetupScore > 0
        || moveFollowupScore > 0
        || moveFollowupDirectScore > 0
      ) {
        return false;
      }
      const candidateScore = aiNumber(candidate.score);
      if (candidate.actionKind === "resource") return candidateScore > 0;
      if (candidate.actionKind !== "move") return false;
      if (breakdown.moveHasCashout !== false) return false;
      return candidateScore > 0 && candidateScore <= 6;
    }

    function getAiEarlyDirectScorePlayPassFloor(candidates = [], options = {}) {
      const round = options.roundNumber == null
        ? getAiRoundNumber()
        : Math.max(1, Math.round(aiNumber(options.roundNumber) || 1));
      if (round > 3) return null;
      const playCardCandidate = (candidates || []).find((candidate) => (
        candidate?.id === "playCard"
        && candidate.available !== false
        && Array.isArray(candidate.playableCards)
        && candidate.playableCards.length > 0
      ));
      const passCandidate = (candidates || []).find((candidate) => (
        (candidate?.id === "pass" || candidate?.id === "end-turn")
        && candidate.available !== false
      ));
      if (!playCardCandidate || !passCandidate) return null;

      const bestPlayableCard = playCardCandidate.playableCards
        .filter((candidate) => candidate?.available !== false)
        .slice()
        .sort((left, right) => aiNumber(right?.score) - aiNumber(left?.score))[0] || null;
      if (!bestPlayableCard || Math.max(0, aiNumber(bestPlayableCard.directScoreGain)) < 8) return null;

      const outerBaseScore = aiNumber(playCardCandidate.score);
      const nestedScore = aiNumber(bestPlayableCard.score);
      const playGraphNet = Number(playCardCandidate.actionGraph?.net);
      const passGraphNet = Number(passCandidate.actionGraph?.net);
      const passNet = Number.isFinite(passGraphNet) ? passGraphNet : aiNumber(passCandidate.score);
      if (
        !Number.isFinite(playGraphNet)
        || outerBaseScore <= passNet
        || nestedScore <= passNet
        || playGraphNet > passNet
      ) {
        return null;
      }
      const floor = roundAiScore(Math.min(outerBaseScore, nestedScore, passNet + 0.01));
      if (floor <= playGraphNet) return null;
      return {
        floor,
        originalNet: roundAiScore(playGraphNet),
        passNet: roundAiScore(passNet),
        outerBaseScore: roundAiScore(outerBaseScore),
        nestedScore: roundAiScore(nestedScore),
        directScoreGain: roundAiScore(Math.max(0, aiNumber(bestPlayableCard.directScoreGain))),
        cardId: bestPlayableCard.cardId || null,
      };
    }

    function applyAiTurnActionSelectionPressure(workingRoot, candidates = []) {
      const round = getAiRoundNumber();
      const currentPlayer = getCurrentPlayer();
      const repeatedNegativeResourceCardCorners = countAiRepeatedNegativeResourceCardCornersThisTurn(
        currentPlayer?.id,
      );
      const playCardCandidate = (candidates || []).find((candidate) => (
        candidate?.id === "playCard"
        && candidate.available !== false
      ));
      const scanCandidate = (candidates || []).find((candidate) => (
        candidate?.id === "scan"
        && candidate.available !== false
      ));
      const playCardNet = Number(playCardCandidate?.actionGraph?.net);
      const scanNet = Number(scanCandidate?.actionGraph?.net);
      const scanOverTechCardGap = scanNet - playCardNet;
      const canUseWeakStartTechCardTieBreak = Boolean(
        round === 2
        && normalizeAiDifficulty(currentPlayer?.aiDifficulty || aiAutoBattleState.aiDifficulty) === AI_DIFFICULTY_WEAK_START
        && Math.max(0, aiNumber(currentPlayer?.resources?.publicity)) <= 0
        && Math.max(0, aiNumber(currentPlayer?.resources?.score)) >= 50
        && Math.max(0, aiNumber(currentPlayer?.resources?.score)) <= 85
        && Number.isFinite(playCardNet)
        && Number.isFinite(scanNet)
        && playCardNet >= 15
        && scanNet >= 15
        && scanOverTechCardGap > 0
        && scanOverTechCardGap <= 0.45
        && Math.max(0, aiNumber(scanCandidate?.directScoreGain)) <= 2
        && (playCardCandidate?.effectTypes || []).some((type) => String(type || "").includes("research_tech"))
        && playCardCandidate?.plan?.type === "card-synergy"
      );
      const weakStartTechCardTieBreakBonus = canUseWeakStartTechCardTieBreak
        ? Math.min(0.55, scanOverTechCardGap + 0.18)
        : 0;
      const directScorePlayPassFloor = getAiEarlyDirectScorePlayPassFloor(candidates, { roundNumber: round });
      const bestContinuation = (candidates || [])
        .filter((candidate) => (
          candidate?.available !== false
          && candidate.id !== "end-turn"
          && candidate.id !== "pass"
          && !shouldCapPostPassNoCashoutCardCorner(candidate, currentPlayer)
        ))
        .reduce((best, candidate) => {
          const score = aiNumber(candidate.score);
          if (!Number.isFinite(score) || score <= best.score) return best;
          return {
            score,
            id: candidate.id || null,
            kind: candidate.kind || null,
          };
        }, { score: -Infinity, id: null, kind: null });

      return (candidates || []).map((candidate) => {
        if (!candidate || candidate.available === false) return candidate;
        let adjusted = candidate;
        const explicitScore = aiNumber(candidate.score);
        const graphNet = Number(candidate.actionGraph?.net);
        if (shouldCapRepeatedNegativeResourceCardCorner(candidate, repeatedNegativeResourceCardCorners)) {
          const cappedScore = Math.min(explicitScore, -0.5);
          const currentNet = Number.isFinite(graphNet) ? graphNet : explicitScore;
          adjusted = {
            ...adjusted,
            score: cappedScore,
            actionGraph: adjusted.actionGraph
              ? {
                ...adjusted.actionGraph,
                uncappedNet: adjusted.actionGraph.net,
                net: Math.min(currentNet, -0.5),
              }
              : adjusted.actionGraph,
            selectionAdjustment: {
              ...(adjusted.selectionAdjustment || {}),
              repeatedNegativeResourceCardCornerCap: repeatedNegativeResourceCardCorners,
              originalScore: Math.round(explicitScore * 100) / 100,
              originalNet: Number.isFinite(graphNet) ? Math.round(graphNet * 100) / 100 : null,
            },
            valueBreakdown: {
              ...(adjusted.valueBreakdown || {}),
              repeatedNegativeResourceCardCornerCap: repeatedNegativeResourceCardCorners,
            },
          };
        }
        if (
          candidate.kind === "quick"
          && Number.isFinite(explicitScore)
          && explicitScore > 0
          && candidate.actionGraph
          && (!Number.isFinite(graphNet) || graphNet < explicitScore)
        ) {
          adjusted = {
            ...adjusted,
            actionGraph: {
              ...adjusted.actionGraph,
              net: explicitScore,
            },
            selectionAdjustment: {
              ...(adjusted.selectionAdjustment || {}),
              quickScoreFloor: Math.round((explicitScore - (Number.isFinite(graphNet) ? graphNet : 0)) * 100) / 100,
            },
          };
        }
        if (shouldCapPostPassNoCashoutCardCorner(candidate, currentPlayer)) {
          const cappedScore = Math.min(aiNumber(adjusted.score), -0.75);
          const currentNet = Number(adjusted.actionGraph?.net);
          adjusted = {
            ...adjusted,
            score: cappedScore,
            actionGraph: adjusted.actionGraph
              ? {
                ...adjusted.actionGraph,
                uncappedPostPassNoCashoutNet: adjusted.actionGraph.net,
                net: Math.min(Number.isFinite(currentNet) ? currentNet : cappedScore, -0.75),
              }
              : adjusted.actionGraph,
            selectionAdjustment: {
              ...(adjusted.selectionAdjustment || {}),
              postPassNoCashoutCardCornerCap: true,
              originalScore: Math.round(aiNumber(candidate.score) * 100) / 100,
              originalNet: Number.isFinite(graphNet) ? Math.round(graphNet * 100) / 100 : null,
            },
            valueBreakdown: {
              ...(adjusted.valueBreakdown || {}),
              postPassNoCashoutCardCornerCap: true,
            },
          };
        }
        if (candidate.id === "playCard" && weakStartTechCardTieBreakBonus > 0) {
          const currentScore = Number.isFinite(explicitScore) ? explicitScore : 0;
          const currentNet = Number(adjusted.actionGraph?.net);
          adjusted = {
            ...adjusted,
            score: currentScore + weakStartTechCardTieBreakBonus,
            actionGraph: adjusted.actionGraph
              ? {
                ...adjusted.actionGraph,
                net: roundAiScore((Number.isFinite(currentNet) ? currentNet : currentScore) + weakStartTechCardTieBreakBonus),
              }
              : adjusted.actionGraph,
            selectionAdjustment: {
              ...(adjusted.selectionAdjustment || {}),
              weakStartTechCardTieBreak: roundAiScore(weakStartTechCardTieBreakBonus),
              scanNet: roundAiScore(scanNet),
              playCardNet: roundAiScore(playCardNet),
            },
          };
        }

        if (
          (candidate.id === "end-turn" || candidate.id === "pass")
          && Number.isFinite(bestContinuation.score)
          && bestContinuation.score > 1
        ) {
          const pressure = Math.min(
            round >= FINAL_ROUND_NUMBER ? 24 : 16,
            Math.max(0, bestContinuation.score) * (round >= FINAL_ROUND_NUMBER ? 1.25 : 0.9)
              + (bestContinuation.score >= 6 ? 3 : 1),
          );
          const currentScore = Number.isFinite(explicitScore) ? explicitScore : 0;
          const currentNet = Number(adjusted.actionGraph?.net);
          adjusted = {
            ...adjusted,
            score: currentScore - pressure,
            actionGraph: adjusted.actionGraph
              ? {
                ...adjusted.actionGraph,
                net: (Number.isFinite(currentNet) ? currentNet : currentScore) - pressure,
              }
              : adjusted.actionGraph,
            selectionAdjustment: {
              ...(adjusted.selectionAdjustment || {}),
              continuationPenalty: Math.round(pressure * 100) / 100,
              bestContinuation,
              originalScore: Math.round(currentScore * 100) / 100,
            },
          };
        }
        if (candidate.id === "playCard" && directScorePlayPassFloor) {
          const currentNet = Number(adjusted.actionGraph?.net);
          if (adjusted.actionGraph && Number.isFinite(currentNet) && currentNet < directScorePlayPassFloor.floor) {
            adjusted = {
              ...adjusted,
              actionGraph: {
                ...adjusted.actionGraph,
                uncappedDirectScorePlayNet: adjusted.actionGraph.net,
                net: directScorePlayPassFloor.floor,
              },
              selectionAdjustment: {
                ...(adjusted.selectionAdjustment || {}),
                directScoreAbovePassFloor: directScorePlayPassFloor,
              },
              valueBreakdown: {
                ...(adjusted.valueBreakdown || {}),
                directScoreAbovePassFloor: directScorePlayPassFloor.floor,
              },
            };
          }
        }
        return adjusted;
      });
    }

    function buildAiResourceLockTradePreviews(workingRoot, player = getCurrentPlayer(), candidates = []) {
      if (
        !player
        || !quickTrades?.getTradeAction
        || state.pendingActionExecuted
        || !canStartMainAction()
        || (turnState.passedPlayerIds || []).includes(player.id)
      ) {
        return [];
      }
      const playCardCandidate = (candidates || []).find((candidate) => candidate?.id === "playCard");
      if (!playCardCandidate || playCardCandidate.available !== false) return [];
      if (!String(playCardCandidate.reason || "").includes("没有资源可支付")) return [];

      const tradeIds = ["cards-for-credit", "cards-for-energy", "energy-for-credit", "credits-for-energy"];
      return tradeIds.map((tradeId) => {
        const trade = quickTrades.getTradeAction(tradeId);
        const check = quickTrades.canExecuteTrade?.(tradeId, createActionContext(workingRoot)) || { ok: false };
        if (!trade || !check.ok) return null;
        const simulatedPlayer = createAiPlayerAfterQuickTrade(player, trade);
        if (!simulatedPlayer) return null;
        const handCost = Math.max(0, Math.round(aiNumber(trade.cost?.handSize)));
        const handAfterTrade = Math.max(
          0,
          Math.round(aiNumber(player.resources?.handSize ?? (player.hand || []).length)) - handCost
            + Math.max(0, Math.round(aiNumber(trade.gain?.handSize))),
        );

        const playableCards = handAfterTrade > 0
          ? (player.hand || [])
            .map((card, handIndex) => buildAiPlayCardCandidate(workingRoot, card, handIndex, simulatedPlayer))
            .filter(Boolean)
            .sort((left, right) => aiNumber(right.score) - aiNumber(left.score))
          : [];
        const bestPlay = playableCards[0] || null;

        const scanCheck = scanEffects?.canExecuteScan?.(simulatedPlayer, { standardAction: true }) || { ok: false };
        const scanScore = scanCheck.ok ? scoreAiScanAction(simulatedPlayer) : 0;
        const analyzeCheck = canAiAnalyzeData(simulatedPlayer);
        const analyzeScore = analyzeCheck.ok ? scoreAiAnalyzeAction(simulatedPlayer) : 0;
        const planetCashoutRecovery = scoreAiEnergyTradePlanetCashoutRecovery(player, tradeId);
        const planetCashoutPlan = planetCashoutRecovery?.plan || null;
        const planetCashoutUnlocked = planetCashoutPlan
          && Math.max(0, aiNumber(planetCashoutPlan.afterTradeGap)) <= 0;

        const activeRocketCount = rocketActions.getRocketsForPlayer
          ? rocketActions.getRocketsForPlayer(rocketState, player.id).length
          : 0;
        const rocketLimit = abilities.rocket?.getRocketLimitForPlayer
          ? abilities.rocket.getRocketLimitForPlayer(player, createActionContext())
          : activeRocketCount;
        const canLaunchAfterTrade = activeRocketCount < rocketLimit
          && players.canAfford(simulatedPlayer, getAiLaunchPaymentCost());
        const launchPlan = canLaunchAfterTrade ? scoreAiPostLaunchMovePlan(simulatedPlayer) : null;
        const launchValue = canLaunchAfterTrade
          ? scoreAiLaunchTurnCandidateValue(simulatedPlayer, launchPlan)
          : null;
        const launchScore = aiNumber(launchValue?.score);

        const options = [
          bestPlay ? {
            actionId: "playCard",
            score: aiNumber(bestPlay.score),
            handIndex: Number.isInteger(Number(bestPlay.handIndex)) ? Number(bestPlay.handIndex) : null,
            cardId: bestPlay.cardId || null,
            cardLabel: bestPlay.cardLabel || null,
            directScoreGain: Math.max(0, aiNumber(bestPlay.directScoreGain)),
          } : null,
          scanCheck.ok ? {
            actionId: "scan",
            score: aiNumber(scanScore),
            directScoreGain: Math.max(0, aiNumber(getAiScanDirectScoreGain(simulatedPlayer))),
          } : null,
          analyzeCheck.ok ? {
            actionId: "analyze",
            score: aiNumber(analyzeScore),
          } : null,
          planetCashoutUnlocked ? {
            actionId: planetCashoutPlan.kind || "planetCashout",
            score: aiNumber(planetCashoutRecovery.score),
            planetId: planetCashoutPlan.planetId || null,
            planetName: planetCashoutPlan.planetName || null,
            directScoreGain: Math.max(0, aiNumber(planetCashoutPlan.directScore)),
            rewardValue: Math.max(0, aiNumber(planetCashoutPlan.rewardValue)),
            targetEnergy: Math.max(0, aiNumber(planetCashoutPlan.targetEnergy)),
            energyAfterTrade: Math.max(0, aiNumber(planetCashoutPlan.energyAfterTrade)),
            afterTradeGap: Math.max(0, aiNumber(planetCashoutPlan.afterTradeGap)),
          } : null,
          canLaunchAfterTrade ? {
            actionId: "launch",
            score: aiNumber(launchScore),
            planScore: aiNumber(launchPlan?.score),
          } : null,
        ].filter(Boolean).sort((left, right) => aiNumber(right.score) - aiNumber(left.score));
        const bestAction = options[0] || null;
        const bestActionHandIndex = Number.isInteger(Number(bestAction?.handIndex))
          ? Number(bestAction.handIndex)
          : null;
        const discardPlan = summarizeAiTradeDiscardPlan(workingRoot, player, trade, bestActionHandIndex, {
          includeExecutionPlan: true,
          tradeId,
        });
        const bestActionDiscardRisk = bestActionHandIndex === null ? null : {
          handIndex: bestActionHandIndex,
          costPlanDiscards: (discardPlan.selectedCards || [])
            .some((card) => Number(card.handIndex) === bestActionHandIndex),
          executionPlanDiscards: (discardPlan.executionSelectedIndexes || [])
            .some((handIndex) => Number(handIndex) === bestActionHandIndex),
          executionMatchesCostPlan: Boolean(discardPlan.executionMatchesCostPlan),
        };

        return {
          tradeId,
          label: trade.label || tradeId,
          cost: { ...(trade.cost || {}) },
          gain: { ...(trade.gain || {}) },
          discardPlan,
          bestActionDiscardRisk,
          resourcesAfterTrade: {
            credits: roundAiScore(simulatedPlayer.resources?.credits),
            energy: roundAiScore(simulatedPlayer.resources?.energy),
            publicity: roundAiScore(simulatedPlayer.resources?.publicity),
            handSize: handAfterTrade,
          },
          bestAction: bestAction ? {
            ...bestAction,
            score: roundAiScore(bestAction.score),
          } : null,
          unlockedActions: options.slice(0, 4).map((option) => ({
            ...option,
            score: roundAiScore(option.score),
          })),
        };
      }).filter(Boolean);
    }

    function buildAiPublicRefillTradePreview(workingRoot, player = getCurrentPlayer()) {
      if (!player) return null;
      const resources = player.resources || {};
      const handSize = Math.max(0, Math.round(aiNumber(resources.handSize ?? (player.hand || []).length)));
      const publicTradeCards = (workingRoot.cardState.publicCards || [])
        .map((card, slotIndex) => {
          const playCandidate = buildAiPlayCardCandidate(workingRoot, card, -1, player);
          return {
            slotIndex,
            cardId: card?.cardId || card?.id || null,
            cardLabel: cards.getCardLabel?.(card) || card?.cardName || card?.label || null,
            price: getCardPrice(card),
            typeCode: getCardTypeCode(card),
            tradeScore: roundAiScore(scoreAiPublicPickCard(card, player, "trade", workingRoot)),
            playScore: playCandidate ? roundAiScore(playCandidate.score) : null,
            directScoreGain: playCandidate ? roundAiScore(playCandidate.directScoreGain) : 0,
          };
        })
        .sort((left, right) => aiNumber(right.tradeScore) - aiNumber(left.tradeScore))
        .slice(0, 5);
      const bestPublicTradeCardScore = publicTradeCards[0]?.tradeScore ?? 0;
      const cardsForPickCardTrade = quickTrades?.getTradeAction?.("cards-for-pick-card");
      const cardsForPickCardCheck = cardsForPickCardTrade
        ? (quickTrades.canExecuteTrade?.("cards-for-pick-card", createActionContext(workingRoot)) || { ok: false })
        : { ok: false };
      const cardsForPickCardHandCost = Math.max(0, Math.round(aiNumber(cardsForPickCardTrade?.cost?.handSize)));
      const cardsForPickCardDiscardPlan = cardsForPickCardTrade && cardsForPickCardCheck.ok
        ? summarizeAiTradeDiscardPlan(workingRoot, player, cardsForPickCardTrade, null, {
          includeExecutionPlan: true,
          tradeId: "cards-for-pick-card",
        })
        : null;
      const cardsForPickCardDiscardCost = cardsForPickCardDiscardPlan?.ok
        ? Number(cardsForPickCardDiscardPlan.totalCost)
        : Infinity;
      const cardsForPickCardPreview = cardsForPickCardTrade
        ? {
          ok: Boolean(cardsForPickCardCheck.ok),
          reason: cardsForPickCardCheck.ok ? null : (cardsForPickCardCheck.reason || cardsForPickCardCheck.message || null),
          handCost: cardsForPickCardHandCost,
          handAfterTrade: Math.max(
            0,
            handSize
              - cardsForPickCardHandCost
              + Math.max(0, Math.round(aiNumber(cardsForPickCardTrade.gain?.handSize))),
          ),
          discardCost: Number.isFinite(cardsForPickCardDiscardCost)
            ? roundAiScore(cardsForPickCardDiscardCost)
            : null,
          discardPlan: cardsForPickCardDiscardPlan,
          bestPublicTradeCardScore: roundAiScore(bestPublicTradeCardScore),
          bestPublicTradeCard: publicTradeCards[0] || null,
          net: Number.isFinite(cardsForPickCardDiscardCost)
            ? roundAiScore(bestPublicTradeCardScore * 0.58 - cardsForPickCardDiscardCost * 0.34)
            : null,
        }
        : null;
      const tradeChecks = ["credits-for-card", "energy-for-card", "publicity-for-card", "cards-for-pick-card"]
        .map((tradeId) => {
          const trade = quickTrades?.getTradeAction?.(tradeId);
          const check = trade ? (quickTrades.canExecuteTrade?.(tradeId, createActionContext()) || { ok: false }) : { ok: false };
          return {
            tradeId,
            ok: Boolean(check.ok),
            reason: check.ok ? null : (check.reason || check.message || null),
            cost: trade?.cost ? { ...trade.cost } : null,
            gain: trade?.gain ? { ...trade.gain } : null,
          };
        });
      return {
        credits: roundAiScore(resources.credits),
        energy: roundAiScore(resources.energy),
        publicity: roundAiScore(resources.publicity),
        handSize,
        bestPublicTradeCardScore,
        topPublicTradeCards: publicTradeCards,
        cardsForPickCardPreview,
        tradeChecks,
      };
    }

    function buildAiEarlyNoMainPublicRefillDiagnostic(workingRoot, player = getCurrentPlayer(), candidates = []) {
      if (
        !player
        || state.pendingActionExecuted
        || !canStartMainAction()
        || getAiRoundNumber() >= FINAL_ROUND_NUMBER
      ) {
        return null;
      }
      const availableMainCount = (candidates || [])
        .filter((candidate) => candidate?.kind === "main" && candidate.available !== false)
        .length;
      if (availableMainCount > 0) return null;
      const resources = player.resources || {};
      const handSize = Math.max(0, Math.round(aiNumber(resources.handSize ?? (player.hand || []).length)));
      if (
        handSize > 3
        && aiNumber(resources.credits) < 2
        && aiNumber(resources.energy) < 2
        && aiNumber(resources.publicity) < 3
      ) {
        return null;
      }
      return {
        roundNumber: getAiRoundNumber(),
        availableMainCount,
        ...buildAiPublicRefillTradePreview(workingRoot, player),
      };
    }

    function buildAiFinalLowHandPassRecoveryDiagnostic(workingRoot, player = getCurrentPlayer(), candidates = []) {
      if (
        !player
        || getAiRoundNumber() < FINAL_ROUND_NUMBER
        || state.pendingActionExecuted
        || !canStartMainAction()
      ) {
        return null;
      }
      const resources = player.resources || {};
      const currentScore = Math.max(0, aiNumber(resources.score));
      const handSize = Math.max(0, Math.round(aiNumber(resources.handSize ?? (player.hand || []).length)));
      if (currentScore >= 170 || handSize > 4) return null;

      const publicTradeCards = (cardState.publicCards || [])
        .map((card, slotIndex) => {
          const playCandidate = buildAiPlayCardCandidate(workingRoot, card, -1, player);
          return {
            slotIndex,
            cardId: card.cardId || card.id || null,
            cardLabel: cards.getCardLabel?.(card) || card.cardName || card.label || null,
            price: getCardPrice(card),
            typeCode: getCardTypeCode(card),
            tradeScore: roundAiScore(scoreAiPublicPickCard(card, player, "trade")),
            playScore: playCandidate ? roundAiScore(playCandidate.score) : null,
            directScoreGain: playCandidate ? roundAiScore(playCandidate.directScoreGain) : 0,
          };
        })
        .sort((left, right) => aiNumber(right.tradeScore) - aiNumber(left.tradeScore))
        .slice(0, 5);
      const finalMarks = countAiFinalMarksForPlayer(player);
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player) || null;
      const bestPublicTradeCardScore = publicTradeCards[0]?.tradeScore ?? 0;
      const finalLowHandRefillWindow = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && canStartMainAction()
        && currentScore < 165
        && handSize <= 1
        && (
          aiNumber(resources.credits) >= 2
          || aiNumber(resources.energy) >= 2
          || aiNumber(resources.publicity) >= 3
        );
      const finalLowHandPublicRefill = finalLowHandRefillWindow && (
        currentScore < 150
          ? bestPublicTradeCardScore >= 4
          : bestPublicTradeCardScore >= 10
      );
      const cardsForPickCardTrade = quickTrades?.getTradeAction?.("cards-for-pick-card");
      const cardsForPickCardCheck = cardsForPickCardTrade
        ? (quickTrades.canExecuteTrade?.("cards-for-pick-card", createActionContext()) || { ok: false })
        : { ok: false };
      const cardsForPickCardHandCost = Math.max(0, Math.round(aiNumber(cardsForPickCardTrade?.cost?.handSize)));
      const cardsForPickCardDiscardPlan = cardsForPickCardTrade && cardsForPickCardCheck.ok
        ? summarizeAiTradeDiscardPlan(workingRoot, player, cardsForPickCardTrade, null, {
          includeExecutionPlan: true,
          tradeId: "cards-for-pick-card",
        })
        : null;
      const cardsForPickCardDiscardCost = cardsForPickCardDiscardPlan?.ok
        ? Number(cardsForPickCardDiscardPlan.totalCost)
        : Infinity;
      const cardsForPickCardPreview = cardsForPickCardTrade
        ? {
          ok: Boolean(cardsForPickCardCheck.ok),
          reason: cardsForPickCardCheck.ok ? null : (cardsForPickCardCheck.reason || cardsForPickCardCheck.message || null),
          handCost: cardsForPickCardHandCost,
          handAfterTrade: Math.max(
            0,
            handSize
              - cardsForPickCardHandCost
              + Math.max(0, Math.round(aiNumber(cardsForPickCardTrade.gain?.handSize))),
          ),
          discardCost: Number.isFinite(cardsForPickCardDiscardCost)
            ? roundAiScore(cardsForPickCardDiscardCost)
            : null,
          discardPlan: cardsForPickCardDiscardPlan,
          bestPublicTradeCardScore: roundAiScore(bestPublicTradeCardScore),
          bestPublicTradeCard: publicTradeCards[0] || null,
          net: Number.isFinite(cardsForPickCardDiscardCost)
            ? roundAiScore(bestPublicTradeCardScore * 0.58 - cardsForPickCardDiscardCost * 0.34)
            : null,
        }
        : null;
      const tradeChecks = ["credits-for-card", "energy-for-card", "publicity-for-card", "cards-for-credit", "cards-for-energy", "cards-for-pick-card", "energy-for-credit"]
        .map((tradeId) => {
          const trade = quickTrades?.getTradeAction?.(tradeId);
          const check = trade ? (quickTrades.canExecuteTrade?.(tradeId, createActionContext()) || { ok: false }) : { ok: false };
          return {
            tradeId,
            ok: Boolean(check.ok),
            reason: check.ok ? null : (check.reason || check.message || null),
            cost: trade?.cost ? { ...trade.cost } : null,
            gain: trade?.gain ? { ...trade.gain } : null,
          };
        });
      const availableQuick = (candidates || [])
        .filter((candidate) => candidate?.kind === "quick" && candidate.available !== false)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score))
        .slice(0, 5)
        .map((candidate) => ({
          id: candidate.id || null,
          tradeId: candidate.tradeId || null,
          label: candidate.label || null,
          score: roundAiScore(candidate.score),
          reason: candidate.reason || null,
        }));
      const lateRecoveryPreviewCandidates = listAiLateResourceRecoveryTradeCandidates(workingRoot, player)
        .slice(0, 5)
        .map((candidate) => ({
          id: candidate.id || null,
          tradeId: candidate.tradeId || null,
          label: candidate.label || null,
          score: roundAiScore(candidate.score),
          reason: candidate.reason || null,
          valueBreakdown: candidate.valueBreakdown || null,
        }));
      const unavailableMain = (candidates || [])
        .filter((candidate) => candidate?.kind === "main" && candidate.available === false)
        .slice(0, 6)
        .map((candidate) => ({
          id: candidate.id || null,
          score: roundAiScore(candidate.score),
          reason: candidate.reason || null,
        }));

      return {
        currentScore,
        finalMarkCount: finalMarks,
        nextFinalMarkThreshold: nextThreshold,
        handSize,
        credits: roundAiScore(resources.credits),
        energy: roundAiScore(resources.energy),
        publicity: roundAiScore(resources.publicity),
        bestPublicTradeCardScore,
        topPublicTradeCards: publicTradeCards,
        cardsForPickCardPreview,
        tradeChecks,
        lateRecoveryGate: {
          hasQuickTrades: Boolean(quickTrades?.getTradeAction),
          hasRunQuickTrade: typeof runQuickTrade === "function",
          mainActionOpen: canStartMainAction(),
          pendingActionExecuted: Boolean(state.pendingActionExecuted),
          passed: Boolean((turnState.passedPlayerIds || []).includes(player.id)),
          finalLowHandRefillWindow,
          finalLowHandPublicRefill,
          finalLowHandCreditRefill: finalLowHandPublicRefill && aiNumber(resources.credits) >= 2,
          finalLowHandEnergyRefill: finalLowHandPublicRefill && aiNumber(resources.energy) >= 2,
          usefulPublicTradeThreshold: nextThreshold && nextThreshold <= 50 ? 8 : 4,
        },
        availableQuick,
        lateRecoveryPreviewCandidates,
        unavailableMain,
      };
    }

    function buildAiFinalHighScorePassRecoveryDiagnostic(workingRoot, player = getCurrentPlayer(), candidates = []) {
      if (
        !player
        || getAiRoundNumber() < FINAL_ROUND_NUMBER
        || state.pendingActionExecuted
        || !canStartMainAction()
      ) {
        return null;
      }
      const resources = player.resources || {};
      const highScorePushProfile = getAiHighScorePushProfile(player);
      const projectedScore = Math.max(0, aiNumber(highScorePushProfile.projectedScore || getAiProjectedFinalScore(player)));
      const scoreTo300 = Math.max(0, 300 - projectedScore);
      const finalMarks = countAiFinalMarksForPlayer(player);
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player) || null;
      const currentScore = Math.max(0, aiNumber(resources.score));
      const handSize = Math.max(0, Math.round(aiNumber(resources.handSize ?? (player.hand || []).length)));
      const credits = Math.max(0, aiNumber(resources.credits));
      const energy = Math.max(0, aiNumber(resources.energy));
      const publicity = Math.max(0, aiNumber(resources.publicity));
      const finalHighScoreCandidateWindow = finalMarks >= 3
        && !nextThreshold
        && highScorePushProfile.active
        && projectedScore >= 260
        && projectedScore < 340
        && !(turnState.passedPlayerIds || []).includes(player.id);
      if (!finalHighScoreCandidateWindow) return null;

      const playableHandCards = (player.hand || [])
        .map((card, handIndex) => {
          const candidate = buildAiPlayCardCandidate(workingRoot, card, handIndex, player);
          return {
            handIndex,
            cardId: card?.cardId || card?.id || null,
            cardLabel: cards.getCardLabel?.(card) || card?.cardName || card?.label || null,
            price: getCardPrice(card),
            typeCode: getCardTypeCode(card),
            score: candidate ? roundAiScore(candidate.score) : null,
            available: candidate ? candidate.available !== false : false,
            reason: candidate?.reason || null,
            directScoreGain: candidate ? roundAiScore(candidate.directScoreGain) : 0,
            endGameExpectedScore: candidate ? roundAiScore(candidate.breakdown?.endGameExpectedScore) : 0,
          };
        })
        .sort((left, right) => (
          aiNumber(right.score) - aiNumber(left.score)
          || left.handIndex - right.handIndex
        ))
        .slice(0, 5);
      const highScorePlayableHandScore = handSize <= 4
        ? playableHandCards.reduce((best, card) => Math.max(best, aiNumber(card.score)), 0)
        : 0;
      const finalHighScoreNeedsCardRefill = handSize <= 1
        || (handSize <= 2 && highScorePlayableHandScore < 8);
      const finalHighScoreDeadHandRefillBaseWindow = handSize >= 3
        && handSize <= 4
        && highScorePlayableHandScore < 8;
      const publicPreview = buildAiPublicRefillTradePreview(player) || {};
      const rankedPublicTradeCards = (cardState.publicCards || [])
        .map((card, slotIndex) => ({
          card,
          slotIndex,
          score: scoreAiPublicPickCard(card, player, "trade"),
        }))
        .filter((entry) => entry.card && Number.isFinite(Number(entry.score)))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || left.slotIndex - right.slotIndex);
      const bestPublicTradeCard = rankedPublicTradeCards[0] || null;
      const bestPublicTradeCardScore = aiNumber(bestPublicTradeCard?.score ?? publicPreview.bestPublicTradeCardScore);
      const bestPublicTradeCardProfile = getAiPublicPickConcreteProfile(bestPublicTradeCard?.card, player);
      const publicRefillScoreThreshold = projectedScore >= 305 ? 8 : scoreTo300 <= 10 ? 0 : 5;
      const finalHighScorePublicRefillBase = finalHighScoreNeedsCardRefill
        && bestPublicTradeCardScore >= publicRefillScoreThreshold;
      const finalHighScoreTerminalNoSignalPublicRefill = finalHighScorePublicRefillBase
        && handSize <= 0
        && publicity >= 3
        && publicity < 6
        && !bestPublicTradeCardProfile.hasConcreteSignal;
      const finalHighScorePublicRefill = finalHighScorePublicRefillBase
        && !finalHighScoreTerminalNoSignalPublicRefill;
      const finalHighScoreBlindRefillPublicityThreshold = normalizeAiDifficulty(
        player?.aiDifficulty || aiAutoBattleState.aiDifficulty,
      ) === AI_DIFFICULTY_WEAK_START ? 3 : 6;
      const finalHighScoreBlindRefill = finalHighScoreNeedsCardRefill
        && projectedScore < 300
        && scoreTo300 <= 32
        && publicity >= finalHighScoreBlindRefillPublicityThreshold
        && handSize <= 1
        && bestPublicTradeCardScore < publicRefillScoreThreshold
        && !bestPublicTradeCardProfile.hasConcreteSignal;
      const cardsForPickCardPreview = publicPreview.cardsForPickCardPreview || null;
      const cardsForPickCardHandAfterTrade = Math.max(0, aiNumber(cardsForPickCardPreview?.handAfterTrade));
      const cardsForPickCardDiscardCost = Number.isFinite(Number(cardsForPickCardPreview?.discardCost))
        ? aiNumber(cardsForPickCardPreview.discardCost)
        : Infinity;
      const finalHighScoreDeadHandPickRefill = finalHighScoreDeadHandRefillBaseWindow
        && Boolean(cardsForPickCardPreview?.ok)
        && cardsForPickCardHandAfterTrade >= 2
        && Number.isFinite(cardsForPickCardDiscardCost)
        && cardsForPickCardDiscardCost <= 8
        && bestPublicTradeCardScore >= 24
        && aiNumber(bestPublicTradeCardProfile.playScore) >= 18
        && bestPublicTradeCardProfile.hasConcreteSignal;
      const availableQuick = (candidates || [])
        .filter((candidate) => candidate?.kind === "quick" && candidate.available !== false)
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score))
        .slice(0, 5)
        .map((candidate) => ({
          id: candidate.id || null,
          tradeId: candidate.tradeId || null,
          label: candidate.label || null,
          score: roundAiScore(candidate.score),
          reason: candidate.reason || null,
        }));
      const lateRecoveryPreviewCandidates = listAiLateResourceRecoveryTradeCandidates(workingRoot, player)
        .slice(0, 5)
        .map((candidate) => ({
          id: candidate.id || null,
          tradeId: candidate.tradeId || null,
          label: candidate.label || null,
          score: roundAiScore(candidate.score),
          reason: candidate.reason || null,
          valueBreakdown: candidate.valueBreakdown || null,
        }));
      const unavailableMain = (candidates || [])
        .filter((candidate) => candidate?.kind === "main" && candidate.available === false)
        .slice(0, 6)
        .map((candidate) => ({
          id: candidate.id || null,
          score: roundAiScore(candidate.score),
          reason: candidate.reason || null,
        }));

      return {
        currentScore: roundAiScore(currentScore),
        projectedScore: roundAiScore(projectedScore),
        scoreTo300: roundAiScore(scoreTo300),
        finalMarkCount: finalMarks,
        finalFormulas: Array.from(highScorePushProfile.formulas || []),
        nextFinalMarkThreshold: nextThreshold,
        handSize,
        credits: roundAiScore(credits),
        energy: roundAiScore(energy),
        publicity: roundAiScore(publicity),
        highScoreStrength: roundAiScore(highScorePushProfile.strength),
        highScorePlayableHandScore: roundAiScore(highScorePlayableHandScore),
        playableHandCards,
        bestPublicTradeCardScore: roundAiScore(bestPublicTradeCardScore),
        topPublicTradeCards: Array.isArray(publicPreview.topPublicTradeCards)
          ? publicPreview.topPublicTradeCards.slice(0, 5)
          : [],
        cardsForPickCardPreview,
        tradeChecks: Array.isArray(publicPreview.tradeChecks)
          ? publicPreview.tradeChecks.slice(0, 8)
          : [],
        highScoreGate: {
          finalHighScoreCandidateWindow,
          finalHighScoreNeedsCardRefill,
          finalHighScorePublicRefillBase,
          finalHighScoreTerminalNoSignalPublicRefill,
          finalHighScorePublicRefill,
          finalHighScoreBlindRefill,
          finalHighScoreBlindRefillPublicityThreshold,
          finalHighScoreDeadHandRefillBaseWindow,
          finalHighScoreDeadHandPickRefill,
          cardsForPickCardHandAfterTrade,
          cardsForPickCardDiscardCost: Number.isFinite(cardsForPickCardDiscardCost)
            ? roundAiScore(cardsForPickCardDiscardCost)
            : null,
          publicRefillScoreThreshold: roundAiScore(publicRefillScoreThreshold),
          bestPublicTradeCardHasConcreteSignal: Boolean(bestPublicTradeCardProfile.hasConcreteSignal),
          hasCardRefillResource: credits >= 2 || energy >= 2 || publicity >= 3 || handSize >= 2,
        },
        availableQuick,
        lateRecoveryPreviewCandidates,
        unavailableMain,
      };
    }
    return Object.freeze({
      isRawNegativeResourceCardCornerAction,
      countAiRepeatedNegativeResourceCardCornersThisTurn,
      shouldCapRepeatedNegativeResourceCardCorner,
      hasAiPassActionThisTurn,
      shouldCapPostPassNoCashoutCardCorner,
      getAiEarlyDirectScorePlayPassFloor,
      applyAiTurnActionSelectionPressure,
      buildAiResourceLockTradePreviews,
      buildAiPublicRefillTradePreview,
      buildAiEarlyNoMainPublicRefillDiagnostic,
      buildAiFinalLowHandPassRecoveryDiagnostic,
      buildAiFinalHighScorePassRecoveryDiagnostic,
    });
  }

  return Object.freeze({ createSelectionPressure });
});
