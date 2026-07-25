(function (root, factory) {
  "use strict";

  let layout = root.SetiSolarLayout;
  let planetReferenceLayout = root.SetiPlanetReferenceLayout;

  if (typeof require === "function") {
    layout = layout || require("../solar-system/layout");
    planetReferenceLayout = planetReferenceLayout || require("./planet-reference-layout");
  }

  const api = factory(layout, planetReferenceLayout);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiPlanetStats = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (layout, planetReferenceLayout) {
  "use strict";

  if (!layout) {
    throw new Error("SetiSolarLayout is required before SetiPlanetStats");
  }

  if (!planetReferenceLayout) {
    throw new Error("SetiPlanetReferenceLayout is required before SetiPlanetStats");
  }

  const PLANET_IDS = Object.freeze(Object.keys(layout.PLANETS));

  function createEmptyPlanetRecord() {
    return {
      orbitMarkers: [],
      landingMarkers: [],
      satelliteLandings: [],
    };
  }

  function createPlanetStatsState() {
    const planets = {};
    for (const planetId of PLANET_IDS) {
      planets[planetId] = createEmptyPlanetRecord();
    }
    return { planets };
  }

  function getPlanetRecord(state, planetId) {
    if (!state?.planets || !planetId) return null;
    return state.planets[planetId] || null;
  }

  function normalizePlayer(player) {
    if (!player) return null;
    return {
      id: player.id,
      color: player.color,
    };
  }

  function getPlanetMarkerDisplayLimit(planetId, kind) {
    return Math.max(0, planetReferenceLayout.getPlanetSlotCount(planetId, kind));
  }

  function projectMarker(marker, sequence, displayLimit) {
    const rewardSlot = Number(marker?.rewardSlot);
    const displaySlot = Number.isSafeInteger(rewardSlot) && rewardSlot > 0
      ? rewardSlot
      : sequence <= displayLimit
        ? sequence
        : null;
    return {
      ...marker,
      sequence,
      displayed: displaySlot != null,
      displaySlot,
    };
  }

  function canAddOrbitMarker(state, planetId) {
    const record = getPlanetRecord(state, planetId);
    if (!record) return false;
    return getPlanetMarkerDisplayLimit(planetId, "orbit") > 0;
  }

  function canAddLandingMarker(state, planetId) {
    const record = getPlanetRecord(state, planetId);
    if (!record) return false;
    return getPlanetMarkerDisplayLimit(planetId, "land") > 0;
  }

  function addPlanetOrbitMarker(state, planetId, player) {
    if (!canAddOrbitMarker(state, planetId)) {
      return { ok: false, marker: null, message: "星球不支持环绕标记" };
    }

    const record = getPlanetRecord(state, planetId);
    const normalizedPlayer = normalizePlayer(player);
    const marker = {
      playerId: normalizedPlayer.id,
      color: normalizedPlayer.color,
    };
    record.orbitMarkers.push(marker);
    return {
      ok: true,
      marker: projectMarker(
        marker,
        record.orbitMarkers.length,
        getPlanetMarkerDisplayLimit(planetId, "orbit"),
      ),
      message: null,
    };
  }

  function addPlanetLandingMarker(state, planetId, player, options = {}) {
    if (!canAddLandingMarker(state, planetId)) {
      return { ok: false, marker: null, message: "星球不支持登陆标记" };
    }

    const record = getPlanetRecord(state, planetId);
    const normalizedPlayer = normalizePlayer(player);
    const marker = {
      playerId: normalizedPlayer.id,
      color: normalizedPlayer.color,
      ...(Number.isSafeInteger(Number(options.rewardSlot)) && Number(options.rewardSlot) > 0
        ? { rewardSlot: Number(options.rewardSlot) }
        : {}),
    };
    record.landingMarkers.push(marker);
    const projected = projectMarker(
      marker,
      record.landingMarkers.length,
      getPlanetMarkerDisplayLimit(planetId, "land"),
    );
    const referenceOffset = Number(options.referenceOffsetTokenWidths);
    if (Number.isFinite(referenceOffset) && referenceOffset !== 0) {
      projected.referenceOffsetTokenWidths = referenceOffset;
    }
    return { ok: true, marker: projected, message: null };
  }

  function getPlanetOrbitCount(state, planetId) {
    return getPlanetRecord(state, planetId)?.orbitMarkers?.length || 0;
  }

  function getPlanetLandingCount(state, planetId) {
    return getPlanetRecord(state, planetId)?.landingMarkers?.length || 0;
  }

  function getPlanetOrbitMarkers(state, planetId) {
    return (getPlanetRecord(state, planetId)?.orbitMarkers || []).map((marker, index) => (
      projectMarker(marker, index + 1, getPlanetMarkerDisplayLimit(planetId, "orbit"))
    ));
  }

  function getPlanetLandingMarkers(state, planetId) {
    const rewardSlotCounts = {};
    return (getPlanetRecord(state, planetId)?.landingMarkers || []).map((marker, index) => {
      const projected = projectMarker(marker, index + 1, getPlanetMarkerDisplayLimit(planetId, "land"));
      if (marker.rewardSlot != null) {
        const collisionIndex = rewardSlotCounts[marker.rewardSlot] || 0;
        rewardSlotCounts[marker.rewardSlot] = collisionIndex + 1;
        if (collisionIndex > 0) projected.referenceOffsetTokenWidths = collisionIndex * 0.5;
      }
      return projected;
    });
  }

  function isSatelliteLanded(state, planetId, satelliteId) {
    const record = getPlanetRecord(state, planetId);
    if (!record) return false;
    return record.satelliteLandings.some((marker) => marker.satelliteId === satelliteId);
  }

  function getAvailableSatellitesForLanding(state, planetId, options = {}) {
    if (!planetReferenceLayout.hasSatellites(planetId)) return [];
    if (options.allowDuplicate) return planetReferenceLayout.getSatellitesForPlanet(planetId);
    return planetReferenceLayout.getSatellitesForPlanet(planetId)
      .filter((satellite) => !isSatelliteLanded(state, planetId, satellite.satelliteId));
  }

  function canLandOnSatellite(state, planetId, satelliteId, options = {}) {
    if (!planetReferenceLayout.getSatellitePlacement(planetId, satelliteId)) return false;
    return Boolean(options.allowDuplicate) || !isSatelliteLanded(state, planetId, satelliteId);
  }

  function addSatelliteLandingMarker(state, planetId, satelliteId, player, options = {}) {
    if (!canLandOnSatellite(state, planetId, satelliteId, options)) {
      return { ok: false, marker: null, message: "该卫星已被登陆或不存在" };
    }

    const satellite = planetReferenceLayout.getSatellitePlacement(planetId, satelliteId);
    const record = getPlanetRecord(state, planetId);
    const normalizedPlayer = normalizePlayer(player);
    const marker = {
      satelliteId,
      playerId: normalizedPlayer.id,
      color: normalizedPlayer.color,
    };
    record.satelliteLandings.push(marker);
    const projected = { ...marker, satelliteName: satellite.satelliteName };
    const referenceOffset = Number(options.referenceOffsetTokenWidths);
    if (Number.isFinite(referenceOffset) && referenceOffset !== 0) {
      projected.referenceOffsetTokenWidths = referenceOffset;
    }
    return { ok: true, marker: projected, message: null };
  }

  function getSatelliteLandingMarkers(state, planetId) {
    return [...(getPlanetRecord(state, planetId)?.satelliteLandings || [])];
  }

  return Object.freeze({
    PLANET_IDS,
    createPlanetStatsState,
    getPlanetRecord,
    canAddOrbitMarker,
    canAddLandingMarker,
    addPlanetOrbitMarker,
    addPlanetLandingMarker,
    getPlanetOrbitCount,
    getPlanetLandingCount,
    getPlanetOrbitMarkers,
    getPlanetLandingMarkers,
    isSatelliteLanded,
    getAvailableSatellitesForLanding,
    canLandOnSatellite,
    addSatelliteLandingMarker,
    getSatelliteLandingMarkers,
  });
});
