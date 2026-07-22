"use strict";

const ACTION_SCHEMA_VERSION = "seti-rl-action-v2";
const OBSERVATION_SCHEMA_VERSION = "seti-rl-observation-v1";

const TURN_ACTION_FAMILIES = Object.freeze([
  "launch", "orbit", "land", "scan", "analyze", "research_tech", "play_card", "pass",
  "move", "quick_trade", "industry", "card_corner", "place_data", "runezu_face_symbol", "end_turn",
]);

const CONDITIONAL_FAMILIES = Object.freeze([
  "choose_card", "choose_target", "choose_payment", "choose_reward", "choose_branch",
  "choose_final_scoring", "accept_optional_effect",
]);

const ACTION_FAMILY_INDEX = Object.freeze(Object.fromEntries(
  [...TURN_ACTION_FAMILIES, ...CONDITIONAL_FAMILIES].map((family, index) => [family, index]),
));

const ACTION_COVERAGE_MATRIX = Object.freeze(TURN_ACTION_FAMILIES.map((family) => Object.freeze({
  family,
  source: "standard_action_descriptor",
  characterization: "shared_registry_enumeration_and_prevalidated_execution",
})));

const CONDITIONAL_COVERAGE_MATRIX = Object.freeze(CONDITIONAL_FAMILIES.map((family) => Object.freeze({
  family,
  characterization: "semantic_decision_boundary",
})));

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item != null));
}

function normalizeTurnCandidate(candidate, actorPlayerId) {
  const standardAction = candidate?.standardAction
    || (candidate?.schemaVersion === "seti-standard-action-v1" ? candidate : null);
  if (
    standardAction
    && standardAction.schemaVersion === "seti-standard-action-v1"
    && TURN_ACTION_FAMILIES.includes(standardAction.family)
    && standardAction.phase !== "conditional"
  ) {
    const family = standardAction.family;
    const target = clone(standardAction.target || undefined);
    const payload = clone(standardAction.payload || undefined);
    return compactObject({
      schemaVersion: ACTION_SCHEMA_VERSION,
      actionId: standardAction.actionId,
      actorPlayerId: standardAction.actorId || actorPlayerId,
      decisionType: "turn_action",
      family,
      target,
      payload,
      actionFeature: {
        familyIndex: ACTION_FAMILY_INDEX[family],
        phase: standardAction.phase,
        hasTarget: Boolean(target && Object.keys(target).length),
        hasPayload: Boolean(payload && Object.keys(payload).length),
      },
      summary: standardAction.summary || family,
    });
  }
  return null;
}

function normalizeConditionalCandidate(candidate, actorPlayerId) {
  const standardAction = candidate?.standardAction
    || (candidate?.schemaVersion === "seti-standard-action-v1" ? candidate : null);
  if (
    standardAction
    && standardAction.schemaVersion === "seti-standard-action-v1"
    && CONDITIONAL_FAMILIES.includes(standardAction.family)
    && standardAction.phase === "conditional"
  ) {
    const family = standardAction.family;
    const target = clone(standardAction.target || undefined);
    const payload = clone(standardAction.payload || undefined);
    if (target?.kind === "discard-hand-cards" && target.handIndexes?.length === 1) {
      target.handIndex = target.handIndexes[0];
      target.cardId = target.cardIds?.[0] || null;
    }
    return compactObject({
      schemaVersion: ACTION_SCHEMA_VERSION,
      actionId: standardAction.actionId,
      actorPlayerId: standardAction.actorId || actorPlayerId,
      decisionType: "conditional_choice",
      family,
      target,
      payload,
      actionFeature: {
        familyIndex: ACTION_FAMILY_INDEX[family],
        phase: "conditional",
        hasTarget: Boolean(target && Object.keys(target).length),
        hasPayload: Boolean(payload && Object.keys(payload).length),
      },
      summary: standardAction.summary || family,
    });
  }
  return null;
}

function sanitizeCard(card) {
  if (!card || typeof card !== "object") return null;
  return compactObject({
    id: card.id,
    cardId: card.cardId,
    set: card.set,
    cardName: card.cardName,
    price: card.price,
    cardTypeCode: card.cardTypeCode,
    discardActionCode: card.discardActionCode,
    scanActionCode: card.scanActionCode,
    incomeCode: card.incomeCode,
    faceUp: card.faceUp,
  });
}

