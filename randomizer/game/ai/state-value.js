(function (root, factory) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("../cards/effects") : root.SetiCardEffects,
    common ? require("../data/placement") : root.SetiDataPlacement,
    common ? require("../tech/catalog") : root.SetiTechCatalog,
    common ? require("../abilities/planet") : root.SetiAbilityPlanet,
    common ? require("../actions/scan-effects") : root.SetiScanEffects);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiStateValue = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (cardEffects, dataPlacement, techCatalog, planetAbility, scanEffects) {
  "use strict";

  const MODEL_VERSION = "seti-purpose-capital-state-value-v2";
  // 首版比较刻度，属于估值假设，不是规则兑换率或可用于证明剪枝的收益上界。
  const DEFAULT_WEIGHTS = Object.freeze({
    credits: 1, energy: 1, publicity: 0.5, availableData: 0.5, additionalPublicScan: 0.5, handSize: 1,
  });
  const evaluatorWeights = new WeakMap();

  function number(value, path) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`VALUE_NUMBER_INVALID: ${path}`);
    return value;
  }

  function valueWeights(options) {
    const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
    for (const [key, value] of Object.entries(weights)) {
      if (!Object.hasOwn(DEFAULT_WEIGHTS, key)) throw new TypeError(`VALUE_WEIGHT_UNKNOWN: ${key}`);
      if (number(value, `weights.${key}`) < 0) throw new TypeError(`VALUE_WEIGHT_NEGATIVE: ${key}`);
    }
    return weights;
  }

  // Forecast hypotheses, not guaranteed rewards or admissible search bounds.
  // The current turn is executed natively; only later-round usage is forecast.
  const FORECAST = Object.freeze({ computerCyclesPerLaterRound: 1, usefulScansPerLaterRound: 2,
    landingsPerLaterRound: 1 });
  function technologyCapital(techState, round, weights = DEFAULT_WEIGHTS) {
    const later = Math.max(0, 4 - round), owned = techState?.ownedTiles || {}, disabled = techState?.disabledTiles || {};
    let total = 0;
    for (const id of Object.keys(owned)) {
      if (!owned[id] || disabled[id]) continue;
      const bonus = dataPlacement.getBlueTileDataBonus(id);
      if (bonus && Number.isInteger(techState.blueBoardSlots?.[id])) {
        const reward = bonus.type === "choose_card" ? weights.handSize
          : Object.entries(weights).reduce((n, [key, w]) => n + (bonus[key] || 0) * w, 0);
        total += FORECAST.computerCyclesPerLaterRound * later * (dataPlacement.getBlueColumnScoreBonus().score
          + Math.max(0, reward - weights.availableData));
      } else if (id === "purple4") {
        // A useful one-point move replaces one paid ordinary movement point.
        // Launch tempo and flexible scan targets are not assigned invented scores.
        total += FORECAST.usefulScansPerLaterRound * later * scanEffects.SCAN_ACTION_4_MOVE_POINTS * weights.energy;
      } else if (id === "orange3") {
        total += FORECAST.landingsPerLaterRound * later * planetAbility.ORANGE3_LAND_DISCOUNT * weights.energy;
      }
    }
    return total;
  }
  function knownCardCapital(card, techState, supply, round, weights = DEFAULT_WEIGHTS) {
    if (round >= 4 || !card?.cardId || card.hidden) return 0;
    const play = cardEffects.buildPlayEffects(card);
    if (play.length !== 1 || play[0].type !== "card_research_tech" || !play[0].options?.skipCost
      || play[0].options.afterResearchReward) return 0;
    const owned = techState?.ownedTiles || {}, types = play[0].options.techTypes || techCatalog.TECH_TYPES;
    const current = technologyCapital(techState, round, weights);
    let best = 0;
    for (const [id, stack] of Object.entries(supply?.stacks || {})) {
      const type = techCatalog.getTechType(id);
      if (!types.includes(type) || owned[id] || !(stack.remaining > 0)) continue;
      const next = { ...techState, ownedTiles: { ...owned, [id]: true },
        blueBoardSlots: { ...techState?.blueBoardSlots, ...(type === "blue" ? { [id]: 1 } : {}) } };
      const first = stack.firstTakeClaimedBy == null ? techCatalog.FIRST_TAKE_TYPE_SCORE : 0;
      best = Math.max(best, technologyCapital(next, round, weights) - current + first);
    }
    const cost = Object.entries(cardEffects.getCardPlayCost(card)).reduce((n, [key, amount]) => n + amount * (weights[key] || 0), 0);
    // Known stack bonus is deliberately excluded: this is a conservative option
    // estimate, not a native play simulation. Unrevealed/new cards have no option.
    return Math.max(0, best - cost - weights.handSize);
  }
  function handCapital(hand, techState, supply, round, weights = DEFAULT_WEIGHTS) {
    // Same-color free-research cards compete for the same first-take/capability.
    // Taking the best option avoids crediting that opportunity once per card.
    return Math.max(0, ...hand.map(card => knownCardCapital(card, techState, supply, round, weights)));
  }

  function evaluateStateValue(observation, seatId, options = {}) {
    const player = observation?.publicState?.players?.find(player => player.playerId === seatId);
    if (!player) throw new TypeError(`VALUE_PLAYER_MISSING: ${seatId}`);
    if (observation.selfState?.playerId !== seatId) throw new TypeError("VALUE_VIEWER_MISMATCH");
    if (!Array.isArray(observation.selfState.hand)) throw new TypeError("VALUE_HAND_MISSING");
    const terminal = observation.terminal ?? observation.outcomeProjection?.terminal;
    if (typeof terminal !== "boolean") throw new TypeError("VALUE_TERMINAL_MISSING");
    const realizedScore = number(player.score, "player.score");
    const currentTotal = number(player.finalScore, "player.finalScore");
    if (terminal) return Object.freeze({ modelVersion: MODEL_VERSION, total: currentTotal,
      components: Object.freeze({ realizedScore, currentEndGameBonus: currentTotal - realizedScore,
        resources: 0, hand: 0, income: 0, technologyPotential: 0, handPotential: 0 }), terminal: true });

    const weights = valueWeights(options);
    const round = number(observation.publicState.roundNumber, "roundNumber");
    if (!Number.isInteger(round) || round < 1 || round > 4) throw new TypeError("VALUE_ROUND_INVALID");
    if (!player.income || typeof player.income !== "object") throw new TypeError("VALUE_INCOME_MISSING");
    let resources = 0;
    let income = 0;
    for (const key of Object.keys(weights)) {
      if (key !== "handSize") resources += number(player[key], `player.${key}`) * weights[key];
      // 正式轮初收入发生于第2/3/4轮；插收入的立即奖励已进入当前资源，不能重复加。
      income += number(player.income[key], `income.${key}`) * weights[key] * (4 - round);
    }
    const hand = observation.selfState.hand.length * weights.handSize;
    const components = Object.freeze({ realizedScore, currentEndGameBonus: currentTotal - realizedScore,
      resources, hand, income, technologyPotential: technologyCapital(player.techState, round, weights),
      handPotential: handCapital(observation.selfState.hand, player.techState, observation.publicState.board?.techSupply, round, weights) });
    const total = Object.values(components).reduce((sum, value) => sum + value, 0);
    number(total, "total");
    return Object.freeze({ modelVersion: MODEL_VERSION, total, components, terminal: false });
  }

  function createStateValueEvaluator(seatId, options = {}) {
    if (typeof seatId !== "string" || !seatId) throw new TypeError("VALUE_VIEWER_INVALID");
    const weights = Object.freeze(valueWeights(options));
    const evaluate = observation => evaluateStateValue(observation, seatId, { weights }).total;
    Object.defineProperties(evaluate, {
      modelKey: { value: JSON.stringify({ version: MODEL_VERSION, seatId, weights }) },
      seatId: { value: seatId },
    });
    evaluatorWeights.set(evaluate, weights);
    return Object.freeze(evaluate);
  }

  function evaluateHandCountDelta(evaluate, observation, delta) {
    if (!evaluatorWeights.has(evaluate)) throw new TypeError("VALUE_EVALUATOR_UNKNOWN");
    if (![-1, 1].includes(delta)) throw new TypeError("VALUE_HAND_DELTA_INVALID");
    if ((observation?.terminal ?? observation?.outcomeProjection?.terminal) !== false) {
      throw new TypeError("VALUE_BOUND_NONTERMINAL_REQUIRED");
    }
    if (!Array.isArray(observation.selfState?.hand)) throw new TypeError("VALUE_HAND_MISSING");
    const hand = observation.selfState.hand.slice();
    if (delta === -1 && !hand.length) throw new TypeError("VALUE_HAND_DELTA_INVALID");
    if (delta === -1) hand.pop();
    else hand.push({ hidden: true });
    // 仅计算数值界，不是规则后继。重算相同求和顺序，避免 base+delta 的浮点误差低估上界。
    return evaluate({ ...observation, selfState: { ...observation.selfState, hand } });
  }

  return Object.freeze({ MODEL_VERSION, DEFAULT_WEIGHTS, FORECAST, technologyCapital, knownCardCapital, handCapital,
    supportsLegacyValueProof: observation => observation.publicState.roundNumber === 4, evaluateStateValue, createStateValueEvaluator,
    evaluateHandCountDelta, isStateValueEvaluator: evaluate => evaluatorWeights.has(evaluate),
    isDefaultStateValueEvaluator: evaluate => {
      const weights = evaluatorWeights.get(evaluate);
      return Boolean(weights && Object.keys(DEFAULT_WEIGHTS).every(key => weights[key] === DEFAULT_WEIGHTS[key]));
    },
    isMoneyMonotoneEvaluator: evaluate => {
      const weights = evaluatorWeights.get(evaluate);
      return Boolean(weights && weights.credits > 0 && weights.energy > 0);
    } });
});
