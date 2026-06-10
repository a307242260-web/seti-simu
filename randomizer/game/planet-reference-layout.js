(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiPlanetReferenceLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const PLANETS_REFERENCE_SIZE = Object.freeze({ width: 1672, height: 941 });
  const PLANET_REFERENCE_CENTERS = Object.freeze({
    venus: Object.freeze({ x: 249, y: 303 }),
    jupiter: Object.freeze({ x: 718, y: 262 }),
    saturn: Object.freeze({ x: 1185, y: 265 }),
    mercury: Object.freeze({ x: 175, y: 666 }),
    mars: Object.freeze({ x: 532, y: 688 }),
    uranus: Object.freeze({ x: 1017, y: 693 }),
    neptune: Object.freeze({ x: 1407, y: 692 }),
  });
  const EXPLICIT_PLACEMENTS = Object.freeze([
    Object.freeze({
      planetId: "venus",
      planetName: "金星",
      kind: "orbit",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 155.33, y: 207.96, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 206.32, y: 190.08, angleOffsetDegrees: 19 }),
        Object.freeze({ sequence: 3, x: 263.34, y: 182.46, angleOffsetDegrees: 38 }),
        Object.freeze({ sequence: 4, x: 314.67, y: 199.59, angleOffsetDegrees: 57 }),
        Object.freeze({ sequence: 5, x: 356.47, y: 239.58, angleOffsetDegrees: 76 }),
      ]),
    }),
    Object.freeze({
      planetId: "venus",
      planetName: "金星",
      kind: "land",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 201.64, y: 335.18, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 192.58, y: 293.25, angleOffsetDegrees: 44 }),
        Object.freeze({ sequence: 3, x: 215.19, y: 256.79, angleOffsetDegrees: 88 }),
        Object.freeze({ sequence: 4, x: 256.78, y: 246.27, angleOffsetDegrees: 132 }),
        Object.freeze({ sequence: 5, x: 294.00, y: 267.59, angleOffsetDegrees: 176 }),
      ]),
    }),
    Object.freeze({
      planetId: "jupiter",
      planetName: "木星",
      kind: "orbit",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 575.34, y: 131.18, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 630.51, y: 98.81, angleOffsetDegrees: 19 }),
        Object.freeze({ sequence: 3, x: 693.21, y: 85.44, angleOffsetDegrees: 38 }),
        Object.freeze({ sequence: 4, x: 761.76, y: 91.18, angleOffsetDegrees: 57 }),
        Object.freeze({ sequence: 5, x: 816.94, y: 119.70, angleOffsetDegrees: 76 }),
      ]),
    }),
    Object.freeze({
      planetId: "jupiter",
      planetName: "木星",
      kind: "land",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 644.22, y: 295.47, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 641.68, y: 234.82, angleOffsetDegrees: 44 }),
        Object.freeze({ sequence: 3, x: 681.98, y: 189.43, angleOffsetDegrees: 88 }),
        Object.freeze({ sequence: 4, x: 742.50, y: 184.77, angleOffsetDegrees: 132 }),
        Object.freeze({ sequence: 5, x: 789.27, y: 223.46, angleOffsetDegrees: 176 }),
      ]),
    }),
    Object.freeze({
      planetId: "saturn",
      planetName: "土星",
      kind: "orbit",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 1095.16, y: 158.75, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 1147.83, y: 136.82, angleOffsetDegrees: 19 }),
        Object.freeze({ sequence: 3, x: 1204.84, y: 134.94, angleOffsetDegrees: 38 }),
        Object.freeze({ sequence: 4, x: 1258.18, y: 150.18, angleOffsetDegrees: 57 }),
        Object.freeze({ sequence: 5, x: 1299.98, y: 178.70, angleOffsetDegrees: 76 }),
      ]),
    }),
    Object.freeze({
      planetId: "saturn",
      planetName: "土星",
      kind: "land",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 1141.14, y: 303.10, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 1126.98, y: 261.94, angleOffsetDegrees: 44 }),
        Object.freeze({ sequence: 3, x: 1145.39, y: 222.50, angleOffsetDegrees: 88 }),
        Object.freeze({ sequence: 4, x: 1186.03, y: 206.91, angleOffsetDegrees: 132 }),
        Object.freeze({ sequence: 5, x: 1226.10, y: 223.93, angleOffsetDegrees: 176 }),
      ]),
    }),
    Object.freeze({
      planetId: "mercury",
      planetName: "水星",
      kind: "orbit",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 126.40, y: 606.66, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 177.73, y: 585.77, angleOffsetDegrees: 23 }),
        Object.freeze({ sequence: 3, x: 231.07, y: 587.65, angleOffsetDegrees: 46 }),
        Object.freeze({ sequence: 4, x: 278.56, y: 620.02, angleOffsetDegrees: 69 }),
        Object.freeze({ sequence: 5, x: 307.15, y: 667.55, angleOffsetDegrees: 92 }),
      ]),
    }),
    Object.freeze({
      planetId: "mercury",
      planetName: "水星",
      kind: "land",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 166.36, y: 718.92, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 162.52, y: 661.81, angleOffsetDegrees: 45 }),
        Object.freeze({ sequence: 3, x: 215.86, y: 640.92, angleOffsetDegrees: 90 }),
        Object.freeze({ sequence: 4, x: 253.81, y: 682.79, angleOffsetDegrees: 135 }),
        Object.freeze({ sequence: 5, x: 229.06, y: 734.17, angleOffsetDegrees: 180 }),
      ]),
    }),
    Object.freeze({
      planetId: "mars",
      planetName: "火星",
      kind: "orbit",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 419.50, y: 619.93, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 464.98, y: 591.51, angleOffsetDegrees: 19 }),
        Object.freeze({ sequence: 3, x: 520.16, y: 583.89, angleOffsetDegrees: 38 }),
        Object.freeze({ sequence: 4, x: 571.49, y: 604.78, angleOffsetDegrees: 57 }),
        Object.freeze({ sequence: 5, x: 615.30, y: 640.92, angleOffsetDegrees: 76 }),
      ]),
    }),
    Object.freeze({
      planetId: "mars",
      planetName: "火星",
      kind: "land",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 489.73, y: 749.32, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 464.98, y: 705.56, angleOffsetDegrees: 44 }),
        Object.freeze({ sequence: 3, x: 497.25, y: 656.16, angleOffsetDegrees: 88 }),
        Object.freeze({ sequence: 4, x: 558.11, y: 658.04, angleOffsetDegrees: 132 }),
        Object.freeze({ sequence: 5, x: 561.96, y: 743.67, angleOffsetDegrees: 176 }),
      ]),
    }),
    Object.freeze({
      planetId: "uranus",
      planetName: "天王星",
      kind: "orbit",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 928.63, y: 607.89, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 982.30, y: 589.54, angleOffsetDegrees: 19 }),
        Object.freeze({ sequence: 3, x: 1037.48, y: 593.39, angleOffsetDegrees: 38 }),
        Object.freeze({ sequence: 4, x: 1088.81, y: 608.54, angleOffsetDegrees: 57 }),
        Object.freeze({ sequence: 5, x: 1134.45, y: 644.77, angleOffsetDegrees: 76 }),
      ]),
    }),
    Object.freeze({
      planetId: "uranus",
      planetName: "天王星",
      kind: "land",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 963.41, y: 734.17, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 1033.63, y: 745.55, angleOffsetDegrees: 44 }),
        Object.freeze({ sequence: 3, x: 963.41, y: 677.05, angleOffsetDegrees: 88 }),
        Object.freeze({ sequence: 4, x: 1014.74, y: 650.42, angleOffsetDegrees: 132 }),
        Object.freeze({ sequence: 5, x: 1062.22, y: 680.91, angleOffsetDegrees: 176 }),
      ]),
    }),
    Object.freeze({
      planetId: "neptune",
      planetName: "海王星",
      kind: "orbit",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 1311.68, y: 607.89, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 1368.53, y: 589.54, angleOffsetDegrees: 19 }),
        Object.freeze({ sequence: 3, x: 1427.39, y: 589.54, angleOffsetDegrees: 38 }),
        Object.freeze({ sequence: 4, x: 1478.88, y: 612.40, angleOffsetDegrees: 57 }),
        Object.freeze({ sequence: 5, x: 1526.37, y: 646.66, angleOffsetDegrees: 76 }),
      ]),
    }),
    Object.freeze({
      planetId: "neptune",
      planetName: "海王星",
      kind: "land",
      points: Object.freeze([
        Object.freeze({ sequence: 1, x: 1357.66, y: 736.14, angleOffsetDegrees: 0 }),
        Object.freeze({ sequence: 2, x: 1353.32, y: 673.29, angleOffsetDegrees: 44 }),
        Object.freeze({ sequence: 3, x: 1408.49, y: 652.30, angleOffsetDegrees: 88 }),
        Object.freeze({ sequence: 4, x: 1455.98, y: 698.03, angleOffsetDegrees: 132 }),
        Object.freeze({ sequence: 5, x: 1421.70, y: 747.44, angleOffsetDegrees: 176 }),
      ]),
    }),
  ]);

  const SATELLITE_PLACEMENTS = Object.freeze([
    Object.freeze({ parentPlanetId: "saturn", parentPlanetName: "土星", satelliteId: "enceladus", satelliteName: "土卫二", x: 1391.27, y: 233.84 }),
    Object.freeze({ parentPlanetId: "jupiter", parentPlanetName: "木星", satelliteId: "io", satelliteName: "木卫一", x: 915.75, y: 176.81 }),
    Object.freeze({ parentPlanetId: "neptune", parentPlanetName: "海王星", satelliteId: "triton", satelliteName: "海卫一", x: 1512.99, y: 777.92 }),
    Object.freeze({ parentPlanetId: "jupiter", parentPlanetName: "木星", satelliteId: "callisto", satelliteName: "木卫四", x: 626.67, y: 416.49 }),
    Object.freeze({ parentPlanetId: "uranus", parentPlanetName: "天王星", satelliteId: "titania", satelliteName: "天卫三", x: 1130.77, y: 720.81 }),
    Object.freeze({ parentPlanetId: "saturn", parentPlanetName: "土星", satelliteId: "titan", satelliteName: "土卫六", x: 1343.79, y: 342.24 }),
    Object.freeze({ parentPlanetId: "jupiter", parentPlanetName: "木星", satelliteId: "ganymede", satelliteName: "木卫三", x: 818.78, y: 401.24 }),
    Object.freeze({ parentPlanetId: "mars", parentPlanetName: "火星", satelliteId: "phobos-deimos", satelliteName: "火卫一/火卫二", x: 598.07, y: 840.69 }),
    Object.freeze({ parentPlanetId: "jupiter", parentPlanetName: "木星", satelliteId: "europa", satelliteName: "木卫二", x: 891.01, y: 294.72 }),
  ]);
  const PLANETS_WITH_SATELLITES = Object.freeze([
    "mars", "jupiter", "saturn", "uranus", "neptune",
  ]);
  const KIND_LABELS = Object.freeze({
    orbit: "环绕",
    land: "登陆",
    satellite: "卫星",
  });
  const PLANET_ORDER = Object.freeze([
    "venus", "jupiter", "saturn", "mercury", "mars", "uranus", "neptune",
  ]);

  const satellitesByPlanet = new Map();
  for (const satellite of SATELLITE_PLACEMENTS) {
    if (!satellitesByPlanet.has(satellite.parentPlanetId)) {
      satellitesByPlanet.set(satellite.parentPlanetId, []);
    }
    satellitesByPlanet.get(satellite.parentPlanetId).push(satellite);
  }

  const slotIndex = new Map();
  for (const entry of EXPLICIT_PLACEMENTS) {
    for (const point of entry.points) {
      slotIndex.set(`${entry.planetId}:${entry.kind}:${point.sequence}`, {
        planetId: entry.planetId,
        planetName: entry.planetName,
        kind: entry.kind,
        ...point,
        center: PLANET_REFERENCE_CENTERS[entry.planetId] || null,
      });
    }
  }

  function getPlanetSlot(planetId, kind, sequence) {
    return slotIndex.get(`${planetId}:${kind}:${sequence}`) || null;
  }

  function getPlanetSlotCount(planetId, kind) {
    const entry = EXPLICIT_PLACEMENTS.find((item) => item.planetId === planetId && item.kind === kind);
    return entry ? entry.points.length : 0;
  }

  function listAllOrbitLandSlots() {
    return EXPLICIT_PLACEMENTS.flatMap((entry) => entry.points.map((point) => ({
      planetId: entry.planetId,
      planetName: entry.planetName,
      kind: entry.kind,
      ...point,
      center: PLANET_REFERENCE_CENTERS[entry.planetId] || null,
    })));
  }

  function normalizePoint(point) {
    const width = PLANETS_REFERENCE_SIZE.width;
    const height = PLANETS_REFERENCE_SIZE.height;
    return {
      x: point.x,
      y: point.y,
      percentX: Math.round((point.x / width) * 10000) / 100,
      percentY: Math.round((point.y / height) * 10000) / 100,
    };
  }

  function buildReferenceData() {
    const planets = {};

    for (const entry of EXPLICIT_PLACEMENTS) {
      planets[entry.planetId] = planets[entry.planetId] || {
        planetId: entry.planetId,
        planetName: entry.planetName,
        center: PLANET_REFERENCE_CENTERS[entry.planetId] || null,
        orbit: [],
        land: [],
      };

      const anchor = entry.points[0];
      for (const point of entry.points) {
        planets[entry.planetId][entry.kind].push({
          sequence: point.sequence,
          angleOffsetDegrees: point.angleOffsetDegrees,
          anchor: { x: anchor.x, y: anchor.y },
          ...normalizePoint(point),
        });
      }
    }

    return {
      version: 1,
      imageSize: { ...PLANETS_REFERENCE_SIZE },
      centers: { ...PLANET_REFERENCE_CENTERS },
      explicitPlacements: EXPLICIT_PLACEMENTS.map((entry) => ({
        planetId: entry.planetId,
        planetName: entry.planetName,
        kind: entry.kind,
        points: entry.points.map((point) => ({ ...point })),
      })),
      planets: PLANET_ORDER.filter((planetId) => planets[planetId]).map((planetId) => planets[planetId]),
    };
  }

  function formatSlotLabel(slot) {
    const kindLabel = KIND_LABELS[slot.kind] || slot.kind;
    return `${slot.planetName} ${kindLabel}${slot.sequence}`;
  }

  function hasSatellites(planetId) {
    return satellitesByPlanet.has(planetId);
  }

  function getSatellitesForPlanet(planetId) {
    return [...(satellitesByPlanet.get(planetId) || [])];
  }

  function getSatellitePlacement(parentPlanetId, satelliteId) {
    return getSatellitesForPlanet(parentPlanetId)
      .find((satellite) => satellite.satelliteId === satelliteId) || null;
  }

  function formatSatelliteLabel(satellite) {
    return `${satellite.parentPlanetName} ${satellite.satelliteName}`;
  }

  return Object.freeze({
    PLANETS_REFERENCE_SIZE,
    PLANET_REFERENCE_CENTERS,
    EXPLICIT_PLACEMENTS,
    SATELLITE_PLACEMENTS,
    PLANETS_WITH_SATELLITES,
    PLANET_ORDER,
    KIND_LABELS,
    getPlanetSlot,
    getPlanetSlotCount,
    listAllOrbitLandSlots,
    hasSatellites,
    getSatellitesForPlanet,
    getSatellitePlacement,
    buildReferenceData,
    formatSlotLabel,
    formatSatelliteLabel,
  });
});
