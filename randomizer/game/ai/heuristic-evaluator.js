(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiHeuristicEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const TURN_ACTION_SCORES = Object.freeze({
    land: 7,
    orbit: 6,
    research_tech: 5,
    play_card: 5,
    launch: 4,
    scan: 2.5,
    analyze: 1,
    place_data: 2,
    move: 0,
    end_turn: 0,
    pass: -12,
  });
  const TECH_TYPE_SCORES = Object.freeze({ orange: 8, purple: 7, blue: 6 });
  const TECH_BONUS_SCORES = Object.freeze({ bonus_3f: 2, bonus_1c: 5, bonus_1p: 4, bonus_1m: 2 });
  const OPTIONAL_NEGATIVE_TOKENS = Object.freeze(["cancel", "skip", "decline", "跳过", "取消", "放弃"]);

  function finiteNumber(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function getVisiblePlayer(context) {
    const publicPlayers = context?.observation?.publicState?.players || [];
    return publicPlayers.find((player) => (
      player?.playerId === context.seatId || player?.id === context.seatId
    )) || null;
  }

  function getVisibleCard(context, action) {
    const payload = action?.payload || {};
    const target = action?.target || {};
    const cards = [
      ...(context?.observation?.selfState?.hand || []),
      ...(context?.observation?.publicState?.board?.publicCards || []),
    ];
    const wantedInstanceId = payload.cardInstanceId || target.cardInstanceId || null;
    const wantedCardId = payload.cardId || target.cardId || null;
    if (wantedInstanceId || wantedCardId) {
      return cards.find((card) => (
        (wantedInstanceId && (card?.id === wantedInstanceId || card?.cardInstanceId === wantedInstanceId))
        || (wantedCardId && card?.cardId === wantedCardId)
      )) || null;
    }
    const handIndex = finiteNumber(payload.handIndex ?? target.handIndex);
    return Number.isInteger(handIndex) ? context?.observation?.selfState?.hand?.[handIndex] || null : null;
  }

  function getVisibleTech(context, action) {
    const tileId = action?.target?.tileId || action?.target?.techTileId
      || action?.payload?.tileId || action?.payload?.techTileId || null;
    if (!tileId) return null;
    return context?.observation?.publicState?.board?.techSupply?.stacks?.[tileId] || { tileId };
  }

  function evaluateAction(context, action) {
    const payloadValue = finiteNumber(action?.payload?.value);
    const evaluation = { score: payloadValue ?? 0 };
    if (action?.family === "play_card" || action?.family === "choose_card") {
      const card = getVisibleCard(context, action);
      if (card) {
        evaluation.cardId = card.cardId || card.id || null;
        evaluation.price = finiteNumber(card.price) ?? 0;
      } else {
        evaluation.price = finiteNumber(action?.payload?.price ?? action?.target?.price) ?? 0;
      }
    }
    if (action?.family === "research_tech") {
      const tech = getVisibleTech(context, action);
      if (tech) {
        evaluation.tileId = tech.tileId || action?.target?.tileId || null;
        evaluation.techType = tech.techType || null;
        evaluation.stackIndex = finiteNumber(tech.stackIndex) ?? 0;
        evaluation.bonusId = tech.bonusId || null;
        evaluation.firstTake = tech.firstTakeClaimedBy == null;
      }
    }
    const player = getVisiblePlayer(context);
    return Object.freeze({
      ...evaluation,
      roundNumber: finiteNumber(context?.observation?.publicState?.roundNumber) ?? 1,
      resources: player ? Object.freeze({
        credits: finiteNumber(player.credits ?? player.resources?.credits) ?? 0,
        energy: finiteNumber(player.energy ?? player.resources?.energy) ?? 0,
        publicity: finiteNumber(player.publicity ?? player.resources?.publicity) ?? 0,
        availableData: finiteNumber(player.availableData ?? player.resources?.availableData) ?? 0,
      }) : null,
    });
  }

  function getTechType(tileId) {
    return String(tileId || "").match(/^(orange|purple|blue)(\d)$/)?.[1] || null;
  }

  function getTechStackIndex(tileId) {
    const match = String(tileId || "").match(/^(orange|purple|blue)(\d)$/);
    return match ? Number(match[2]) : 0;
  }

  function scoreTech(item) {
    const explicitScore = finiteNumber(item?.score);
    if (explicitScore != null) return explicitScore;
    const tileId = typeof item === "string" ? item : item?.tileId;
    const techType = item?.techType || getTechType(tileId);
    const stackIndex = item?.stackIndex ?? getTechStackIndex(tileId);
    return (TECH_TYPE_SCORES[techType] || 0)
      + (TECH_BONUS_SCORES[item?.bonusId] || 0)
      + (item?.firstTake ? 2 : 0)
      + Math.max(0, 5 - stackIndex) * 0.1;
  }

  function scoreCard(item) {
    const explicitScore = finiteNumber(item?.score);
    const price = Math.max(0, Math.round(Number(item?.price) || 0));
    return (explicitScore ?? 0) + Math.max(0, 5 - price) * 0.2;
  }

  function bestScore(items, scoreFn) {
    return (items || []).reduce((best, item) => {
      const score = finiteNumber(scoreFn(item));
      return score == null ? best : Math.max(best, score);
    }, -Infinity);
  }

  function itemFamily(item) {
    return item?.standardAction?.family || item?.descriptor?.family || ({
      launch: "launch",
      orbit: "orbit",
      land: "land",
      scan: "scan",
      analyze: "analyze",
      researchTech: "research_tech",
      playCard: "play_card",
      pass: "pass",
      move: "move",
      quickTrade: "quick_trade",
      industry: "industry",
      cardCorner: "card_corner",
      placeData: "place_data",
      runezuFaceSymbol: "runezu_face_symbol",
      "end-turn": "end_turn",
    })[item?.id] || item?.family || item?.id || null;
  }

  function scoreTurnFallback(item) {
    if (!item) return -Infinity;
    const family = itemFamily(item);
    const explicitScore = finiteNumber(item.score);
    let valueScore = explicitScore ?? 0;
    if (family === "research_tech") {
      const score = bestScore(item.takeable || [], scoreTech);
      if (Number.isFinite(score)) valueScore = Math.max(valueScore, score);
    }
    if (family === "play_card") {
      const score = bestScore(item.playableCards || [], scoreCard);
      if (Number.isFinite(score)) valueScore = Math.max(valueScore, score);
    }
    return (TURN_ACTION_SCORES[family] ?? 0) + valueScore;
  }

  function scoreTurnPrimary(item) {
    const graphNet = finiteNumber(item?.actionGraph?.net ?? item?.net);
    return graphNet == null ? scoreTurnFallback(item) : graphNet;
  }

  function selectScoredItem(items = [], options = {}) {
    const mode = options.mode || "turn";
    const available = items.filter((item) => item?.available !== false);
    return available
      .map((item, index) => ({
        item,
        index,
        primary: mode === "card" ? scoreCard(item) : scoreTurnPrimary(item),
        fallback: mode === "card" ? scoreCard(item) : scoreTurnFallback(item),
      }))
      .sort((left, right) => (
        Number(right.primary || 0) - Number(left.primary || 0)
        || Number(right.fallback || 0) - Number(left.fallback || 0)
        || left.index - right.index
      ))[0]?.item || null;
  }

  function optionalChoicePenalty(action) {
    const text = `${action.summary || ""} ${stableSerialize(action.target || {})}`.toLowerCase();
    return OPTIONAL_NEGATIVE_TOKENS.some((token) => text.includes(token)) ? -1000 : 0;
  }

  function numericChoiceScore(action) {
    const value = [
      action.payload?.value,
      action.payload?.amount,
      action.payload?.gain,
      action.target?.value,
      action.target?.amount,
    ].map(finiteNumber).find((candidate) => candidate != null);
    return value == null ? 0 : value;
  }

  function selectLegalAction(context, options = {}) {
    const evaluate = options.evaluateAction || evaluateAction;
    const weights = options.strategyWeights || {};
    const enabled = context.legalActions
      .map((action, index) => ({ action, index, weight: weights[action.family] ?? 1 }))
      .filter((entry) => entry.weight > 0 && (options.isFeasible?.(context, entry.action) ?? true));
    if (!enabled.length) return null;
    const conditional = enabled.every((entry) => entry.action.phase === "conditional");
    if (conditional) {
      const preferredCards = new Set();
      const cardEntries = enabled.filter((entry) => entry.action.family === "choose_card");
      if (cardEntries.length) {
        const preferred = cardEntries
          .map((entry) => ({
            entry,
            evaluation: { ...entry.action.payload, ...entry.action.target },
          }))
          .sort((left, right) => scoreCard(right.evaluation) - scoreCard(left.evaluation) || left.entry.index - right.entry.index)[0];
        if (preferred) preferredCards.add(preferred.entry.action.actionId);
      }
      return enabled
        .map((entry) => ({
          ...entry,
          score: optionalChoicePenalty(entry.action)
            + numericChoiceScore(entry.action)
            + (preferredCards.has(entry.action.actionId) ? 100 : 0),
        }))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.action || null;
    }
    return enabled
      .map((entry) => {
        const evaluation = evaluate(context, entry.action) || {};
        const weightedEvaluation = { ...evaluation, score: (finiteNumber(evaluation.score) ?? 0) * entry.weight };
        return {
          ...entry,
          primary: scoreTurnPrimary({ ...weightedEvaluation, family: entry.action.family }),
          fallback: scoreTurnFallback({ ...weightedEvaluation, family: entry.action.family }),
        };
      })
      .sort((left, right) => (
        right.primary - left.primary
        || right.fallback - left.fallback
        || left.index - right.index
      ))[0]?.action || null;
  }

  function standardActionMatchesCandidate(standardAction, candidate) {
    const target = standardAction?.target || {};
    const payload = standardAction?.payload || {};
    const expected = {
      rocketId: candidate.rocketId,
      planetId: candidate.planetId,
      tileId: candidate.tileId,
      blueSlot: candidate.blueSlot,
      tradeId: candidate.tradeId,
      cardInstanceId: candidate.cardInstanceId || candidate.cardId,
      companyLabel: candidate.companyLabel || candidate.industryCard?.label,
      deltaX: candidate.deltaX,
      deltaY: candidate.deltaY,
      alienSlotId: candidate.alienSlotId,
      position: candidate.position,
      symbolId: candidate.symbolId,
    };
    if (candidate.id === "placeData" && candidate.target != null) expected.target = candidate.target;
    return Object.entries(expected).every(([key, value]) => (
      value == null || target[key] === value || payload[key] === value
    ));
  }

  function attachStandardDescriptors(candidates = [], standardActions = []) {
    return candidates.flatMap((candidate) => {
      const family = itemFamily(candidate);
      if (!family || candidate.available === false) return [candidate];
      const familyActions = standardActions.filter((action) => action.family === family);
      const matched = familyActions.filter((action) => standardActionMatchesCandidate(action, candidate));
      const descriptors = matched.length ? matched : familyActions;
      return descriptors.map((standardAction) => ({
        ...candidate,
        family,
        actionId: standardAction.actionId,
        standardAction: structuredClone(standardAction),
      }));
    });
  }

  function buildTurnDescriptorEvaluations(input = {}, dependencies = {}) {
    const rawCandidates = input.rawCandidates || [];
    const currentPlayer = input.currentPlayer || null;
    const markedFinalFormulas = input.markedFinalFormulas || [];
    const graphCandidates = dependencies.actionGraph?.buildActionGraph
      ? dependencies.actionGraph.buildActionGraph(
        rawCandidates,
        input.graphState || {},
        currentPlayer?.id || null,
        {
          markedFormulas: markedFinalFormulas,
          hasMarkedFinalTile: markedFinalFormulas.length > 0,
          traceCompetition: input.traceCompetition || null,
        },
      )
      : null;
    const adjusted = Array.isArray(graphCandidates) && graphCandidates.length === rawCandidates.length
      ? graphCandidates.map((candidate, index) => {
        const value = dependencies.adjustForStyle(
          rawCandidates[index],
          dependencies.adjust(rawCandidates[index], candidate, currentPlayer),
          currentPlayer,
          markedFinalFormulas,
        );
        return {
          ...rawCandidates[index],
          actionGraph: {
            gain: value.gain,
            cost: value.cost,
            finalMarginal: value.finalMarginal,
            goalBonus: value.goalBonus,
            feasibility: value.feasibility,
            net: value.net,
          },
          breakdown: value.breakdown,
        };
      })
      : rawCandidates;
    const described = Array.isArray(input.standardActions)
      ? attachStandardDescriptors(adjusted, input.standardActions)
      : adjusted;
    const candidates = dependencies.applySelectionPressure(described);
    const select = dependencies.selectScoredItem || selectScoredItem;
    return Object.freeze({ candidates, selectedAction: select(candidates) });
  }

  return Object.freeze({
    TURN_ACTION_SCORES,
    evaluateAction,
    selectLegalAction,
    selectScoredItem,
    buildTurnDescriptorEvaluations,
    standardActionMatchesCandidate,
    attachStandardDescriptors,
  });
});
