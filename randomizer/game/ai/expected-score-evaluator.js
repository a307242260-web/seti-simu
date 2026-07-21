(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const EVALUATION_MODEL = "expected-terminal-score-v1";
  const PARAMETER_VERSION = "seti-theta0-v1";
  const RESOURCE_KEYS = Object.freeze([
    "credits", "energy", "availableData", "publicity", "ordinaryCard", "alienCard",
  ]);
  const DEFAULT_PARAMETERS = deepFreeze({
    parameterVersion: PARAMETER_VERSION,
    resourceValues: {
      credits: 5,
      energy: 5,
      availableData: 2.5,
      publicity: 2.5,
      ordinaryCard: 2.5,
      alienCard: 10 / 3,
    },
    salvageByRound: { 1: 0.9, 2: 0.75, 3: 0.55, 4: 0.25 },
    tempoCost: { quick: 0, main: 0.25, pass: 0.75 },
    completionChance: { route: 0.8, data: 0.8, card: 0.75, tech: 0.8 },
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function mergeParameters(input = {}) {
    const resourceValues = {};
    for (const key of RESOURCE_KEYS) {
      const value = finite(input.resourceValues?.[key], DEFAULT_PARAMETERS.resourceValues[key]);
      if (value < 0) throw new TypeError(`${key} 估值必须是非负有限数值`);
      resourceValues[key] = value;
    }
    const mergeNumericMap = (fallback, override = {}) => Object.fromEntries(
      Object.entries(fallback).map(([key, value]) => {
        const next = finite(override[key], value);
        if (next < 0) throw new TypeError(`${key} 参数必须是非负有限数值`);
        return [key, next];
      }),
    );
    return deepFreeze({
      parameterVersion: String(input.parameterVersion || PARAMETER_VERSION),
      resourceValues,
      salvageByRound: mergeNumericMap(DEFAULT_PARAMETERS.salvageByRound, input.salvageByRound),
      tempoCost: mergeNumericMap(DEFAULT_PARAMETERS.tempoCost, input.tempoCost),
      completionChance: mergeNumericMap(DEFAULT_PARAMETERS.completionChance, input.completionChance),
    });
  }

  function normalizeResources(input = {}) {
    return Object.freeze(Object.fromEntries(RESOURCE_KEYS.map((key) => [key, Math.max(0, finite(input[key]))])));
  }

  function addResources(left, right, multiplier = 1) {
    return Object.fromEntries(RESOURCE_KEYS.map((key) => [
      key,
      finite(left?.[key]) + finite(right?.[key]) * multiplier,
    ]));
  }

  function resourceValue(resources, parameters) {
    return RESOURCE_KEYS.reduce((total, key) => (
      total + finite(resources?.[key]) * parameters.resourceValues[key]
    ), 0);
  }

  function getVisiblePlayer(observation, seatId) {
    const players = observation?.publicState?.players;
    if (Array.isArray(players)) {
      return players.find((player) => player?.playerId === seatId || player?.id === seatId) || null;
    }
    return players?.[seatId] || null;
  }

  function readInventory(observation, seatId) {
    const player = getVisiblePlayer(observation, seatId) || {};
    const self = observation?.selfState || {};
    const handCount = finite(player.handCount, Array.isArray(self.hand) ? self.hand.length : 0);
    const alienCardCount = Array.isArray(self.privateAlienCards) ? self.privateAlienCards.length : 0;
    return normalizeResources({
      credits: player.credits ?? player.resources?.credits,
      energy: player.energy ?? player.resources?.energy,
      availableData: player.availableData ?? player.resources?.availableData,
      publicity: player.publicity ?? player.resources?.publicity,
      ordinaryCard: handCount,
      alienCard: alienCardCount,
    });
  }

  function normalizePlan(plan, index = 0) {
    return Object.freeze({
      id: String(plan?.id || `plan-${index}`),
      consumes: normalizeResources(plan?.consumes),
      exclusiveKeys: Object.freeze([...(plan?.exclusiveKeys || [])].map(String)),
      completionChance: Math.max(0, Math.min(1, finite(plan?.completionChance, 1))),
      terminalGain: finite(plan?.terminalGain),
      opportunityCost: Math.max(0, finite(plan?.opportunityCost)),
      riskPenalty: Math.max(0, finite(plan?.riskPenalty)),
    });
  }

  function planExpectedValue(plan) {
    return plan.completionChance * plan.terminalGain - plan.opportunityCost - plan.riskPenalty;
  }

  function selectBestPlanPortfolio(plans = [], inventory = {}) {
    const normalizedPlans = plans.map(normalizePlan);
    const capacity = normalizeResources(inventory);
    let best = { score: 0, plans: [], consumed: normalizeResources({}) };

    function visit(index, selected, consumed, exclusive, score) {
      if (index >= normalizedPlans.length) {
        if (score > best.score) best = { score, plans: [...selected], consumed: normalizeResources(consumed) };
        return;
      }
      visit(index + 1, selected, consumed, exclusive, score);
      const plan = normalizedPlans[index];
      if (plan.exclusiveKeys.some((key) => exclusive.has(key))) return;
      const nextConsumed = addResources(consumed, plan.consumes);
      if (RESOURCE_KEYS.some((key) => nextConsumed[key] > capacity[key])) return;
      const nextExclusive = new Set(exclusive);
      plan.exclusiveKeys.forEach((key) => nextExclusive.add(key));
      visit(index + 1, [...selected, plan], nextConsumed, nextExclusive, score + planExpectedValue(plan));
    }

    visit(0, [], normalizeResources({}), new Set(), 0);
    return deepFreeze({
      score: best.score,
      selectedPlans: best.plans,
      consumed: best.consumed,
      leftover: normalizeResources(addResources(capacity, best.consumed, -1)),
    });
  }

  function evaluateState(observation, seatId, inputParameters = {}) {
    const parameters = mergeParameters(inputParameters);
    const player = getVisiblePlayer(observation, seatId) || {};
    const inventory = readInventory(observation, seatId);
    const round = Math.max(1, Math.min(4, Math.trunc(finite(observation?.publicState?.roundNumber, 1))));
    const portfolio = selectBestPlanPortfolio(inputParameters.plans || [], inventory);
    const leftoverSalvage = resourceValue(portfolio.leftover, parameters) * parameters.salvageByRound[round];
    const realized = finite(player.score ?? player.resources?.score);
    const lockedFinal = finite(player.finalScore) - realized;
    return deepFreeze({
      value: realized + Math.max(0, lockedFinal) + portfolio.score + leftoverSalvage,
      realized,
      lockedFinal: Math.max(0, lockedFinal),
      selectedPlans: portfolio.selectedPlans,
      leftoverSalvage,
      competition: 0,
      risk: 0,
      parameterVersion: parameters.parameterVersion,
      inventory,
    });
  }

  function descriptorResources(raw = {}) {
    return normalizeResources({
      ...raw,
      ordinaryCard: raw.ordinaryCard ?? raw.handSize ?? raw.cards,
      availableData: raw.availableData ?? raw.data,
    });
  }

  function getVisibleCard(context, action) {
    const cards = context?.observation?.selfState?.hand || [];
    const instanceId = action?.target?.cardInstanceId || action?.payload?.cardInstanceId;
    const handIndex = Number(action?.payload?.handIndex ?? action?.target?.handIndex);
    return cards.find((card) => card?.id === instanceId)
      || (Number.isInteger(handIndex) ? cards[handIndex] : null);
  }

  function getPlanetStats(context, action) {
    const planetId = action?.target?.planetId;
    const planets = context?.observation?.publicState?.board?.planets?.planets
      || context?.observation?.publicState?.board?.planets
      || {};
    return planetId ? planets[planetId] || null : null;
  }

  function projectionForAction(context, action, parameters) {
    let cost = descriptorResources(action?.payload?.cost);
    let gain = descriptorResources(action?.payload?.gain);
    let realizedDelta = finite(action?.payload?.gain?.score);
    let lockedFinalDelta = 0;
    let planKind = null;
    const reasonCodes = [];
    const family = action?.family;

    if (family === "launch" && resourceValue(cost, parameters) === 0) {
      cost = descriptorResources({ credits: 2 });
      planKind = "route";
      reasonCodes.push("standard-launch-cost");
    } else if (family === "scan" && resourceValue(cost, parameters) === 0) {
      cost = descriptorResources({ credits: 1, energy: 2 });
      gain = descriptorResources({ ...gain, availableData: Math.max(1, gain.availableData) });
      planKind = "data";
      reasonCodes.push("standard-scan-cost", "visible-data-outcome");
    } else if (family === "analyze" && resourceValue(cost, parameters) === 0) {
      cost = descriptorResources({ energy: 1 });
      planKind = "data";
      reasonCodes.push("standard-analyze-cost");
    }

    if (family === "play_card") {
      cost = descriptorResources({ ...cost, ordinaryCard: 1 });
      planKind = "card";
      lockedFinalDelta += parameters.resourceValues.ordinaryCard;
      reasonCodes.push("ordinary-card-plan-upside");
    } else if (family === "research_tech") {
      planKind = "tech";
    } else if (["move", "orbit", "land"].includes(family)) {
      planKind = "route";
      const planet = getPlanetStats(context, action);
      if (family === "orbit" && planet && finite(planet.orbits) === 0) {
        realizedDelta += 3;
        reasonCodes.push("first-orbit-score");
      }
      if (family === "land") {
        realizedDelta += 6;
        if (planet && finite(planet.landings) === 0) {
          gain = descriptorResources({ ...gain, availableData: Math.max(1, gain.availableData) });
          reasonCodes.push("first-landing-data");
        }
        reasonCodes.push("landing-and-yellow-trace");
      }
    } else if (family === "place_data") {
      cost = descriptorResources({ ...cost, availableData: Math.max(1, cost.availableData) });
      if (action?.target?.blueSlot != null) realizedDelta += 2;
      planKind = "data";
    } else if (family === "card_corner") {
      cost = descriptorResources({ ...cost, ordinaryCard: Math.max(1, cost.ordinaryCard) });
      const discardCode = getVisibleCard(context, action)?.discardActionCode;
      if (discardCode === 0) gain = descriptorResources({ ...gain, publicity: Math.max(1, gain.publicity) });
      if (discardCode === 1) gain = descriptorResources({ ...gain, availableData: Math.max(1, gain.availableData) });
      if (discardCode === 2) gain = descriptorResources({ ...gain, energy: Math.max(1, gain.energy) });
      reasonCodes.push("visible-card-corner");
    }

    if (family === "analyze") {
      realizedDelta += parameters.resourceValues.energy;
      reasonCodes.push("blue-trace-cashout");
    }

    const costValue = resourceValue(cost, parameters);
    const gainValue = resourceValue(gain, parameters);
    const completionChance = planKind ? parameters.completionChance[planKind] : 0;
    const riskPenalty = planKind ? costValue * (1 - completionChance) : 0;
    const committedPlanValue = planKind ? costValue + riskPenalty : 0;
    const phase = action?.phase === "quick" ? "quick" : "main";
    const tempoCost = family === "pass" ? parameters.tempoCost.pass : parameters.tempoCost[phase];
    return {
      cost,
      gain,
      realizedDelta,
      lockedFinalDelta,
      planKind,
      committedPlanValue,
      leftoverSalvageDelta: gainValue - costValue,
      riskPenalty,
      tempoCost,
      reasonCodes,
    };
  }

  function evaluateAction(context, action, inputParameters = {}) {
    const parameters = mergeParameters(inputParameters);
    const projection = projectionForAction(context, action, parameters);
    const payloadValue = Number(action?.payload?.value);
    const explicitDelta = Number.isFinite(payloadValue) ? payloadValue : 0;
    const rawScore = projection.realizedDelta
      + projection.lockedFinalDelta
      + projection.committedPlanValue
      + projection.leftoverSalvageDelta
      - projection.riskPenalty
      - projection.tempoCost
      + explicitDelta;
    const score = Math.round(rawScore * 1e9) / 1e9;
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score,
      realizedDelta: projection.realizedDelta,
      lockedFinalDelta: projection.lockedFinalDelta,
      selectedPlans: projection.planKind ? [{
        id: `${projection.planKind}:${action.actionId}`,
        kind: projection.planKind,
        expectedValue: projection.committedPlanValue,
      }] : [],
      leftoverSalvageDelta: projection.leftoverSalvageDelta,
      competitionDelta: 0,
      riskPenalty: projection.riskPenalty,
      tempoCost: projection.tempoCost,
      parameterVersion: parameters.parameterVersion,
      reasonCodes: projection.reasonCodes,
    });
  }

  return Object.freeze({
    EVALUATION_MODEL,
    PARAMETER_VERSION,
    DEFAULT_PARAMETERS,
    mergeParameters,
    evaluateState,
    evaluateAction,
    selectBestPlanPortfolio,
  });
});
