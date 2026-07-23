(function (root, factory) {
  "use strict";

  let initialCards = root.SetiInitialCards;

  if (!initialCards && typeof require === "function") {
    initialCards = initialCards || require("../initial-cards");
  }

  const api = factory(initialCards);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAISelectionEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (initialCards) {
  "use strict";

  const FINAL_ROUND_NUMBER = 4;
  const RESOURCE_VALUES = Object.freeze({
    score: 1,
    credits: 3,
    energy: 3,
    handSize: 3,
    availableData: 1.5,
    publicity: 1,
    additionalPublicScan: 1.5,
  });

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function getResourceValue(resources = {}, values = RESOURCE_VALUES) {
    return Object.entries(resources || {}).reduce((total, [key, value]) => (
      total + numeric(value) * numeric(values[key])
    ), 0);
  }

  function getRemainingIncomeMultiplier(roundNumber = 1) {
    const round = Math.max(1, Math.round(numeric(roundNumber) || 1));
    return Math.max(0, FINAL_ROUND_NUMBER - round);
  }

  function getIncomeValue(income = {}, options = {}) {
    return getResourceValue(income, options.resourceValues)
      * getRemainingIncomeMultiplier(options.roundNumber);
  }

  function getIndustryEffectForEvaluation(cardOrLabel, options = {}) {
    const player = options.player || (options.aiDifficulty ? { aiDifficulty: options.aiDifficulty } : null);
    if (player && initialCards?.getEffectiveIndustryEffect) {
      return initialCards.getEffectiveIndustryEffect(cardOrLabel, player);
    }
    return initialCards?.getIndustryEffect?.(cardOrLabel);
  }

  function evaluateIndustryCard(cardOrLabel, options = {}) {
    const effect = getIndustryEffectForEvaluation(cardOrLabel, options);
    if (!effect) return 0;
    return getResourceValue(effect.resources, options.resourceValues)
      + getIncomeValue(effect.baseIncome, options)
      + numeric(effect.blindDraw) * RESOURCE_VALUES.handSize
      + numeric(effect.dataGain) * RESOURCE_VALUES.availableData
      + numeric(effect.launchCount) * 2
      + numeric(effect.incomeIncreaseCount) * 2;
  }

  function evaluateInitialCard(cardOrNumber, options = {}) {
    const effect = initialCards?.getInitialCardEffect?.(cardOrNumber);
    if (!effect) return 0;
    return getResourceValue(effect.resources, options.resourceValues)
      + getIncomeValue(effect.income, options)
      + numeric(effect.blindDraw) * RESOURCE_VALUES.handSize
      + numeric(effect.dataGain) * RESOURCE_VALUES.availableData
      + numeric(effect.scan?.count) * 3
      + (effect.orbitPlanetId ? 3 : 0)
      + (effect.alienTrace ? 6 : 0);
  }

  function byScoreDescending(left, right) {
    return Number(right.score || 0) - Number(left.score || 0);
  }

  function chooseBest(items, scoreFn) {
    const scored = (items || [])
      .map((item) => ({ item, score: scoreFn(item) }))
      .sort(byScoreDescending);
    return scored.length ? scored[0].item : null;
  }

  const TECH_TYPE_SCORES = Object.freeze({
    orange: 8,
    purple: 7,
    blue: 6,
  });

  const TECH_BONUS_SCORES = Object.freeze({
    bonus_3f: 2,
    bonus_1c: 5,
    bonus_1p: 4,
    bonus_1m: 2,
  });

  function getTechType(tileId) {
    const match = String(tileId || "").match(/^(orange|purple|blue)(\d)$/);
    return match ? match[1] : null;
  }

  function getTechStackIndex(tileId) {
    const match = String(tileId || "").match(/^(orange|purple|blue)(\d)$/);
    return match ? Number(match[2]) : 0;
  }

  function getCandidateTileId(candidate) {
    return typeof candidate === "string" ? candidate : candidate?.tileId;
  }

  function getFiniteScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? score : null;
  }

  function scoreResearchTechCandidate(candidate) {
    const explicitScore = getFiniteScore(candidate?.score);
    if (explicitScore != null) return explicitScore;
    const tileId = getCandidateTileId(candidate);
    const techType = candidate?.techType || getTechType(tileId);
    const stackIndex = candidate?.stackIndex ?? getTechStackIndex(tileId);
    const bonusId = candidate?.bonusId || null;
    const firstTakeBonus = candidate?.firstTake ? 2 : 0;
    return (TECH_TYPE_SCORES[techType] || 0)
      + (TECH_BONUS_SCORES[bonusId] || 0)
      + firstTakeBonus
      + Math.max(0, 5 - stackIndex) * 0.1;
  }

  function getEffectResourcesValue(effect = {}, options = {}) {
    return getResourceValue(effect.resources || {}, options.resourceValues)
      + Number(effect.blindDraw || 0) * RESOURCE_VALUES.handSize
      + Number(effect.dataGain || 0) * RESOURCE_VALUES.availableData
      + getIncomeValue(effect.income || {}, options)
      + getIncomeValue(effect.baseIncome || {}, options);
  }

  function addOpeningGoal(goals, id, amount = 1) {
    if (!id) return;
    goals[id] = (goals[id] || 0) + Math.max(0, Number(amount) || 0);
  }

  function getOpeningIndustryEffect(industry, options = {}) {
    const player = options.player || (options.aiDifficulty ? { aiDifficulty: options.aiDifficulty } : null);
    if (player && initialCards?.getEffectiveIndustryEffect) {
      return initialCards.getEffectiveIndustryEffect(industry, player);
    }
    return initialCards?.getIndustryEffect?.(industry);
  }

  function getOpeningEffects(industry, initialPair = [], options = {}) {
    const effects = [];
    const industryEffect = getOpeningIndustryEffect(industry, options);
    if (industryEffect) effects.push({ source: "industry", effect: industryEffect });
    for (const card of initialPair) {
      const effect = initialCards?.getInitialCardEffect?.(initialCards.getInitialCardNumber?.(card) || card);
      if (effect) effects.push({ source: "initial", effect });
    }
    return effects;
  }

  function getWeakStartCheatLabOpeningIncomePressure(industry, options = {}) {
    const difficulty = String(options.aiDifficulty || options.player?.aiDifficulty || "");
    const label = String(industry?.label || industry?.id || "");
    return difficulty === "weak_start" && label.includes("作弊实验室") ? 1 : 0;
  }

  function scoreOpeningCombination(industry, initialPair = [], options = {}) {
    const effects = getOpeningEffects(industry, initialPair, options);
    const goals = {};
    let score = evaluateIndustryCard(industry, options);
    for (const card of initialPair) {
      score += evaluateInitialCard(initialCards?.getInitialCardNumber?.(card) || card, options);
    }

    const combined = effects.reduce((summary, entry) => {
      const effect = entry.effect || {};
      summary.resourceScore += Number(effect.resources?.score || 0);
      summary.immediatePublicity += Number(effect.resources?.publicity || 0);
      // baseIncome is only collected after PASS; income is awarded immediately on setup.
      summary.credits += Number(effect.resources?.credits || 0) + Number(effect.income?.credits || 0);
      summary.energy += Number(effect.resources?.energy || 0) + Number(effect.income?.energy || 0);
      summary.hand += Number(effect.blindDraw || 0) + Number(effect.income?.handSize || 0);
      summary.data += Number(effect.dataGain || 0) + Number(effect.income?.availableData || 0);
      summary.baseIncomeCredits += Number(effect.baseIncome?.credits || 0);
      summary.baseIncomeEnergy += Number(effect.baseIncome?.energy || 0);
      summary.baseIncomeHand += Number(effect.baseIncome?.handSize || 0);
      summary.baseIncomeData += Number(effect.baseIncome?.availableData || 0);
      summary.scan += Number(effect.scan?.count || 0) + Number(effect.resources?.additionalPublicScan || 0);
      summary.incomeIncreases += Number(effect.incomeIncreaseCount || 0);
      if (effect.alienTrace) summary.traces += 1;
      if (effect.orbitPlanetId) summary.orbits += 1;
      summary.rawValue += getEffectResourcesValue(effect, options);
      return summary;
    }, {
      resourceScore: 0,
      immediatePublicity: 0,
      credits: 0,
      energy: 0,
      hand: 0,
      data: 0,
      baseIncomeCredits: 0,
      baseIncomeEnergy: 0,
      baseIncomeHand: 0,
      baseIncomeData: 0,
      scan: 0,
      incomeIncreases: 0,
      traces: 0,
      orbits: 0,
      rawValue: 0,
    });

    score += Math.min(8, combined.resourceScore * 0.55);
    score += combined.credits >= 3 ? 3 : combined.credits >= 2 ? 1.5 : 0;
    score += combined.incomeIncreases >= 3 ? 7 : combined.incomeIncreases === 2 ? 4.5 : combined.incomeIncreases;
    score += combined.scan >= 2 ? 6 : combined.scan * 1.8;
    score += combined.data >= 2 ? 5 : combined.data * 1.7;
    // 初始痕迹还包含后续揭示链、任务和颜色供给价值，不能只按 state 图即时分折价。
    score += combined.traces * 7;
    score += combined.orbits * 2.5;
    const isHuanyuSuperdrive = String(industry?.label || industry?.id || "").includes("寰宇超动力");
    combined.huanyuUnsupportedSecondOrbitPenalty = isHuanyuSuperdrive
      && combined.orbits >= 2
      && combined.scan <= 0
      && combined.traces <= 0
      && combined.data <= 0
      && combined.hand <= 0
      ? 3.5
      : 0;
    score -= combined.huanyuUnsupportedSecondOrbitPenalty;
    if (
      isHuanyuSuperdrive
      && combined.traces <= 0
      && combined.orbits >= 1
      && combined.data >= 1
      && combined.scan >= 2
    ) {
      score += 1.8;
    }

    if (combined.resourceScore >= 8 || combined.traces || combined.scan >= 2) {
      addOpeningGoal(goals, "FIRST_ROUND_SCORE_25", 1);
    }
    if (combined.scan >= 2) addOpeningGoal(goals, "GRAB_TRACE_PINK", combined.scan);
    if (combined.data >= 1 || combined.scan >= 2) addOpeningGoal(goals, "GRAB_TRACE_BLUE", combined.data + combined.scan * 0.35);
    if (combined.traces || combined.orbits) addOpeningGoal(goals, "GRAB_TRACE_YELLOW", combined.traces + combined.orbits * 0.35);
    const weakStartIncomePressure = getWeakStartCheatLabOpeningIncomePressure(industry, options);
    const weakStartResearchReady = String(options.aiDifficulty || options.player?.aiDifficulty || "") === "weak_start"
      && combined.immediatePublicity >= 4;
    if (weakStartResearchReady) score += 3.2;
    // Keep setup payability on immediately granted resources, while preserving
    // the recurring company income as a long-term strategic signal.
    combined.longTermCredits = combined.credits + combined.baseIncomeCredits;
    if (combined.incomeIncreases >= 2 || combined.credits >= 3) {
      addOpeningGoal(
        goals,
        "OPENING_INCOME",
        combined.incomeIncreases + combined.longTermCredits * 0.25 + weakStartIncomePressure,
      );
    }

    return {
      score,
      goals,
      summary: combined,
      industry,
      initialCards: initialPair,
    };
  }

  function getInitialPairs(cards = [], count = 2) {
    if (count <= 0) return [[]];
    if (count <= 1) return (cards || []).map((card) => [card]);
    const pairs = [];
    for (let left = 0; left < cards.length; left += 1) {
      for (let right = left + 1; right < cards.length; right += 1) {
        pairs.push([cards[left], cards[right]]);
      }
    }
    return pairs;
  }

  function evaluateInitialSelection(offer, options = {}) {
    const forcedIndustry = options.forcedIndustryCard || options.forcedIndustry || null;
    const industryOptions = forcedIndustry ? [forcedIndustry] : (offer?.industryOptions || []);
    const initialOptions = offer?.initialOptions || [];
    const initialCount = Math.max(1, Math.round(Number(options.initialCount) || 2));
    const plans = [];
    for (const industry of industryOptions) {
      for (const initialPair of getInitialPairs(initialOptions, initialCount)) {
        plans.push(scoreOpeningCombination(industry, initialPair, options));
      }
    }
    const bestPlan = plans.sort((left, right) => (
      Number(right.score || 0) - Number(left.score || 0)
      || String(left.industry?.id || "").localeCompare(String(right.industry?.id || ""))
    ))[0];
    const topPlans = plans.slice(0, 5).map((plan) => ({
      score: Math.round(Number(plan.score || 0) * 100) / 100,
      industryLabel: plan.industry?.label || plan.industry?.id || null,
      initialNumbers: (plan.initialCards || [])
        .map((card) => initialCards?.getInitialCardNumber?.(card) || null)
        .filter((number) => number != null),
      summary: plan.summary,
      goals: plan.goals,
    }));

    if (bestPlan) {
      return {
        industry: bestPlan.industry,
        initialCards: bestPlan.initialCards.slice(0, initialCount),
        openingPlan: {
          score: Math.round(bestPlan.score * 100) / 100,
          goals: bestPlan.goals,
          summary: bestPlan.summary,
          topPlans,
        },
      };
    }

    const industry = chooseBest(industryOptions, (card) => evaluateIndustryCard(card, options));
    return {
      industry,
      initialCards: initialOptions.slice(0, initialCount),
      openingPlan: null,
    };
  }

  const INCOME_DISCARD_TYPES = new Set([
    "income",
    "initial_income",
    "planet_reward_income",
    "place_data_income",
    "industry_helios_income",
    "discard_any_income",
  ]);

  const INCOME_GAIN_SCORE = Object.freeze({
    credits: 14,
    energy: 11,
    handSize: 8,
    publicity: 3,
    availableData: 3,
    additionalPublicScan: 2,
  });

  function scoreIncomeGain(gain = null) {
    if (!gain || typeof gain !== "object") return -Infinity;
    return Object.entries(gain).reduce((total, [key, value]) => {
      const amount = Math.max(0, Number(value) || 0);
      return total + amount * (INCOME_GAIN_SCORE[key] || 1);
    }, 0);
  }

  function getCardSortLabel(card) {
    return String(card?.label || card?.cardName || card?.cardId || card?.id || "");
  }

  function getIncomeGainByIndex(request, index) {
    const gains = request?.incomeGainByIndex;
    if (!gains) return null;
    if (Array.isArray(gains)) return gains[index] || null;
    return gains[index] || gains[String(index)] || null;
  }

  function isIncomeDiscardRequest(request = {}) {
    const type = String(request?.pendingType || request?.type || request?.discardType || "");
    return INCOME_DISCARD_TYPES.has(type);
  }

  function evaluateDiscardIndexes(hand = [], count = 1, request = {}) {
    const target = Math.max(0, Math.round(Number(count) || 0));
    const incomeRequest = isIncomeDiscardRequest(request);
    return hand
      .map((card, index) => ({ index, card }))
      .sort((left, right) => {
        if (incomeRequest) {
          const rightIncomeScore = scoreIncomeGain(getIncomeGainByIndex(request, right.index));
          const leftIncomeScore = scoreIncomeGain(getIncomeGainByIndex(request, left.index));
          if (rightIncomeScore !== leftIncomeScore) return rightIncomeScore - leftIncomeScore;
        }
        const leftLabel = getCardSortLabel(left.card);
        const rightLabel = getCardSortLabel(right.card);
        return leftLabel.localeCompare(rightLabel, "zh-Hans-CN");
      })
      .slice(0, target)
      .map((entry) => entry.index);
  }

  function evaluatePassReserveCard(pile = []) {
    return pile[0] || null;
  }

  function evaluateResearchTechTile(candidates = []) {
    return chooseBest(candidates.filter((candidate) => candidate?.available !== false), scoreResearchTechCandidate);
  }

  function evaluateBlueTechSlot(availableSlots = []) {
    const sorted = [...availableSlots]
      .map((slot) => Number(slot))
      .filter((slot) => Number.isInteger(slot))
      .sort((left, right) => left - right);
    return sorted.length ? sorted[0] : null;
  }

  function evaluateMovePaymentIndexes(hand = [], request = {}) {
    const requiredMovePoints = Math.max(0, Math.round(Number(request.requiredMovePoints) || 0));
    const availableEnergy = Math.max(0, Math.round(Number(request.availableEnergy) || 0));
    const roundNumber = Math.max(1, Math.round(Number(request.roundNumber) || 1));
    const preserveEnergy = request.preserveEnergy != null
      ? Boolean(request.preserveEnergy)
      : roundNumber <= 2 || availableEnergy <= 2;
    const neededCards = preserveEnergy
      ? requiredMovePoints
      : Math.max(0, requiredMovePoints - availableEnergy);
    return (request.moveCardIndexes || [])
      .filter((index) => Number.isInteger(Number(index)) && hand[Number(index)])
      .map((index) => Number(index))
      .sort((left, right) => (
        Number(request.moveCardOpportunityCosts?.[left] ?? 0)
          - Number(request.moveCardOpportunityCosts?.[right] ?? 0)
        || left - right
      ))
      .slice(0, neededCards);
  }

  function scoreAlienUseOption(option) {
    if (!option || option.disabled) return -Infinity;
    const choice = String(option.choice ?? "");
    const explicitScore = getFiniteScore(option.score);
    if (explicitScore != null) return explicitScore;
    const label = String(option.label || "");
    const scoreMatch = label.match(/(\d+)\s*分/);
    const threatMatch = label.match(/威胁\s*(\d+)/);

    if (choice === "cancel") return -100;
    if (choice === "skip") return -30;
    if (choice === "displayed") return 50;
    if (choice === "confirm") return 45;
    if (choice === "blind") return 35;
    if (scoreMatch && threatMatch) {
      return 40 + Number(scoreMatch[1]) * 2 + Number(threatMatch[1]) * 0.25;
    }
    if (/^\d+$/.test(choice)) return 30 - Number(choice) * 0.01;
    if (choice.includes(":")) return 28;
    return choice ? 25 : -Infinity;
  }

  function evaluateAlienUseOption(options = []) {
    return (options || [])
      .map((option, index) => ({ option, index, score: scoreAlienUseOption(option) }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.option || null;
  }

  return Object.freeze({
    evaluateInitialSelection,
    evaluateDiscardIndexes,
    evaluatePassReserveCard,
    evaluateResearchTechTile,
    evaluateBlueTechSlot,
    evaluateMovePaymentIndexes,
    evaluateAlienUseOption,
    scoreResearchTechCandidate,
    scoreAlienUseOption,
    scoreOpeningCombination,
    getInitialPairs,
    scoreIncomeGain,
  });
});