function sanitizePublicPlayer(player, finalScoreSummary) {
  const resources = player?.resources || {};
  const summary = finalScoreSummary && typeof finalScoreSummary === "object"
    ? finalScoreSummary
    : { totalScore: finalScoreSummary };
  return {
    playerId: player?.id || null,
    color: player?.color || null,
    playerLabel: player?.colorLabel || player?.name || player?.id || null,
    score: Number(resources.score) || 0,
    finalScore: summary.totalScore ?? null,
    scoreBreakdown: summary.breakdown ? clone(summary.breakdown) : null,
    scoreSources: summary.breakdown ? clone(player?.scoreSources || {}) : null,
    credits: Number(resources.credits) || 0,
    energy: Number(resources.energy) || 0,
    publicity: Number(resources.publicity) || 0,
    availableData: Number(resources.availableData) || 0,
    additionalPublicScan: Number(resources.additionalPublicScan) || 0,
    handCount: Array.isArray(player?.hand)
      ? player.hand.length
      : Math.max(0, Math.round(Number(player?.handCount) || 0)),
    reservedCount: Array.isArray(player?.reservedCards)
      ? player.reservedCards.length
      : Math.max(0, Math.round(Number(player?.reservedCount) || 0)),
    completedTaskCount: Object.values(player?.taskState || {}).filter(Boolean).length,
    techState: clone(player?.techState || {}),
    passed: Boolean(player?.passed),
  };
}

function sanitizeSelfPlayer(player) {
  if (!player) return null;
  return compactObject({
    playerId: player.id,
    hand: (player.hand || []).map(sanitizeCard),
    reservedCards: (player.reservedCards || []).map(sanitizeCard),
    industryId: player.industryId,
    industryCardId: player.industryCardId,
    industryAbilityUsed: player.industryAbilityUsed,
    privateAlienCards: clone(player.alienCards || player.privateAlienCards || []),
    taskState: clone(player.taskState || {}),
    oneTimeAbilities: clone(player.oneTimeAbilities || {}),
  });
}

function sanitizeAlienPublicState(state) {
  if (!state || typeof state !== "object") return {};
  const slots = Object.values(state.aliens || state.slots || state.alienSlots || {}).map((slot) => ({
    revealed: Boolean(slot?.revealed),
    alienId: slot?.revealed ? (slot.alienId || slot.assignedAlienId || null) : null,
    traces: clone(slot?.traces || {}),
  }));
  return { slots };
}

function sanitizeTechSupply(state) {
  const stacks = state?.board?.stacks || {};
  return {
    stacks: Object.fromEntries(Object.entries(stacks).map(([tileId, stack]) => [tileId, compactObject({
      tileId: stack?.tileId || tileId,
      techType: stack?.techType,
      stackIndex: stack?.stackIndex,
      bonusId: stack?.bonusId,
      remaining: stack?.remaining,
      firstTakeClaimedBy: stack?.firstTakeClaimedBy,
      depleted: stack?.depleted,
    })])),
  };
}

function sanitizeFinalScoringState(state) {
  if (!state || typeof state !== "object") return {};
  return compactObject({
    tiles: clone(state.tiles || state.boards || []),
    marks: clone(state.marks || state.playerMarks || {}),
    pendingMarks: clone(state.pendingMarks || []),
  });
}

function containsForbiddenObservationKey(value) {
  const forbidden = /^(score|net|actionGraph|plannerShadow|recoverySnapshot|drawPileCardIds|deck|ui|overlay|dataset|hover|selected|highlight)$/i;
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, item] of Object.entries(current)) {
      if (forbidden.test(key) && key !== "score") return key;
      if (item && typeof item === "object") stack.push(item);
    }
  }
  return null;
}

module.exports = {
  ACTION_SCHEMA_VERSION,
  OBSERVATION_SCHEMA_VERSION,
  TURN_ACTION_FAMILIES,
  CONDITIONAL_FAMILIES,
  ACTION_FAMILY_INDEX,
  ACTION_COVERAGE_MATRIX,
  CONDITIONAL_COVERAGE_MATRIX,
  normalizeTurnCandidate,
  normalizeConditionalCandidate,
  sanitizeCard,
  sanitizePublicPlayer,
  sanitizeSelfPlayer,
  sanitizeAlienPublicState,
  sanitizeTechSupply,
  sanitizeFinalScoringState,
  containsForbiddenObservationKey,
};
