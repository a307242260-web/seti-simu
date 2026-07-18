"use strict";

const crypto = require("node:crypto");

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

const LEGACY_FAMILY_BY_ID = Object.freeze({
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
});

const ACTION_FAMILY_INDEX = Object.freeze(Object.fromEntries(
  [...TURN_ACTION_FAMILIES, ...CONDITIONAL_FAMILIES].map((family, index) => [family, index]),
));

const ACTION_COVERAGE_MATRIX = Object.freeze(TURN_ACTION_FAMILIES.map((family) => Object.freeze({
  family,
  legacyId: Object.keys(LEGACY_FAMILY_BY_ID).find((id) => LEGACY_FAMILY_BY_ID[id] === family),
  characterization: "headless_rule_enumeration_and_prevalidated_execution",
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

function normalizeTarget(target) {
  if (target == null) return undefined;
  if (typeof target !== "object") return { choiceId: String(target) };
  const allowed = [
    "cardId", "handIndex", "publicCardSlot", "rocketId", "planetId", "satelliteId",
    "sectorX", "sectorY", "nebulaId", "techTileId", "techSlotId", "traceType", "choiceId",
    "kind", "row", "column", "slotId", "direction", "x", "y",
  ];
  return compactObject(Object.fromEntries(allowed.map((key) => [key, clone(target[key])])));
}

function normalizePayload(candidate) {
  return compactObject({
    tradeId: candidate.tradeId,
    cardId: candidate.cardId,
    cardInstanceId: candidate.cardInstanceId,
    handIndex: candidate.handIndex,
    blueSlot: candidate.blueSlot,
    placementSlot: candidate.placementSlot,
    rocketId: candidate.rocketId,
    planetId: candidate.planetId,
    direction: candidate.direction,
    deltaX: candidate.deltaX,
    deltaY: candidate.deltaY,
    requiredMovePoints: candidate.requiredMovePoints,
    alienSlotId: candidate.alienSlotId,
    position: candidate.position,
    symbolId: candidate.symbolId,
    preserveHandIndex: candidate.preserveHandIndex,
    sourceActionType: candidate.kind,
  });
}

function stableActionId(actorPlayerId, family, target, payload) {
  const body = JSON.stringify({ actorPlayerId, family, target: target || null, payload: payload || {} });
  return `${family}:${crypto.createHash("sha256").update(body).digest("hex").slice(0, 16)}`;
}

function normalizeTurnCandidate(candidate, actorPlayerId) {
  const standardAction = candidate?.standardAction
    || (candidate?.schemaVersion === "seti-standard-action-v1" ? candidate : null);
  if (standardAction && TURN_ACTION_FAMILIES.includes(standardAction.family)) {
    const family = standardAction.family;
    const target = clone(standardAction.target || undefined);
    const legacyId = Object.keys(LEGACY_FAMILY_BY_ID)
      .find((id) => LEGACY_FAMILY_BY_ID[id] === family);
    const payload = compactObject({
      ...(clone(standardAction.payload || {})),
      sourceActionType: legacyId,
    });
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
  const family = LEGACY_FAMILY_BY_ID[candidate?.id];
  if (!family) return null;
  const target = normalizeTarget(candidate.target);
  const payload = normalizePayload(candidate);
  return compactObject({
    schemaVersion: ACTION_SCHEMA_VERSION,
    actionId: stableActionId(actorPlayerId, family, target, payload),
    actorPlayerId,
    decisionType: "turn_action",
    family,
    target,
    payload: Object.keys(payload).length ? payload : undefined,
    actionFeature: {
      familyIndex: ACTION_FAMILY_INDEX[family],
      phase: family === "end_turn" ? "turn_control" : TURN_ACTION_FAMILIES.indexOf(family) >= 8 ? "quick" : "main",
      hasTarget: Boolean(target && Object.keys(target).length),
      hasPayload: Boolean(Object.keys(payload).length),
    },
    summary: candidate.label || family,
  });
}

function normalizeConditionalCandidate(candidate, actorPlayerId) {
  const standardAction = candidate?.standardAction
    || (candidate?.schemaVersion === "seti-standard-action-v1" ? candidate : null);
  if (standardAction && CONDITIONAL_FAMILIES.includes(standardAction.family)) {
    const family = standardAction.family;
    const target = clone(standardAction.target || undefined);
    const payload = clone(standardAction.payload || undefined);
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
  const family = candidate?.family;
  if (!CONDITIONAL_FAMILIES.includes(family)) return null;
  const target = normalizeTarget(candidate.target);
  const payload = normalizePayload(candidate);
  return compactObject({
    schemaVersion: ACTION_SCHEMA_VERSION,
    actionId: stableActionId(actorPlayerId, family, target, payload),
    actorPlayerId,
    decisionType: "conditional_choice",
    family,
    target,
    payload: Object.keys(payload).length ? payload : undefined,
    actionFeature: {
      familyIndex: ACTION_FAMILY_INDEX[family],
      phase: "conditional",
      hasTarget: Boolean(target && Object.keys(target).length),
      hasPayload: Boolean(Object.keys(payload).length),
    },
    summary: candidate.label || family,
  });
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
    handCount: (player?.hand || []).length,
    reservedCount: (player?.reservedCards || []).length,
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
  LEGACY_FAMILY_BY_ID,
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
