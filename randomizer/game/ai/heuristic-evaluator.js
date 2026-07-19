(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiHeuristicEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function finiteNumber(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
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
    const candidate = {
      score: payloadValue ?? 0,
    };
    if (action?.family === "play_card") {
      const card = getVisibleCard(context, action);
      if (card) {
        candidate.cardId = card.cardId || card.id || null;
        candidate.price = finiteNumber(card.price) ?? 0;
      }
    }
    if (action?.family === "research_tech") {
      const tech = getVisibleTech(context, action);
      if (tech) {
        candidate.tileId = tech.tileId || action?.target?.tileId || null;
        candidate.techType = tech.techType || null;
        candidate.stackIndex = finiteNumber(tech.stackIndex) ?? 0;
        candidate.bonusId = tech.bonusId || null;
        candidate.firstTake = tech.firstTakeClaimedBy == null;
      }
    }
    const player = getVisiblePlayer(context);
    return Object.freeze({
      ...candidate,
      roundNumber: finiteNumber(context?.observation?.publicState?.roundNumber) ?? 1,
      resources: player ? Object.freeze({
        credits: finiteNumber(player.credits) ?? 0,
        energy: finiteNumber(player.energy) ?? 0,
        publicity: finiteNumber(player.publicity) ?? 0,
        availableData: finiteNumber(player.availableData) ?? 0,
      }) : null,
    });
  }

  return Object.freeze({ evaluateAction });
});
