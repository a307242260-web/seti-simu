(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiOutcomeModel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const OBSERVATION_SCHEMA_VERSION = "seti-decision-observation-v2";
  const OUTCOME_SCHEMA_VERSION = "seti-action-outcome-v1";
  const PROJECTION_SCHEMA_VERSION = "seti-outcome-projection-v2";
  const REWARD_SCHEMA_VERSION = "seti-outcome-reward-v2";
  const VALUE_SCHEMA_VERSION = "seti-outcome-value-v2";
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

  function isAlienCard(card) {
    return card?.kind === "alien"
      || card?.alienId != null
      || card?.speciesId != null
      || card?.alienCardId != null
      || String(card?.set || "").startsWith("alien:");
  }

  function countAlienCards(selfState) {
    const privateCount = count(selfState?.privateAlienCards) ?? 0;
    const handCount = (selfState?.hand || []).filter(isAlienCard).length;
    return privateCount + handCount;
  }

  function countOrdinaryCards(selfState, publicPlayer) {
    if (Array.isArray(selfState?.hand)) {
      return selfState.hand.filter((card) => !isAlienCard(card)).length;
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

  function boardOf(source) {
    return source?.publicState?.board || source?.board || {};
  }

  function playerColor(publicPlayer) {
    return publicPlayer?.color || publicPlayer?.playerColor || null;
  }

  function boardRockets(source) {
    const board = boardOf(source);
    const candidates = board.rockets
      ?? board.pieces?.public
      ?? board.pieces?.rockets
      ?? source?.publicState?.resident?.pieces?.rockets
      ?? source?.resident?.pieces?.rockets
      ?? [];
    return Array.isArray(candidates) ? candidates : [];
  }

  function createProbeRoute(source, seatId, summary = null) {
    const deployedProbes = boardRockets(source)
      .filter((rocket) => (
        String(rocket?.playerId ?? rocket?.ownerId ?? "") === String(seatId)
        && rocket?.surface === "solar-board"
      ))
      .slice(0, 2)
      .map((rocket) => ({
        probeId: rocket.id,
        position: { x: Number(rocket.sectorX), y: Number(rocket.sectorY) },
      }));
    return {
      deployedProbes,
      candidate: summary ? clone(summary) : null,
      fieldPaths: {
        probes: "publicState.board.rockets",
        candidate: "standard action outcome route checkpoints",
      },
    };
  }

  function countPlayerTraces(source, seatId, publicPlayer = null) {
    const aliens = source?.publicState?.board?.aliens
      ?? source?.publicState?.aliens
      ?? source?.aliens
      ?? {};
    const slots = Array.isArray(aliens?.slots)
      ? aliens.slots
      : Object.values(aliens?.slots || aliens?.aliens || {});
    let traceCount = 0;
    let alienContacts = 0;
    const color = playerColor(publicPlayer);
    for (const slot of slots) {
      const traces = slot?.traces || {};
      const own = Array.isArray(traces)
        ? traces.filter((trace) => (
          String(trace?.playerId ?? trace?.ownerId) === String(seatId)
          || (color && trace?.ownerPlayerColor === color)
        )).length
        : Object.values(traces).reduce((total, trace) => {
          if (finiteOrNull(trace) != null) return total + (finiteOrNull(trace) || 0);
          const owned = String(trace?.playerId ?? trace?.ownerId ?? "") === String(seatId)
            || (color && trace?.ownerPlayerColor === color);
          const extra = Array.isArray(trace?.extraMarkers)
            ? trace.extraMarkers.filter((marker) => (
              String(marker?.playerId ?? marker?.ownerId ?? "") === String(seatId)
              || (color && marker?.playerColor === color)
            )).length
            : 0;
          return total + (owned && trace?.firstPlaced !== false ? 1 : 0) + extra;
        }, 0);
      traceCount += own;
      if (own > 0 && slot?.revealed !== false) alienContacts += 1;
    }
    return { traceCount, alienContacts };
  }

  function createOutcomeProjection(source, seatId, options = {}) {
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
    const traces = countPlayerTraces(source, seatId, publicPlayer);
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
        probeRoute: createProbeRoute(source, seatId, options.probeRouteSummary),
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
      outcomeProjection: createOutcomeProjection(source, seatId, options),
    });
  }

  function deltaProjection(before, after) {
    return {
      realizedScore: after.scoring.realizedScore - before.scoring.realizedScore,
      credits: after.assets.credits - before.assets.credits,
      energy: after.assets.energy - before.assets.energy,
      publicity: after.assets.publicity - before.assets.publicity,
      availableData: after.assets.availableData - before.assets.availableData,
      ordinaryCards: after.assets.ordinaryCards - before.assets.ordinaryCards,
      alienCards: after.assets.alienCards - before.assets.alienCards,
    };
  }

  function routeActionIds(checkpoint, previousLength = 0) {
    return (checkpoint?.actionChain || []).slice(previousLength);
  }

  function createProbeRouteSummary(rootObservation, checkpoints, fullActionChain) {
    if (!checkpoints.length) return null;
    const firstActionId = String(fullActionChain?.[0] || "");
    const firstFamily = firstActionId.split(":")[0];
    if (!["launch", "move", "orbit", "land"].includes(firstFamily)) return null;
    const current = checkpoints[0].observation;
    const final = checkpoints[checkpoints.length - 1].observation;
    let endpointIndex = -1;
    let previousLength = 0;
    let publicityAlongRoute = 0;
    const publicityOutcomeRefs = [];
    for (let index = 0; index < checkpoints.length; index += 1) {
      const checkpoint = checkpoints[index];
      const actionIds = routeActionIds(checkpoint, previousLength);
      previousLength = checkpoint.actionChain.length;
      const before = index === 0 ? rootObservation : checkpoints[index - 1].observation;
      const publicityDelta = checkpoint.observation.outcomeProjection.assets.publicity
        - before.outcomeProjection.assets.publicity;
      if (index > 0 && publicityDelta > 0) {
        publicityAlongRoute += publicityDelta;
        publicityOutcomeRefs.push(...actionIds);
      }
      if (actionIds.some((actionId) => (
        String(actionId).startsWith("orbit:") || String(actionId).startsWith("land:")
      ))) endpointIndex = index;
    }
    const endpoint = endpointIndex >= 0 ? checkpoints[endpointIndex] : null;
    const beforeEndpoint = endpointIndex > 0
      ? checkpoints[endpointIndex - 1].observation
      : rootObservation;
    const endpointActionId = endpoint
      ? routeActionIds(endpoint, endpointIndex > 0
        ? checkpoints[endpointIndex - 1].actionChain.length
        : 0).find((actionId) => (
        String(actionId).startsWith("orbit:") || String(actionId).startsWith("land:")
      )) || null
      : null;
    return {
      nextActionId: fullActionChain[0],
      nextActionFamily: firstFamily,
      currentOutcomeRef: checkpoints[0].actionChain.join("→"),
      routeOutcomeRef: fullActionChain.join("→"),
      endpointActionId,
      endpointKind: endpointActionId ? endpointActionId.split(":")[0] : null,
      currentDelta: deltaProjection(rootObservation.outcomeProjection, current.outcomeProjection),
      remainingRouteDelta: deltaProjection(current.outcomeProjection, final.outcomeProjection),
      publicityAlongRoute,
      publicityOutcomeRefs: publicityOutcomeRefs.slice(0, 6),
      endpointDelta: endpoint
        ? deltaProjection(beforeEndpoint.outcomeProjection, endpoint.observation.outcomeProjection)
        : null,
    };
  }

  function projectOutcomeObservations(outcomes, options = {}) {
    return deepFreeze((outcomes || []).map((outcome) => {
      const rootObservation = createDecisionObservation(outcome.rootObservation, options);
      return {
        ...clone(outcome),
        rootObservation,
        leaves: (outcome.leaves || []).map((leaf) => {
          const checkpoints = (leaf.routeCheckpoints || []).map((checkpoint) => ({
            actionId: checkpoint.actionId,
            family: checkpoint.family,
            actionChain: clone(checkpoint.actionChain || []),
            observation: createDecisionObservation(checkpoint.observation, options),
          }));
          const probeRouteSummary = createProbeRouteSummary(
            rootObservation,
            checkpoints,
            leaf.actionChain || [],
          );
          const projectedLeaf = clone(leaf);
          delete projectedLeaf.routeCheckpoints;
          return {
            ...projectedLeaf,
            observation: createDecisionObservation(leaf.observation, {
              ...options,
              probeRouteSummary,
            }),
          };
        }),
      };
    }));
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
    for (const route of ["probeRoute"]) {
      facts.push({
        path: `outcomeProjection.progress.${route}`,
        before: clone(before.progress?.[route] || null),
        after: clone(after.progress?.[route] || null),
        delta: null,
      });
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
