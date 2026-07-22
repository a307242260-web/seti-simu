(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SetiAppAiBattleLog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createAiBattleLog(context) {
    if (!context || !context.aiAutoBattleState) {
      throw new Error("createAiBattleLog requires explicit AI battle context");
    }
    with (context) {
        function getAiAutoBattleScoreSnapshot() {
          return getActivePlayers().map((player) => ({
            playerId: player.id || null,
            playerLabel: player.colorLabel || player.name || player.color || null,
            score: Math.max(0, Math.round(aiNumber(player.resources?.score))),
            credits: Math.max(0, Math.round(aiNumber(player.resources?.credits))),
            energy: Math.max(0, Math.round(aiNumber(player.resources?.energy))),
            publicity: Math.max(0, Math.round(aiNumber(player.resources?.publicity))),
            availableData: Math.max(0, Math.round(aiNumber(player.resources?.availableData))),
            handSize: Array.isArray(player.hand)
              ? player.hand.length
              : Math.max(0, Math.round(aiNumber(player.resources?.handSize))),
            reservedCount: Array.isArray(player.reservedCards) ? player.reservedCards.length : 0,
            techCount: countAiPlayerTech(player),
          }));
        }

        function getAiAutoBattleEntryPlayer(details = {}) {
          const playerId = details.logPlayerId || details.ownerPlayerId || null;
          const playerColor = details.logPlayerColor || details.ownerPlayerColor || null;
          return (playerId ? getPlayerById(playerId) : null)
            || (playerColor ? getPlayerByColor(playerColor) : null)
            || getCurrentPlayer();
        }

        function compactAiAutoBattleLogValue(value, depth = 0) {
          if (value == null || typeof value !== "object") return value;
          if (depth >= 2) return Array.isArray(value) ? `[${value.length}项]` : "[详情已省略]";
          if (Array.isArray(value)) {
            return value.slice(0, 6).map((entry) => compactAiAutoBattleLogValue(entry, depth + 1));
          }
          return Object.fromEntries(Object.entries(value)
            .slice(0, 16)
            .map(([key, entry]) => [key, compactAiAutoBattleLogValue(entry, depth + 1)]));
        }

        function compactAiAutoBattleLogDetails(type, details = {}) {
          if (!aiAutoBattleState.compactLogs) return structuredClone(details || {});
          if (type === "turn-action") {
            const candidates = Array.isArray(details.candidates) ? details.candidates : [];
            const rankedCandidates = candidates
              .filter((candidate) => candidate?.available !== false)
              .map((candidate, index) => ({ candidate, index }))
              .sort((left, right) => (
                getAiCandidateRankScore(right.candidate) - getAiCandidateRankScore(left.candidate)
                || left.index - right.index
              ))
              .slice(0, 3)
              .map(({ candidate }) => summarizeAiTurnActionCandidate(candidate));
            return {
              action: summarizeAiTurnActionCandidate(details.action || {}),
              candidates: rankedCandidates,
              plannerShadow: compactAiAutoBattleLogValue(details.plannerShadow || null),
            };
          }
          if (type === "final-score-mark") {
            const candidates = Array.isArray(details.candidates)
              ? details.candidates.filter((candidate) => candidate?.available !== false)
              : [];
            return {
              pending: compactAiAutoBattleLogValue(details.pending || null),
              selected: summarizeAiFinalScoreMarkCandidate(details.selected || details.mark || {}),
              candidates: candidates.map(summarizeAiFinalScoreMarkCandidate),
              mark: compactAiAutoBattleLogValue(details.mark || null),
            };
          }
          if (type === "tech-placement") {
            const summarizeTechCandidate = (candidate = {}) => ({
              tileId: candidate.tileId || null,
              techType: candidate.techType || null,
              stackIndex: candidate.stackIndex ?? null,
              bonusId: candidate.bonusId || null,
              firstTake: candidate.firstTake === true,
              remaining: candidate.remaining ?? null,
              score: roundAiScore(aiNumber(candidate.score)),
              directScoreGain: roundAiScore(aiNumber(candidate.directScoreGain)),
              finalFormulaDeltas: candidate.finalFormulaDeltas || {},
              plan: candidate.plan ? {
                actionId: candidate.plan.actionId || null,
                score: roundAiScore(aiNumber(candidate.plan.score)),
              } : null,
              valueBreakdown: candidate.valueBreakdown || {},
            });
            return {
              tileId: details.tileId || null,
              blueSlot: details.blueSlot ?? null,
              selected: summarizeTechCandidate(details.selected || {}),
              candidates: Array.isArray(details.candidates)
                ? details.candidates.map(summarizeTechCandidate)
                : [],
            };
          }
          if (type === "pick-card") {
            const topPublicCandidates = Array.isArray(details.topPublicCandidates)
              ? details.topPublicCandidates.slice(0, 5)
              : [];
            const selectedCard = details.card
              ? summarizeAiAutoBattleLogCard(details.card)
              : topPublicCandidates.find((candidate) => (
                Number(candidate?.slotIndex) === Number(details.slotIndex)
              )) || null;
            return {
              pendingType: details.pendingType || null,
              tradeId: details.tradeId || null,
              aiReason: details.aiReason || null,
              aiPreferBlindDraw: details.aiPreferBlindDraw === true,
              slotIndex: details.slotIndex ?? null,
              score: details.score ?? null,
              selectedCard,
              skippedPublicCard: details.skippedPublicCard || null,
              topPublicCandidates,
            };
          }
          if (type === "play-card") {
            const selected = details.selected || null;
            return {
              selectedLabel: details.selectedLabel || null,
              handIndex: details.handIndex ?? selected?.handIndex ?? null,
              card: details.card ? summarizeAiAutoBattleLogCard(details.card) : null,
              selected: selected ? {
                cardId: selected.cardId || null,
                cardInstanceId: selected.cardInstanceId || null,
                cardLabel: selected.cardLabel || details.selectedLabel || null,
                price: selected.price ?? null,
                typeCode: selected.typeCode ?? null,
                score: selected.score ?? null,
              } : null,
            };
          }
          if (type === "industry" && details.slotId) {
            return {
              slotId: details.slotId,
              score: details.score ?? null,
              rewardLabel: details.rewardLabel || null,
              choices: Array.isArray(details.choices)
                ? details.choices.map((choice) => ({
                  slotId: choice?.slotId || null,
                  score: choice?.score ?? null,
                  rewardLabel: choice?.rewardLabel || null,
                }))
                : [],
            };
          }
          return compactAiAutoBattleLogValue(details || {});
        }

        function summarizeAiAutoBattleLogCard(card = {}) {
          return {
            cardId: card.cardId || card.id || null,
            cardInstanceId: card.id || null,
            cardLabel: getAiCardDisplayLabel({ card, cardId: card.cardId || card.id || null })
              || card.cardName
              || card.label
              || null,
            price: getCardPrice(card),
            typeCode: getCardTypeCode(card),
          };
        }

        function createAiAutoBattleEntry(type, message, details = {}) {
          const currentPlayer = getAiAutoBattleEntryPlayer(details);
          const { turnState, playerState } = getRuleReadout();
          const rawTurnNumber = turnState.turnNumber;
          return {
            id: aiAutoBattleState.logs.length + aiAutoBattleState.bugs.length + 1,
            type,
            roundNumber: turnState.roundNumber,
            turnNumber: getAiDisplayedTurnNumber(rawTurnNumber),
            rawTurnNumber,
            playerId: currentPlayer?.id || playerState.currentPlayerId || null,
            playerLabel: currentPlayer?.colorLabel || currentPlayer?.name || null,
            playerResources: currentPlayer
              ? {
                score: Math.max(0, Math.round(aiNumber(currentPlayer.resources?.score))),
                credits: Math.max(0, Math.round(aiNumber(currentPlayer.resources?.credits))),
                energy: Math.max(0, Math.round(aiNumber(currentPlayer.resources?.energy))),
                publicity: Math.max(0, Math.round(aiNumber(currentPlayer.resources?.publicity))),
                availableData: Math.max(0, Math.round(aiNumber(currentPlayer.resources?.availableData))),
                handSize: Array.isArray(currentPlayer.hand)
                  ? currentPlayer.hand.length
                  : Math.max(0, Math.round(aiNumber(currentPlayer.resources?.handSize))),
              }
              : null,
            scoreboard: getAiAutoBattleScoreSnapshot(),
            message: String(message || ""),
            details: compactAiAutoBattleLogDetails(type, details),
            createdAt: new Date().toISOString(),
          };
        }

        function recordAiAutoBattleLog(type, message, details = {}) {
          const entry = createAiAutoBattleEntry(type, message, details);
          aiAutoBattleState.logs.push(entry);
          return entry;
        }

        function recordAiAutoBattleBug(message, details = {}) {
          const key = String(message || "unknown");
          aiAutoBattleState.bugCounts[key] = (aiAutoBattleState.bugCounts[key] || 0) + 1;
          const entry = createAiAutoBattleEntry("bug", key, {
            ...details,
            repeatCount: aiAutoBattleState.bugCounts[key],
          });
          aiAutoBattleState.bugs.push(entry);
          return entry;
        }

      return { getAiAutoBattleScoreSnapshot, getAiAutoBattleEntryPlayer, compactAiAutoBattleLogValue, compactAiAutoBattleLogDetails, summarizeAiAutoBattleLogCard, createAiAutoBattleEntry, recordAiAutoBattleLog, recordAiAutoBattleBug };
    }
  }

  return { createAiBattleLog };
});
