(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiOutcomeModel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const OBSERVATION_SCHEMA_VERSION = "seti-decision-observation-v1";
  const OUTCOME_SCHEMA_VERSION = "seti-action-outcome-v1";
  const PROJECTION_SCHEMA_VERSION = "seti-outcome-projection-v1";
  const REWARD_SCHEMA_VERSION = "seti-outcome-reward-v1";
  const VALUE_SCHEMA_VERSION = "seti-outcome-value-v1";
  const OUTCOME_STATUSES = Object.freeze(new Set([
    "settled", "unresolved", "failed", "stale",
  ]));
  const OUTCOME_CONFIDENCES = Object.freeze(new Set(["high", "low", "none"]));
  const ASSET_PATHS = Object.freeze({
    credits: "outcomeProjection.assets.credits",
    energy: "outcomeProjection.assets.energy",
    availableData: "outcomeProjection.assets.availableData",
    publicity: "outcomeProjection.assets.publicity",
    additionalPublicScan: "outcomeProjection.assets.additionalPublicScan",
    ordinaryCard: "outcomeProjection.assets.ordinaryCards",
    alienCard: "outcomeProjection.assets.alienCards",
  });

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function finiteOrNull(value) {
    if (value == null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function count(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return finiteOrNull(value);
  }

  function findPlayer(source, seatId) {
    const publicPlayers = source?.publicState?.players;
    if (Array.isArray(publicPlayers)) {
      return publicPlayers.find((player) => (
        String(player?.playerId ?? player?.id) === String(seatId)
      )) || null;
    }
    if (publicPlayers && typeof publicPlayers === "object") {
      return publicPlayers[seatId] || Object.values(publicPlayers).find((player) => (
        String(player?.playerId ?? player?.id) === String(seatId)
      )) || null;
    }
    const players = source?.players;
    if (Array.isArray(players)) {
      return players.find((player) => String(player?.playerId ?? player?.id) === String(seatId)) || null;
    }
    return players?.[seatId] || Object.values(players || {}).find((player) => (
      String(player?.playerId ?? player?.id) === String(seatId)
    )) || null;
  }

  function publicStateOf(source) {
    if (source?.publicState) return clone(source.publicState);
    return {
      match: clone(source?.match || {}),
      board: clone(source?.board || {}),
      players: clone(source?.players || {}),
      tech: clone(source?.tech || {}),
      aliens: clone(source?.aliens || {}),
    };
  }

  function selfStateOf(source, seatId, publicPlayer) {
    const sourceSelfId = source?.selfState?.playerId
      ?? source?.selfState?.id
      ?? source?.perspectivePlayerId;
    if (source?.selfState && String(sourceSelfId) === String(seatId)) {
      return clone(source.selfState);
    }
    const cards = source?.cards || {};
    return {
      playerId: seatId,
      player: clone(publicPlayer || null),
      hand: clone(cards.hand || []),
      reservedCards: clone(cards.reserved || []),
    };
  }

  function countAlienCards(selfState) {
    const privateCount = count(selfState?.privateAlienCards) ?? 0;
    const handCount = (selfState?.hand || []).filter((card) => (
      card?.kind === "alien" || card?.alienId != null || card?.speciesId != null
    )).length;
    return privateCount + handCount;
  }

  function countOrdinaryCards(selfState, publicPlayer) {
    if (Array.isArray(selfState?.hand)) {
      return selfState.hand.filter((card) => (
        card?.kind !== "alien" && card?.alienId == null && card?.speciesId == null
      )).length;
    }
    return finiteOrNull(publicPlayer?.handCount) ?? 0;
  }

  function countTech(publicPlayer) {
    const source = publicPlayer?.techState?.ownedTiles
      ?? publicPlayer?.tech
      ?? publicPlayer?.techState;
    if (Array.isArray(source)) return source.length;
    if (source && typeof source === "object") {
      return Object.values(source).reduce((total, value) => (
        total + (Array.isArray(value) ? value.length : (value ? 1 : 0))
      ), 0);
    }
    return finiteOrNull(publicPlayer?.techCount) ?? 0;
  }

  function countPlayerTraces(source, seatId) {
    const aliens = source?.publicState?.board?.aliens
      ?? source?.publicState?.aliens
      ?? source?.aliens
      ?? {};
    const slots = Array.isArray(aliens?.slots)
      ? aliens.slots
      : Object.values(aliens?.slots || aliens?.aliens || {});
    let traceCount = 0;
    let alienContacts = 0;
    for (const slot of slots) {
      const traces = slot?.traces || {};
      const own = Array.isArray(traces)
        ? traces.filter((trace) => String(trace?.playerId ?? trace?.ownerId) === String(seatId)).length
        : finiteOrNull(traces[seatId]) ?? 0;
      traceCount += own;
      if (own > 0 && slot?.revealed !== false) alienContacts += 1;
    }
    return { traceCount, alienContacts };
  }

  function createOutcomeProjection(source, seatId) {
    const publicPlayer = findPlayer(source, seatId);
    const selfState = selfStateOf(source, seatId, publicPlayer);
    const resources = publicPlayer?.resources || publicPlayer || selfState?.player?.resources || {};
    const terminal = Boolean(
      source?.terminal
      ?? source?.publicState?.terminal
      ?? source?.publicState?.match?.terminal
      ?? source?.match?.terminal,
    );
    const realizedScore = finiteOrNull(resources.score ?? publicPlayer?.score) ?? 0;
    const officialTerminalScore = terminal
      ? (finiteOrNull(publicPlayer?.finalScore) ?? realizedScore)
      : null;
    const traces = countPlayerTraces(source, seatId);
    return deepFreeze({
      schemaVersion: PROJECTION_SCHEMA_VERSION,
      viewerSeatId: String(seatId),
      terminal,
      scoring: {
        realizedScore,
        officialTerminalScore,
        sourcePath: officialTerminalScore == null
          ? "publicState.players[viewer].score"
          : (publicPlayer?.finalScore == null
            ? "publicState.players[viewer].score@committed-terminal"
            : "publicState.players[viewer].finalScore"),
      },
      assets: {
        credits: finiteOrNull(resources.credits) ?? 0,
        energy: finiteOrNull(resources.energy) ?? 0,
        availableData: finiteOrNull(resources.availableData) ?? 0,
        publicity: finiteOrNull(resources.publicity) ?? 0,
        additionalPublicScan: finiteOrNull(resources.additionalPublicScan) ?? 0,
        ordinaryCards: countOrdinaryCards(selfState, publicPlayer),
        alienCards: countAlienCards(selfState),
      },
      progress: {
        techCount: countTech(publicPlayer),
        traceCount: traces.traceCount,
        alienContacts: traces.alienContacts,
      },
    });
  }

  function createDecisionObservation(source, options = {}) {
    const seatId = String(options.seatId ?? source?.perspectivePlayerId ?? source?.viewer?.playerId ?? "");
    if (!seatId) throw new TypeError("Decision observation 缺少 viewer seatId");
    return deepFreeze({
      schemaVersion: OBSERVATION_SCHEMA_VERSION,
      viewer: { seatId },
      authority: {
        stateVersion: options.stateVersion ?? source?.source?.stateVersion ?? null,
        decisionVersion: options.decisionVersion ?? source?.decision?.decisionVersion ?? null,
      },
      publicState: publicStateOf(source),
      selfState: selfStateOf(source, seatId, findPlayer(source, seatId)),
      outcomeProjection: createOutcomeProjection(source, seatId),
    });
  }

  function projectOutcomeObservations(outcomes, options = {}) {
    return deepFreeze((outcomes || []).map((outcome) => ({
      ...clone(outcome),
      rootObservation: createDecisionObservation(outcome.rootObservation, options),
      leaves: (outcome.leaves || []).map((leaf) => ({
        ...clone(leaf),
        observation: createDecisionObservation(leaf.observation, options),
      })),
    })));
  }

  function assertOutcomeSet(outcomes, legalActions) {
    if (!Array.isArray(outcomes)) throw new TypeError("actionOutcomes 必须是数组");
    const legalIds = (legalActions || []).map((action) => action.actionId).sort();
    const outcomeIds = outcomes.map((outcome) => outcome?.actionId).sort();
    if (JSON.stringify(legalIds) !== JSON.stringify(outcomeIds)) {
      throw new TypeError("actionOutcomes 必须与 legalActions 逐 actionId 完整对齐");
    }
    for (const outcome of outcomes) {
      if (outcome?.schemaVersion !== OUTCOME_SCHEMA_VERSION) {
        throw new TypeError(`action outcome schema 不支持: ${outcome?.schemaVersion || "<missing>"}`);
      }
      if (!OUTCOME_STATUSES.has(outcome.status) || !OUTCOME_CONFIDENCES.has(outcome.confidence)) {
        throw new TypeError(`action outcome status/confidence 非法: ${outcome.status}/${outcome.confidence}`);
      }
      if (outcome.rootObservation?.schemaVersion !== OBSERVATION_SCHEMA_VERSION) {
        throw new TypeError("action outcome root 必须使用标准 Decision observation");
      }
      for (const leaf of outcome.leaves || []) {
        if (leaf?.observation?.schemaVersion !== OBSERVATION_SCHEMA_VERSION) {
          throw new TypeError("action outcome leaf 必须使用标准 Decision observation");
        }
      }
    }
    return outcomes;
  }

  function createReward(rootObservation, leafObservation) {
    const before = rootObservation?.outcomeProjection;
    const after = leafObservation?.outcomeProjection;
    if (before?.schemaVersion !== PROJECTION_SCHEMA_VERSION
      || after?.schemaVersion !== PROJECTION_SCHEMA_VERSION
      || before.viewerSeatId !== after.viewerSeatId) {
      throw new TypeError("Reward 需要同 viewer 的标准 root/leaf outcome projection");
    }
    const facts = [];
    const addFact = (path, beforeValue, afterValue) => facts.push({
      path,
      before: beforeValue,
      after: afterValue,
      delta: Number(afterValue || 0) - Number(beforeValue || 0),
    });
    addFact("outcomeProjection.scoring.realizedScore", before.scoring.realizedScore, after.scoring.realizedScore);
    for (const path of Object.values(ASSET_PATHS)) {
      const keys = path.split(".").slice(1);
      const read = (projection) => keys.reduce((value, key) => value?.[key], projection);
      addFact(path, read(before), read(after));
    }
    return deepFreeze({
      schemaVersion: REWARD_SCHEMA_VERSION,
      viewerSeatId: before.viewerSeatId,
      rootProjectionVersion: before.schemaVersion,
      leafProjectionVersion: after.schemaVersion,
      terminal: after.terminal,
      facts,
      immediateScoreDelta: after.scoring.realizedScore - before.scoring.realizedScore,
      terminalScoreDelta: after.terminal
        ? after.scoring.officialTerminalScore - (before.scoring.officialTerminalScore ?? before.scoring.realizedScore)
        : 0,
      resourceDelta: {
        credits: after.assets.credits - before.assets.credits,
        energy: after.assets.energy - before.assets.energy,
        publicity: after.assets.publicity - before.assets.publicity,
        availableData: after.assets.availableData - before.assets.availableData,
        additionalPublicScan: after.assets.additionalPublicScan - before.assets.additionalPublicScan,
        handCount: (after.assets.ordinaryCards + after.assets.alienCards)
          - (before.assets.ordinaryCards + before.assets.alienCards),
      },
      shaping: {},
    });
  }

  return Object.freeze({
    OBSERVATION_SCHEMA_VERSION,
    OUTCOME_SCHEMA_VERSION,
    PROJECTION_SCHEMA_VERSION,
    REWARD_SCHEMA_VERSION,
    VALUE_SCHEMA_VERSION,
    ASSET_PATHS,
    createOutcomeProjection,
    createDecisionObservation,
    projectOutcomeObservations,
    assertOutcomeSet,
    createReward,
  });
});
