(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SetiAppAiReportFormatters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createAiReportFormatters(context) {
    if (!context) {
      throw new Error("createAiReportFormatters requires explicit report context");
    }
    with (context) {
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
              details: (entry.type === "alien-trace" || entry.type === "scan-target")
                ? entry.details
                : undefined,
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

      return {
        getAiCandidateRankScore,
        getAiCardDisplayLabel,
        summarizeAiTurnActionCandidate,
        buildAiLowMarkPlayerDiagnostics,
        summarizeAiFinalScoreMarkCandidate,
      };
    }
  }

  return { createAiReportFormatters };
});
