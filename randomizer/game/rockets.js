(function (root, factory) {
  "use strict";

  let solar = root.SetiSolarSystem;
  let stateSequences = root.SetiStateSequences;
  if ((!solar || !stateSequences) && typeof require === "function") {
    solar = require("../solar-system/core");
    stateSequences = stateSequences || require("./state/sequences");
  }

  const api = factory(solar, stateSequences);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiRocketActions = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (solar, stateSequences) {
  "use strict";

  if (!solar) {
    throw new Error("SetiSolarSystem is required before SetiRocketActions");
  }
  if (!stateSequences) {
    throw new Error("SetiStateSequences is required before SetiRocketActions");
  }

  const SECTOR_RING_MIN = 1;
  const SECTOR_RING_MAX = 4;
  const ROCKET_SURFACE = Object.freeze({
    SOLAR: "solar-board",
  });
  const ROCKET_KIND = Object.freeze({
    STANDARD: "standard",
    CHONG_FOSSIL: "chong-fossil",
  });

  function createRocketState() {
    return {
      activeRocketId: null,
      rockets: [],
      playerRocketSequences: {},
    };
  }

  // 卡牌条件与终局计分共用的位置事实；只读，不缓存跨状态位置或分配实体。
  function buildProbeLocationData(root) {
    const solarSystemState = root?.solarSystem || {};
    const earth = solar.createSolarSnapshot(solarSystemState)
      .planetLocations.find((planet) => planet.planetId === "earth");
    if (!earth) throw new TypeError("探测器位置读取缺少地球位置");
    const details = [];
    const index = {};
    for (const rocket of (root?.pieces?.rockets || [])) {
      if (!isControllablePlayerRocket(rocket)) continue;
      const coordinate = getRocketSectorCoordinate(rocket);
      if (!coordinate) throw new TypeError(`探测器 ${rocket.id} 缺少太阳系位置`);
      const content = solar.resolveVisibleContent(coordinate.x, coordinate.y, solarSystemState).content;
      const distanceFromEarth = Math.min(
        solar.mod8(coordinate.x - earth.x),
        solar.mod8(earth.x - coordinate.x),
      ) + Math.abs(coordinate.y - earth.y);
      const locationType = content.kind;
      const detail = {
        playerId: rocket.playerId,
        color: rocket.color || null,
        sectorX: coordinate.x,
        sectorY: coordinate.y,
        locationType,
        adjacentToEarth: distanceFromEarth === 1,
        distanceFromEarth,
        planetId: locationType === "planet" ? content.planetId : null,
      };
      details.push(detail);
      for (const key of [rocket.playerId, rocket.color].filter(Boolean).map(String)) {
        if (!index[key]) index[key] = [];
        if (!index[key].includes(locationType)) index[key].push(locationType);
      }
    }
    return { details, index };
  }

  function getPlayerRocketSequences(piecesState, playerId) {
    if (!playerId) return null;
    const current = piecesState.playerRocketSequences[playerId];
    if (!Array.isArray(current)) piecesState.playerRocketSequences[playerId] = [];
    return piecesState.playerRocketSequences[playerId];
  }

  function allocatePlayerRocketSequence(piecesState, playerId) {
    const used = getPlayerRocketSequences(piecesState, playerId);
    if (!used) return null;

    let sequence = 1;
    while (used.includes(sequence)) sequence += 1;
    used.push(sequence);
    used.sort((left, right) => left - right);
    return sequence;
  }

  function releasePlayerRocketSequence(piecesState, playerId, sequence) {
    const used = piecesState.playerRocketSequences?.[playerId];
    if (!used || !Number.isInteger(sequence)) return;
    const index = used.indexOf(sequence);
    if (index >= 0) used.splice(index, 1);
  }

  function isControllablePlayerRocket(rocket) {
    if (!rocket?.playerId) return false;
    if (getRocketSurface(rocket) !== ROCKET_SURFACE.SOLAR) return false;
    if ((rocket.kind || ROCKET_KIND.STANDARD) !== ROCKET_KIND.STANDARD) return false;
    return true;
  }

  function isMovablePlayerToken(rocket) {
    if (!rocket?.playerId) return false;
    if (getRocketSurface(rocket) !== ROCKET_SURFACE.SOLAR) return false;
    if (rocket.movementLocked) return false;
    return true;
  }

  function isChongFossilRewardProbe(rocket, playerId) {
    if (!rocket?.playerId) return false;
    if (playerId && rocket.playerId !== playerId) return false;
    const kind = rocket.kind || ROCKET_KIND.STANDARD;
    if (kind === ROCKET_KIND.CHONG_FOSSIL) return isMovablePlayerToken(rocket);
    return isControllablePlayerRocket(rocket);
  }

  function formatRocketLabel(rocket) {
    if ((rocket?.kind || ROCKET_KIND.STANDARD) === ROCKET_KIND.CHONG_FOSSIL) {
      return `F${rocket?.id ?? "?"}`;
    }
    if (Number.isInteger(rocket?.playerSequence)) {
      return `R${rocket.playerSequence}`;
    }
    return `R${rocket?.id ?? "?"}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundBoardCoordinate(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function getRocketSurface(rocket) {
    return rocket?.surface || ROCKET_SURFACE.SOLAR;
  }

  function hasPolarPoint(point) {
    return Number.isFinite(Number(point?.radius)) && Number.isFinite(Number(point?.angleDegrees));
  }

  function normalizeBoardPoint(point) {
    const size = solar.GLOBAL_COORDINATE_SYSTEM.size;
    return {
      x: roundBoardCoordinate(clamp(Number(point.x), 0, size)),
      y: roundBoardCoordinate(clamp(Number(point.y), 0, size)),
    };
  }

  function normalizePolarPoint(point) {
    const maxRadius = solar.GLOBAL_COORDINATE_SYSTEM.size / 2;
    return {
      radius: roundBoardCoordinate(clamp(Number(point.radius), 0, maxRadius)),
      angleDegrees: roundBoardCoordinate(Number(point.angleDegrees)),
    };
  }

  function getPolarPointFromBoardPoint(point) {
    return normalizePolarPoint(solar.globalPointToPolarPoint(point));
  }

  function getBoardPointFromPolarPoint(point) {
    return normalizeBoardPoint(solar.polarToGlobalPoint(point.radius, point.angleDegrees));
  }

  function sectorKey(sectorX, sectorY) {
    return `${sectorX},${sectorY}`;
  }

  function createRocketSnapshot(rocket) {
    const surface = getRocketSurface(rocket);
    const polar = hasPolarPoint(rocket) ? normalizePolarPoint(rocket) : null;
    const board = polar ? getBoardPointFromPolarPoint(polar) : null;
    const sectorResolution = surface === ROCKET_SURFACE.SOLAR && board
      ? solar.resolveSectorCoordinateFromGlobalPoint(board)
      : { sectorCoordinate: null, reason: surface === ROCKET_SURFACE.SOLAR ? "missing-polar" : "reference-surface" };

    return {
      id: rocket.id,
      kind: rocket.kind || ROCKET_KIND.STANDARD,
      fossilId: rocket.fossilId || null,
      playerId: rocket.playerId || null,
      playerSequence: Number.isInteger(rocket.playerSequence) ? rocket.playerSequence : null,
      color: rocket.color || null,
      surface,
      polar,
      board,
      sectorCoordinate: sectorResolution.sectorCoordinate,
      sectorReason: sectorResolution.reason || null,
      slotIndex: Number.isInteger(rocket.slotIndex) ? rocket.slotIndex : null,
      slotSectorCoordinate: surface === ROCKET_SURFACE.SOLAR
      && Number.isInteger(rocket.sectorX)
      && Number.isInteger(rocket.sectorY)
      && Number.isInteger(rocket.slotIndex)
        ? { x: rocket.sectorX, y: rocket.sectorY }
        : null,
      launchGrid: rocket.launchGrid ? { ...rocket.launchGrid } : null,
      launchSectorCoordinate: rocket.launchSectorCoordinate ? { ...rocket.launchSectorCoordinate } : null,
    };
  }

  /** 状态记录器：扫描当前火箭，得到「每个扇区 -> 已占用槽位」的实时占用表。 */
  function getSectorOccupancy(piecesState, excludeRocketId) {
    const occupancy = new Map();
    for (const rocket of piecesState.rockets) {
      if (rocket.id === excludeRocketId) continue;
      if (!Number.isInteger(rocket.sectorX) || !Number.isInteger(rocket.sectorY)) continue;
      if (!Number.isInteger(rocket.slotIndex)) continue;
      const key = sectorKey(rocket.sectorX, rocket.sectorY);
      if (!occupancy.has(key)) occupancy.set(key, new Map());
      occupancy.get(key).set(rocket.slotIndex, rocket.id);
    }
    return occupancy;
  }

  function getOccupiedSlotIndices(piecesState, sectorX, sectorY, excludeRocketId) {
    const slots = getSectorOccupancy(piecesState, excludeRocketId).get(sectorKey(sectorX, sectorY));
    return slots ? new Set(slots.keys()) : new Set();
  }

  /** 按优先顺序（中心->四角->四边）返回该扇区第一个空闲槽位；满了返回 null。 */
  function findAvailableSlotIndex(piecesState, sectorX, sectorY, excludeRocketId) {
    const occupied = getOccupiedSlotIndices(piecesState, sectorX, sectorY, excludeRocketId);
    for (const slotIndex of solar.LAUNCH_SLOT_PRIORITY) {
      if (!occupied.has(slotIndex)) return slotIndex;
    }
    return null;
  }

  function assignRocketToSlot(rocket, sectorX, sectorY, slotIndex) {
    const slot = solar.getSectorLaunchSlot(sectorX, sectorY, slotIndex);
    rocket.surface = ROCKET_SURFACE.SOLAR;
    rocket.sectorX = sectorX;
    rocket.sectorY = sectorY;
    rocket.slotIndex = slot.slotIndex;
    rocket.radius = slot.radius;
    rocket.angleDegrees = slot.angleDegrees;
    return rocket;
  }

  function clearRocketSectorSlot(rocket) {
    rocket.sectorX = null;
    rocket.sectorY = null;
    rocket.slotIndex = null;
  }

  function assignRocketToBoardPoint(rocket, boardPoint) {
    const board = normalizeBoardPoint(boardPoint);
    const polar = getPolarPointFromBoardPoint(board);
    const resolution = solar.resolveSectorCoordinateFromGlobalPoint(board);

    rocket.surface = ROCKET_SURFACE.SOLAR;
    rocket.radius = polar.radius;
    rocket.angleDegrees = polar.angleDegrees;
    rocket.slotIndex = null;

    if (resolution.sectorCoordinate) {
      rocket.sectorX = resolution.sectorCoordinate.x;
      rocket.sectorY = resolution.sectorCoordinate.y;
    } else {
      clearRocketSectorSlot(rocket);
    }

    return rocket;
  }

  /** 把火箭放进目标扇区的优先空位；扇区已满则不放置并返回 false。 */
  function placeRocketByPriority(piecesState, rocket, sectorX, sectorY) {
    const slotIndex = findAvailableSlotIndex(piecesState, sectorX, sectorY, rocket.id);
    if (slotIndex === null) return false;
    assignRocketToSlot(rocket, sectorX, sectorY, slotIndex);
    return true;
  }

  function getRocketSectorCoordinate(rocket) {
    if (getRocketSurface(rocket) !== ROCKET_SURFACE.SOLAR) return null;
    if (Number.isInteger(rocket.sectorX) && Number.isInteger(rocket.sectorY)) {
      return { x: rocket.sectorX, y: rocket.sectorY };
    }
    if (!hasPolarPoint(rocket)) return null;
    const resolution = solar.resolveSectorCoordinateFromGlobalPoint(getBoardPointFromPolarPoint(rocket));
    return resolution.sectorCoordinate || { x: 0, y: SECTOR_RING_MIN };
  }

  function launchRocketAtSector(piecesState, sectorCoordinate, input) {
    const source = input || {};
    const sectorX = solar.mod8(sectorCoordinate.x);
    const sectorY = clamp(Number(sectorCoordinate.y), SECTOR_RING_MIN, SECTOR_RING_MAX);
    const rocket = {
      id: stateSequences.peek(source.root, "rocket"),
      playerId: source.playerId || null,
      color: source.color || null,
    };

    if (!placeRocketByPriority(piecesState, rocket, sectorX, sectorY)) {
      const message = `扇区[${sectorX},${sectorY}]已满，无法发射`;
      return { ok: false, rocket: null, message };
    }

    stateSequences.take(source.root, "rocket");
    rocket.launchGrid = { x: sectorX, y: sectorY };
    rocket.launchSectorCoordinate = { x: sectorX, y: sectorY };
    rocket.playerSequence = allocatePlayerRocketSequence(piecesState, rocket.playerId);
    piecesState.activeRocketId = rocket.id;
    piecesState.rockets.push(rocket);

    const message = `发射 ${formatRocketLabel(rocket)} -> 扇区[${rocket.sectorX},${rocket.sectorY}]#${rocket.slotIndex}`;
    return { ok: true, rocket, message };
  }

  function createMovableTokenAtSector(piecesState, sectorCoordinate, input = {}) {
    const sectorX = solar.mod8(sectorCoordinate.x);
    const sectorY = clamp(Number(sectorCoordinate.y), SECTOR_RING_MIN, SECTOR_RING_MAX);
    const rocket = {
      id: stateSequences.peek(input.root, "rocket"),
      kind: input.kind || ROCKET_KIND.CHONG_FOSSIL,
      playerId: input.playerId || null,
      color: input.color || null,
      fossilId: input.fossilId || null,
      cargo: input.cargo ? { ...input.cargo } : null,
    };

    if (!placeRocketByPriority(piecesState, rocket, sectorX, sectorY)) {
      const message = `扇区[${sectorX},${sectorY}]已满，无法放置移动棋子`;
      return { ok: false, rocket: null, message };
    }

    stateSequences.take(input.root, "rocket");
    rocket.launchGrid = { x: sectorX, y: sectorY };
    rocket.launchSectorCoordinate = { x: sectorX, y: sectorY };
    piecesState.activeRocketId = rocket.id;
    piecesState.rockets.push(rocket);

    const message = `放置 ${formatRocketLabel(rocket)} -> 扇区[${rocket.sectorX},${rocket.sectorY}]#${rocket.slotIndex}`;
    return { ok: true, rocket, message };
  }

  function setActiveRocket(piecesState, rocketId) {
    const rocket = piecesState.rockets.find((item) => item.id === rocketId);
    if (!rocket) {
      const message = `火箭 R${rocketId} 不存在`;
      return { ok: false, rocket: null, message };
    }

    piecesState.activeRocketId = rocket.id;
    return { ok: true, rocket, message: null };
  }

  function getRocketsForPlayer(piecesState, playerId) {
    return piecesState.rockets
      .filter(isControllablePlayerRocket)
      .filter((rocket) => !playerId || rocket.playerId === playerId)
      .sort((left, right) => left.playerSequence - right.playerSequence);
  }

  function getMovableTokensForPlayer(piecesState, playerId) {
    return piecesState.rockets
      .filter(isMovablePlayerToken)
      .filter((rocket) => !playerId || rocket.playerId === playerId)
      .sort((left, right) => {
        const leftSequence = Number.isInteger(left.playerSequence) ? left.playerSequence : 999 + left.id;
        const rightSequence = Number.isInteger(right.playerSequence) ? right.playerSequence : 999 + right.id;
        return leftSequence - rightSequence;
      });
  }

  function canMoveRocket(piecesState, rocketId, deltaX, deltaY) {
    const rocket = piecesState.rockets.find((item) => item.id === rocketId);
    if (!rocket) {
      const message = `火箭 R${rocketId} 不存在`;
      return { ok: false, rocket: null, message };
    }

    const current = getRocketSectorCoordinate(rocket);
    if (!current) {
      const message = `R${rocket.id} 不在主盘扇区内，无法用快捷按钮移动`;
      return { ok: false, rocket, message };
    }

    return { ...canMoveFromCoordinate(piecesState, current, deltaX, deltaY, rocket.id), rocket };
  }

  function canMoveFromCoordinate(piecesState, current, deltaX, deltaY, movingRocketId = null) {
    if (!current) return { ok: false, message: "缺少移动起点" };
    const sectorX = solar.mod8(current.x + Number(deltaX || 0));
    const sectorY = clamp(current.y + Number(deltaY || 0), SECTOR_RING_MIN, SECTOR_RING_MAX);

    if (sectorX === Number(current.x) && sectorY === Number(current.y)) {
      return { ok: false, message: "已在边界，无法继续移动" };
    }

    if (findAvailableSlotIndex(piecesState, sectorX, sectorY, movingRocketId) === null) {
      return { ok: false, message: `扇区[${sectorX},${sectorY}]已满，无法移动` };
    }

    return { ok: true, to: { x: sectorX, y: sectorY }, message: null };
  }

  function moveRocket(piecesState, rocketId, deltaX, deltaY) {
    const activation = setActiveRocket(piecesState, rocketId);
    if (!activation.ok) return activation;
    return moveActiveRocket(piecesState, deltaX, deltaY);
  }

  function moveActiveRocket(piecesState, deltaX, deltaY) {
    const rocket = piecesState.rockets.find((item) => item.id === piecesState.activeRocketId);
    if (!rocket) {
      const message = "没有可移动的当前火箭";
      return { ok: false, rocket: null, message };
    }

    const current = getRocketSectorCoordinate(rocket);
    if (!current) {
      const message = `R${rocket.id} 不在主盘扇区内，无法用快捷按钮移动`;
      return { ok: false, rocket, message };
    }
    const sectorX = solar.mod8(current.x + Number(deltaX || 0));
    const sectorY = clamp(current.y + Number(deltaY || 0), SECTOR_RING_MIN, SECTOR_RING_MAX);

    if (sectorX === rocket.sectorX && sectorY === rocket.sectorY) {
      const message = `R${rocket.id} 已在边界，无法继续移动`;
      return { ok: false, rocket, message };
    }

    if (!placeRocketByPriority(piecesState, rocket, sectorX, sectorY)) {
      const message = `扇区[${sectorX},${sectorY}]已满，R${rocket.id} 保持原位`;
      return { ok: false, rocket, message };
    }

    const message = `${formatRocketLabel(rocket)} -> 扇区[${rocket.sectorX},${rocket.sectorY}]#${rocket.slotIndex}`;
    return { ok: true, rocket, message };
  }

  function placeRocketAtBoardPoint(piecesState, rocketId, boardPoint) {
    const activation = setActiveRocket(piecesState, rocketId);
    if (!activation.ok) return activation;

    assignRocketToBoardPoint(activation.rocket, boardPoint);
    const snapshot = createRocketSnapshot(activation.rocket);
    const sectorText = snapshot.sectorCoordinate
      ? ` -> 扇区[${snapshot.sectorCoordinate.x},${snapshot.sectorCoordinate.y}]`
      : " -> 主盘扇区外";
    const message = `手动放置 R${activation.rocket.id} 主盘[${snapshot.board.x},${snapshot.board.y}]${sectorText}`;
    return { ok: true, rocket: activation.rocket, message };
  }

  function getActiveRocket(piecesState) {
    if (!piecesState?.activeRocketId) return null;
    return piecesState.rockets.find((rocket) => rocket.id === piecesState.activeRocketId) || null;
  }

  function removeRocket(piecesState, rocketId) {
    const index = piecesState.rockets.findIndex((rocket) => rocket.id === rocketId);
    if (index === -1) {
      const message = `火箭 R${rocketId} 不存在`;
      return { ok: false, rocketId, message };
    }

    const removedRocket = piecesState.rockets[index];
    if (isControllablePlayerRocket(removedRocket)) {
      releasePlayerRocketSequence(
        piecesState,
        removedRocket.playerId,
        removedRocket.playerSequence,
      );
    }

    piecesState.rockets.splice(index, 1);
    if (piecesState.activeRocketId === rocketId) {
      const next = piecesState.rockets[piecesState.rockets.length - 1];
      piecesState.activeRocketId = next ? next.id : null;
    }

    const message = `移除 R${rocketId}`;
    return { ok: true, rocketId, message };
  }

  function serializeSectorOccupancy(piecesState) {
    return Object.fromEntries(
      [...getSectorOccupancy(piecesState).entries()].map(([key, slots]) => [
        key,
        [...slots.keys()].sort((a, b) => a - b),
      ]),
    );
  }

  return Object.freeze({
    SECTOR_RING_MIN,
    SECTOR_RING_MAX,
    ROCKET_SURFACE,
    ROCKET_KIND,
    createRocketState,
    buildProbeLocationData,
    normalizeBoardPoint,
    normalizePolarPoint,
    getRocketSurface,
    getPolarPointFromBoardPoint,
    getBoardPointFromPolarPoint,
    createRocketSnapshot,
    getSectorOccupancy,
    getOccupiedSlotIndices,
    findAvailableSlotIndex,
    assignRocketToSlot,
    placeRocketByPriority,
    getRocketSectorCoordinate,
    getActiveRocket,
    setActiveRocket,
    getRocketsForPlayer,
    getMovableTokensForPlayer,
    isControllablePlayerRocket,
    isMovablePlayerToken,
    isChongFossilRewardProbe,
    formatRocketLabel,
    removeRocket,
    placeRocketAtBoardPoint,
    launchRocketAtSector,
    createMovableTokenAtSector,
    canMoveRocket,
    canMoveFromCoordinate,
    moveRocket,
    moveActiveRocket,
    serializeSectorOccupancy,
  });
});
