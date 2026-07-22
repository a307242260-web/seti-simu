(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIIncomeCard = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createIncomeCard(context = {}) {
    const {
      state,
      solar,
      players,
      rocketActions,
      planetRewards,
      endGameScoring,
      industry,
      quickTrades,
      cards,
      cardEffects,
      runezu,
      ai,
      solarState,
      cardState,
      FINAL_ROUND_NUMBER,
      AI_RESOURCE_VALUES,
    } = context;
    const addAiIncomeGain = (...args) => context.addAiIncomeGain(...args);
    const aiNumber = (...args) => context.aiNumber(...args);
    const buildAiPlayCardCandidate = (...args) => context.buildAiPlayCardCandidate(...args);
    const canAiPlanetAcceptLanding = (...args) => context.canAiPlanetAcceptLanding(...args);
    const confirmPassReserveSelection = (...args) => context.confirmPassReserveSelection(...args);
    const countAiFinalMarksForPlayer = (...args) => context.countAiFinalMarksForPlayer(...args);
    const createActionContext = (...args) => context.createActionContext(...args);
    const createAiPlayerAfterQuickTrade = (...args) => context.createAiPlayerAfterQuickTrade(...args);
    const getAiCardDisplayLabel = (...args) => context.getAiCardDisplayLabel(...args);
    const getAiDiscardedCardOpportunityCost = (...args) => context.getAiDiscardedCardOpportunityCost(...args);
    const getAiIncomeFinalFormulaEntries = (...args) => context.getAiIncomeFinalFormulaEntries(...args);
    const getAiIncomeFormulaBase = (...args) => context.getAiIncomeFormulaBase(...args);
    const getAiIncomeIncreaseSnapshot = (...args) => context.getAiIncomeIncreaseSnapshot(...args);
    const getAiLiveScorePaceDeficit = (...args) => context.getAiLiveScorePaceDeficit(...args);
    const getAiLowEngineCatchupProfile = (...args) => context.getAiLowEngineCatchupProfile(...args);
    const getAiMarkedFinalFormulaEntries = (...args) => context.getAiMarkedFinalFormulaEntries(...args);
    const getAiNextMissingFinalScoreThreshold = (...args) => context.getAiNextMissingFinalScoreThreshold(...args);
    const getAiPlanetAtCoordinate = (...args) => context.getAiPlanetAtCoordinate(...args);
    const getAiPlanningFinalFormulaEntries = (...args) => context.getAiPlanningFinalFormulaEntries(...args);
    const getAiPlayEffectsForCard = (...args) => context.getAiPlayEffectsForCard(...args);
    const getAiProjectedFinalScore = (...args) => context.getAiProjectedFinalScore(...args);
    const getAiRewardDirectScore = (...args) => context.getAiRewardDirectScore(...args);
    const getAiRoundNumber = (...args) => context.getAiRoundNumber(...args);
    const getAiSectorDistance = (...args) => context.getAiSectorDistance(...args);
    const getCardPlayCost = (...args) => context.getCardPlayCost(...args);
    const getCardPrice = (...args) => context.getCardPrice(...args);
    const getCardTypeCode = (...args) => context.getCardTypeCode(...args);
    const getCurrentPlayer = (...args) => context.getCurrentPlayer(...args);
    const getMovableTokensForPlayer = (...args) => context.getMovableTokensForPlayer(...args);
    const getPassReserveSelectionCards = (...args) => context.getPassReserveSelectionCards(...args);
    const getPlayerById = (...args) => context.getPlayerById(...args);
    const isAiAlienMainPlayCard = (...args) => context.isAiAlienMainPlayCard(...args);
    const isAiAutoBattlePlayer = (...args) => context.isAiAutoBattlePlayer(...args);
    const rankIncomeOptions = (...args) => context.rankIncomeOptions(...args);
    const recordAiAutoBattleLog = (...args) => context.recordAiAutoBattleLog(...args);
    const roundAiScore = (...args) => context.roundAiScore(...args);
    const scoreAiCardCornerOpportunity = (...args) => context.scoreAiCardCornerOpportunity(...args);
    const scoreAiCardEndGameExpectedValue = (...args) => context.scoreAiCardEndGameExpectedValue(...args);
    const scoreAiFinalFormulaDeltaValue = (...args) => context.scoreAiFinalFormulaDeltaValue(...args);
    const scoreAiIncomeOpportunityValue = (...args) => context.scoreAiIncomeOpportunityValue(...args);
    const scoreAiIndustryCornerReward = (...args) => context.scoreAiIndustryCornerReward(...args);
    const scoreAiMidgameResourceContinuationValue = (...args) => context.scoreAiMidgameResourceContinuationValue(...args);
    const scoreAiPaceValueForDirectScore = (...args) => context.scoreAiPaceValueForDirectScore(...args);
    const scoreAiPlayCardValue = (...args) => context.scoreAiPlayCardValue(...args);
    const scoreAiPublicityResearchTechSetupValue = (...args) => context.scoreAiPublicityResearchTechSetupValue(...args);
    const scoreAiResourceBundle = (...args) => context.scoreAiResourceBundle(...args);
    const selectPassReserveCard = (...args) => context.selectPassReserveCard(...args);

    function getAiIncomeDiscardPreview(
      player,
      count,
      pendingType,
      incomeGainByIndex = [],
      incomeFormulaEntries = null,
      selectedIndexes = [],
    ) {
      if (pendingType !== "place_data_income" || !player?.hand?.length) return null;
      const target = Math.max(0, Math.round(aiNumber(count)));
      const handSize = Math.max(0, Math.round(aiNumber(player.resources?.handSize ?? player.hand.length)));
      const handScarcityCost = getAiIncomeDiscardHandScarcityCost(player);
      const selectedSet = new Set((selectedIndexes || []).map((index) => Number(index)));
      const options = (player.hand || [])
        .map((card, index) => {
          const gain = incomeGainByIndex[index] || null;
          if (!gain) return null;
          const incomeScore = scoreAiIncomeOpportunityValue(player, gain);
          const finalFormulaFit = scoreAiIncomeDiscardFinalFormulaFit(player, gain, incomeFormulaEntries);
          const routeEnergyFit = scoreAiIncomeDiscardRouteEnergyFit(player, gain);
          const playValue = Math.max(0, scoreAiPlayCardValue(card, { player }));
          const discardOpportunityCost = scoreAiIncomeDiscardSelectionOpportunityCost(player, card, { playValue });
          const value = incomeScore + finalFormulaFit + routeEnergyFit;
          return {
            index,
            selected: selectedSet.has(index),
            cardId: card.cardId || card.id || null,
            cardLabel: getAiCardDisplayLabel({ card, cardId: card.cardId || card.id || null }, player),
            incomeGain: gain,
            incomeScore: roundAiScore(incomeScore),
            finalFormulaFit: roundAiScore(finalFormulaFit),
            routeEnergyFit: roundAiScore(routeEnergyFit),
            playValue: roundAiScore(playValue),
            discardOpportunityCost: roundAiScore(discardOpportunityCost),
            handScarcityCost: roundAiScore(handScarcityCost),
            netAfterDiscard: roundAiScore(value - discardOpportunityCost - handScarcityCost),
          };
        })
        .filter(Boolean)
        .sort((left, right) => (
          Number(right.selected) - Number(left.selected)
          || right.netAfterDiscard - left.netAfterDiscard
          || right.incomeScore - left.incomeScore
          || left.index - right.index
        ));
      return {
        pendingType,
        count: target,
        handSize,
        resources: {
          score: aiNumber(player.resources?.score),
          credits: aiNumber(player.resources?.credits),
          energy: aiNumber(player.resources?.energy),
          publicity: aiNumber(player.resources?.publicity),
          availableData: aiNumber(player.resources?.availableData),
        },
        options,
      };
    }

    function getAiIncomeDiscardHandScarcityCost(player = getCurrentPlayer()) {
      const handSize = Math.max(0, Math.round(aiNumber(player?.resources?.handSize ?? player?.hand?.length)));
      if (handSize <= 1) return 10;
      if (handSize === 2) return 6;
      if (handSize === 3) return 2.5;
      return 0;
    }

    function scoreAiIncomeDiscardOptionNet(player, card, index, incomeGain, incomeFormulaEntries = null) {
      if (!player || !card || !incomeGain) return null;
      const incomeScore = scoreAiIncomeOpportunityValue(player, incomeGain);
      const finalFormulaFit = scoreAiIncomeDiscardFinalFormulaFit(player, incomeGain, incomeFormulaEntries);
      const routeEnergyFit = scoreAiIncomeDiscardRouteEnergyFit(player, incomeGain);
      const discardOpportunityCost = scoreAiIncomeDiscardSelectionOpportunityCost(player, card);
      const handScarcityCost = getAiIncomeDiscardHandScarcityCost(player);
      return {
        incomeScore,
        finalFormulaFit,
        routeEnergyFit,
        discardOpportunityCost,
        handScarcityCost,
        net: incomeScore + finalFormulaFit + routeEnergyFit - discardOpportunityCost - handScarcityCost,
      };
    }

    function scoreAiIncomeDiscardSelectionOpportunityCost(player, card, options = {}) {
      if (!player || !card) return 0;
      const playValue = options.playValue == null
        ? Math.max(0, scoreAiPlayCardValue(card, { player }))
        : Math.max(0, aiNumber(options.playValue));
      return Math.min(8, playValue * 0.12);
    }

    function scoreAiIncomePlacementRewardValue(player = getCurrentPlayer()) {
      const hand = player?.hand || [];
      if (!player || !hand.length) return -8;
      const incomeFormulaEntries = getAiIncomeFinalFormulaEntries(player);
      const best = hand.reduce((result, card, index) => {
        const incomeGain = cards.getIncomeGainForCard?.(card);
        const score = scoreAiIncomeDiscardOptionNet(player, card, index, incomeGain, incomeFormulaEntries);
        if (!score) return result;
        return !result || score.net > result.net ? score : result;
      }, null);
      if (!best) return 0;
      return roundAiScore(Math.max(-18, best.net));
    }

    function chooseAiTradeDiscardIndexes(workingRoot, player, count, pending = {}) {
      const target = Math.max(0, Math.round(aiNumber(count)));
      const hand = player?.hand || [];
      if (!player || !target || !hand.length) return null;
      const trade = quickTrades?.getTradeAction?.(pending.tradeId);
      const simulatedPlayer = trade ? createAiPlayerAfterQuickTrade(player, trade) : null;
      const postTradeCandidates = new Map(
        (simulatedPlayer ? hand : [])
          .map((card, index) => buildAiPlayCardCandidate(workingRoot, card, index, simulatedPlayer))
          .filter(Boolean)
          .map((candidate) => [candidate.handIndex, candidate]),
      );
      const bestPostTradePlay = [...postTradeCandidates.values()]
        .sort((left, right) => aiNumber(right.score) - aiNumber(left.score))[0] || null;
      const preserveIndexes = new Set();
      const explicitPreserveHandIndex = pending.preserveHandIndex === null
        || pending.preserveHandIndex === undefined
        || pending.preserveHandIndex === ""
        ? null
        : Number(pending.preserveHandIndex);
      if (
        Number.isInteger(explicitPreserveHandIndex)
        && explicitPreserveHandIndex >= 0
        && explicitPreserveHandIndex < hand.length
        && hand.length > target
      ) {
        preserveIndexes.add(explicitPreserveHandIndex);
      }
      if (
        bestPostTradePlay
        && aiNumber(bestPostTradePlay.score) >= 8
        && hand.length > target
      ) {
        preserveIndexes.add(bestPostTradePlay.handIndex);
      }
      const preserveCapacity = Math.max(0, hand.length - target);
      const ranked = hand
        .map((card, index) => {
          const postTradePlay = postTradeCandidates.get(index) || null;
          const currentPlay = buildAiPlayCardCandidate(workingRoot, card, index, player);
          const playCandidate = postTradePlay || currentPlay;
          const finalDeltaValue = Math.max(
            0,
            scoreAiFinalFormulaDeltaValue(playCandidate?.finalFormulaDeltas || {}, player, {
              includePotential: true,
              potentialScale: 0.45,
            }),
          );
          const preserveScore = getAiDiscardedCardOpportunityCost(card, playCandidate)
            + Math.max(0, aiNumber(postTradePlay?.score)) * 0.6
            + Math.max(0, aiNumber(postTradePlay?.directScoreGain)) * 1.1
            + finalDeltaValue * 0.55
            + Math.max(0, aiNumber(postTradePlay?.valueBreakdown?.c2Type3ProgressValue)) * 0.45
            + Math.max(0, aiNumber(postTradePlay?.valueBreakdown?.cFinalTaskProgressValue)) * 0.45;
          return {
            index,
            preserveScore,
            label: cards.getCardLabel?.(card) || String(card?.label || card?.cardName || card?.id || index),
            preserve: preserveIndexes.has(index),
          };
        })
        .sort((left, right) => (
          left.preserveScore - right.preserveScore
          || left.label.localeCompare(right.label, "zh-Hans-CN")
        ));
      const selected = [];
      for (const entry of ranked) {
        if (selected.length >= target) break;
        if (
          entry.preserve
          && preserveIndexes.size <= preserveCapacity
          && ranked.length - selected.length > target - selected.length
        ) {
          continue;
        }
        selected.push(entry.index);
      }
      if (selected.length < target) {
        for (const entry of ranked) {
          if (selected.length >= target) break;
          if (!selected.includes(entry.index)) selected.push(entry.index);
        }
      }
      return selected.slice(0, target);
    }

    function shouldAiUseRouteAwareIncomeDiscard(player, incomeGainByIndex = []) {
      if (!player || !Array.isArray(incomeGainByIndex)) return false;
      const resources = player.resources || {};
      if (getAiRoundNumber() < 3) return false;
      if (Math.max(0, aiNumber(resources.score)) >= 25) return false;
      const hasEnergyIncome = incomeGainByIndex.some((gain) => aiNumber(gain?.energy) > 0);
      if (!hasEnergyIncome || aiNumber(resources.energy) > 0) return false;
      const ownsSatelliteTech = players.playerOwnsTech(player, "orange4", createActionContext());
      const hasNearPlanetRocket = getMovableTokensForPlayer(player.id)
        .some((rocket) => {
          const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
          if (!coordinate) return false;
          const planet = getAiPlanetAtCoordinate(coordinate);
          if (planet && canAiPlanetAcceptLanding(planet.planetId, player)) return true;
          return solar.createSolarSnapshot(solarState).planetLocations
            .some((target) => target?.planetId !== "earth" && getAiSectorDistance(coordinate, target) <= 1);
        });
      return ownsSatelliteTech || hasNearPlanetRocket || getAiLiveScorePaceDeficit(player) > 25;
    }

    function chooseAiIncomeDiscardIndexes(workingRoot, player, count, incomeGainByIndex = [], incomeFormulaEntries = null) {
      const target = Math.max(0, Math.round(aiNumber(count)));
      const hand = player?.hand || [];
      if (!target || !hand.length) return null;
      const selected = [];
      const selectedSet = new Set();
      const simulatedPlayer = {
        ...player,
        resources: { ...(player.resources || {}) },
        income: { ...(player.income || {}) },
        hand: hand.slice(),
      };
      const rankIncomeOptions = () => hand
        .map((card, index) => {
          if (selectedSet.has(index)) return null;
          const gain = incomeGainByIndex[index] || null;
          if (!gain) return null;
          const incomeScore = scoreAiIncomeOpportunityValue(simulatedPlayer, gain);
          const finalFormulaFit = scoreAiIncomeDiscardFinalFormulaFit(simulatedPlayer, gain, incomeFormulaEntries);
          const routeEnergyFit = scoreAiIncomeDiscardRouteEnergyFit(simulatedPlayer, gain);
          const sequenceFit = target > 1
            ? scoreAiMultiIncomeSequenceFit(simulatedPlayer, gain, target - selected.length)
            : 0;
          const playValue = Math.max(0, scoreAiPlayCardValue(workingRoot, card, { player: simulatedPlayer }));
          const discardOpportunityCost = scoreAiIncomeDiscardSelectionOpportunityCost(simulatedPlayer, card, { playValue });
          return {
            index,
            incomeScore,
            finalFormulaFit,
            routeEnergyFit,
            sequenceFit,
            playValue,
            score: incomeScore + finalFormulaFit + routeEnergyFit + sequenceFit - discardOpportunityCost,
          };
        })
        .filter((entry) => entry && Number.isFinite(entry.score))
        .sort((left, right) => (
          right.score - left.score
          || right.routeEnergyFit - left.routeEnergyFit
          || right.finalFormulaFit - left.finalFormulaFit
          || right.sequenceFit - left.sequenceFit
          || right.incomeScore - left.incomeScore
          || left.playValue - right.playValue
          || left.index - right.index
        ));
      while (selected.length < target) {
        const ranked = rankIncomeOptions();
        const best = ranked[0] || null;
        if (!best) return null;
        selected.push(best.index);
        selectedSet.add(best.index);
        simulatedPlayer.income = addAiIncomeGain(simulatedPlayer.income, incomeGainByIndex[best.index] || {});
        simulatedPlayer.hand = hand.filter((_card, index) => !selectedSet.has(index));
        simulatedPlayer.resources = {
          ...(simulatedPlayer.resources || {}),
          handSize: simulatedPlayer.hand.length,
        };
      }
      return selected;
    }

    function scoreAiMultiIncomeSequenceFit(player = getCurrentPlayer(), incomeGain = {}, remainingSelections = 1) {
      if (!player || !incomeGain || typeof incomeGain !== "object" || remainingSelections <= 1) return 0;
      const income = player.income || {};
      const keys = ["credits", "energy", "handSize"];
      const gainedKeys = keys.filter((key) => aiNumber(incomeGain[key]) > 0);
      if (!gainedKeys.length) return 0;
      const round = getAiRoundNumber();
      const minIncome = Math.min(...keys.map((key) => aiNumber(income[key])));
      const liftedLowest = gainedKeys.filter((key) => aiNumber(income[key]) <= minIncome);
      let value = liftedLowest.length
        ? (round <= 2 ? 5.4 : round === 3 ? 2.8 : 1.2) * Math.min(1, liftedLowest.length)
        : 0;
      const afterIncome = addAiIncomeGain(income, incomeGain);
      for (const key of gainedKeys) {
        const otherMax = Math.max(...keys.filter((item) => item !== key).map((item) => aiNumber(afterIncome[item])));
        const surplus = Math.max(0, aiNumber(afterIncome[key]) - otherMax - 1);
        if (surplus > 0) value -= surplus * (round <= 2 ? 3.4 : 1.4);
      }
      return value;
    }

    function scoreAiIncomeDiscardRouteEnergyFit(player = getCurrentPlayer(), incomeGain = {}) {
      if (!player || aiNumber(incomeGain?.energy) <= 0) return 0;
      const energy = Math.max(0, aiNumber(player.resources?.energy));
      if (energy > 1) return 0;
      let value = energy <= 0 ? 9 : 5;
      if (players.playerOwnsTech(player, "orange4", createActionContext())) value += 3;
      if (getAiLiveScorePaceDeficit(player) > 25) value += 2;
      return value;
    }

    function scoreAiIncomeDiscardFinalFormulaFit(player = getCurrentPlayer(), incomeGain = {}, entries = null) {
      if (!player || !incomeGain || typeof incomeGain !== "object") return 0;
      const formulaEntries = entries || getAiIncomeFinalFormulaEntries(player);
      if (!formulaEntries.length) return 0;
      const income = player.income || {};
      return formulaEntries.reduce((total, entry) => {
        if (entry.formulaId === "a2") {
          const currentBase = getAiIncomeFormulaBase("a2", income, player);
          const formulaIncome = getAiIncomeIncreaseSnapshot(player, income);
          const bottlenecks = ["credits", "energy", "handSize"]
            .filter((key) => aiNumber(formulaIncome[key]) <= currentBase);
          const lifted = bottlenecks.filter((key) => aiNumber(incomeGain[key]) > 0);
          if (lifted.length) {
            return total + (entry.potential ? 8 : 14) * Math.min(1, lifted.length / Math.max(1, bottlenecks.length));
          }
          return total - (entry.potential ? 1.5 : 4);
        }
        if (entry.formulaId === "a1") {
          const beforeBase = getAiIncomeFormulaBase("a1", income, player);
          const afterBase = getAiIncomeFormulaBase("a1", addAiIncomeGain(income, incomeGain), player);
          return total + Math.max(0, afterBase - beforeBase) * (entry.potential ? 2 : 4);
        }
        return total;
      }, 0);
    }

    function getAiPassReserveResourcePressure(player = getCurrentPlayer(), pile = [], currentHandSizeOverride = null, options = {}) {
      if (!player || !(pile || []).length) return { active: false, reasons: [], score: 0 };
      const round = getAiRoundNumber();
      if (round !== 2 && !options.ignoreRound) return { active: false, reasons: [], score: 0 };
      const resources = player.resources || {};
      const income = player.income || {};
      const currentHandSize = currentHandSizeOverride == null
        ? Math.max(0, aiNumber(resources.handSize ?? (player.hand || []).length))
        : Math.max(0, aiNumber(currentHandSizeOverride));
      const credits = Math.max(0, aiNumber(resources.credits));
      const energy = Math.max(0, aiNumber(resources.energy));
      const reasons = [];
      if (credits <= 0 && aiNumber(income.credits) <= 4) reasons.push("credits");
      if (energy <= 0 && aiNumber(income.energy) <= 3) reasons.push("energy");
      if (currentHandSize <= 1 && aiNumber(income.handSize) <= 3) reasons.push("hand");
      if (!reasons.length) return { active: false, reasons: [], score: 0 };
      const matchingIncomeCandidates = (pile || []).map((card) => {
        if (!card) return false;
        const gain = cards.getIncomeGainForCard?.(card);
        if (!gain) return null;
        const matches = (reasons.includes("credits") && aiNumber(gain.credits) > 0)
          || (reasons.includes("energy") && aiNumber(gain.energy) > 0)
          || (reasons.includes("hand") && aiNumber(gain.handSize) > 0);
        if (!matches) return null;
        return {
          cardId: card.cardId || card.id || null,
          cardLabel: cards.getCardLabel?.(card) || card.cardName || card.label || null,
          typeCode: getCardTypeCode(card),
          price: aiNumber(getCardPrice(card)),
          incomeGain: gain,
        };
      });
      const incomeCandidates = matchingIncomeCandidates.filter(Boolean);
      if (!incomeCandidates.length) return { active: false, reasons: [], score: 0 };
      return {
        active: true,
        reasons,
        incomeCandidates: incomeCandidates.slice(0, 6),
        score: roundAiScore(
          reasons.length
            + Math.max(0, 2 - credits) * 0.25
            + Math.max(0, 2 - energy) * 0.25
            + Math.max(0, 2 - currentHandSize) * 0.2,
        ),
      };
    }

    function isAiPassReservePreviewIncomeCandidate(card, preview = null) {
      if (!card || !preview?.active || !Array.isArray(preview.incomeCandidates)) return false;
      const selectedIds = [card.cardId, card.id].filter(Boolean).map(String);
      if (!selectedIds.length) return false;
      return preview.incomeCandidates.some((entry) => selectedIds.includes(String(entry?.cardId || "")));
    }


    function countAiType3CardsForPlayer(player = getCurrentPlayer()) {
      if (endGameScoring?.countType3Cards) {
        return Math.max(0, Math.round(aiNumber(endGameScoring.countType3Cards(player, getCardTypeCode))));
      }
      return (player?.reservedCards || []).reduce((total, card) => total + (getCardTypeCode(card) === 3 ? 1 : 0), 0);
    }

    function hasAiRunezuPassReservePressure(player = getCurrentPlayer(), pile = []) {
      if (!runezu?.isRunezuCard) return false;
      const cardsToCheck = [
        ...(player?.hand || []),
        ...(player?.reservedCards || []),
        ...(pile || []),
      ];
      return cardsToCheck.some((card) => (
        runezu.isRunezuCard(card)
        && (
          runezu.isTaskUnfinished?.(card)
          || Boolean(runezu.getFinalCardRule?.(card))
          || !card?.runezuTaskCompleted
        )
      ));
    }

    function scoreAiC2Type3ProgressValue(player = getCurrentPlayer()) {
      if (!player) return 0;
      const c2Entries = getAiPlanningFinalFormulaEntries(player, ["c2"]);
      if (!c2Entries.length) return 0;
      const currentTotal = Math.max(0, Math.round(aiNumber(player.completedTaskCount)))
        + countAiType3CardsForPlayer(player);
      const beforeBase = Math.floor(currentTotal / 2);
      const afterBase = Math.floor((currentTotal + 1) / 2);
      return c2Entries.reduce((total, entry) => {
        const multiplier = Math.max(1, aiNumber(entry.multiplier));
        const immediate = Math.max(0, afterBase - beforeBase) * multiplier;
        return total + (immediate > 0 ? immediate * 0.9 : multiplier * 0.22);
      }, 0);
    }

    function scoreAiCFinalTaskProgressValue(player = getCurrentPlayer(), taskIncrement = 1) {
      if (!player) return 0;
      const increment = Math.max(1, Math.round(aiNumber(taskIncrement) || 1));
      const entries = getAiPlanningFinalFormulaEntries(player, ["c1", "c2"]);
      if (!entries.length) return 0;
      const currentTasks = Math.max(0, Math.round(aiNumber(player.completedTaskCount)));
      const currentType3 = countAiType3CardsForPlayer(player);
      const finalCashoutFocus = getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && countAiFinalMarksForPlayer(player) >= 3;
      const c1ImmediateScale = finalCashoutFocus ? 0.94 : 0.72;
      const c2ImmediateScale = finalCashoutFocus ? 0.94 : 0.82;
      return entries.reduce((total, entry) => {
        const multiplier = Math.max(1, aiNumber(entry.multiplier));
        if (entry.formulaId === "c1") {
          const immediate = increment * multiplier;
          return total + (entry.potential ? immediate * 0.38 : immediate * c1ImmediateScale);
        }
        if (entry.formulaId === "c2") {
          const beforeBase = Math.floor((currentTasks + currentType3) / 2);
          const afterBase = Math.floor((currentTasks + currentType3 + increment) / 2);
          const immediate = Math.max(0, afterBase - beforeBase) * multiplier;
          return total + (immediate > 0 ? immediate * c2ImmediateScale : multiplier * 0.18);
        }
        return total;
      }, 0);
    }

    function getAiC2Type3BaseDelta(player = getCurrentPlayer()) {
      if (!player) return 0;
      const currentTotal = Math.max(0, Math.round(aiNumber(player.completedTaskCount)))
        + countAiType3CardsForPlayer(player);
      return Math.max(0, Math.floor((currentTotal + 1) / 2) - Math.floor(currentTotal / 2));
    }

    function getAiPlayCardFinalFormulaDeltas(card, details = {}) {
      const player = details.player || getCurrentPlayer();
      if (!card || !player) return {};
      const model = details.model || cardEffects.getCardModel?.(card) || null;
      const typeCode = details.typeCode ?? getCardTypeCode(card);
      const reservesAfterPlay = details.reservesAfterPlay ?? (
        [1, 2, 3].includes(typeCode) || Boolean(model?.reserveAfterPlay)
      );
      const deltas = {};
      const taskCount = Math.max(0, (model?.tasks || []).length);
      if (taskCount > 0) {
        const setupDelta = Math.min(0.6, 0.25 + taskCount * 0.12);
        deltas.c1 = Math.max(aiNumber(deltas.c1), setupDelta);
        deltas.c2 = Math.max(aiNumber(deltas.c2), Math.min(0.45, 0.18 + taskCount * 0.08));
      }
      if (typeCode === 3 && reservesAfterPlay) {
        deltas.c2 = Math.max(aiNumber(deltas.c2), getAiC2Type3BaseDelta(player) || 0.25);
      }
      return Object.fromEntries(
        Object.entries(deltas)
          .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
          .map(([key, value]) => [key, roundAiScore(value)]),
      );
    }

    function scoreAiFinalRoundEndGameCardUrgency(typeCode, model, player, endGameExpectedScore = 0, c2Type3ProgressValue = 0) {
      if (getAiRoundNumber() < FINAL_ROUND_NUMBER || !player) return 0;
      if (typeCode !== 3 && !model?.endGameScoring) return 0;
      const hasC2 = getAiPlanningFinalFormulaEntries(player, ["c2"]).length > 0;
      return Math.min(
        11,
        Math.max(0, aiNumber(endGameExpectedScore)) * 0.35
          + Math.max(0, aiNumber(c2Type3ProgressValue)) * 0.45
          + (hasC2 && typeCode === 3 ? 2 : 0),
      );
    }

    function scoreAiPassReserveCard(workingRoot, card, player = getCurrentPlayer()) {
      if (!card) return -Infinity;
      const model = cardEffects.getCardModel?.(card) || null;
      const playEffects = getAiPlayEffectsForCard(card);
      const typeCode = getCardTypeCode(card);
      const endGameExpectedScore = scoreAiCardEndGameExpectedValue(card, model, player);
      const cTaskProgressValue = model?.tasks?.length
        ? scoreAiCFinalTaskProgressValue(player, model.tasks.length)
        : 0;
      let value = 0;
      const directScoreGain = getAiRewardDirectScore(playEffects, player, { workingRoot });
      if (directScoreGain > 0) {
        value += Math.min(10, directScoreGain * 0.8)
          + scoreAiPaceValueForDirectScore(directScoreGain, player, {
            baseWeight: 0.18,
            pressureWeight: 0.08,
          });
      }
      for (const effect of playEffects || []) {
        const type = effect?.type;
        if (type === "research_tech_select" || type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) value += 4;
        if (type === cardEffects.EFFECT_TYPES.PUBLIC_SCAN || type === cardEffects.EFFECT_TYPES.HAND_SCAN) value += 2.5;
        if (type === planetRewards.EFFECT_TYPES?.DRAW_CARDS || type === "draw_cards") {
          value += Math.max(1, aiNumber(effect?.options?.count) || 1) * 1.6;
        }
      }
      if (typeCode === 3) value += 4 + scoreAiC2Type3ProgressValue(player);
      if (model?.endGameScoring || endGameExpectedScore > 0) value += 2.5 + Math.min(8, endGameExpectedScore * 0.5);
      if (model?.tasks?.length) value += 1.5 + model.tasks.length * 1.2 + Math.min(8, cTaskProgressValue * 0.65);
      const incomeGain = cards.getIncomeGainForCard?.(card);
      if (incomeGain) value += scoreAiIncomeOpportunityValue(player, incomeGain) * 0.18;
      return value + Math.max(0, 4 - aiNumber(getCardPrice(card))) * 0.25;
    }

    function scoreAiFinalRoundUnreachablePublicPickPenalty(card, player = getCurrentPlayer(), details = {}) {
      if (!card || !player || getAiRoundNumber() < FINAL_ROUND_NUMBER) return 0;
      if (details.pendingType === "trade" || countAiFinalMarksForPlayer(player) < 3) return 0;
      if (details.playCandidate) return 0;
      const model = details.model || cardEffects.getCardModel?.(card) || null;
      const typeCode = details.typeCode ?? getCardTypeCode(card);
      const hasPersistentValue = Boolean(
        model?.tasks?.length
        || model?.triggers?.length
        || model?.endGameScoring
        || model?.pluto
        || typeCode === 3
        || isAiAlienMainPlayCard(card)
      );
      if (hasPersistentValue) return 0;
      const cost = getCardPlayCost(card);
      if (players.canAfford(player, cost)) return 0;
      const resources = player.resources || {};
      const creditShortfall = Math.max(0, aiNumber(cost.credits) - aiNumber(resources.credits));
      const energyShortfall = Math.max(0, aiNumber(cost.energy) - aiNumber(resources.energy));
      const publicityShortfall = Math.max(0, aiNumber(cost.publicity) - aiNumber(resources.publicity));
      const dataShortfall = Math.max(0, aiNumber(cost.availableData) - aiNumber(resources.availableData));
      const weightedShortfall =
        creditShortfall * AI_RESOURCE_VALUES.credits
        + energyShortfall * AI_RESOURCE_VALUES.energy
        + publicityShortfall * AI_RESOURCE_VALUES.publicity
        + dataShortfall * AI_RESOURCE_VALUES.availableData;
      if (weightedShortfall <= 0) return 0;
      const severeShortfall = creditShortfall >= 2 || energyShortfall >= 2 || weightedShortfall >= 6;
      if (!severeShortfall) return 0;
      const projectedScore = getAiProjectedFinalScore(player);
      const highScoreWastePenalty = projectedScore >= 260 ? 8 : 4;
      return Math.min(30, 9 + weightedShortfall * 1.35 + highScoreWastePenalty);
    }

    function getAiImmediateIncomeRewardGain(player = getCurrentPlayer(), incomeGain = {}) {
      const gain = incomeGain && typeof incomeGain === "object" ? incomeGain : {};
      const resources = player?.resources || {};
      const limits = players.RESOURCE_LIMITS || {};
      const immediateGain = {
        credits: Math.max(0, aiNumber(gain.credits)),
        energy: Math.max(0, aiNumber(gain.energy)),
        handSize: Math.max(0, aiNumber(gain.handSize)),
        additionalPublicScan: Math.max(0, aiNumber(gain.additionalPublicScan)),
      };
      for (const key of ["publicity", "availableData"]) {
        immediateGain[key] = Math.max(0, Math.min(
          Math.max(0, aiNumber(gain[key])),
          Math.max(0, aiNumber(limits[key]) - aiNumber(resources[key])),
        ));
      }
      return immediateGain;
    }

    function scoreAiImmediateIncomeRewardValue(player = getCurrentPlayer(), incomeGain = {}) {
      const immediateGain = getAiImmediateIncomeRewardGain(player, incomeGain);
      return scoreAiResourceBundle(immediateGain)
        + scoreAiMidgameResourceContinuationValue(immediateGain, player, { scale: 0.7 })
        + scoreAiPublicityResearchTechSetupValue(immediateGain, player, { scale: 0.7 });
    }

    function scoreAiPublicPickCard(card, player = getCurrentPlayer(), pendingType = null, workingRoot = null) {
      if (!card) return -Infinity;
      const incomeGain = cards.getIncomeGainForCard?.(card) || null;
      if (pendingType === "industry_mission_pick") {
        return incomeGain ? scoreAiImmediateIncomeRewardValue(player, incomeGain) : -Infinity;
      }
      const incomeValue = incomeGain ? scoreAiIncomeOpportunityValue(player, incomeGain) : 0;
      const cornerValue = scoreAiCardCornerOpportunity(card);
      if (pendingType === "industry_fenwick_pick") {
        const reward = industry?.getCornerReward?.(cards, card) || null;
        const rewardValue = scoreAiIndustryCornerReward(card, reward, {
          workingRoot,
          moveId: "industryFenwickMove",
        });
        return Number.isFinite(Number(rewardValue)) ? rewardValue + incomeValue * 0.15 : -Infinity;
      }
      const model = cardEffects.getCardModel?.(card) || null;
      const playEffects = getAiPlayEffectsForCard(card);
      const typeCode = getCardTypeCode(card);
      const playableValue = Math.max(0, scoreAiPlayCardValue(workingRoot, card, {
        player,
        model,
        playEffects,
        typeCode,
      }));
      const currentScore = Math.max(0, aiNumber(player?.resources?.score));
      const nextThreshold = getAiNextMissingFinalScoreThreshold(player);
      const finalRoundDeferredPick = pendingType !== "trade"
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && countAiFinalMarksForPlayer(player) >= 3;
      const deferredPlayCandidate = finalRoundDeferredPick
        ? buildAiPlayCardCandidate(workingRoot, card, -1, player)
        : null;
      const closeThirdFinalMarkPick = pendingType === "trade"
        && nextThreshold === 70
        && countAiFinalMarksForPlayer(player) === 2
        && currentScore >= 64;
      const finalRoundTradePick = pendingType === "trade"
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && !closeThirdFinalMarkPick;
      const finalRoundGrandStrategyRecoveryPick = pendingType === "industry_strategy_pick"
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && nextThreshold
        && currentScore < nextThreshold
        && countAiFinalMarksForPlayer(player) < 3;
      if (finalRoundGrandStrategyRecoveryPick) {
        const playCandidate = buildAiPlayCardCandidate(workingRoot, card, -1, player);
        const immediatePlayValue = Math.max(0, aiNumber(playCandidate?.score));
        const directScoreGain = Math.max(0, aiNumber(playCandidate?.directScoreGain));
        const thresholdCashout = playCandidate
          && currentScore + directScoreGain >= nextThreshold
          ? (nextThreshold >= 70 ? 20 : 16)
          : 0;
        const price = Math.max(0, aiNumber(getCardPrice(card)));
        const credits = Math.max(0, aiNumber(player?.resources?.credits));
        const unreachablePenalty = playCandidate
          ? 0
          : Math.min(30, 12 + Math.max(0, price - credits) * 5);
        return immediatePlayValue * 0.9
          + thresholdCashout
          + directScoreGain * 0.55
          + (playCandidate ? 2.5 : playableValue * 0.1)
          + cornerValue * 0.18
          + incomeValue * 0.12
          + (typeCode === 3 ? 1 : 0)
          - unreachablePenalty;
      }
      if (finalRoundTradePick) {
        const playCandidate = buildAiPlayCardCandidate(workingRoot, card, -1, player);
        const immediatePlayValue = Math.max(0, aiNumber(playCandidate?.score));
        const directScoreGain = Math.max(0, aiNumber(playCandidate?.directScoreGain));
        const price = Math.max(0, aiNumber(getCardPrice(card)));
        const credits = Math.max(0, aiNumber(player?.resources?.credits));
        const affordabilityPenalty = playCandidate
          ? 0
          : Math.min(24, 8 + Math.max(0, price - credits) * 4.5);
        const thresholdCashout = playCandidate
          && nextThreshold
          && currentScore < nextThreshold
          && currentScore + directScoreGain >= nextThreshold
          ? (nextThreshold >= 70 ? 18 : 14)
          : 0;
        return immediatePlayValue * 0.92
          + thresholdCashout
          + (playCandidate ? 2.5 : playableValue * 0.12)
          + cornerValue * 0.18
          + incomeValue * 0.12
          + (typeCode === 3 ? 1.2 : 0)
          - affordabilityPenalty;
      }
      if (closeThirdFinalMarkPick) {
        const playCandidate = buildAiPlayCardCandidate(workingRoot, card, -1, player);
        const immediatePlayValue = Math.max(0, aiNumber(playCandidate?.score));
        const directScoreGain = Math.max(0, aiNumber(playCandidate?.directScoreGain));
        const finalCashoutValue = playCandidate && nextThreshold && currentScore < nextThreshold
          && currentScore + directScoreGain >= nextThreshold
          ? (nextThreshold >= 70 ? 18 : 12)
          : 0;
        const deferredValue = playCandidate ? 0 : playableValue * (getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 0.16 : 0.28);
        const unplayablePenalty = playCandidate ? 0 : (getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 8 : 4);
        return immediatePlayValue * 0.95
          + finalCashoutValue
          + deferredValue
          + cornerValue * 0.2
          + incomeValue * 0.12
          + (typeCode === 3 ? 1.4 : 0)
          - unplayablePenalty;
      }
      const baseValue = playableValue * 0.75
        + cornerValue * 0.3
        + incomeValue * 0.2
        + (typeCode === 3 ? 2 : 0);
      return baseValue - scoreAiFinalRoundUnreachablePublicPickPenalty(card, player, {
        pendingType,
        model,
        typeCode,
        playCandidate: deferredPlayCandidate,
      });
    }

    function summarizeAiPublicPickCandidate(workingRoot, entry, player = getCurrentPlayer()) {
      const card = entry?.card || null;
      if (!card) return null;
      const playCandidate = buildAiPlayCardCandidate(workingRoot, card, -1, player);
      const breakdown = playCandidate?.valueBreakdown || null;
      return {
        slotIndex: Number.isInteger(Number(entry.slotIndex)) ? Number(entry.slotIndex) : null,
        score: roundAiScore(entry.score),
        cardId: card.cardId || card.id || null,
        cardInstanceId: card.id || null,
        cardLabel: getAiCardDisplayLabel({ card, cardId: card.cardId || card.id || null }, player)
          || card.cardName
          || card.label
          || null,
        price: getCardPrice(card),
        typeCode: getCardTypeCode(card),
        playScore: playCandidate ? roundAiScore(playCandidate.score) : null,
        directScoreGain: playCandidate ? roundAiScore(playCandidate.directScoreGain) : 0,
        effectTypes: Array.isArray(playCandidate?.effectTypes)
          ? playCandidate.effectTypes.slice(0, 6)
          : [],
        valueSignals: breakdown ? {
          planScore: roundAiScore(breakdown.planScore),
          endGameExpectedScore: roundAiScore(breakdown.endGameExpectedScore),
          c2Type3ProgressValue: roundAiScore(breakdown.c2Type3ProgressValue),
          cFinalTaskProgressValue: roundAiScore(breakdown.cFinalTaskProgressValue),
          readyTaskCashoutDirectScore: roundAiScore(breakdown.readyTaskCashoutDirectScore),
          readyTaskCashoutCount: roundAiScore(breakdown.readyTaskCashoutCount),
          playCardConversionPressure: roundAiScore(breakdown.playCardConversionPressure),
          finalRoundResourceDrainPenalty: roundAiScore(breakdown.finalRoundResourceDrainPenalty),
          standardActionPremium: roundAiScore(breakdown.standardActionPremium),
        } : null,
      };
    }

    function getAiPublicPickConcreteProfile(workingRoot, card, player = getCurrentPlayer()) {
      if (!card || !player) {
        return {
          hasConcreteSignal: false,
          playScore: null,
          directScoreGain: 0,
          effectTypes: [],
          signals: null,
        };
      }
      const playCandidate = buildAiPlayCardCandidate(workingRoot, card, -1, player);
      const breakdown = playCandidate?.valueBreakdown || null;
      const effectTypes = Array.isArray(playCandidate?.effectTypes)
        ? playCandidate.effectTypes.filter(Boolean)
        : [];
      const signals = breakdown ? {
        planScore: roundAiScore(breakdown.planScore),
        endGameExpectedScore: roundAiScore(breakdown.endGameExpectedScore),
        c2Type3ProgressValue: roundAiScore(breakdown.c2Type3ProgressValue),
        cFinalTaskProgressValue: roundAiScore(breakdown.cFinalTaskProgressValue),
        readyTaskCashoutDirectScore: roundAiScore(breakdown.readyTaskCashoutDirectScore),
        readyTaskCashoutCount: roundAiScore(breakdown.readyTaskCashoutCount),
        playCardConversionPressure: roundAiScore(breakdown.playCardConversionPressure),
        standardActionPremium: roundAiScore(breakdown.standardActionPremium),
      } : null;
      const hasConcreteSignal = Boolean(
        effectTypes.length
        || Math.max(0, aiNumber(playCandidate?.directScoreGain)) > 0
        || Math.max(0, aiNumber(breakdown?.planScore)) > 0
        || Math.max(0, aiNumber(breakdown?.endGameExpectedScore)) > 0
        || Math.max(0, aiNumber(breakdown?.c2Type3ProgressValue)) > 0
        || Math.max(0, aiNumber(breakdown?.cFinalTaskProgressValue)) > 0
        || Math.max(0, aiNumber(breakdown?.readyTaskCashoutDirectScore)) > 0
        || Math.max(0, aiNumber(breakdown?.readyTaskCashoutCount)) > 0
        || Math.max(0, aiNumber(breakdown?.standardActionPremium)) > 0
      );
      return {
        hasConcreteSignal,
        playScore: playCandidate ? roundAiScore(playCandidate.score) : null,
        directScoreGain: playCandidate ? roundAiScore(playCandidate.directScoreGain) : 0,
        effectTypes: effectTypes.slice(0, 6),
        signals,
      };
    }

    const AI_DEEPSPACE_SWAP_MIN_SCORE = 10;

    function scoreAiDeepspaceHandSwapCost(workingRoot, card, player = getCurrentPlayer()) {
      if (!card || !player) return Infinity;
      const playCandidate = buildAiPlayCardCandidate(workingRoot, card, -1, player);
      const playValue = Math.max(0, aiNumber(playCandidate?.score));
      const cornerValue = Math.max(0, scoreAiCardCornerOpportunity(card));
      const incomeGain = cards.getIncomeGainForCard?.(card) || null;
      const incomeValue = incomeGain ? Math.max(0, scoreAiIncomeOpportunityValue(player, incomeGain)) : 0;
      const typeCode = getCardTypeCode(card);
      const reserveBias = typeCode === 3 ? 3 : typeCode === 2 ? 1.5 : 0;
      return playValue * 0.65 + cornerValue * 0.35 + incomeValue * 0.18 + reserveBias;
    }

    function scoreAiDeepspaceSwapPair(workingRoot, handCard, publicCard, player = getCurrentPlayer()) {
      if (!handCard || !publicCard || !player) return -Infinity;
      const publicValue = scoreAiPublicPickCard(publicCard, player, "industry_deepspace_public", workingRoot);
      if (!Number.isFinite(Number(publicValue))) return -Infinity;
      const handCost = scoreAiDeepspaceHandSwapCost(workingRoot, handCard, player);
      if (!Number.isFinite(Number(handCost))) return -Infinity;
      const handPressure = Math.max(0, (player.hand || []).length - 4) * 0.75;
      return publicValue - handCost + handPressure;
    }

    function listAiDeepspaceSwapPairs(workingRoot, player = getCurrentPlayer(), fixedHandIndex = null) {
      if (!player || !(player.hand || []).length) return [];
      const handIndexes = Number.isInteger(Number(fixedHandIndex))
        ? [Number(fixedHandIndex)]
        : (player.hand || []).map((_card, index) => index);
      return handIndexes.flatMap((handIndex) => {
        const handCard = player.hand?.[handIndex] || null;
        if (!handCard) return [];
        return (workingRoot.cardState.publicCards || []).map((publicCard, slotIndex) => ({
          handIndex,
          handCard,
          slotIndex,
          publicCard,
          score: scoreAiDeepspaceSwapPair(workingRoot, handCard, publicCard, player),
          handCost: scoreAiDeepspaceHandSwapCost(workingRoot, handCard, player),
          publicValue: scoreAiPublicPickCard(publicCard, player, "industry_deepspace_public", workingRoot),
        }));
      })
        .filter((entry) => entry.handCard && entry.publicCard && Number.isFinite(Number(entry.score)))
        .sort((left, right) => (
          Number(right.score || 0) - Number(left.score || 0)
          || Number(right.publicValue || 0) - Number(left.publicValue || 0)
          || Number(left.handCost || 0) - Number(right.handCost || 0)
          || left.handIndex - right.handIndex
          || left.slotIndex - right.slotIndex
        ));
    }

    function getAiBestDeepspaceSwap(workingRoot, player = getCurrentPlayer(), fixedHandIndex = null) {
      return listAiDeepspaceSwapPairs(workingRoot, player, fixedHandIndex)[0] || null;
    }
    return Object.freeze({
      getAiIncomeDiscardPreview,
      getAiIncomeDiscardHandScarcityCost,
      scoreAiIncomeDiscardOptionNet,
      scoreAiIncomeDiscardSelectionOpportunityCost,
      scoreAiIncomePlacementRewardValue,
      chooseAiTradeDiscardIndexes,
      shouldAiUseRouteAwareIncomeDiscard,
      chooseAiIncomeDiscardIndexes,
      scoreAiMultiIncomeSequenceFit,
      scoreAiIncomeDiscardRouteEnergyFit,
      scoreAiIncomeDiscardFinalFormulaFit,
      getAiPassReserveResourcePressure,
      isAiPassReservePreviewIncomeCandidate,
      countAiType3CardsForPlayer,
      hasAiRunezuPassReservePressure,
      scoreAiC2Type3ProgressValue,
      scoreAiCFinalTaskProgressValue,
      getAiC2Type3BaseDelta,
      getAiPlayCardFinalFormulaDeltas,
      scoreAiFinalRoundEndGameCardUrgency,
      scoreAiPassReserveCard,
      scoreAiFinalRoundUnreachablePublicPickPenalty,
      getAiImmediateIncomeRewardGain,
      scoreAiImmediateIncomeRewardValue,
      scoreAiPublicPickCard,
      summarizeAiPublicPickCandidate,
      getAiPublicPickConcreteProfile,
      scoreAiDeepspaceHandSwapCost,
      scoreAiDeepspaceSwapPair,
      listAiDeepspaceSwapPairs,
      getAiBestDeepspaceSwap,
    });
  }

  return Object.freeze({ createIncomeCard });
});
