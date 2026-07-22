(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppRenderRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const RENDER_CONTEXT_CAPABILITY_INVENTORY = Object.freeze({
    platform: Object.freeze(["document", "Image", "getProjection", "viewState", "enforceCapabilityInventory"]),
    pureModules: Object.freeze([
      "solar", "players", "rocketActions", "planetStats", "planetReferenceLayout", "endGameScoring",
      "finalScoring", "data", "aliens", "jiuzhe", "yichangdian", "chong", "aomomo", "runezu",
      "industry", "tech", "actionHistory", "quickActionHistory",
    ]),
    domOnlyHelpers: Object.freeze([
      "createInitialSelectionPicker", "createCompanyCardSummary", "createPlayerNameStat", "createStatSeparator",
      "createStatIcon", "createInlineIconValue", "createPlayerStatsRow", "buildPlayerResourceStatNodes",
      "buildPlayerIncomeStatNodes", "buildPlayerRunezuStatNodes", "buildPlayerFangzhouStatNodes",
      "renderFinalScoreBoard", "attachCardHoverPreview", "getPublicCardHeight",
    ]),
    scalarOrFreshDtoSelectors: Object.freeze([
      "getPlayerRoundOrderNumber", "getPlayerDisplayLabel", "isPlayerPassedThisRound", "buildPlutoMarkerContext",
      "canUseCardCornerQuickAction", "isIndustryHandSelectionActive", "isIndustryFutureSpanHandSelectionActive",
      "isFutureSpanEligibleHandCard", "getFutureSpanDeltaForCard", "isMovePaymentCard",
      "getCardCornerQuickActionForCard", "getHandCardPlayActionForCard", "getCardPlayCost", "formatCardPlayCost",
      "getPublicScanChoicesForCard", "getPlanetName", "getBoardPointFromPolarPoint", "getReferencePlacementName",
      "formatPlanetsReferencePoint", "formatPolarPoint", "formatBoardPoint", "getNormalTokenAssetForPlayer",
      "isRocketOnPlanetsReference", "isPlanetMarkerRocket", "isRocketMoveCandidate", "isRocketMoveMuted",
      "getChongPlanetLabel", "getTurnReadoutLines", "getInitialSelectionReadoutLines", "getPlayerReadoutLines",
      "getPlanetStatsReadoutLines", "getRocketCoordinateReadoutLines",
    ]),
    inputCallbacks: Object.freeze(["handleRocketPointerDown", "syncInteractionFocusChrome", "placeDataToBlueSlot"]),
    domState: Object.freeze([
      "tokenWidths", "techRenderContext", "sectorElements", "yichangdianAnomalyMarkerElements",
      "chongPlanetFossilMarkerElements", "chongFossilOwnerTokenElements", "runezuBoardSymbolElements", "els",
      "ROCKET_IMAGE_SCALE", "REFERENCE_ORBIT_IMAGE_SCALE", "REFERENCE_LANDDING_IMAGE_SCALE", "RESOURCE_ICON_SRC",
      "OPPONENT_SECTOR_WIN_STATS", "OPPONENT_TECH_TYPES", "ROTATE_STATE_SLOTS",
    ]),
    forbidden: Object.freeze([
      "browserRuleState", "workingState", "solarState", "playerState", "rocketState", "nebulaDataState",
      "planetStatsState", "alienGameState", "finalScoringState", "turnState", "cardState", "techGameState",
      "getCurrentPlayer", "getInterfacePlayer", "getActivePlayers", "getPlayerById",
      "getPlayerByColor", "syncFinalScorePendingMarks", "computePlayerFinalScoreBreakdown", "getPendingMovePayment",
      "getPendingCardCornerQuickAction", "getPendingHandCardPlayAction", "getPendingPlayCardSelection",
      "isDiscardSelectionActive", "isPlayCardSelectionActive", "isMovePaymentSelectionActive",
      "isHandScanSelectionActive", "getInitialSelectionOffer", "renderReservedCardsFromTaskState",
      "updatePublicCardControls", "updatePlayerHandPanelTitle", "canBlindDraw", "selectDefaultRocketForCurrentPlayer",
      "isCardSelectionActive", "isPublicCardMultiSelectActive", "isAiAutoBattlePlayer",
      "ensurePublicCardsFilledRespectingDelayedRefills",
    ]),
  });
  const ALLOWED_RENDER_CONTEXT_KEYS = new Set(Object.entries(RENDER_CONTEXT_CAPABILITY_INVENTORY)
    .filter(([category]) => category !== "forbidden")
    .flatMap(([, keys]) => keys));

  function cloneSelectorResult(value) {
    return value == null || typeof value !== "object" ? value : structuredClone(value);
  }

  function createCardHoverPreviewRuntime(context = {}) {
    const windowRef = context.window || root;
    const documentRef = context.document || root.document;
    let preview = null;
    let previewImage = null;
    let previewAnchor = null;
    let listenersBound = false;

    function position(anchor = previewAnchor) {
      if (!anchor || !preview || !preview.classList.contains("is-visible")) return;

      const anchorRect = anchor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const margin = 12;
      const previewWidth = previewRect.width || 260;
      const previewHeight = previewRect.height || 360;
      const viewportWidth = windowRef.innerWidth || documentRef.documentElement.clientWidth || 0;
      const viewportHeight = windowRef.innerHeight || documentRef.documentElement.clientHeight || 0;
      const maxLeft = Math.max(margin, viewportWidth - previewWidth - margin);
      let left = anchorRect.left + (anchorRect.width / 2) - (previewWidth / 2);
      let top = anchorRect.top - previewHeight - margin;
      let placement = "above";

      if (top < margin) {
        top = anchorRect.bottom + margin;
        placement = "below";
      }
      if (top + previewHeight > viewportHeight - margin) {
        top = Math.max(margin, viewportHeight - previewHeight - margin);
      }

      left = Math.min(Math.max(margin, left), maxLeft);
      preview.dataset.placement = placement;
      preview.style.left = `${Math.round(left)}px`;
      preview.style.top = `${Math.round(top)}px`;
    }

    function hide(anchor) {
      if (anchor && previewAnchor && anchor !== previewAnchor) return;
      if (preview) {
        preview.classList.remove("is-visible");
        preview.classList.remove("card-hover-preview--pass-reserve");
        preview.classList.remove("card-hover-preview--action-briefing");
        preview.style.visibility = "";
      }
      previewAnchor = null;
    }

    function bindListeners() {
      if (listenersBound) return;
      listenersBound = true;
      windowRef.addEventListener("resize", () => position(), { passive: true });
      windowRef.addEventListener("scroll", () => position(), { passive: true, capture: true });
      documentRef.addEventListener("pointerdown", () => hide(), { capture: true });
      documentRef.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") hide();
      }, { capture: true });
    }

    function ensure() {
      if (preview && previewImage) return preview;
      preview = documentRef.createElement("div");
      preview.className = "card-hover-preview";
      preview.setAttribute("aria-hidden", "true");
      previewImage = documentRef.createElement("img");
      previewImage.alt = "";
      previewImage.decoding = "async";
      previewImage.onload = () => position();
      preview.append(previewImage);
      documentRef.body.append(preview);
      bindListeners();
      return preview;
    }

    function show(anchor, src, label) {
      if (!anchor || !src) return;
      const element = ensure();
      previewAnchor = anchor;
      previewImage.src = src;
      previewImage.alt = label || "";
      element.classList.toggle(
        "card-hover-preview--pass-reserve",
        Boolean(anchor.closest?.(".pass-reserve-selection-overlay")),
      );
      element.classList.toggle(
        "card-hover-preview--action-briefing",
        Boolean(anchor.closest?.(".action-briefing-overlay")),
      );
      element.style.visibility = "hidden";
      element.classList.add("is-visible");
      position(anchor);
      element.style.visibility = "";
    }

    function attach(anchor, src, label) {
      if (!anchor || !src) return anchor;
      const cardLabel = label || "";
      anchor.addEventListener("pointerenter", () => show(anchor, src, cardLabel));
      anchor.addEventListener("pointerleave", () => hide(anchor));
      anchor.addEventListener("pointermove", () => position(anchor));
      anchor.addEventListener("focus", () => show(anchor, src, cardLabel));
      anchor.addEventListener("blur", () => hide(anchor));
      return anchor;
    }

    return { attach, show, hide, position, ensure };
  }

  function createCoordinateRuntime(context = {}) {
    const {
      els,
      solar,
      rocketActions,
      planetReferenceLayout,
      planetStats,
      players,
      referencePlacementKindLabels,
      planetsReferenceSize,
      rocketSurface,
      removeRocketElement,
      renderRockets,
    } = context;
    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("coordinate-runtime operation requires an explicit workingRoot");
      }
      return workingRoot;
    }
    function getReferencePlacementKindLabel(kind) {
      return referencePlacementKindLabels[kind] || kind || "贴图";
    }
    function getReferencePlacementName(placement) {
      if (!placement) return null;
      if (placement.kind === "satellite") return `${placement.parentPlanetName} ${placement.satelliteName}`;
      const index = placement.sequence ? placement.sequence : "";
      return `${placement.planetName} ${getReferencePlacementKindLabel(placement.kind)}${index}`;
    }
    function buildPlanetOrbitLandReferenceData() { return planetReferenceLayout.buildReferenceData(); }
    function isPlanetMarkerRocket(rocket) { return Boolean(rocket?.referencePlacement?.isPlanetMarker); }
    function getBoardPointFromClientPosition(clientX, clientY) {
      const rect = els.wheelWrap.getBoundingClientRect();
      const size = solar.GLOBAL_COORDINATE_SYSTEM.size;
      return rocketActions.normalizeBoardPoint({
        x: ((clientX - rect.left) / rect.width) * size,
        y: ((clientY - rect.top) / rect.height) * size,
      });
    }
    function getPlanetsReferenceDimensions() {
      return {
        width: els.planetsReferenceImage.naturalWidth
          || Number(els.planetsReferenceImage.getAttribute("width"))
          || planetsReferenceSize.width,
        height: els.planetsReferenceImage.naturalHeight
          || Number(els.planetsReferenceImage.getAttribute("height"))
          || planetsReferenceSize.height,
      };
    }
    function isPointInsideRect(clientX, clientY, rect) {
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }
    function isClientPositionInsidePlanetsReference(clientX, clientY) {
      if (!els.planetsReferenceImage) return false;
      return isPointInsideRect(clientX, clientY, els.planetsReferenceImage.getBoundingClientRect());
    }
    function getPlanetsReferencePointFromClientPosition(clientX, clientY) {
      const rect = els.planetsReferenceImage.getBoundingClientRect();
      const dimensions = getPlanetsReferenceDimensions();
      return rocketActions.normalizePlanetsReferencePoint({
        percentX: ((clientX - rect.left) / rect.width) * 100,
        percentY: ((clientY - rect.top) / rect.height) * 100,
        width: dimensions.width,
        height: dimensions.height,
      });
    }
    function formatBoardPoint(point) { return point ? `[${point.x.toFixed(2)},${point.y.toFixed(2)}]` : "无"; }
    function getPolarPointFromBoardPoint(point) { return rocketActions.getPolarPointFromBoardPoint(point); }
    function getBoardPointFromPolarPoint(point) { return rocketActions.getBoardPointFromPolarPoint(point); }
    function getPolarPointFromClientPosition(clientX, clientY) {
      return getPolarPointFromBoardPoint(getBoardPointFromClientPosition(clientX, clientY));
    }
    function formatPolarPoint(point) {
      return point ? `[r=${point.radius.toFixed(2)},a=${point.angleDegrees.toFixed(2)}]` : "无";
    }
    function formatSectorCoordinate(resolution) {
      return resolution?.sectorCoordinate
        ? `[${resolution.sectorCoordinate.x},${resolution.sectorCoordinate.y}]`
        : "无";
    }
    function formatPlanetsReferencePoint(point) {
      return point
        ? `planets贴图[${point.x.toFixed(2)},${point.y.toFixed(2)}] ${point.percentX.toFixed(2)}%,${point.percentY.toFixed(2)}%`
        : "planets贴图 无";
    }
    function isRocketOnPlanetsReference(rocket) {
      return (rocket?.surface || rocketSurface.SOLAR) === rocketSurface.PLANETS_REFERENCE;
    }
    function createDefaultReferencePlacementInput(placement) {
      return { x: placement.x, y: placement.y, width: planetsReferenceSize.width, height: planetsReferenceSize.height };
    }
    function createPlanetMarkerPlacement(slot, markerState) {
      const common = {
        x: slot.x,
        y: slot.y,
        isPlanetMarker: true,
        playerId: markerState.playerId,
        color: markerState.color,
        referenceOffsetTokenWidths: markerState.referenceOffsetTokenWidths || 0,
      };
      return slot.satelliteId
        ? { ...common, parentPlanetId: slot.parentPlanetId, parentPlanetName: slot.parentPlanetName, satelliteId: slot.satelliteId, satelliteName: slot.satelliteName, kind: "satellite" }
        : { ...common, planetId: slot.planetId, planetName: slot.planetName, kind: slot.kind, sequence: slot.sequence, angleOffsetDegrees: slot.angleOffsetDegrees, center: slot.center };
    }
    function createPlanetMarkerRocket(workingRoot, slot, markerState) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const placement = createPlanetMarkerPlacement(slot, markerState);
      const rocket = { id: rocketState.nextRocketId, playerId: markerState.playerId, color: markerState.color, referencePlacement: placement };
      rocketState.nextRocketId += 1;
      rocketState.rockets.push(rocket);
      rocketActions.placeRocketAtPlanetsReferencePoint(rocketState, rocket.id, createDefaultReferencePlacementInput(placement));
      return rocket;
    }
    function removePlanetMarkerRockets(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      rocketState.rockets.filter(isPlanetMarkerRocket).forEach((rocket) => {
        rocketActions.removeRocket(rocketState, rocket.id);
        removeRocketElement(rocket.id);
      });
    }
    function syncPlanetOrbitLandMarkers(workingRoot) {
      const { planetStatsState } = requireWorkingRoot(workingRoot);
      removePlanetMarkerRockets(workingRoot);
      for (const planetId of planetReferenceLayout.PLANET_ORDER) {
        for (const marker of planetStats.getPlanetOrbitMarkers(planetStatsState, planetId)) {
          const slot = planetReferenceLayout.getPlanetSlot(planetId, "orbit", marker.sequence);
          if (slot) createPlanetMarkerRocket(workingRoot, slot, marker);
        }
        for (const marker of planetStats.getPlanetLandingMarkers(planetStatsState, planetId)) {
          const slot = planetReferenceLayout.getPlanetSlot(planetId, "land", marker.displaySlot || marker.sequence);
          if (slot) createPlanetMarkerRocket(workingRoot, slot, marker);
        }
        for (const marker of planetStats.getSatelliteLandingMarkers(planetStatsState, planetId)) {
          const slot = planetReferenceLayout.getSatellitePlacement(planetId, marker.satelliteId);
          if (slot) createPlanetMarkerRocket(workingRoot, slot, marker);
        }
      }
      renderRockets();
    }
    function seedDefaultReferenceRockets(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (rocketState.rockets.length) return;
      rocketState.activeRocketId = null;
      rocketState.statusNote = null;
      syncPlanetOrbitLandMarkers(workingRoot);
    }
    function formatRocketLabel(rocket) { return rocketActions.formatRocketLabel(rocket); }
    function getMovableTokensForPlayer(workingRoot, playerId) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      return rocketActions.getMovableTokensForPlayer
        ? rocketActions.getMovableTokensForPlayer(rocketState, playerId)
        : rocketActions.getRocketsForPlayer(rocketState, playerId);
    }
    function createRocketSnapshot(rocket) { return rocketActions.createRocketSnapshot(rocket); }
    function getEarthSectorCoordinate(workingRoot) {
      const { solarState } = requireWorkingRoot(workingRoot);
      const earth = solar.createSolarSnapshot(solarState).planetLocations.find((planet) => planet.planetId === "earth");
      if (!earth) throw new Error("Earth position was not found in the current solar snapshot");
      return { x: earth.x, y: earth.y };
    }
    function getRocketCoordinateReadoutLines(rocketState) {
      const activeRocket = (rocketState?.rockets || []).find((rocket) => rocket.id === rocketState.activeRocketId);
      const formatRocketLine = (rocket) => {
        const marker = rocket.id === rocketState.activeRocketId ? "*" : " ";
        const snapshot = createRocketSnapshot(rocket);
        const color = players.getPlayerColorDefinition(rocket.color || players.DEFAULT_PLAYER_COLOR);
        if (snapshot.surface === rocketSurface.PLANETS_REFERENCE) {
          return `${marker}${formatRocketLabel(rocket)} ${color.label} ${formatPlanetsReferencePoint(snapshot.planetsReference)}`;
        }
        const slot = snapshot.slotSectorCoordinate
          ? ` 扇区[${snapshot.slotSectorCoordinate.x},${snapshot.slotSectorCoordinate.y}]#${snapshot.slotIndex}`
          : snapshot.sectorCoordinate
            ? ` -> ${formatSectorCoordinate(snapshot)}`
            : "";
        return `${marker}${formatRocketLabel(rocket)} ${color.label} ${formatPolarPoint(snapshot.polar)} ${formatBoardPoint(snapshot.board)}${slot}`;
      };
      const occupancy = rocketActions.getSectorOccupancy(rocketState);
      const occupancyLines = occupancy.size
        ? [...occupancy.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, slots]) => `扇区[${key}] 占用#${[...slots.keys()].sort((a, b) => a - b).join(",")}`)
        : ["无"];
      return [
        "火箭坐标",
        `火箭坐标系 polar board-${solar.GLOBAL_COORDINATE_SYSTEM.size}`,
        activeRocket ? `当前 ${formatRocketLine(activeRocket).replace(/^[* ]/, "")}` : "当前 无",
        rocketState?.statusNote ? `提示 ${rocketState.statusNote}` : "提示 无",
        "",
        "扇区占用",
        ...occupancyLines,
      ];
    }

    return {
      getReferencePlacementKindLabel, getReferencePlacementName, buildPlanetOrbitLandReferenceData,
      isPlanetMarkerRocket, getBoardPointFromClientPosition, getPlanetsReferenceDimensions,
      isPointInsideRect, isClientPositionInsidePlanetsReference, getPlanetsReferencePointFromClientPosition,
      formatBoardPoint, getPolarPointFromBoardPoint, getBoardPointFromPolarPoint,
      getPolarPointFromClientPosition, formatPolarPoint, formatSectorCoordinate,
      formatPlanetsReferencePoint, isRocketOnPlanetsReference, createDefaultReferencePlacementInput,
      createPlanetMarkerPlacement, createPlanetMarkerRocket, removePlanetMarkerRockets,
      syncPlanetOrbitLandMarkers, seedDefaultReferenceRockets, formatRocketLabel,
      getMovableTokensForPlayer, createRocketSnapshot, getEarthSectorCoordinate,
      getRocketCoordinateReadoutLines,
    };
  }

  function createRenderRuntime(context = {}) {
    const document = context.document || root.document;
    const ImageCtor = context.Image || root.Image;
    const forbiddenCapabilities = RENDER_CONTEXT_CAPABILITY_INVENTORY.forbidden
      .filter((key) => Object.hasOwn(context, key));
    if (forbiddenCapabilities.length) {
      throw new TypeError(`createRenderRuntime 拒绝规则 root reader/writer: ${forbiddenCapabilities.join(", ")}`);
    }
    if (context.enforceCapabilityInventory) {
      const unknownCapabilities = Object.keys(context).filter((key) => !ALLOWED_RENDER_CONTEXT_KEYS.has(key));
      if (unknownCapabilities.length) {
        throw new TypeError(`createRenderRuntime 未分类 capability: ${unknownCapabilities.join(", ")}`);
      }
    }
    if (typeof context.getProjection !== "function") {
      throw new TypeError("createRenderRuntime 需要 getProjection() 只读 BrowserProjection provider");
    }

    let activeProjection = null;

    function loadProjection() {
      const projection = context.getProjection();
      if (!projection || projection.schemaVersion !== "seti-browser-host-v1" || !projection.resident) {
        throw new TypeError("createRenderRuntime 需要含 resident view 的 seti-browser-host-v1 BrowserProjection");
      }
      if (!Object.isFrozen(projection) || !Object.isFrozen(projection.resident)) {
        throw new TypeError("createRenderRuntime 拒绝 mutable BrowserProjection");
      }
      return projection;
    }

    function readProjection() {
      return activeProjection || loadProjection();
    }

    function withProjection(render) {
      return function renderFromProjection(...args) {
        const parentProjection = activeProjection;
        if (!activeProjection) activeProjection = loadProjection();
        try {
          return render(...args);
        } finally {
          activeProjection = parentProjection;
        }
      };
    }

    function createReadonlySelector(section, fallback = {}) {
      return new Proxy(fallback, {
        get(_target, key) {
          if (key === Symbol.toStringTag) return "BrowserProjectionSelector";
          return (readProjection().resident[section] || fallback)[key];
        },
        has(_target, key) {
          return key in (readProjection().resident[section] || fallback);
        },
        ownKeys() {
          return Reflect.ownKeys(readProjection().resident[section] || fallback);
        },
        getOwnPropertyDescriptor(_target, key) {
          const source = readProjection().resident[section] || fallback;
          if (!Object.hasOwn(source, key)) return undefined;
          return { configurable: true, enumerable: true, value: source[key], writable: false };
        },
        set() {
          throw new TypeError(`BrowserProjection.${section} 是只读 selector`);
        },
        deleteProperty() {
          throw new TypeError(`BrowserProjection.${section} 是只读 selector`);
        },
      });
    }

    function cloneResident(section, fallback = {}) {
      return structuredClone(readProjection().resident[section] || fallback);
    }

    function clonePlayersForReadout() {
      const snapshot = cloneResident("players", { players: [] });
      for (const player of snapshot.players || []) {
        player.techState = players.normalizePlayerTechState(player.techState);
      }
      return snapshot;
    }

    function getProjectedPlayers() {
      const projectedPlayers = readProjection().resident.players?.players;
      return Array.isArray(projectedPlayers) ? projectedPlayers : [];
    }

    function getPlayerById(playerId) {
      return getProjectedPlayers().find((player) => String(player?.id) === String(playerId)) || null;
    }

    function getPlayerByColor(playerColor) {
      return getProjectedPlayers().find((player) => player?.color === playerColor) || null;
    }

    function getCurrentPlayer() {
      return getPlayerById(readProjection().resident.players?.currentPlayerId);
    }

    function getInterfacePlayer() {
      const viewerPlayerId = readProjection().viewer?.role === "player"
        ? readProjection().viewer.playerId
        : null;
      return getPlayerById(viewerPlayerId) || getCurrentPlayer();
    }

    function getActivePlayers() {
      const activePlayerIds = new Set(
        (readProjection().resident.turn?.activePlayerIds || []).map(String),
      );
      return getProjectedPlayers().filter((player) => activePlayerIds.has(String(player?.id)));
    }

    function getPlayerFinalScoreBreakdown(player) {
      return readProjection().resident.finalScoring?.breakdownsByPlayerId?.[String(player?.id)]
        || { totalScore: Number(player?.resources?.score) || 0 };
    }

    function cloneProjectedPlayer(player) {
      return player ? structuredClone(player) : null;
    }

    const solarState = createReadonlySelector("solar");
    const playerState = createReadonlySelector("players", { players: [] });
    const rocketState = createReadonlySelector("pieces", { rockets: [] });
    const nebulaDataState = createReadonlySelector("data");
    const planetStatsState = createReadonlySelector("planets");
    const alienGameState = createReadonlySelector("aliens");
    const turnState = createReadonlySelector("turn");
    const cardState = createReadonlySelector("cards", { publicCards: [] });
    const continuationState = createReadonlySelector("decisions");
    const uiRuntimeState = context.viewState || {};
    const {
      solar,
      players,
      rocketActions,
      planetStats,
      planetReferenceLayout,
      endGameScoring,
      finalScoring,
      data,
      aliens,
      jiuzhe,
      yichangdian,
      chong,
      aomomo,
      runezu,
      industry,
      tokenWidths,
      techRenderContext,
      sectorElements,
      yichangdianAnomalyMarkerElements,
      chongPlanetFossilMarkerElements,
      chongFossilOwnerTokenElements,
      runezuBoardSymbolElements,
      els,
      ROCKET_IMAGE_SCALE,
      REFERENCE_ORBIT_IMAGE_SCALE,
      REFERENCE_LANDDING_IMAGE_SCALE,
      RESOURCE_ICON_SRC,
      OPPONENT_SECTOR_WIN_STATS,
      OPPONENT_TECH_TYPES,
      ROTATE_STATE_SLOTS,
      getPlayerRoundOrderNumber,
      getPlayerDisplayLabel,
      isPlayerPassedThisRound,
      createInitialSelectionPicker,
      createCompanyCardSummary,
      createPlayerNameStat,
      createStatSeparator,
      createStatIcon,
      createInlineIconValue,
      createPlayerStatsRow,
      buildPlayerResourceStatNodes,
      buildPlayerIncomeStatNodes,
      buildPlayerRunezuStatNodes,
      buildPlayerFangzhouStatNodes,
      renderFinalScoreBoard,
      buildPlutoMarkerContext,
      canUseCardCornerQuickAction,
      isIndustryHandSelectionActive,
      isIndustryFutureSpanHandSelectionActive,
      isFutureSpanEligibleHandCard,
      getFutureSpanDeltaForCard,
      isMovePaymentCard,
      getCardCornerQuickActionForCard,
      getHandCardPlayActionForCard,
      getCardPlayCost,
      formatCardPlayCost,
      getPublicScanChoicesForCard,
      attachCardHoverPreview,
      getPlanetName,
      getBoardPointFromPolarPoint,
      getReferencePlacementName,
      formatPlanetsReferencePoint,
      formatPolarPoint,
      formatBoardPoint,
      getNormalTokenAssetForPlayer,
      isRocketOnPlanetsReference,
      isPlanetMarkerRocket,
      isRocketMoveCandidate,
      isRocketMoveMuted,
      handleRocketPointerDown,
      getChongPlanetLabel,
      getTurnReadoutLines,
      getInitialSelectionReadoutLines,
      getPlayerReadoutLines,
      getRocketCoordinateReadoutLines,
      syncInteractionFocusChrome,
    } = context;
    const getPlanetStatsReadoutLines = context.getPlanetStatsReadoutLines || (() => {
      const lines = planetStats.formatPlanetStatsLines(planetStatsState);
      if (aomomo && (solarState.aomomoActive || alienGameState.aomomo?.revealInitialized)) {
        const aomomoLineIndex = lines.findIndex((line) => String(line).startsWith("奥陌陌 "));
        if (aomomoLineIndex >= 0) {
          lines[aomomoLineIndex] = `奥陌陌 环绕=${aomomo.countOrbitMarkers(alienGameState)} 登陆=${aomomo.countLandingMarkers(alienGameState)}`;
        }
      }
      return ["星球统计", ...lines];
    });
    const getPublicCardHeight = context.getPublicCardHeight || (() => {
      const row = els.publicCardRow;
      if (!row) return null;
      const fromVar = root.getComputedStyle?.(row).getPropertyValue("--public-card-height").trim();
      if (fromVar) {
        const parsed = Number.parseFloat(fromVar);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      const reference = row.querySelector(".public-card");
      const height = reference?.getBoundingClientRect().height || 0;
      return height > 0 ? height : null;
    });
    function loadTokenWidth(asset, scale, fallbackNaturalWidth, onLoad) {
      const image = new ImageCtor();
      const resolveWidth = (naturalWidth) => {
        const canonicalWidth = Number.isFinite(Number(fallbackNaturalWidth))
          ? Number(fallbackNaturalWidth)
          : naturalWidth;
        onLoad(Math.max(1, Math.round(canonicalWidth * scale)));
      };
      image.addEventListener("load", () => {
        resolveWidth(image.naturalWidth || fallbackNaturalWidth);
      });
      image.addEventListener("error", () => {
        resolveWidth(fallbackNaturalWidth);
      });
      image.src = asset;
    }

    function setTokenAssetSizes() {
      const currentPlayer = cloneProjectedPlayer(getCurrentPlayer());
      const color = players.getPlayerColorDefinition(currentPlayer.color);
      let pendingLoads = 3;
      const finalizeTokenSizes = () => {
        pendingLoads -= 1;
        if (pendingLoads === 0) renderRockets();
      };

      loadTokenWidth(color.rocketAsset, ROCKET_IMAGE_SCALE, 205, (width) => {
        tokenWidths.rocket = width;
        els.tokenLayer.style.setProperty("--rocket-width", `${width}px`);
        els.planetsTokenLayer.style.setProperty("--rocket-width", `${width}px`);
        finalizeTokenSizes();
      });
      loadTokenWidth(color.satelliteAsset, REFERENCE_ORBIT_IMAGE_SCALE, 927, (width) => {
        tokenWidths.orbit = width;
        els.planetsTokenLayer.style.setProperty("--reference-orbit-width", `${width}px`);
        finalizeTokenSizes();
      });
      loadTokenWidth(color.landdingAsset, REFERENCE_LANDDING_IMAGE_SCALE, 927, (width) => {
        tokenWidths.landding = width;
        els.planetsTokenLayer.style.setProperty("--reference-land-width", `${width}px`);
        finalizeTokenSizes();
      });
    }

    function applyTokenWidth(element, rocket) {
      if (!isRocketOnPlanetsReference(rocket)) {
        element.style.removeProperty("width");
        return;
      }

      const kind = rocket.referencePlacement?.kind;
      if (kind === "orbit" && tokenWidths.orbit) {
        element.style.width = `${tokenWidths.orbit}px`;
        return;
      }
      if ((kind === "land" || kind === "satellite") && tokenWidths.landding) {
        element.style.width = `${tokenWidths.landding}px`;
        return;
      }
      if (tokenWidths.rocket) {
        element.style.width = `${tokenWidths.rocket}px`;
        return;
      }
      element.style.removeProperty("width");
    }

    function getRocketColorDefinition(rocket) {
      return players.getPlayerColorDefinition(rocket.color || players.DEFAULT_PLAYER_COLOR);
    }

    function getTokenAssetForRocket(rocket, color) {
      if (rocket.tokenSrc) return rocket.tokenSrc;
      if (!isRocketOnPlanetsReference(rocket)) return color.rocketAsset;

      const kind = rocket.referencePlacement?.kind;
      if (kind === "orbit") return color.satelliteAsset;
      if (kind === "land" || kind === "satellite") return color.landdingAsset;
      return color.rocketAsset;
    }

    function isChongFossilToken(rocket) {
      return (rocket?.kind || rocketActions.ROCKET_KIND?.STANDARD) === rocketActions.ROCKET_KIND?.CHONG_FOSSIL;
    }

    function getTokenTypeLabel(rocket) {
      if (isChongFossilToken(rocket)) {
        return "化石";
      }
      if (!isRocketOnPlanetsReference(rocket)) return "火箭";

      const kind = rocket.referencePlacement?.kind;
      if (kind === "orbit") return "卫星";
      if (kind === "land") return "登陆";
      return "火箭";
    }

    function renderRocketElement(rocket) {
      let element = document.getElementById(`rocket-${rocket.id}`);
      const color = getRocketColorDefinition(rocket);

      if (!element) {
        element = document.createElement("img");
        element.className = "rocket-token";
        element.id = `rocket-${rocket.id}`;
        element.draggable = false;
        element.dataset.rocketId = String(rocket.id);
        element.addEventListener("pointerdown", handleRocketPointerDown);
        els.tokenLayer.appendChild(element);
      }

      const layer = isRocketOnPlanetsReference(rocket) ? els.planetsTokenLayer : els.tokenLayer;
      if (layer && element.parentElement !== layer) layer.appendChild(element);

      const referencePlacement = rocket.referencePlacement || null;
      const referenceLabel = getReferencePlacementName(referencePlacement);
      const tokenTypeLabel = getTokenTypeLabel(rocket);
      element.src = getTokenAssetForRocket(rocket, color);
      const rocketLabel = rocketActions.formatRocketLabel(rocket);
      element.alt = referenceLabel
        ? `${referenceLabel} ${color.label}${tokenTypeLabel} ${rocketLabel}`
        : `${color.label}${tokenTypeLabel} ${rocketLabel}`;
      element.dataset.playerId = rocket.playerId || "";
      element.dataset.playerColor = color.id;
      element.dataset.referencePlanet = referencePlacement?.planetId || "";
      element.dataset.referenceParentPlanet = referencePlacement?.parentPlanetId || "";
      element.dataset.referenceSatellite = referencePlacement?.satelliteId || "";
      element.dataset.referenceKind = referencePlacement?.kind || "";
      element.style.setProperty("--rocket-glow", color.glowColor);
      element.classList.toggle("is-dragging", rocketState.draggingRocketId === rocket.id);
      element.classList.toggle("is-reference-placed", isRocketOnPlanetsReference(rocket));
      element.classList.toggle("is-default-reference", Boolean(referencePlacement?.isDefault));
      element.classList.toggle("is-reference-orbit", referencePlacement?.kind === "orbit");
      element.classList.toggle("is-reference-land", referencePlacement?.kind === "land");
      element.classList.toggle("is-reference-satellite", referencePlacement?.kind === "satellite");
      element.classList.toggle("is-planet-marker", Boolean(referencePlacement?.isPlanetMarker));
      const referenceOffset = Number(referencePlacement?.referenceOffsetTokenWidths) || 0;
      element.classList.toggle("is-reference-offset", Boolean(referenceOffset));
      if (referenceOffset) {
        element.style.setProperty("--reference-offset-token-widths", String(referenceOffset));
      } else {
        element.style.removeProperty("--reference-offset-token-widths");
      }
      element.classList.toggle("is-chong-fossil", isChongFossilToken(rocket));
      element.classList.toggle("is-chong-delivered", Boolean(rocket.chongDelivered || rocket.cargo?.delivered));
      element.classList.toggle("is-move-target", rocket.id === uiRuntimeState.moveHighlightRocketId);
      element.classList.toggle("is-move-candidate", isRocketMoveCandidate(rocket));
      element.classList.toggle("is-move-muted", isRocketMoveMuted(rocket));
      element.classList.toggle(
        "is-move-selectable",
        rocket.playerId === getInterfacePlayer()?.id
          && (rocketActions.isMovablePlayerToken?.(rocket) || rocketActions.isControllablePlayerRocket(rocket)),
      );

      if (isRocketOnPlanetsReference(rocket)) {
        applyTokenWidth(element, rocket);
        const referencePoint = rocket.planetsReference || { percentX: 50, percentY: 50 };
        element.style.left = `${referencePoint.percentX}%`;
        element.style.top = `${referencePoint.percentY}%`;
        element.title = referenceLabel
          ? `${referenceLabel} ${rocketLabel} ${formatPlanetsReferencePoint(referencePoint)}`
          : formatPlanetsReferencePoint(referencePoint);
        return;
      }

      applyTokenWidth(element, rocket);

      const boardPoint = getBoardPointFromPolarPoint(rocket);
      element.style.left = `${boardPoint.x / 10}%`;
      element.style.top = `${boardPoint.y / 10}%`;
      element.title = referenceLabel
        ? `${referenceLabel} ${rocketLabel} ${formatPolarPoint(rocket)} ${formatBoardPoint(boardPoint)}`
        : `${formatPolarPoint(rocket)} ${formatBoardPoint(boardPoint)}`;
      if (isChongFossilToken(rocket) && (rocket.chongDelivered || rocket.cargo?.delivered)) {
        element.title = `${element.title} · 已送达，点击对应虫族任务牌完成`;
      }
      if (isChongFossilToken(rocket)) renderChongFossilOwnerTokenForRocket(rocket);
    }

    function renderChongFossilOwnerTokenForRocket(rocket, activeKeys = null) {
      if (!els.tokenLayer || !isChongFossilToken(rocket) || isRocketOnPlanetsReference(rocket)) return null;

      const key = String(rocket.id);
      if (activeKeys) activeKeys.add(key);
      let element = chongFossilOwnerTokenElements.get(key);
      if (!element) {
        element = document.createElement("img");
        element.className = "chong-fossil-owner-token";
        element.draggable = false;
        element.dataset.chongFossilOwnerToken = key;
        element.dataset.rocketId = key;
        chongFossilOwnerTokenElements.set(key, element);
        els.tokenLayer.appendChild(element);
      }
      if (element.parentElement !== els.tokenLayer) els.tokenLayer.appendChild(element);

      const player = getPlayerById(rocket.playerId) || { color: rocket.color };
      const color = getRocketColorDefinition(rocket);
      const boardPoint = getBoardPointFromPolarPoint(rocket);
      element.src = getNormalTokenAssetForPlayer(player);
      element.alt = `${color.label}化石归属标记 ${rocketActions.formatRocketLabel(rocket)}`;
      element.title = element.alt;
      element.style.left = `${boardPoint.x / 10}%`;
      element.style.top = `${boardPoint.y / 10}%`;
      return element;
    }

    function renderChongFossilOwnerTokens() {
      if (!els.tokenLayer) return;
      const activeKeys = new Set();
      for (const rocket of rocketState.rockets) {
        renderChongFossilOwnerTokenForRocket(rocket, activeKeys);
      }
      for (const [key, element] of chongFossilOwnerTokenElements.entries()) {
        if (activeKeys.has(key)) continue;
        element.remove();
        chongFossilOwnerTokenElements.delete(key);
      }
    }

    function renderPiratesRaidPlanetMarkers() {
      const layer = els.planetsTokenLayer;
      if (!layer) return;
      layer.querySelectorAll(".pirates-raid-planet-marker").forEach((element) => element.remove());
      if (!industry?.listPiratesRaidPlanetMarkers) return;

      const markerSrc = industry.PIRATES_RAID_MARKER_SRC || "../assets/industry/掠夺标记.png";
      for (const player of playerState.players || []) {
        if (!industry.shouldShowPiratesRaidMarkers?.(player)) continue;
        for (const marker of industry.listPiratesRaidPlanetMarkers(player)) {
          const center = planetReferenceLayout.PLANET_REFERENCE_CENTERS?.[marker.planetId];
          if (!center) continue;
          const element = document.createElement("img");
          element.className = "pirates-raid-planet-marker";
          element.src = markerSrc;
          element.alt = "";
          element.decoding = "async";
          element.draggable = false;
          element.dataset.playerId = marker.playerId || player.id || "";
          element.dataset.playerColor = marker.playerColor || player.color || "";
          element.dataset.planetId = marker.planetId;
          element.dataset.techTileId = marker.tileId;
          element.title = `星际海盗：${marker.tileId} 掠夺标记 @ ${getPlanetName(marker.planetId)}`;
          element.style.left = `${((center.x - 70) / planetReferenceLayout.PLANETS_REFERENCE_SIZE.width) * 100}%`;
          element.style.top = `${(center.y / planetReferenceLayout.PLANETS_REFERENCE_SIZE.height) * 100}%`;
          layer.append(element);
        }
      }
    }

    function getYichangdianAnomalyKey(anomaly) {
      return `${anomaly.markerId}:${anomaly.sectorX}:${anomaly.y || 4}`;
    }

    function getYichangdianAnomalyBoardPoint(anomaly) {
      return aliens.getYichangdianAnomalyMarkerBoardPoint?.(solar, anomaly)
        || solar.solarGridToGlobalPoint(anomaly.sectorX, anomaly.y || 4);
    }

    function renderYichangdianAnomalyMarkers() {
      if (!els.tokenLayer || !yichangdian) return;
      const anomalies = alienGameState.yichangdian?.anomalies || [];
      const activeKeys = new Set();

      for (const anomaly of anomalies) {
        const key = getYichangdianAnomalyKey(anomaly);
        activeKeys.add(key);
        let element = yichangdianAnomalyMarkerElements.get(key);
        if (!element) {
          element = document.createElement("img");
          element.className = "yichangdian-anomaly-marker";
          element.draggable = false;
          yichangdianAnomalyMarkerElements.set(key, element);
          els.tokenLayer.appendChild(element);
        }
        if (element.parentElement !== els.tokenLayer) els.tokenLayer.appendChild(element);
        const point = getYichangdianAnomalyBoardPoint(anomaly);
        element.style.left = `${point.x / 10}%`;
        element.style.top = `${point.y / 10}%`;
        element.dataset.boardX = String(point.x);
        element.dataset.boardY = String(point.y);
        element.src = anomaly.src || yichangdian.getAnomalyMarkerSrc(anomaly.markerId);
        element.alt = `异常 ${anomaly.markerId}`;
        element.dataset.anomalyKey = key;
        element.dataset.markerId = anomaly.markerId;
        element.dataset.sectorX = String(anomaly.sectorX);
        element.dataset.sectorY = String(anomaly.y || 4);
        element.title = `${yichangdian.formatAnomalyLabel(anomaly)} @ [${point.x.toFixed(2)},${point.y.toFixed(2)}]`;
      }

      for (const [key, element] of yichangdianAnomalyMarkerElements.entries()) {
        if (activeKeys.has(key)) continue;
        element.remove();
        yichangdianAnomalyMarkerElements.delete(key);
      }
    }

    function getChongPlanetFossilMarkerKey(planetId) {
      return `planet:${planetId}`;
    }

    function getChongPlanetFossilPoint(planetLocation) {
      const boundary = solar.getSectorCoordinateBoundary(planetLocation.x, planetLocation.y);
      const polar = boundary.polarBoundary || {};
      if (
        Number.isFinite(polar.innerRadius)
        && Number.isFinite(polar.outerRadius)
        && Number.isFinite(polar.startAngleDegrees)
        && Number.isFinite(polar.endAngleDegrees)
      ) {
        const radius = polar.innerRadius + (polar.outerRadius - polar.innerRadius) * 0.78;
        const angle = polar.startAngleDegrees + (polar.endAngleDegrees - polar.startAngleDegrees) * 0.72;
        return solar.polarToGlobalPoint(radius, angle);
      }
      return boundary.boardCenter || solar.solarGridToGlobalPoint(planetLocation.x, planetLocation.y);
    }

    function renderChongPlanetFossilMarkers() {
      if (!els.tokenLayer || !chong) return;
      const cState = alienGameState.chong;
      const activeKeys = new Set();
      const revealed = Boolean(cState?.revealInitialized && cState.revealedSlotId);
      const planetLocations = revealed
        ? solar.createSolarSnapshot(solarState).planetLocations
        : [];

      for (const planetId of ["jupiter", "saturn"]) {
        const planetLocation = planetLocations.find((planet) => planet.planetId === planetId);
        if (!planetLocation) continue;
        const fossils = chong.getAvailablePlanetFossils(alienGameState, planetId);
        if (!fossils.length) continue;
        const key = getChongPlanetFossilMarkerKey(planetId);
        activeKeys.add(key);
        let element = chongPlanetFossilMarkerElements.get(key);
        if (!element) {
          element = document.createElement("div");
          element.className = "chong-planet-fossil-marker";
          const image = document.createElement("img");
          image.className = "chong-planet-fossil-marker-image";
          image.draggable = false;
          image.decoding = "async";
          const count = document.createElement("span");
          count.className = "chong-planet-fossil-count";
          element.append(image, count);
          chongPlanetFossilMarkerElements.set(key, element);
          els.tokenLayer.appendChild(element);
        }
        if (element.parentElement !== els.tokenLayer) els.tokenLayer.appendChild(element);
        const point = getChongPlanetFossilPoint(planetLocation);
        element.style.left = `${point.x / 10}%`;
        element.style.top = `${point.y / 10}%`;
        let image = element.querySelector(".chong-planet-fossil-marker-image");
        if (!image) {
          image = document.createElement("img");
          image.className = "chong-planet-fossil-marker-image";
          image.draggable = false;
          image.decoding = "async";
          element.prepend(image);
        }
        image.src = chong.FOSSIL_BACK_SRC;
        image.alt = `${getChongPlanetLabel(planetId)}化石背面`;
        let count = element.querySelector(".chong-planet-fossil-count");
        if (!count) {
          count = document.createElement("span");
          count.className = "chong-planet-fossil-count";
          element.appendChild(count);
        }
        count.textContent = String(fossils.length);
        element.dataset.chongPlanetId = planetId;
        element.dataset.chongPlanetFossilCount = String(fossils.length);
        element.title = `${getChongPlanetLabel(planetId)}化石背面 x${fossils.length}`;
      }

      for (const [key, element] of chongPlanetFossilMarkerElements.entries()) {
        if (activeKeys.has(key)) continue;
        element.remove();
        chongPlanetFossilMarkerElements.delete(key);
      }
    }

    function getRunezuBoardSymbolKey(sourceSymbol) {
      return `${sourceSymbol.sourceType}:${sourceSymbol.sourceId}`;
    }

    function getRunezuSourceSymbolPoint(sourceSymbol) {
      if (sourceSymbol.sourceType === "planet") {
        const planetLocation = solar.createSolarSnapshot(solarState).planetLocations
          .find((planet) => planet.planetId === sourceSymbol.sourceId);
        if (!planetLocation) return null;
        const boundary = solar.getSectorCoordinateBoundary(planetLocation.x, planetLocation.y);
        const polar = boundary.polarBoundary || {};
        if (
          Number.isFinite(polar.innerRadius)
          && Number.isFinite(polar.outerRadius)
          && Number.isFinite(polar.startAngleDegrees)
          && Number.isFinite(polar.endAngleDegrees)
        ) {
          const radius = polar.innerRadius + (polar.outerRadius - polar.innerRadius) * 0.72;
          const angle = polar.startAngleDegrees + (polar.endAngleDegrees - polar.startAngleDegrees) * 0.72;
          return solar.polarToGlobalPoint(radius, angle);
        }
        return boundary.boardCenter || solar.solarGridToGlobalPoint(planetLocation.x, planetLocation.y);
      }
      if (sourceSymbol.sourceType === "sector") {
        for (let x = 0; x < 8; x += 1) {
          const nebula = solar.getNebulaAtCoordinate(x, 5, solarState.sectorBySlot);
          if (nebula?.id !== sourceSymbol.sourceId) continue;
          const boundary = solar.getSectorCoordinateBoundary(x, 5);
          const polar = boundary.polarBoundary || {};
          if (
            Number.isFinite(polar.innerRadius)
            && Number.isFinite(polar.outerRadius)
            && Number.isFinite(polar.startAngleDegrees)
            && Number.isFinite(polar.endAngleDegrees)
          ) {
            const radius = polar.innerRadius + (polar.outerRadius - polar.innerRadius) * 0.38;
            const angle = polar.startAngleDegrees + (polar.endAngleDegrees - polar.startAngleDegrees) * 0.52;
            return solar.polarToGlobalPoint(radius, angle);
          }
          return boundary.boardCenter || solar.solarGridToGlobalPoint(x, 5);
        }
      }
      return null;
    }

    function mountRunezuBoardLayerSymbol(sourceSymbol, activeKeys) {
      if (!els.tokenLayer || !runezu || sourceSymbol.claimedByPlayerId || sourceSymbol.claimedByPlayerColor) return;
      if (sourceSymbol.sourceType !== "planet" && sourceSymbol.sourceType !== "sector") return;
      const point = getRunezuSourceSymbolPoint(sourceSymbol);
      if (!point) return;
      const key = getRunezuBoardSymbolKey(sourceSymbol);
      activeKeys.add(key);
      let element = runezuBoardSymbolElements.get(key);
      if (!element) {
        element = document.createElement("img");
        element.className = "runezu-board-symbol-marker";
        element.draggable = false;
        runezuBoardSymbolElements.set(key, element);
        els.tokenLayer.appendChild(element);
      }
      if (element.parentElement !== els.tokenLayer) els.tokenLayer.appendChild(element);
      element.style.left = `${point.x / 10}%`;
      element.style.top = `${point.y / 10}%`;
      element.src = runezu.getSymbolSrc(sourceSymbol.symbolId);
      element.alt = `符文族 ${sourceSymbol.symbolId}`;
      element.dataset.runezuSourceType = sourceSymbol.sourceType;
      element.dataset.runezuSourceId = sourceSymbol.sourceId;
      element.title = `符文族 ${sourceSymbol.sourceType}:${sourceSymbol.sourceId} ${runezu.formatSymbolLabel(sourceSymbol.symbolId)}`;
    }

    function mountRunezuTechSymbol(sourceSymbol, activeKeys) {
      if (!runezu || sourceSymbol.claimedByPlayerId || sourceSymbol.claimedByPlayerColor) return;
      if (sourceSymbol.sourceType !== "tech") return;
      const slot = techRenderContext?.supplySlots?.[sourceSymbol.sourceId]
        || document.querySelector(`.tech-slot[data-tech-slot="${sourceSymbol.sourceId}"]`);
      if (!slot) return;
      const key = getRunezuBoardSymbolKey(sourceSymbol);
      activeKeys.add(key);
      let element = runezuBoardSymbolElements.get(key);
      if (!element) {
        element = document.createElement("img");
        element.className = "runezu-tech-symbol-marker";
        element.draggable = false;
        runezuBoardSymbolElements.set(key, element);
      }
      const mount = slot.querySelector(".tech-slot-stack") || slot;
      if (element.parentElement !== mount) mount.appendChild(element);
      element.src = runezu.getSymbolSrc(sourceSymbol.symbolId);
      element.alt = `符文族 ${sourceSymbol.symbolId}`;
      element.dataset.runezuSourceType = sourceSymbol.sourceType;
      element.dataset.runezuSourceId = sourceSymbol.sourceId;
      element.title = `符文族科技 ${sourceSymbol.sourceId} ${runezu.formatSymbolLabel(sourceSymbol.symbolId)}`;
    }

    function renderRunezuBoardSymbols() {
      if (!runezu) return;
      const activeKeys = new Set();
      const sourceSymbols = alienGameState.runezu?.revealInitialized
        ? runezu.listSourceSymbols(alienGameState)
        : [];
      for (const sourceSymbol of sourceSymbols) {
        mountRunezuBoardLayerSymbol(sourceSymbol, activeKeys);
        mountRunezuTechSymbol(sourceSymbol, activeKeys);
      }
      for (const [key, element] of runezuBoardSymbolElements.entries()) {
        if (activeKeys.has(key)) continue;
        element.remove();
        runezuBoardSymbolElements.delete(key);
      }
    }

    function renderRockets() {
      const activeIds = new Set(rocketState.rockets.map((rocket) => rocket.id));
      els.tokenLayer?.querySelectorAll(".rocket-token").forEach((element) => {
        const rocketId = Number(element.dataset.rocketId);
        if (!activeIds.has(rocketId)) element.remove();
      });
      els.planetsTokenLayer?.querySelectorAll(".rocket-token").forEach((element) => {
        const rocketId = Number(element.dataset.rocketId);
        if (!activeIds.has(rocketId)) element.remove();
      });
      rocketState.rockets.forEach(renderRocketElement);
      renderYichangdianAnomalyMarkers();
      renderChongPlanetFossilMarkers();
      renderChongFossilOwnerTokens();
      renderPiratesRaidPlanetMarkers();
      renderRunezuBoardSymbols();
    }

    function renderPublicCards() {
      if (!els.publicCardRow) return;

      const controls = cardState.publicControls || {};
      const selectionActive = Boolean(controls.selectionActive);
      const publicCardMultiSelect = Boolean(controls.multiSelectActive);
      const selectedPublicSlots = continuationState.publicCardSelectedSlots || [];
      els.publicCardRow.replaceChildren(...cardState.publicCards.map((card, index) => {
        const slot = document.createElement("div");
        slot.className = "public-card-slot";
        slot.dataset.publicSlot = String(index);
        const label = card?.cardName || `公共牌 ${index + 1}`;

        if (!card) {
          slot.classList.add("is-empty");
          slot.setAttribute("aria-hidden", "true");
          return slot;
        }

        if (selectionActive) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "public-card";
          button.dataset.publicSlot = String(index);
          button.classList.add("is-selectable");
          if (publicCardMultiSelect && selectedPublicSlots.includes(index)) {
            button.classList.add("is-selected");
          }
          button.setAttribute("aria-label", label);

          const image = document.createElement("img");
          image.src = card.src;
          image.alt = "";
          image.width = 747;
          image.height = 1040;
          image.decoding = "async";
          image.setAttribute("aria-hidden", "true");
          button.append(image);
          attachCardHoverPreview(button, card.src, label);
          slot.append(button);
          return slot;
        }

        const image = document.createElement("img");
        image.className = "public-card";
        image.src = card.src;
        image.alt = label;
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        attachCardHoverPreview(image, card.src, label);
        slot.append(image);
        return slot;
      }));

      if (els.publicBlindDrawButton) {
        els.publicBlindDrawButton.disabled = !controls.blindDrawEnabled;
        els.publicBlindDrawButton.classList.toggle("is-selectable", Boolean(controls.blindDrawEnabled));
        els.publicBlindDrawButton.title = controls.blindDrawReason || "";
      }
    }

    function layoutCardFan(fan, cardCount) {
      if (!fan) return;

      const cardHeight = getPublicCardHeight() || 166;
      const cardWidth = cardHeight * (747 / 1040);
      const fanPadding = 14;
      const minStackStep = Math.round(cardWidth * 0.26);
      const count = Number.isInteger(cardCount)
        ? cardCount
        : fan.querySelectorAll(".player-hand-card-button, .player-hand-card").length;

      fan.style.setProperty("--card-height", `${cardHeight}px`);
      fan.style.setProperty("--card-width", `${cardWidth}px`);
      fan.style.minHeight = `${cardHeight + fanPadding}px`;
      fan.classList.toggle("is-spread", count > 1);

      if (!count) {
        fan.style.setProperty("--card-step", `${cardWidth}px`);
        return;
      }

      const padding = 24;
      const available = Math.max(0, fan.clientWidth - padding);
      const spreadStep = count > 1
        ? (available - cardWidth) / (count - 1)
        : cardWidth;
      const step = count > 1
        ? Math.max(minStackStep, spreadStep)
        : cardWidth;

      fan.style.setProperty("--card-step", `${step}px`);
    }

    function layoutPlayerHandFan(cardCount) {
      layoutCardFan(els.playerHandFan, cardCount);
    }

    function layoutReservedCardRows() {
      if (!els.reservedCardFan) return;
      els.reservedCardFan.querySelectorAll(".reserved-card-row").forEach((row) => layoutCardFan(row));
    }

    function renderPlayerHand() {
      if (!els.playerHandFan || !els.playerHandPanel) return;

      const currentPlayer = cloneProjectedPlayer(getInterfacePlayer());
      const hand = Array.isArray(currentPlayer.hand) ? currentPlayer.hand : [];
      const actualCurrentPlayer = cloneProjectedPlayer(getCurrentPlayer());
      const movePayment = continuationState.movePayment;
      const playCardSelection = continuationState.playCardSelection;
      const discardActive = Boolean(cardState.ui?.discardSelectionActive)
        && continuationState.discardContinuation?.playerId === currentPlayer?.id;
      const playActive = Boolean(cardState.ui?.playCardSelectionActive)
        && actualCurrentPlayer?.id === currentPlayer?.id;
      const movePaymentActive = Boolean(movePayment)
        && (movePayment.playerId || movePayment.player?.id) === currentPlayer?.id;
      const handScanActive = Boolean(continuationState.handScanContinuation)
        && continuationState.handScanContinuation?.playerId === currentPlayer?.id;
      const cardCornerAction = continuationState.cardCornerQuickAction;
      const handCardPlayAction = continuationState.handCardPlayAction;
      const cardCornerActionEnabled = actualCurrentPlayer?.id === currentPlayer?.id && canUseCardCornerQuickAction();
      const handScanPickIndex = continuationState.scanTargetContinuation?.type === "hand_scan"
        && Number.isInteger(Number(continuationState.scanTargetContinuation.handIndex))
        ? Number(continuationState.scanTargetContinuation.handIndex)
        : null;
      const handPickActive = discardActive
        || playActive
        || movePaymentActive
        || handScanActive
        || isIndustryHandSelectionActive()
        || handScanPickIndex != null
        || cardCornerActionEnabled;
      els.playerHandPanel.classList.toggle("is-empty", hand.length === 0);
      els.playerHandPanel.classList.toggle("card-corner-action-ready", Boolean(cardCornerAction || handCardPlayAction));
      layoutPlayerHandFan(hand.length);
      els.playerHandFan.replaceChildren(...hand.map((card, index) => {
        const label = card.cardName || (card.faceUp ? `手牌 ${index + 1}` : `手牌背面 ${index + 1}`);

        if (handPickActive && !(handScanPickIndex != null && index !== handScanPickIndex)) {
          const playCost = getCardPlayCost(card);
          const formattedPlayCost = formatCardPlayCost(playCost);
          const affordable = players.canAfford(currentPlayer, playCost);
          const button = document.createElement("button");
          button.type = "button";
          button.className = "player-hand-card-button";
          button.style.setProperty("--card-index", String(index + 1));
          button.dataset.handIndex = String(index);
          if (discardActive) {
            button.classList.add("is-selectable");
            if (continuationState.discardSelectedHandIndexes?.includes(index)) {
              button.classList.add("is-selected");
            }
            button.setAttribute("aria-label", label);
          } else if (handScanActive) {
            const scanChoices = getPublicScanChoicesForCard(card);
            if (scanChoices.ok) {
              button.classList.add("is-scan-card");
              button.setAttribute("aria-label", `${label}（扫描牌，点击弃除并扫描）`);
              button.title = `${scanChoices.scanLabel}：点击后选择星云`;
            } else {
              button.classList.add("is-scan-card-muted");
              button.disabled = true;
              button.setAttribute("aria-label", label);
              button.title = scanChoices.message;
            }
          } else if (handScanPickIndex != null) {
            button.classList.add("is-scan-card", "is-selected");
            button.disabled = true;
            button.setAttribute("aria-label", `${label}（扫描中）`);
          } else if (isIndustryFutureSpanHandSelectionActive()) {
            const eligible = isFutureSpanEligibleHandCard(card);
            if (eligible) {
              const targetDelta = getFutureSpanDeltaForCard(card);
              button.classList.add("is-industry-hand-card");
              button.setAttribute("aria-label", `${label}（未来跨度：扣下并设置目标分）`);
              button.title = `未来跨度：目标分 +${targetDelta}`;
            } else {
              button.classList.add("is-industry-hand-card-muted");
              button.disabled = true;
              button.setAttribute("aria-label", label);
              button.title = "未来跨度只能选择费用为信用点的手牌";
            }
          } else if (isIndustryHandSelectionActive()) {
            button.classList.add("is-industry-hand-card");
            button.setAttribute("aria-label", `${label}（深空探测：选择交换手牌）`);
            button.title = "深空探测：点击选择要交换的手牌";
          } else if (movePaymentActive) {
            if (isMovePaymentCard(card)) {
              button.classList.add("is-move-card");
              if ((movePayment.selectedHandIndices || []).includes(index)) {
                button.classList.add("is-selected");
              }
              button.setAttribute("aria-label", `${label}（移动牌，点击选择弃置）`);
              button.title = "弃置此牌以支付移动";
            } else {
              button.classList.add("is-move-card-muted");
              button.disabled = true;
              button.setAttribute("aria-label", label);
            }
          } else if (cardCornerActionEnabled) {
            const action = getCardCornerQuickActionForCard(card);
            const playAction = getHandCardPlayActionForCard(card, actualCurrentPlayer);
            const selected = cardCornerAction?.cardId === card.id
              || handCardPlayAction?.cardId === card.id;
            if (action || playAction) {
              if (action) button.classList.add("is-corner-action-card");
              if (playAction) button.classList.add("is-hand-play-card");
              if (selected) button.classList.add("is-selected");
              const actionLabels = [
                playAction ? `打出，费用 ${formattedPlayCost}` : null,
                action ? action.label : null,
              ].filter(Boolean).join("；");
              button.setAttribute("aria-label", `${label}（${actionLabels}）`);
              button.title = selected
                ? `${actionLabels}：点击上方按钮确认，或再次点击取消`
                : `${actionLabels}：点击选择`;
            } else {
              button.classList.add("is-corner-action-card-muted");
              button.setAttribute("aria-label", label);
              button.title = "这张牌没有可用的手牌快捷操作";
            }
          } else if (playActive) {
            const selected = playCardSelection?.handIndex === index;
            button.classList.add(affordable ? "is-playable" : "is-unaffordable");
            if (selected) button.classList.add("is-selected");
            button.setAttribute("aria-label", `${label}，费用 ${formattedPlayCost}`);
            button.title = affordable
              ? selected
                ? `已选择 ${label}，点击上方「打出」确认，或再次点击取消选择`
                : `选择 ${label}，费用 ${formattedPlayCost}`
              : `资源不足，需要 ${formattedPlayCost}`;
          } else {
            button.setAttribute("aria-label", label);
          }

          const image = document.createElement("img");
          image.src = card.src || players.CARD_BACK_SRC;
          image.alt = "";
          image.width = 747;
          image.height = 1040;
          image.decoding = "async";
          image.setAttribute("aria-hidden", "true");
          button.append(image);
          attachCardHoverPreview(button, card.src || players.CARD_BACK_SRC, label);
          return button;
        }

        const image = document.createElement("img");
        image.className = "player-hand-card";
        image.src = card.src || players.CARD_BACK_SRC;
        image.alt = label;
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        image.style.setProperty("--card-index", String(index + 1));
        attachCardHoverPreview(image, card.src || players.CARD_BACK_SRC, label);
        return image;
      }));
    }

    function renderReservedCards() {
      if (!els.reservedCardFan || !els.reservedCardPanel) return;
      const presentation = readProjection().resident.reservedCards || { rows: [] };
      const title = els.reservedCardPanel.querySelector(".panel-title");
      if (title) title.textContent = presentation.title || "保留牌区";
      els.reservedCardPanel.classList.toggle(
        "is-initial-selection-active",
        Boolean(presentation.initialSelectionActive),
      );
      els.reservedCardPanel.classList.toggle("is-empty", Boolean(presentation.empty));
      renderInitialSelectionArea();
      if (presentation.initialSelectionActive) {
        els.reservedCardFan.replaceChildren();
        return;
      }

      function createReservedRow(row) {
        const element = document.createElement("div");
        element.className = `reserved-card-row reserved-card-row-${row.type}`;
        element.dataset.reservedRow = row.type;
        element.setAttribute("aria-label", row.label);
        element.replaceChildren(...(row.items || []).map((item, rowIndex) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `reserved-card-button reserved-card-button-${item.kind}`;
          button.style.setProperty("--card-index", String(rowIndex + 1));
          button.disabled = Boolean(item.disabled);
          button.title = item.title || "";
          if (item.kind === "regular") {
            button.className = "reserved-card-button";
            button.dataset.reservedIndex = String(item.originalIndex);
            button.classList.toggle("is-task-ready", Boolean(item.ready));
          } else if (item.kind === "jiuzhe") {
            button.dataset.jiuzheCards = "true";
            button.dataset.playerId = item.playerId || "";
            button.dataset.playerColor = item.playerColor || "";
            button.title = "查看九折牌";
          } else if (item.kind === "fangzhou") {
            button.dataset.fangzhouReserved = item.traceType || "";
            if (item.debugUnlock) {
              button.dataset.fangzhouUnlock = item.traceType || "";
              button.classList.add("is-fangzhou-unlock-pending");
            }
          } else if (item.kind === "banrenma") {
            button.dataset.banrenmaReservedIndex = String(item.originalIndex);
            button.classList.toggle("is-banrenma-threshold-ready", Boolean(item.ready));
          }

          const image = document.createElement("img");
          image.className = "player-hand-card reserved-card";
          image.src = item.imageSrc || players.CARD_BACK_SRC;
          image.alt = item.imageAlt || "保留牌";
          image.width = 747;
          image.height = 1040;
          image.decoding = "async";
          image.setAttribute("aria-hidden", "true");
          button.append(image);
          if (item.kind === "regular") {
            attachCardHoverPreview(button, image.src, image.alt);
            if (item.progressIndexes?.length) {
              const badge = document.createElement("span");
              badge.className = "reserved-card-trigger-badge";
              badge.textContent = `已完成 ${item.progressIndexes.join("/")}`;
              button.append(badge);
            }
            if (item.plutoState) {
              const badge = document.createElement("span");
              badge.className = "reserved-card-trigger-badge reserved-card-pluto-status-badge";
              const orbitLine = document.createElement("span");
              orbitLine.textContent = item.plutoState.orbitDone ? "已环绕" : "可环绕";
              const landLine = document.createElement("span");
              landLine.textContent = item.plutoState.landDone ? "已登陆" : "可登陆";
              badge.append(orbitLine, landLine);
              button.append(badge);
            }
            if (item.ready) {
              const badge = document.createElement("span");
              badge.className = "reserved-card-task-badge";
              badge.textContent = "完成任务";
              button.append(badge);
            }
          } else if (item.kind === "jiuzhe") {
            const badge = document.createElement("span");
            badge.className = "reserved-card-trigger-badge";
            badge.textContent = String(item.count || 0);
            button.append(badge);
          } else if (item.kind === "banrenma") {
            const threshold = document.createElement("span");
            threshold.className = "reserved-card-banrenma-threshold-badge";
            const icon = document.createElement("img");
            icon.className = "reserved-card-banrenma-threshold-icon";
            icon.src = item.thresholdIconSrc || "";
            icon.alt = "";
            icon.decoding = "async";
            icon.setAttribute("aria-hidden", "true");
            const value = document.createElement("span");
            value.textContent = String(item.threshold);
            threshold.append(icon, value);
            button.append(threshold);
            if (item.ready) {
              const ready = document.createElement("span");
              ready.className = "reserved-card-task-badge reserved-card-banrenma-ready-badge";
              ready.textContent = "结算条件";
              button.append(ready);
            }
          }
          return button;
        }));
        return element;
      }

      els.reservedCardFan.replaceChildren(...(presentation.rows || []).map(createReservedRow));
      layoutReservedCardRows?.();
    }

    function renderInitialSelectionArea() {
      if (!els.initialSelectionArea) return;

      const selection = readProjection().resident.initialSelection || {};
      if (selection.active) {
        if (selection.interactive) {
          els.initialSelectionArea.hidden = false;
          els.initialSelectionArea.replaceChildren(createInitialSelectionPicker(selection.offer || null));
          syncInteractionFocusChrome();
          return;
        }
      }

      const currentPlayer = cloneProjectedPlayer(getInterfacePlayer());
      const selectedCards = structuredClone(selection.selectedCards || []);
      if (!selectedCards.length) {
        els.initialSelectionArea.hidden = true;
        els.initialSelectionArea.replaceChildren();
        syncInteractionFocusChrome();
        return;
      }

      els.initialSelectionArea.hidden = false;
      const summary = document.createElement("div");
      summary.className = "initial-selection-company-slot";
      const [companyCard] = selectedCards;
      const hasTuringBorrowedTech = companyCard?.label === "图灵系统"
        && Boolean(industry?.getBorrowedTechTileId?.(currentPlayer, turnState.roundNumber, turnState.turnNumber));
      if (companyCard?.label === "未来跨度研究所") {
        summary.classList.add("has-company-below-card-markers");
        if (industry?.hasFutureSpanCard?.(currentPlayer)) {
          summary.classList.add("has-future-span-card-below");
        }
      } else if (industry?.shouldShowAlienLabPanels?.(currentPlayer) || hasTuringBorrowedTech) {
        summary.classList.add("has-company-below-card-markers");
      }
      summary.replaceChildren(createCompanyCardSummary(companyCard, currentPlayer));
      els.initialSelectionArea.replaceChildren(summary);
      syncInteractionFocusChrome();
    }

    function renderPlayerDataBoard() {
      const currentPlayer = cloneProjectedPlayer(getInterfacePlayer());
      data.renderPlayerDataTokens(currentPlayer, els.playerBoardDataLayer, {
        onPlace: (blueSlot) => {
          context.placeDataToBlueSlot(blueSlot);
        },
      });
    }

    function createOpponentStatRow(className) {
      const row = document.createElement("div");
      row.className = `opponent-stat-row ${className}`;
      return row;
    }

    function createOpponentTechRow(player, techType, prefix, techColor) {
      const row = createOpponentStatRow("opponent-stat-row-tech");
      const ownedTiles = player.techState?.ownedTiles || {};

      for (let index = 1; index <= 4; index += 1) {
        const tileId = `${techType}${index}`;
        const item = document.createElement("span");
        item.className = "opponent-tech-item";
        item.textContent = `${prefix}${index}`;
        if (ownedTiles[tileId]) {
          item.classList.add("is-owned");
          item.style.setProperty("--opponent-tech-color", techColor);
          if (player.techState?.disabledTiles?.[tileId]) {
            item.classList.add("is-disabled");
          }
        } else {
          item.classList.add("is-missing");
        }
        row.append(item);
      }

      return row;
    }

    function createOpponentPlayerHeaderRow(player, score, finalTotalScore) {
      const color = players.getPlayerColorDefinition(player.color);
      const row = createOpponentStatRow("opponent-stat-row-header");
      const roundOrderNumber = getPlayerRoundOrderNumber(player?.id);

      const idEl = document.createElement("span");
      idEl.className = "opponent-stat-id player-stat-value";
      idEl.classList.toggle("is-player-passed", isPlayerPassedThisRound(player?.id));
      idEl.textContent = getPlayerDisplayLabel(player);
      idEl.title = idEl.textContent;

      const orderEl = document.createElement("span");
      orderEl.className = "player-turn-order-number";
      orderEl.textContent = roundOrderNumber == null ? "-" : String(roundOrderNumber);
      orderEl.title = roundOrderNumber == null ? "不在本轮顺位中" : `本轮顺位 ${roundOrderNumber}`;
      orderEl.setAttribute("aria-label", orderEl.title);

      const marker = document.createElement("span");
      marker.className = "player-color-marker";
      marker.style.setProperty("--player-color", color.uiColor);
      marker.setAttribute("aria-label", color.label);

      row.append(
        idEl,
        orderEl,
        marker,
        createInlineIconValue("分数", score, RESOURCE_ICON_SRC.score, "player-stat-score"),
        createInlineIconValue("终局总分", finalTotalScore, RESOURCE_ICON_SRC.finalScore, "player-stat-final-score"),
      );
      return row;
    }

    function createOpponentSummaryRow(player) {
      const row = createOpponentStatRow("opponent-stat-row-summary");
      const orbitLandCount = endGameScoring?.countOrbitOrLandMarkers
        ? endGameScoring.countOrbitOrLandMarkers(player, planetStatsState, buildPlutoMarkerContext())
        : 0;

      row.append(createStatIcon("环绕登陆", orbitLandCount, RESOURCE_ICON_SRC.orbitOrLand));

      for (const { color, label, iconKey } of OPPONENT_SECTOR_WIN_STATS) {
        const count = endGameScoring?.countSectorWinsByColor
          ? endGameScoring.countSectorWinsByColor(player, nebulaDataState, color)
          : 0;
        row.append(createStatIcon(label, count, RESOURCE_ICON_SRC[iconKey]));
      }

      return row;
    }

    function createOpponentAlienTraceRow(player) {
      const row = createOpponentStatRow("opponent-stat-row-alien-traces");
      row.append(
        createStatIcon(
          "黄色外星人痕迹",
          endGameScoring?.countTraceMarkers
            ? endGameScoring.countTraceMarkers(player, alienGameState, "yellow")
            : 0,
          RESOURCE_ICON_SRC.alienYellow,
        ),
        createStatIcon(
          "粉色外星人痕迹",
          endGameScoring?.countTraceMarkers
            ? endGameScoring.countTraceMarkers(player, alienGameState, "pink")
            : 0,
          RESOURCE_ICON_SRC.alienPink,
        ),
        createStatIcon(
          "蓝色外星人痕迹",
          endGameScoring?.countTraceMarkers
            ? endGameScoring.countTraceMarkers(player, alienGameState, "blue")
            : 0,
          RESOURCE_ICON_SRC.alienBlue,
        ),
      );
      return row;
    }

    function createOpponentRunezuSymbolRow(player) {
      const row = createOpponentStatRow("opponent-stat-row-runezu-symbols");
      const nodes = buildPlayerRunezuStatNodes(player);
      row.replaceChildren(...nodes);
      row.hidden = !nodes.length;
      return row;
    }

    function createOpponentJiuzheRow(player) {
      const cardsForPlayer = jiuzhe?.getPlayerJiuzheCards?.(alienGameState, player) || [];
      const playedCount = jiuzhe?.countPlayedCards?.(alienGameState, player) || 0;
      const threat = jiuzhe?.getPanelThreat?.(alienGameState, player) || 0;
      const revealed = Boolean(alienGameState.jiuzhe?.revealedSlotId);
      if (!revealed && !cardsForPlayer.length && !playedCount && !threat) return null;

      const row = createOpponentStatRow("opponent-stat-row-jiuzhe");
      row.append(
        createStatIcon("已打出九折牌", playedCount, RESOURCE_ICON_SRC.jiuzheCard),
        createStatIcon("九折威胁度", threat, RESOURCE_ICON_SRC.jiuzheThreat),
      );
      return row;
    }

    function renderOpponentStats() {
      if (!els.opponentStatGrid) return;

      const currentPlayerId = getCurrentPlayer()?.id || playerState.currentPlayerId;
      const projectedActivePlayers = getActivePlayers();
      const activePlayers = projectedActivePlayers.length ? projectedActivePlayers : playerState.players;
      const cards = activePlayers.map((projectedPlayer) => {
        const player = cloneProjectedPlayer(projectedPlayer);
        const color = players.getPlayerColorDefinition(player.color);
        const finalScoreBreakdown = getPlayerFinalScoreBreakdown(player);
        const card = document.createElement("article");
        card.className = "opponent-stat-card";
        card.dataset.playerId = player.id;
        if (player.id === currentPlayerId) {
          card.classList.add("is-current");
        }
        card.style.setProperty("--player-color", color.uiColor);

        const resourcesRow = createOpponentStatRow("opponent-stat-row-resources");
        resourcesRow.append(...buildPlayerResourceStatNodes(player, { includeHandSize: true }));

        const incomeRow = createOpponentStatRow("opponent-stat-row-income");
        incomeRow.append(...buildPlayerIncomeStatNodes(player));
        const jiuzheRow = createOpponentJiuzheRow(player);
        const runezuRow = createOpponentRunezuSymbolRow(player);

        card.append(
          createOpponentPlayerHeaderRow(player, player.resources.score, finalScoreBreakdown.totalScore),
          resourcesRow,
          incomeRow,
          ...(jiuzheRow ? [jiuzheRow] : []),
          ...(runezuRow && !runezuRow.hidden ? [runezuRow] : []),
          ...OPPONENT_TECH_TYPES.map(({ type, prefix, color: techColor }) => (
            createOpponentTechRow(player, type, prefix, techColor)
          )),
          createOpponentSummaryRow(player),
          createOpponentAlienTraceRow(player),
        );
        return card;
      });

      els.opponentStatGrid.replaceChildren(...cards);
    }

    function renderPlayerStats() {
      const currentPlayer = cloneProjectedPlayer(getInterfacePlayer());
      const resources = currentPlayer.resources;
      const finalScoreBreakdown = getPlayerFinalScoreBreakdown(currentPlayer);

      renderFinalScoreBoard({
        currentPlayer,
        finalScoringState: cloneResident("finalScoring"),
      });

      const mainStats = [
        createPlayerNameStat(currentPlayer, resources.score, finalScoreBreakdown.totalScore),
        createStatSeparator(),
        ...buildPlayerResourceStatNodes(currentPlayer),
        createStatSeparator(),
        ...buildPlayerIncomeStatNodes(currentPlayer, { showBasePlusIncrease: true }),
      ];
      const runezuStats = buildPlayerRunezuStatNodes(currentPlayer);
      const fangzhouStats = buildPlayerFangzhouStatNodes(currentPlayer);
      const statRows = [
        createPlayerStatsRow("player-stats-main-row", mainStats),
      ];

      if (fangzhouStats.length) {
        statRows.push(createPlayerStatsRow("player-stats-fangzhou-row", fangzhouStats));
      }

      if (runezuStats.length) {
        const label = document.createElement("span");
        label.className = "player-stat player-stat-runezu-label";
        label.textContent = "符文族";
        statRows.push(createPlayerStatsRow("player-stats-runezu-row", [label, ...runezuStats]));
      }

      els.playerStats.replaceChildren(...statRows);
      renderOpponentStats();
      const handPanel = readProjection().resident.handPanel || {};
      if (els.playerHandPanelHandCount) {
        els.playerHandPanelHandCount.textContent = String(handPanel.count || 0);
        els.playerHandPanelHandCount.classList.toggle("is-over-limit", Boolean(handPanel.overLimit));
        els.playerHandPanelHandCount.setAttribute("aria-label", `当前手牌 ${handPanel.count || 0} 张`);
      }
      if (els.playerHandPanelTitleHint) {
        els.playerHandPanelTitleHint.textContent = handPanel.hint || "";
      }
      renderPlayerHand();
      renderReservedCards();
      renderPlayerDataBoard();
    }

    function renderSectorNebulaDataBoard() {
      for (const sectorId of [1, 2, 3, 4]) {
        const sectorElement = sectorElements[sectorId];
        if (sectorElement) {
          data.renderSectorNebulaData(sectorId, sectorElement, nebulaDataState, {
            showDebugWinMarkers: uiRuntimeState.sectorWinDebugActive,
          });
        }
      }
      data.renderAomomoNebulaData?.(els.tokenLayer, nebulaDataState, solarState, {
        solarApi: solar,
        forceVisible: Boolean(solarState.aomomoActive),
      });
    }

    function stepsToTransform(steps) {
      const rotation = steps * (Math.PI / 4);
      return `rotate(${rotation}rad)`;
    }

    function renderWheels() {
      for (let w = 1; w <= 4; w += 1) {
        els.wheels[w].style.transform = stepsToTransform(solarState.wheelSteps[w]);
      }
      if (els.wheels[3]) {
        els.wheels[3].style.backgroundImage = solarState.aomomoActive && aomomo?.WHEEL3_AMM_SRC
          ? `url("${aomomo.WHEEL3_AMM_SRC}")`
          : "";
      }
    }

    function renderSectors() {
      for (const sectorId of [1, 2, 3, 4]) {
        delete sectorElements[sectorId];
      }

      for (let slot = 1; slot <= 4; slot += 1) {
        const wrap = els.sectorWraps[slot];
        wrap.innerHTML = "";
        const sectorId = solarState.sectorBySlot[slot];
        if (!sectorId) continue;

        const sector = document.createElement("div");
        sector.className = `sector sector-${sectorId}`;
        sector.dataset.sectorId = String(sectorId);
        sector.dataset.boardSlot = String(slot);
        wrap.appendChild(sector);
        sectorElements[sectorId] = sector;
      }

      renderSectorNebulaDataBoard();
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

    function renderStateReadout() {
      if (uiRuntimeState.codexAiBatchSuppressReadoutRender) return;
      const snapshot = solar.createSolarSnapshot(solarState);
      const axisLine = "坐标轴 x0=中线上方偏右第一块，顺时针递增";
      const wheelLine = [1, 2, 3, 4]
        .map((w) => `W${w}=${solar.mod8(solarState.wheelSteps[w])}`)
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
        ...getTurnReadoutLines(),
        "",
        ...getInitialSelectionReadoutLines(),
        "",
        ...getPlayerReadoutLines(),
        "",
        ...finalScoring.getReadoutLines(cloneResident("finalScoring")),
        "",
        ...getPlanetStatsReadoutLines(),
        "",
        "可见坐标",
        formatVisibleCoordinateGroups(snapshot.visibleCoordinateGroups),
        "",
        ...getRocketCoordinateReadoutLines(rocketState),
        "",
        ...context.tech.getReadoutLines(cloneResident("tech"), clonePlayersForReadout()),
        "",
        ...data.getReadoutLines(clonePlayersForReadout()),
        "",
        ...data.getNebulaReadoutLines(cloneResident("data")),
        "",
        ...data.getSectorSettlementReadoutLines(cloneResident("data")),
        "",
        ...aliens.getReadoutLines(cloneResident("aliens")),
        "",
        ...(industry.getReadoutLines?.(getInterfacePlayer(), turnState.roundNumber) || []),
        ...(context.actionHistory.hasSession() ? ["", "行动指令栈", ...context.actionHistory.getTrace()] : []),
        ...(context.quickActionHistory.hasSession() ? ["", "快速行动指令栈", ...context.quickActionHistory.getTrace()] : []),
      ].join("\n");
    }

    function getRotateStateSlotIndex(rotationCount) {
      return ((Number(rotationCount) % ROTATE_STATE_SLOTS.length) + ROTATE_STATE_SLOTS.length) % ROTATE_STATE_SLOTS.length;
    }

    function renderRotateStateToken() {
      if (!els.roundStatusToken) return;

      const slot = ROTATE_STATE_SLOTS[getRotateStateSlotIndex(solarState.rotation.rotationCount)];
      els.roundStatusToken.style.setProperty("--rotate-token-x", `${slot.percentX}%`);
      els.roundStatusToken.style.setProperty("--rotate-token-y", `${slot.percentY}%`);
      els.roundStatusToken.dataset.slotId = slot.id;
    }

    return Object.freeze({
      setTokenAssetSizes: withProjection(setTokenAssetSizes),
      renderRocketElement: withProjection(renderRocketElement),
      renderChongFossilOwnerTokenForRocket: withProjection(renderChongFossilOwnerTokenForRocket),
      renderChongFossilOwnerTokens: withProjection(renderChongFossilOwnerTokens),
      renderPiratesRaidPlanetMarkers: withProjection(renderPiratesRaidPlanetMarkers),
      renderYichangdianAnomalyMarkers: withProjection(renderYichangdianAnomalyMarkers),
      renderChongPlanetFossilMarkers: withProjection(renderChongPlanetFossilMarkers),
      renderRunezuBoardSymbols: withProjection(renderRunezuBoardSymbols),
      renderRockets: withProjection(renderRockets),
      renderPublicCards: withProjection(renderPublicCards),
      renderOpponentStats: withProjection(renderOpponentStats),
      renderPlayerHand: withProjection(renderPlayerHand),
      renderReservedCards: withProjection(renderReservedCards),
      renderInitialSelectionArea: withProjection(renderInitialSelectionArea),
      renderPlayerDataBoard: withProjection(renderPlayerDataBoard),
      renderPlayerStats: withProjection(renderPlayerStats),
      renderSectorNebulaDataBoard: withProjection(renderSectorNebulaDataBoard),
      renderWheels: withProjection(renderWheels),
      renderSectors: withProjection(renderSectors),
      renderStateReadout: withProjection(renderStateReadout),
      renderRotateStateToken: withProjection(renderRotateStateToken),
      layoutPlayerHandFan,
      layoutReservedCardRows,
    });
  }

  return {
    RENDER_CONTEXT_CAPABILITY_INVENTORY,
    cloneSelectorResult,
    createRenderRuntime,
    createCardHoverPreviewRuntime,
    createCoordinateRuntime,
  };
});
