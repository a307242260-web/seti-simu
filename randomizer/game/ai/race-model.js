(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIRaceModel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function idKey(value) {
    return value == null ? "" : String(value);
  }

  function uniqueIds(values = []) {
    const seen = new Set();
    const result = [];
    for (const value of values || []) {
      const key = idKey(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
    return result;
  }

  function rotateIds(ids, startId) {
    if (!ids.length) return [];
    const startKey = idKey(startId);
    const startIndex = ids.findIndex((value) => idKey(value) === startKey);
    if (startIndex <= 0) return [...ids];
    return [...ids.slice(startIndex), ...ids.slice(0, startIndex)];
  }

  function buildRoundOrder(turnState = {}) {
    const activeIds = uniqueIds(turnState.activePlayerIds || []);
    const activeKeys = new Set(activeIds.map(idKey));
    const configuredOrder = uniqueIds(turnState.turnOrderPlayerIds || []);
    const orderedActiveIds = configuredOrder.length
      ? configuredOrder.filter((playerId) => !activeKeys.size || activeKeys.has(idKey(playerId)))
      : [...activeIds];

    for (const playerId of activeIds) {
      if (!orderedActiveIds.some((value) => idKey(value) === idKey(playerId))) {
        orderedActiveIds.push(playerId);
      }
    }

    const startPlayerId = orderedActiveIds.some((value) => idKey(value) === idKey(turnState.startPlayerId))
      ? turnState.startPlayerId
      : orderedActiveIds[0];
    return rotateIds(orderedActiveIds, startPlayerId);
  }

  function buildActionWindowOrder(turnState = {}, actorId = null) {
    const actorKey = idKey(actorId);
    if (!actorKey) return [];

    const passedKeys = new Set((turnState.passedPlayerIds || []).map(idKey));
    const roundOrder = buildRoundOrder(turnState)
      .filter((playerId) => !passedKeys.has(idKey(playerId)));
    const actorIndex = roundOrder.findIndex((playerId) => idKey(playerId) === actorKey);
    if (actorIndex < 0) return [];

    const completedKeys = new Set((turnState.completedTurnPlayerIds || []).map(idKey));
    const currentCycleRemaining = roundOrder
      .filter((playerId) => !completedKeys.has(idKey(playerId)));

    if (!completedKeys.has(actorKey)) {
      const remainingActorIndex = currentCycleRemaining
        .findIndex((playerId) => idKey(playerId) === actorKey);
      return remainingActorIndex > 0
        ? currentCycleRemaining.slice(0, remainingActorIndex)
        : [];
    }

    return [
      ...currentCycleRemaining,
      ...roundOrder.slice(0, actorIndex),
    ].filter((playerId) => idKey(playerId) !== actorKey);
  }

  function normalizeEta(value) {
    if (value == null || value === "") return Infinity;
    const eta = Number(value);
    return Number.isFinite(eta) ? Math.max(0, eta) : Infinity;
  }

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeOpponentEtas(opponentEtas = []) {
    return (opponentEtas || []).map((entry, index) => {
      if (entry && typeof entry === "object") {
        return {
          ...entry,
          playerId: entry.playerId ?? entry.id ?? null,
          eta: normalizeEta(entry.eta),
        };
      }
      return {
        playerId: null,
        index,
        eta: normalizeEta(entry),
      };
    });
  }

  function estimateRaceOutcome(options = {}) {
    const actorEta = normalizeEta(options.actorEta);
    const opponentEtas = normalizeOpponentEtas(options.opponentEtas);
    const reachableOpponents = opponentEtas.filter((entry) => Number.isFinite(entry.eta));
    const fastestOpponentEta = reachableOpponents.reduce(
      (best, entry) => Math.min(best, entry.eta),
      Infinity,
    );
    const fastestOpponentIds = reachableOpponents
      .filter((entry) => entry.eta === fastestOpponentEta)
      .map((entry) => entry.playerId)
      .filter((playerId) => playerId != null);
    const contested = Number.isFinite(fastestOpponentEta);
    const actorReachable = Number.isFinite(actorEta);
    const tied = actorReachable && contested && fastestOpponentEta === actorEta;
    const actorWins = actorReachable && (!contested || actorEta < fastestOpponentEta);
    const reusableValue = numeric(options.reusableValue);
    const exclusiveValue = numeric(options.exclusiveValue);
    const fallbackValue = numeric(options.fallbackValue);
    const uncontestedValue = reusableValue + exclusiveValue;
    const lostRaceValue = reusableValue + fallbackValue;
    const raceAdjustedValue = actorWins ? uncontestedValue : lostRaceValue;

    let outcome = "actor_first";
    if (!actorReachable) outcome = "actor_unreachable";
    else if (!contested) outcome = "uncontested";
    else if (tied) outcome = "opponent_tie_break";
    else if (!actorWins) outcome = "opponent_first";

    return {
      outcome,
      actorEta,
      opponentEtas,
      fastestOpponentEta,
      fastestOpponentIds,
      contested,
      tied,
      actorWins,
      reusableValue,
      exclusiveValue,
      fallbackValue,
      uncontestedValue,
      lostRaceValue,
      raceAdjustedValue,
      exclusiveValueAtRisk: Math.max(0, uncontestedValue - lostRaceValue),
    };
  }

  return Object.freeze({
    buildActionWindowOrder,
    estimateRaceOutcome,
  });
});
