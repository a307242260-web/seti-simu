(function () {
  "use strict";

  const solar = window.SetiSolarSystem;

  /** 与官网 main.js 一致的每层转盘随机偏移基数 */
  const WHEEL_OFFSETS = [0, 0, 20, 11, 4];
  const ROCKET_IMAGE_SRC = "../assets/tokens/rocket.png";
  const ROCKET_IMAGE_SCALE = 0.2;
  const ROCKET_COORDINATE_STORAGE_KEY = "seti.randomizer.rocketCoordinates";

  const state = solar.createBaselineState();
  const rocketState = {
    nextRocketId: 1,
    activeRocketId: null,
    draggingRocketId: null,
    rockets: [],
    savedCoordinates: loadSavedRocketCoordinates(),
  };

  rocketState.nextRocketId = rocketState.savedCoordinates.reduce((nextId, rocket) => (
    Math.max(nextId, Number(rocket.id || 0) + 1)
  ), 1);

  const els = {
    appWrap: document.querySelector(".app-wrap"),
    boardShell: document.getElementById("board-shell"),
    reportDock: document.getElementById("report-dock"),
    wheelWrap: document.getElementById("wheel-wrap"),
    tokenLayer: document.getElementById("token-layer"),
    buttonWrap: document.getElementById("button-wrap"),
    wheels: {
      1: document.getElementById("wheel-1"),
      2: document.getElementById("wheel-2"),
      3: document.getElementById("wheel-3"),
      4: document.getElementById("wheel-4"),
    },
    sectorWraps: {
      1: document.getElementById("sector-wrap-1"),
      2: document.getElementById("sector-wrap-2"),
      3: document.getElementById("sector-wrap-3"),
      4: document.getElementById("sector-wrap-4"),
    },
    spinButton: document.getElementById("spin-button"),
    debugToggle: document.getElementById("debug-toggle"),
    debugRotateButton: document.getElementById("debug-rotate-button"),
    debugLaunchButton: document.getElementById("debug-launch-button"),
    debugSaveButton: document.getElementById("debug-save-button"),
    debugReadout: document.getElementById("debug-readout"),
    logToggle: document.getElementById("log-toggle"),
    stateReadout: document.getElementById("state-readout"),
  };

  function resize() {
    const h = window.innerHeight;
    const chrome = els.buttonWrap.offsetHeight + 12;
    const boardWidth = els.boardShell.clientWidth || window.innerWidth;
    const boardHeight = h - chrome - 16;
    const boardSize = Math.floor(Math.max(220, Math.min(boardWidth, boardHeight)));
    els.wheelWrap.style.width = `${boardSize}px`;
    els.wheelWrap.style.height = `${boardSize}px`;
    els.buttonWrap.style.width = `${boardSize}px`;
  }

  function setLogOpen(open) {
    els.appWrap.classList.toggle("log-collapsed", !open);
    els.logToggle.setAttribute("aria-expanded", String(open));
    resize();
  }

  function setDebugOpen(open) {
    els.appWrap.classList.toggle("debug-collapsed", !open);
    els.debugToggle.setAttribute("aria-expanded", String(open));
    resize();
  }

  function loadSavedRocketCoordinates() {
    try {
      const value = window.localStorage.getItem(ROCKET_COORDINATE_STORAGE_KEY);
      if (!value) return [];
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((rocket) => ({
          id: Number(rocket.id),
          x: roundBoardCoordinate(rocket.x),
          y: roundBoardCoordinate(rocket.y),
        }))
        .filter((rocket) => Number.isFinite(rocket.id)
          && Number.isFinite(rocket.x)
          && Number.isFinite(rocket.y));
    } catch (error) {
      return [];
    }
  }

  function storeSavedRocketCoordinates() {
    window.localStorage.setItem(
      ROCKET_COORDINATE_STORAGE_KEY,
      JSON.stringify(rocketState.savedCoordinates),
    );
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundBoardCoordinate(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function normalizeBoardPoint(point) {
    const size = solar.GLOBAL_COORDINATE_SYSTEM.size;
    return {
      x: roundBoardCoordinate(clamp(Number(point.x), 0, size)),
      y: roundBoardCoordinate(clamp(Number(point.y), 0, size)),
    };
  }

  function getBoardPointFromClientPosition(clientX, clientY) {
    const rect = els.wheelWrap.getBoundingClientRect();
    const size = solar.GLOBAL_COORDINATE_SYSTEM.size;

    return normalizeBoardPoint({
      x: ((clientX - rect.left) / rect.width) * size,
      y: ((clientY - rect.top) / rect.height) * size,
    });
  }

  function formatBoardPoint(point) {
    return `[${point.x.toFixed(2)},${point.y.toFixed(2)}]`;
  }

  function getEarthLaunchPoint() {
    const snapshot = solar.createSolarSnapshot(state);
    const earth = snapshot.planetLocations.find((planet) => planet.planetId === "earth");

    if (!earth) {
      throw new Error("Earth position was not found in the current solar snapshot");
    }

    return {
      grid: { x: earth.x, y: earth.y },
      global: normalizeBoardPoint(solar.solarGridToGlobalPoint(earth.x, earth.y)),
    };
  }

  function setRocketAssetSize() {
    const image = new Image();
    image.addEventListener("load", () => {
      const width = Math.max(1, Math.round(image.naturalWidth * ROCKET_IMAGE_SCALE));
      els.tokenLayer.style.setProperty("--rocket-width", `${width}px`);
    });
    image.src = ROCKET_IMAGE_SRC;
  }

  function renderRocketElement(rocket) {
    let element = document.getElementById(`rocket-${rocket.id}`);
    if (!element) {
      element = document.createElement("img");
      element.className = "rocket-token";
      element.id = `rocket-${rocket.id}`;
      element.src = ROCKET_IMAGE_SRC;
      element.alt = `火箭 ${rocket.id}`;
      element.draggable = false;
      element.dataset.rocketId = String(rocket.id);
      element.addEventListener("pointerdown", handleRocketPointerDown);
      element.addEventListener("pointermove", handleRocketPointerMove);
      element.addEventListener("pointerup", handleRocketPointerUp);
      element.addEventListener("pointercancel", handleRocketPointerUp);
      els.tokenLayer.appendChild(element);
    }

    element.style.left = `${rocket.x / 10}%`;
    element.style.top = `${rocket.y / 10}%`;
    element.classList.toggle("is-dragging", rocketState.draggingRocketId === rocket.id);
  }

  function renderRockets() {
    rocketState.rockets.forEach(renderRocketElement);
  }

  function renderDebugReadout() {
    const activeRocket = rocketState.rockets.find((rocket) => rocket.id === rocketState.activeRocketId);
    const rocketLines = rocketState.rockets.length
      ? rocketState.rockets.map((rocket) => {
        const marker = rocket.id === rocketState.activeRocketId ? "*" : " ";
        return `${marker}R${rocket.id} ${formatBoardPoint(rocket)}`;
      })
      : ["无"];
    const savedLines = rocketState.savedCoordinates.length
      ? rocketState.savedCoordinates.map((rocket) => `R${rocket.id} ${formatBoardPoint(rocket)}`)
      : ["无"];

    els.debugReadout.textContent = [
      `坐标系 board-${solar.GLOBAL_COORDINATE_SYSTEM.size}`,
      activeRocket ? `当前 R${activeRocket.id} ${formatBoardPoint(activeRocket)}` : "当前 无",
      "",
      "火箭坐标",
      ...rocketLines,
      "",
      "已保存",
      ...savedLines,
    ].join("\n");
  }

  function launchRocket() {
    const launchPoint = getEarthLaunchPoint();
    const rocket = {
      id: rocketState.nextRocketId,
      x: launchPoint.global.x,
      y: launchPoint.global.y,
      launchGrid: launchPoint.grid,
    };

    rocketState.nextRocketId += 1;
    rocketState.activeRocketId = rocket.id;
    rocketState.rockets.push(rocket);
    renderRocketElement(rocket);
    renderDebugReadout();
  }

  function updateRocketPositionFromPointer(event) {
    const rocket = rocketState.rockets.find((item) => item.id === rocketState.activeRocketId);
    if (!rocket) return;

    const point = getBoardPointFromClientPosition(event.clientX, event.clientY);
    rocket.x = point.x;
    rocket.y = point.y;
    renderRocketElement(rocket);
    renderDebugReadout();
  }

  function handleRocketPointerDown(event) {
    const rocketId = Number(event.currentTarget.dataset.rocketId);
    rocketState.activeRocketId = rocketId;
    rocketState.draggingRocketId = rocketId;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    updateRocketPositionFromPointer(event);
    event.preventDefault();
  }

  function handleRocketPointerMove(event) {
    const rocketId = Number(event.currentTarget.dataset.rocketId);
    if (rocketState.draggingRocketId !== rocketId) return;

    updateRocketPositionFromPointer(event);
  }

  function handleRocketPointerUp(event) {
    const rocketId = Number(event.currentTarget.dataset.rocketId);
    if (rocketState.draggingRocketId !== rocketId) return;

    if (event.currentTarget.releasePointerCapture) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    rocketState.draggingRocketId = null;
    const rocket = rocketState.rockets.find((item) => item.id === rocketId);
    if (rocket) renderRocketElement(rocket);
    renderDebugReadout();
  }

  function saveRocketCoordinates() {
    rocketState.savedCoordinates = rocketState.rockets.map((rocket) => ({
      id: rocket.id,
      x: rocket.x,
      y: rocket.y,
    }));
    storeSavedRocketCoordinates();
    renderDebugReadout();
  }

  function stepsToTransform(steps) {
    const rotation = steps * (Math.PI / 4);
    return `rotate(${rotation}rad)`;
  }

  function renderWheels() {
    for (let w = 1; w <= 4; w += 1) {
      els.wheels[w].style.transform = stepsToTransform(state.wheelSteps[w]);
    }
  }

  function renderSectors() {
    for (let slot = 1; slot <= 4; slot += 1) {
      const wrap = els.sectorWraps[slot];
      wrap.innerHTML = "";
      const sectorId = state.sectorBySlot[slot];
      if (!sectorId) continue;

      const sector = document.createElement("div");
      sector.className = `sector sector-${sectorId}`;
      wrap.appendChild(sector);
    }
  }

  function renderStateReadout() {
    const snapshot = solar.createSolarSnapshot(state);
    const axisLine = "坐标轴 x0=中线上方偏右第一块，顺时针递增";
    const wheelLine = [1, 2, 3, 4]
      .map((w) => `W${w}=${solar.mod8(state.wheelSteps[w])}`)
      .join("  ");
    const planetLine = snapshot.planetLocations
      .map((planet) => `${planet.name}[${planet.x},${planet.y}]`)
      .join("  ");
    const nebulaLine = snapshot.nebulaRelations
      .map((relation) => relation.displayText)
      .join("  ");
    const visibleCounts = Object.entries(snapshot.statistics.visibleMeaningfulContentCounts)
      .map(([label, count]) => `${label}=${count}`)
      .join("  ");
    els.stateReadout.textContent = [
      axisLine,
      `版图位置 ${wheelLine}`,
      `行星 ${planetLine}`,
      `星云 ${nebulaLine}`,
      `可见统计 ${visibleCounts}`,
      "",
      "可见坐标",
      formatVisibleCoordinateGroups(snapshot.visibleCoordinateGroups),
    ].join("\n");
  }

  function formatNamedCoordinates(items) {
    if (!items.length) return "无";
    return items.map((item) => {
      const label = item.kind === solar.layout.CONTENT_KIND.PLANET ? `${item.label}` : "";
      return `${label}[${item.x},${item.y}]`;
    }).join("  ");
  }

  function formatVisibleCoordinateGroups(groups) {
    return [
      `可见星球坐标 ${formatNamedCoordinates(groups.planets)}`,
      `小行星坐标 ${formatNamedCoordinates(groups.asteroids)}`,
      `彗星坐标 ${formatNamedCoordinates(groups.comets)}`,
    ].join("\n");
  }

  /** 官网 randomizeWheels 的无动画版：直接累加步数并渲染 */
  function randomizeWheels() {
    for (let w = 1; w <= 4; w += 1) {
      const delta = Math.floor(Math.random() * 8 + WHEEL_OFFSETS[w]);
      state.wheelSteps[w] -= delta;
    }
    state.rotation = solar.normalizeRotationState(state.wheelSteps, 0);
    renderWheels();
  }

  /** 官网 randomizeSectors 逻辑：将 4 个扇区洗牌分配到 4 个外边槽位 */
  function randomizeSectors() {
    const pool = [1, 2, 3, 4];
    while (pool.length) {
      const slotId = pool.length;
      const pickIndex = Math.floor(Math.random() * pool.length);
      const sectorId = pool.splice(pickIndex, 1)[0];
      state.sectorBySlot[slotId] = sectorId;
    }
    renderSectors();
  }

  function randomizeAll() {
    els.spinButton.classList.remove("pulsin");
    randomizeWheels();
    randomizeSectors();
    renderStateReadout();
  }

  function getSetupState() {
    return solar.createSetupState(state);
  }

  function rotateSolarOrbit(count) {
    state.rotation = solar.applySolarOrbitRotation(state.rotation, count || 1);
    state.wheelSteps = solar.rotationToWheelSteps(state.rotation);
    renderWheels();
    renderStateReadout();
  }

  els.spinButton.addEventListener("click", randomizeAll);
  els.debugToggle.addEventListener("click", () => {
    setDebugOpen(els.appWrap.classList.contains("debug-collapsed"));
  });
  els.debugRotateButton.addEventListener("click", () => {
    rotateSolarOrbit(1);
  });
  els.debugLaunchButton.addEventListener("click", launchRocket);
  els.debugSaveButton.addEventListener("click", saveRocketCoordinates);
  els.logToggle.addEventListener("click", () => {
    setLogOpen(els.appWrap.classList.contains("log-collapsed"));
  });
  window.addEventListener("resize", resize);

  setRocketAssetSize();
  resize();
  renderWheels();
  renderSectors();
  renderStateReadout();
  renderRockets();
  renderDebugReadout();

  window.SetiRandomizer = {
    randomize: randomizeAll,
    rotateSolarOrbit,
    launchRocket,
    saveRocketCoordinates,
    screenToBoardPoint: (clientX, clientY) => getBoardPointFromClientPosition(clientX, clientY),
    solarGridToGlobalPoint: (x, y) => solar.solarGridToGlobalPoint(x, y),
    resolveVisibleContent: (x, y) => solar.resolveVisibleContent(x, y, state),
    getSolarSnapshot: () => solar.createSolarSnapshot(state),
    getWheelCoordinateReport: () => solar.collectWheelCoordinateReport(state),
    getVisibleCoordinateReport: () => solar.collectVisibleCoordinateReport(state),
    getVisibleCoordinateGroups: () => solar.collectVisibleCoordinateGroups(state),
    getRocketCoordinates: () => structuredClone(rocketState.rockets),
    getSavedRocketCoordinates: () => structuredClone(rocketState.savedCoordinates),
    getState: () => structuredClone({
      ...state,
      rockets: rocketState.rockets,
      savedRocketCoordinates: rocketState.savedCoordinates,
      setup: getSetupState(),
      solarSystem: solar.createSolarSnapshot(state),
    }),
    getSetupState,
  };
})();
