(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAICandidatePipeline = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const STANDARD_FAMILY_BY_AI_ACTION_ID = Object.freeze({
    launch: "launch",
    orbit: "orbit",
    land: "land",
    researchTech: "research_tech",
    scan: "scan",
    analyze: "analyze",
    playCard: "play_card",
    pass: "pass",
    move: "move",
    quickTrade: "quick_trade",
    industry: "industry",
    cardCorner: "card_corner",
    placeData: "place_data",
    runezuFaceSymbol: "runezu_face_symbol",
    "end-turn": "end_turn",
  });

  function standardActionMatchesAiCandidate(standardAction, candidate) {
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

  function attachStandardActionDescriptors(candidates = [], standardActions = []) {
    return candidates.flatMap((candidate) => {
      const family = STANDARD_FAMILY_BY_AI_ACTION_ID[candidate.id];
      if (!family || candidate.available === false) return [candidate];
      const familyActions = standardActions.filter((action) => action.family === family);
      const matched = familyActions.filter((action) => standardActionMatchesAiCandidate(action, candidate));
      const descriptors = matched.length ? matched : familyActions;
      return descriptors.map((standardAction) => ({
        ...candidate,
        standardAction: structuredClone(standardAction),
      }));
    });
  }

  function buildCandidatePipeline(input = {}, dependencies = {}) {
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
    const graphAdjustedCandidates = Array.isArray(graphCandidates)
      && graphCandidates.length === rawCandidates.length
      ? graphCandidates.map((candidate, index) => {
        const adjusted = dependencies.adjustForStyle(
          rawCandidates[index],
          dependencies.adjust(rawCandidates[index], candidate, currentPlayer),
          currentPlayer,
          markedFinalFormulas,
        );
        return {
          ...rawCandidates[index],
          actionGraph: {
            gain: adjusted.gain,
            cost: adjusted.cost,
            finalMarginal: adjusted.finalMarginal,
            goalBonus: adjusted.goalBonus,
            feasibility: adjusted.feasibility,
            net: adjusted.net,
          },
          breakdown: adjusted.breakdown,
        };
      })
      : rawCandidates;
    const withDescriptors = Array.isArray(input.standardActions)
      ? attachStandardActionDescriptors(graphAdjustedCandidates, input.standardActions)
      : graphAdjustedCandidates;
    const candidates = dependencies.applySelectionPressure(withDescriptors);
    const selectedAction = dependencies.policy?.chooseTurnAction?.(candidates, {
      playerState: input.graphState?.playerState,
      turnState: input.graphState?.turnState,
      currentPlayer,
    }) || null;
    return Object.freeze({ candidates, selectedAction });
  }

  return Object.freeze({
    STANDARD_FAMILY_BY_AI_ACTION_ID,
    standardActionMatchesAiCandidate,
    attachStandardActionDescriptors,
    buildCandidatePipeline,
  });
});
