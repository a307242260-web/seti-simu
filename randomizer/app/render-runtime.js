(function (root, factory) {
  "use strict";
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppRenderRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";
  function createCoordinateOwnerInputPort(registry, context = {}) {
    return registry.register("coordinate", {
      syncPlanetMarkers: (workingRoot) => (
        context.getRuntime().syncPlanetOrbitLandMarkers(workingRoot),
        { ok: true, value: { ok: true } }
      ),
      seedReferenceRockets: (workingRoot) => (
        context.getRuntime().seedDefaultReferenceRockets(workingRoot),
        { ok: true, value: { ok: true } }
      ),
    });
  }



  const RENDER_CONTEXT_CAPABILITY_INVENTORY = Object.freeze({
    platform: Object.freeze([
      "document", "Image", "getProjection", "assertProjection", "viewState", "enforceCapabilityInventory",
    ]),
    domOnlyHelpers: Object.freeze([
      "createInitialSelectionPicker", "createCompanyCardSummary", "createPlayerNameStat", "createStatSeparator",
      "createStatIcon", "createInlineIconValue", "createPlayerStatsRow", "buildPlayerResourceStatNodes",
      "buildPlayerIncomeStatNodes", "buildPlayerRunezuStatNodes", "buildPlayerFangzhouStatNodes",
      "renderFinalScoreBoard", "attachCardHoverPreview", "getPublicCardHeight",
    ]),
    scalarOrFreshDtoSelectors: Object.freeze([
      "getPublicCardHeight",
    ]),
    inputCallbacks: Object.freeze(["handleRocketPointerDown", "syncInteractionFocusChrome", "placeDataToBlueSlot"]),
    domState: Object.freeze([
      "tokenWidths", "techRenderContext", "sectorElements", "yichangdianAnomalyMarkerElements",
      "chongPlanetFossilMarkerElements", "chongFossilOwnerTokenElements", "runezuBoardSymbolElements", "els",
      "ROCKET_IMAGE_SCALE", "REFERENCE_ORBIT_IMAGE_SCALE", "REFERENCE_LANDDING_IMAGE_SCALE", "RESOURCE_ICON_SRC",
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
      "solar", "players", "rocketActions", "planetStats", "planetReferenceLayout",
      "endGameScoring", "finalScoring", "data", "aliens", "jiuzhe", "yichangdian",
      "chong", "aomomo", "runezu", "industry", "tech", "actionHistory", "quickActionHistory",
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
      document,
      chongFossilOwnerTokenElements,
      referencePlacementKindLabels,
      planetsReferenceSize,
      rocketSurface,
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
    function removeRocketElement(rocketId) {
      document?.getElementById(`rocket-${rocketId}`)?.remove();
      const chongOwnerToken = chongFossilOwnerTokenElements?.get(String(rocketId));
      if (chongOwnerToken) {
        chongOwnerToken.remove();
        chongFossilOwnerTokenElements.delete(String(rocketId));
      }
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
      removeRocketElement,
      syncPlanetOrbitLandMarkers, seedDefaultReferenceRockets, formatRocketLabel,
      getMovableTokensForPlayer, createRocketSnapshot, getEarthSectorCoordinate,
      getRocketCoordinateReadoutLines,
    };
  }

  function createBrowserLayoutRuntime(context = {}) {
    const { window, document, els, techRenderContext } = context;
    function resize() {
      const height = window.innerHeight;
      const boardWidth = els.boardShell.clientWidth || window.innerWidth;
      const boardHeight = height - 160;
      const baseBoardSize = Math.max(220, Math.min(boardWidth, boardHeight));
      const compactWidthCap = window.innerWidth <= 760 ? Math.max(220, window.innerWidth - 16) : Infinity;
      const boardSize = Math.floor(Math.min(
        baseBoardSize * context.boardVisualScale,
        boardWidth,
        compactWidthCap,
      ));
      els.playerCommand.style.width = `${boardSize}px`;
      els.wheelWrap.style.width = `${boardSize}px`;
      els.wheelWrap.style.height = `${boardSize}px`;
      els.planetsReference.style.width = `${boardSize}px`;
      if (els.buttonWrap) els.buttonWrap.style.width = `${boardSize}px`;
      context.layoutPlayerHandFan();
      context.layoutReservedCardRows();
      context.alignAlienPanelsToPlanets();
      context.renderAlienPanels();
      context.renderTechBoard();
      if (context.getMoveHighlightRocketId() != null) context.scheduleRenderMoveArrows();
    }
    function syncTechRenderContext() {
      techRenderContext.supplyStage = els.techStage;
      techRenderContext.playerBoardTechLayer = els.playerBoardTechLayer;
      techRenderContext.supplySlots = Object.fromEntries(
        [...document.querySelectorAll(".tech-slot[data-tech-slot]")].map((slot) => [slot.dataset.techSlot, slot]),
      );
    }
    return Object.freeze({ resize, syncTechRenderContext });
  }

  function createCoordinatePort(context = {}) {
    function getMovableTokensForPlayer(playerId) {
      const projection = context.getBoardCoordinateProjection();
      return projection.tokens.filter(
        (token) => String(token?.playerId) === String(playerId) && token.movable,
      );
    }
    function getEarthSectorCoordinate() {
      const earth = context.getBoardCoordinateProjection().planetLocations
        .find((planet) => planet.planetId === "earth");
      if (!earth) throw new Error("Earth position was not found in BoardCoordinateProjection");
      return { x: earth.x, y: earth.y };
    }
    function syncPlanetOrbitLandMarkers() {
      return context.inputPort.syncPlanetMarkers();
    }
    function seedDefaultReferenceRockets() {
      return context.inputPort.seedReferenceRockets();
    }
    return Object.freeze({
      getMovableTokensForPlayer,
      getEarthSectorCoordinate,
      syncPlanetOrbitLandMarkers,
      seedDefaultReferenceRockets,
    });
  }

  function createFrameRenderScheduler(context = {}) {
    function queue() {
      if (context.state.stateReadoutRenderFrame) return;
      context.state.stateReadoutRenderFrame = context.requestAnimationFrame(() => {
        context.state.stateReadoutRenderFrame = 0;
        context.render();
      });
    }
    return Object.freeze({ queue });
  }

  function createMovePaymentAiGuard(context = {}) {
    return function block(message = null) {
      const player = context.getMovePaymentPlayer();
      return context.blockManualInput(
        message || `${player?.colorLabel || "电脑玩家"}AI 正在确认移动支付`,
        player,
      );
    };
  }

  function createInteractionChrome(context = {}) {
    const { els = {} } = context;
    function syncPublicScanConfirmButton() {
      if (!els.publicScanConfirm) return;
      const multi = context.isPublicCardMultiSelectActive();
      els.publicScanConfirm.hidden = !multi;
      if (!multi) return;
      const count = context.getPublicCardSelectedCount();
      const minSelectable = context.getPublicCardMultiSelectMinSelectable();
      els.publicScanConfirm.disabled = count < minSelectable;
      const label = context.getCardSelectionType() === "card_public_corner_discard" ? "确认弃除" : "确认扫描";
      els.publicScanConfirm.textContent = count > 0 ? `${label}（${count}/${minSelectable}张）` : label;
    }
    function syncCardSelectionChrome() {
      const active = context.isCardSelectionActive();
      if (active) context.cancelHandCardContextActions({ silent: true });
      els.appWrap?.classList.toggle("card-selection-active", active);
      els.publicCardPanel?.classList.toggle("card-selection-active", active);
      els.publicCardPanel?.classList.toggle("public-card-panel-focused", active);
      if (els.cardSelectionBackdrop) {
        els.cardSelectionBackdrop.hidden = !active;
        els.cardSelectionBackdrop.setAttribute("aria-hidden", String(!active));
      }
      if (els.cardSelectionCancel) els.cardSelectionCancel.hidden = !active;
      syncPublicScanConfirmButton();
      if (active) context.setQuickPanelOpen(false);
      context.renderPublicCards();
      context.updatePublicCardControls();
      syncInteractionFocusChrome();
    }
    function syncInteractionFocusChrome() {
      if (!els.appWrap) return;
      const mode = context.getInteractionFocusMode();
      els.appWrap.dataset.interactionFocus = mode || "";
      els.appWrap.classList.toggle("has-future-span-ready-card", context.hasPlayableFutureSpanCard());
      els.boardShell?.classList.toggle("board-shell-focused", mode === "board-rockets");
    }
    function syncIndustryHandSelectionChrome() {
      const active = context.isIndustryHandSelectionActive();
      if (active) context.cancelHandCardContextActions({ silent: true });
      els.appWrap?.classList.toggle("industry-hand-selection-active", active);
      els.playerHandPanel?.classList.toggle("industry-hand-selection-active", active);
      els.playerHandPanel?.classList.toggle("player-hand-panel-focused", active);
      if (active) {
        context.setQuickPanelOpen(false);
        context.scrollToPlayerHandPanel();
      }
      context.renderPlayerHand();
      context.renderInitialSelectionArea();
      syncInteractionFocusChrome();
    }
    function setActionEffectFlowActive(active) {
      els.appWrap?.classList.toggle("action-effect-flow-active", Boolean(active));
    }
    function resetAfterRecovery() {
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
      if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = true;
      if (els.alienTraceTitle) els.alienTraceTitle.textContent = "获取外星人标记";
      els.alienTraceSubtitle?.classList.remove("alien-reveal-confirmation-text");
      if (els.alienTraceCancel) els.alienTraceCancel.hidden = false;
      if (els.landTargetOverlay) els.landTargetOverlay.hidden = true;
      if (els.dataPlaceOverlay) els.dataPlaceOverlay.hidden = true;
      if (els.actionEffectBar) els.actionEffectBar.hidden = true;
      els.appWrap?.classList.remove(
        "action-effect-flow-active", "move-mode-active", "card-selection-active",
        "play-card-selection-active", "card-corner-action-active", "discard-selection-active",
        "pass-reserve-selection-active", "hand-scan-selection-active", "industry-hand-selection-active",
      );
      if (els.passReserveSelectionOverlay) {
        els.passReserveSelectionOverlay.hidden = true;
        els.passReserveSelectionOverlay.setAttribute("aria-hidden", "true");
      }
    }
    return Object.freeze({
      syncPublicScanConfirmButton,
      syncCardSelectionChrome,
      syncInteractionFocusChrome,
      syncIndustryHandSelectionChrome,
      setActionEffectFlowActive,
      resetAfterRecovery,
    });
  }

  function createPlayerHandTitlePresenter(context = {}) {
    function getPlayerHandPanelTitleHint() {
      if (context.isDiscardSelectionActive()) {
        return `（请选择 ${context.getPendingDiscardDecision()?.count || 0} 张弃牌）`;
      }
      if (context.isHandScanSelectionActive()) return "（请选择一张牌进行扫描）";
      if (context.isMovePaymentSelectionActive() && !context.isMovePaymentLockedForAiAutomation()) {
        const required = context.getPendingMovePayment()?.requiredMovePoints || context.moveEnergyCost;
        return required > 1
          ? `（需 ${required} 点移动力：可选移动牌，剩余用能量补齐）`
          : "（可选移动牌弃置，或直接确认消耗 1 能量）";
      }
      if (context.isPlayCardSelectionActive()) {
        const pending = context.getPendingPlayCardSelection();
        return pending ? `（已选择 ${context.getCardLabel(pending.card)}）` : "（请选择要打出的牌）";
      }
      const selectedHandAction = context.getPendingCardCornerQuickAction() || context.getPendingHandCardPlayAction();
      return selectedHandAction ? `（已选择 ${context.getCardLabel(selectedHandAction.card)}）` : "";
    }

    return Object.freeze({
      getPlayerHandPanelTitleHint,
      updatePlayerHandPanelTitle: () => context.renderPlayerHand(),
    });
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
    if (typeof context.getProjection !== "function" || typeof context.assertProjection !== "function") {
      throw new TypeError("createRenderRuntime 需要冻结 RenderProjection provider/assertion");
    }

    let activeProjection = null;

    function loadProjection() {
      return context.assertProjection(context.getProjection());
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

    function getProjectedPlayers() {
      const projectedPlayers = readProjection().playerPanels?.players;
      return Array.isArray(projectedPlayers) ? projectedPlayers : [];
    }

    function getPlayerById(playerId) {
      return getProjectedPlayers().find((player) => String(player?.id) === String(playerId)) || null;
    }

    function getPlayerByColor(playerColor) {
      return getProjectedPlayers().find((player) => player?.color === playerColor) || null;
    }

    function getCurrentPlayer() {
      return getPlayerById(readProjection().playerPanels?.currentPlayerId);
    }

    function getInterfacePlayer() {
      return getPlayerById(readProjection().playerPanels?.interfacePlayerId) || getCurrentPlayer();
    }

    function getActivePlayers() {
      const activePlayerIds = new Set(
        (readProjection().turnPresentation?.activePlayerIds || []).map(String),
      );
      return getProjectedPlayers().filter((player) => activePlayerIds.has(String(player?.id)));
    }

    function getPlayerFinalScoreBreakdown(player) {
      return readProjection().finalScorePresentation?.breakdownsByPlayerId?.[String(player?.id)]
        || { totalScore: Number(player?.finalTotalScore) || Number(player?.score) || 0 };
    }

    function cloneProjectedPlayer(player) {
      return player ? structuredClone(player) : null;
    }

    const boardChrome = () => readProjection().boardChrome;
    const playerPanels = () => readProjection().playerPanels;
    const tokenPresentation = () => readProjection().tokenPresentation;
    const dataPresentation = () => readProjection().dataPresentation;
    const turnPresentation = () => readProjection().turnPresentation;
    const cardPanels = () => readProjection().cardPanels;
    const markerPresentation = () => readProjection().markerPresentation;
    const {
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
      attachCardHoverPreview,
      handleRocketPointerDown,
      syncInteractionFocusChrome,
    } = context;
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
      const assets = currentPlayer?.tokenAssets || {};
      let pendingLoads = 3;
      const finalizeTokenSizes = () => {
        pendingLoads -= 1;
        if (pendingLoads === 0) renderRockets();
      };

      loadTokenWidth(assets.rocket, ROCKET_IMAGE_SCALE, 205, (width) => {
        tokenWidths.rocket = width;
        els.tokenLayer.style.setProperty("--rocket-width", `${width}px`);
        els.planetsTokenLayer.style.setProperty("--rocket-width", `${width}px`);
        finalizeTokenSizes();
      });
      loadTokenWidth(assets.orbit, REFERENCE_ORBIT_IMAGE_SCALE, 927, (width) => {
        tokenWidths.orbit = width;
        els.planetsTokenLayer.style.setProperty("--reference-orbit-width", `${width}px`);
        finalizeTokenSizes();
      });
      loadTokenWidth(assets.land, REFERENCE_LANDDING_IMAGE_SCALE, 927, (width) => {
        tokenWidths.landding = width;
        els.planetsTokenLayer.style.setProperty("--reference-land-width", `${width}px`);
        finalizeTokenSizes();
      });
    }

    function applyTokenWidth(element, rocket) {
      if (!rocket.isReferencePlaced) {
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

    function renderRocketElement(rocket) {
      let element = document.getElementById(`rocket-${rocket.id}`);

      if (!element) {
        element = document.createElement("img");
        element.className = "rocket-token";
        element.id = `rocket-${rocket.id}`;
        element.draggable = false;
        element.dataset.rocketId = String(rocket.id);
        element.addEventListener("pointerdown", handleRocketPointerDown);
        els.tokenLayer.appendChild(element);
      }

      const layer = rocket.isReferencePlaced ? els.planetsTokenLayer : els.tokenLayer;
      if (layer && element.parentElement !== layer) layer.appendChild(element);

      const referencePlacement = rocket.referencePlacement || null;
      element.src = rocket.imageSrc || "";
      element.alt = rocket.alt || "";
      element.dataset.playerId = rocket.playerId || "";
      element.dataset.playerColor = rocket.uiColorId || "";
      element.dataset.referencePlanet = referencePlacement?.planetId || "";
      element.dataset.referenceParentPlanet = referencePlacement?.parentPlanetId || "";
      element.dataset.referenceSatellite = referencePlacement?.satelliteId || "";
      element.dataset.referenceKind = referencePlacement?.kind || "";
      element.style.setProperty("--rocket-glow", rocket.glowColor || "");
      element.classList.toggle("is-dragging", tokenPresentation().draggingRocketId === rocket.id);
      element.classList.toggle("is-reference-placed", Boolean(rocket.isReferencePlaced));
      element.classList.toggle("is-default-reference", Boolean(referencePlacement?.isDefault));
      element.classList.toggle("is-reference-orbit", referencePlacement?.kind === "orbit");
      element.classList.toggle("is-reference-land", referencePlacement?.kind === "land");
      element.classList.toggle("is-reference-satellite", referencePlacement?.kind === "satellite");
      element.classList.toggle("is-planet-marker", Boolean(rocket.isPlanetMarker));
      const referenceOffset = Number(referencePlacement?.referenceOffsetTokenWidths) || 0;
      element.classList.toggle("is-reference-offset", Boolean(referenceOffset));
      if (referenceOffset) {
        element.style.setProperty("--reference-offset-token-widths", String(referenceOffset));
      } else {
        element.style.removeProperty("--reference-offset-token-widths");
      }
      element.classList.toggle("is-chong-fossil", Boolean(rocket.isChongFossil));
      element.classList.toggle("is-chong-delivered", Boolean(rocket.chongDelivered || rocket.cargo?.delivered));
      element.classList.toggle("is-move-target", Boolean(rocket.isMoveTarget));
      element.classList.toggle("is-move-candidate", Boolean(rocket.isMoveCandidate));
      element.classList.toggle("is-move-muted", Boolean(rocket.isMoveMuted));
      element.classList.toggle("is-move-selectable", Boolean(rocket.isMoveSelectable));

      applyTokenWidth(element, rocket);
      element.style.left = `${rocket.leftPercent}%`;
      element.style.top = `${rocket.topPercent}%`;
      element.title = rocket.title || "";
      if (rocket.isChongFossil) renderChongFossilOwnerTokenForRocket(rocket);
    }

    function renderChongFossilOwnerTokenForRocket(rocket, activeKeys = null) {
      if (!els.tokenLayer || !rocket.isChongFossil || rocket.isReferencePlaced) return null;

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

      element.src = rocket.ownerTokenSrc || "";
      element.alt = `${rocket.alt || ""}归属标记`;
      element.title = element.alt;
      element.style.left = `${rocket.leftPercent}%`;
      element.style.top = `${rocket.topPercent}%`;
      return element;
    }

    function renderChongFossilOwnerTokens() {
      if (!els.tokenLayer) return;
      const activeKeys = new Set();
      for (const rocket of tokenPresentation().tokens) {
        renderChongFossilOwnerTokenForRocket(rocket, activeKeys);
      }
      for (const [key, element] of chongFossilOwnerTokenElements.entries()) {
        if (activeKeys.has(key)) continue;
        element.remove();
        chongFossilOwnerTokenElements.delete(key);
      }
    }

    function renderYichangdianAnomalyMarkers() {
      if (!els.tokenLayer) return;
      const activeKeys = new Set();

      for (const anomaly of markerPresentation().anomalies || []) {
        const key = anomaly.key;
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
        element.style.left = `${anomaly.leftPercent}%`;
        element.style.top = `${anomaly.topPercent}%`;
        element.dataset.boardX = String(anomaly.boardX);
        element.dataset.boardY = String(anomaly.boardY);
        element.src = anomaly.imageSrc;
        element.alt = anomaly.alt;
        element.dataset.anomalyKey = key;
        element.dataset.markerId = anomaly.markerId;
        element.dataset.sectorX = String(anomaly.sectorX);
        element.dataset.sectorY = String(anomaly.sectorY);
        element.title = anomaly.title;
      }

      for (const [key, element] of yichangdianAnomalyMarkerElements.entries()) {
        if (activeKeys.has(key)) continue;
        element.remove();
        yichangdianAnomalyMarkerElements.delete(key);
      }
    }

    function renderChongPlanetFossilMarkers() {
      if (!els.tokenLayer) return;
      const activeKeys = new Set();
      for (const fossil of markerPresentation().planetFossils || []) {
        const key = fossil.key;
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
        element.style.left = `${fossil.leftPercent}%`;
        element.style.top = `${fossil.topPercent}%`;
        let image = element.querySelector(".chong-planet-fossil-marker-image");
        if (!image) {
          image = document.createElement("img");
          image.className = "chong-planet-fossil-marker-image";
          image.draggable = false;
          image.decoding = "async";
          element.prepend(image);
        }
        image.src = fossil.imageSrc;
        image.alt = fossil.alt;
        let count = element.querySelector(".chong-planet-fossil-count");
        if (!count) {
          count = document.createElement("span");
          count.className = "chong-planet-fossil-count";
          element.appendChild(count);
        }
        count.textContent = String(fossil.count);
        element.dataset.chongPlanetId = fossil.planetId;
        element.dataset.chongPlanetFossilCount = String(fossil.count);
        element.title = fossil.title;
      }

      for (const [key, element] of chongPlanetFossilMarkerElements.entries()) {
        if (activeKeys.has(key)) continue;
        element.remove();
        chongPlanetFossilMarkerElements.delete(key);
      }
    }

    function mountRunezuBoardLayerSymbol(sourceSymbol, activeKeys) {
      if (!els.tokenLayer || sourceSymbol.surface !== "board") return;
      const key = sourceSymbol.key;
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
      element.style.left = `${sourceSymbol.leftPercent}%`;
      element.style.top = `${sourceSymbol.topPercent}%`;
      element.src = sourceSymbol.imageSrc;
      element.alt = sourceSymbol.alt;
      element.dataset.runezuSourceType = sourceSymbol.sourceType;
      element.dataset.runezuSourceId = sourceSymbol.sourceId;
      element.title = sourceSymbol.title;
    }

    function mountRunezuTechSymbol(sourceSymbol, activeKeys) {
      if (sourceSymbol.surface !== "tech") return;
      const slot = techRenderContext?.supplySlots?.[sourceSymbol.sourceId]
        || document.querySelector(`.tech-slot[data-tech-slot="${sourceSymbol.sourceId}"]`);
      if (!slot) return;
      const key = sourceSymbol.key;
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
      element.src = sourceSymbol.imageSrc;
      element.alt = sourceSymbol.alt;
      element.dataset.runezuSourceType = sourceSymbol.sourceType;
      element.dataset.runezuSourceId = sourceSymbol.sourceId;
      element.title = sourceSymbol.title;
    }

    function renderRunezuBoardSymbols() {
      const activeKeys = new Set();
      for (const sourceSymbol of markerPresentation().runezuSymbols || []) {
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
      const activeIds = new Set(tokenPresentation().tokens.map((rocket) => rocket.id));
      els.tokenLayer?.querySelectorAll(".rocket-token").forEach((element) => {
        const rocketId = Number(element.dataset.rocketId);
        if (!activeIds.has(rocketId)) element.remove();
      });
      els.planetsTokenLayer?.querySelectorAll(".rocket-token").forEach((element) => {
        const rocketId = Number(element.dataset.rocketId);
        if (!activeIds.has(rocketId)) element.remove();
      });
      tokenPresentation().tokens.forEach(renderRocketElement);
      renderYichangdianAnomalyMarkers();
      renderChongPlanetFossilMarkers();
      renderChongFossilOwnerTokens();
      renderRunezuBoardSymbols();
    }

    function renderPublicCards() {
      if (!els.publicCardRow) return;

      const controls = cardPanels().publicControls || {};
      els.publicCardRow.replaceChildren(...cardPanels().publicCards.map((card, index) => {
        const slot = document.createElement("div");
        slot.className = "public-card-slot";
        slot.dataset.publicSlot = String(index);
        const label = card.label;

        if (card.empty) {
          slot.classList.add("is-empty");
          slot.setAttribute("aria-hidden", "true");
          return slot;
        }

        if (card.selectable) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "public-card";
          button.dataset.publicSlot = String(index);
          button.classList.add("is-selectable");
          button.classList.toggle("is-selected", Boolean(card.selected));
          button.setAttribute("aria-label", label);

          const image = document.createElement("img");
          image.src = card.imageSrc;
          image.alt = "";
          image.width = 747;
          image.height = 1040;
          image.decoding = "async";
          image.setAttribute("aria-hidden", "true");
          button.append(image);
          attachCardHoverPreview(button, card.imageSrc, label);
          slot.append(button);
          return slot;
        }

        const image = document.createElement("img");
        image.className = "public-card";
        image.src = card.imageSrc;
        image.alt = label;
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        attachCardHoverPreview(image, card.imageSrc, label);
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

      const hand = cardPanels().handCards || [];
      const handPanel = cardPanels().handPanel || {};
      els.playerHandPanel.classList.toggle("is-empty", Boolean(handPanel.empty));
      els.playerHandPanel.classList.toggle("card-corner-action-ready", Boolean(handPanel.contextActionReady));
      layoutPlayerHandFan(hand.length);
      els.playerHandFan.replaceChildren(...hand.map((card, index) => {
        if (card.interactive) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "player-hand-card-button";
          button.style.setProperty("--card-index", String(index + 1));
          button.dataset.handIndex = String(index);
          button.classList.add(...(card.classNames || []));
          button.disabled = Boolean(card.disabled);
          button.setAttribute("aria-label", card.ariaLabel || card.label);
          button.title = card.title || "";

          const image = document.createElement("img");
          image.src = card.imageSrc;
          image.alt = "";
          image.width = 747;
          image.height = 1040;
          image.decoding = "async";
          image.setAttribute("aria-hidden", "true");
          button.append(image);
          attachCardHoverPreview(button, card.imageSrc, card.label);
          return button;
        }

        const image = document.createElement("img");
        image.className = "player-hand-card";
        image.src = card.imageSrc;
        image.alt = card.label;
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        image.style.setProperty("--card-index", String(index + 1));
        attachCardHoverPreview(image, card.imageSrc, card.label);
        return image;
      }));
    }

    function renderReservedCards() {
      if (!els.reservedCardFan || !els.reservedCardPanel) return;
      const presentation = cardPanels().reservedCards || { rows: [] };
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
          image.src = item.imageSrc || "";
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

      const selection = cardPanels().initialSelection || {};
      if (selection.active) {
        if (selection.interactive) {
          els.initialSelectionArea.hidden = false;
          els.initialSelectionArea.replaceChildren(createInitialSelectionPicker(selection.offer || null));
          syncInteractionFocusChrome();
          return;
        }
      }

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
      summary.classList.add(...(selection.companyClassNames || []));
      summary.replaceChildren(createCompanyCardSummary(companyCard, null));
      els.initialSelectionArea.replaceChildren(summary);
      syncInteractionFocusChrome();
    }

    function renderPlayerDataBoard() {
      const layer = els.playerBoardDataLayer;
      if (!layer) return;
      layer.replaceChildren();
      for (const token of dataPresentation().playerTokens || []) {
        const image = document.createElement("img");
        image.className = token.kind === "pool"
          ? "data-token data-token-positioned data-token-pool"
          : token.kind === "blue-bonus"
            ? "data-token data-token-positioned data-token-placed data-token-blue-bonus"
            : "data-token data-token-positioned data-token-placed";
        image.src = token.imageSrc;
        image.alt = token.alt;
        image.title = token.title;
        image.draggable = false;
        image.dataset.dataKind = token.kind === "pool" ? "pool" : "placed";
        image.dataset.dataTokenId = token.tokenId;
        image.dataset.dataIndex = String(token.tokenIndex);
        if (token.slotIndex != null) image.dataset.dataSlotIndex = String(token.slotIndex);
        if (token.blueSlot != null) image.dataset.dataBlueSlot = String(token.blueSlot);
        if (token.placementSlot != null) image.dataset.dataPlacementSlot = String(token.placementSlot);
        image.style.left = `${token.percentX}%`;
        image.style.top = `${token.percentY}%`;
        image.style.setProperty("--data-scale", String(token.scale));
        layer.append(image);
      }
      for (const zone of dataPresentation().blueDropZones || []) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "data-blue-bonus-drop-zone";
        button.dataset.blueSlot = String(zone.blueSlot);
        button.disabled = !zone.enabled;
        button.title = zone.title;
        button.setAttribute("aria-label", zone.title);
        button.style.left = `${zone.percentX}%`;
        button.style.top = `${zone.percentY}%`;
        button.style.setProperty("--data-scale", String(zone.scale));
        if (zone.enabled) {
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            context.placeDataToBlueSlot(zone.blueSlot);
          });
        }
        layer.append(button);
      }
    }

    function createOpponentStatRow(className) {
      const row = document.createElement("div");
      row.className = `opponent-stat-row ${className}`;
      return row;
    }

    function createOpponentTechRow(techStat) {
      const row = createOpponentStatRow("opponent-stat-row-tech");
      for (const slot of techStat.slots || []) {
        const item = document.createElement("span");
        item.className = "opponent-tech-item";
        item.textContent = slot.label;
        if (slot.owned) {
          item.classList.add("is-owned");
          item.style.setProperty("--opponent-tech-color", techStat.color);
          item.classList.toggle("is-disabled", Boolean(slot.disabled));
        } else {
          item.classList.add("is-missing");
        }
        row.append(item);
      }

      return row;
    }

    function createOpponentPlayerHeaderRow(player, score, finalTotalScore) {
      const row = createOpponentStatRow("opponent-stat-row-header");
      const roundOrderNumber = player.roundOrderNumber || null;

      const idEl = document.createElement("span");
      idEl.className = "opponent-stat-id player-stat-value";
      idEl.classList.toggle("is-player-passed", Boolean(player.passed));
      idEl.textContent = player.displayName;
      idEl.title = idEl.textContent;

      const orderEl = document.createElement("span");
      orderEl.className = "player-turn-order-number";
      orderEl.textContent = roundOrderNumber == null ? "-" : String(roundOrderNumber);
      orderEl.title = roundOrderNumber == null ? "不在本轮顺位中" : `本轮顺位 ${roundOrderNumber}`;
      orderEl.setAttribute("aria-label", orderEl.title);

      const marker = document.createElement("span");
      marker.className = "player-color-marker";
      marker.style.setProperty("--player-color", player.uiColor);
      marker.setAttribute("aria-label", player.colorLabel || "");

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
      row.append(createStatIcon(
        "环绕登陆",
        player.opponentStats?.orbitLand || 0,
        RESOURCE_ICON_SRC.orbitOrLand,
      ));
      for (const stat of player.opponentStats?.sectorWins || []) {
        row.append(createStatIcon(stat.label, stat.value, stat.iconSrc));
      }

      return row;
    }

    function createOpponentAlienTraceRow(player) {
      const row = createOpponentStatRow("opponent-stat-row-alien-traces");
      row.append(...(player.opponentStats?.traces || []).map(
        (stat) => createStatIcon(stat.label, stat.value, stat.iconSrc),
      ));
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
      const presentation = player.opponentStats?.jiuzhe;
      if (!presentation?.visible) return null;

      const row = createOpponentStatRow("opponent-stat-row-jiuzhe");
      row.append(
        createStatIcon("已打出九折牌", presentation.count, RESOURCE_ICON_SRC.jiuzheCard),
        createStatIcon("九折威胁度", presentation.threat, RESOURCE_ICON_SRC.jiuzheThreat),
      );
      return row;
    }

    function renderOpponentStats() {
      if (!els.opponentStatGrid) return;

      const currentPlayerId = getCurrentPlayer()?.id || playerPanels().currentPlayerId;
      const projectedActivePlayers = getActivePlayers();
      const activePlayers = projectedActivePlayers.length ? projectedActivePlayers : playerPanels().players;
      const cards = activePlayers.map((projectedPlayer) => {
        const player = cloneProjectedPlayer(projectedPlayer);
        const finalScoreBreakdown = getPlayerFinalScoreBreakdown(player);
        const card = document.createElement("article");
        card.className = "opponent-stat-card";
        card.dataset.playerId = player.id;
        if (player.id === currentPlayerId) {
          card.classList.add("is-current");
        }
        card.style.setProperty("--player-color", player.uiColor);

        const resourcesRow = createOpponentStatRow("opponent-stat-row-resources");
        resourcesRow.append(...buildPlayerResourceStatNodes(player, { includeHandSize: true }));

        const incomeRow = createOpponentStatRow("opponent-stat-row-income");
        incomeRow.append(...buildPlayerIncomeStatNodes(player));
        const jiuzheRow = createOpponentJiuzheRow(player);
        const runezuRow = createOpponentRunezuSymbolRow(player);

        card.append(
          createOpponentPlayerHeaderRow(player, player.score, finalScoreBreakdown.totalScore),
          resourcesRow,
          incomeRow,
          ...(jiuzheRow ? [jiuzheRow] : []),
          ...(runezuRow && !runezuRow.hidden ? [runezuRow] : []),
          ...(player.techStats || []).map(createOpponentTechRow),
          createOpponentSummaryRow(player),
          createOpponentAlienTraceRow(player),
        );
        return card;
      });

      els.opponentStatGrid.replaceChildren(...cards);
    }

    function renderPlayerStats() {
      const currentPlayer = cloneProjectedPlayer(getInterfacePlayer());
      const finalScoreBreakdown = getPlayerFinalScoreBreakdown(currentPlayer);

      const mainStats = [
        createPlayerNameStat(currentPlayer, currentPlayer.score, finalScoreBreakdown.totalScore),
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
      const handPanel = cardPanels().handPanel || {};
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
        if (!sectorElement) continue;
        sectorElement.querySelectorAll(".nebula-panel, .sector-win-marker-layer")
          .forEach((element) => element.remove());
        for (const panelView of dataPresentation().sectorTokensBySectorId?.[String(sectorId)] || []) {
          const panel = document.createElement("div");
          panel.className = "nebula-panel";
          panel.dataset.nebulaId = panelView.nebulaId;
          panel.style.position = "absolute";
          panel.style.left = `${panelView.region.originX}%`;
          panel.style.top = `${panelView.region.originY}%`;
          panel.style.width = `${panelView.region.widthPercent}%`;
          panel.style.height = `${panelView.region.heightPercent}%`;
          const layer = document.createElement("div");
          layer.className = "nebula-data-layer";
          layer.dataset.nebulaId = panelView.nebulaId;
          for (const token of panelView.tokens || []) {
            const image = document.createElement("img");
            image.className = "data-token nebula-data-token nebula-data-token-positioned";
            image.src = token.imageSrc;
            image.alt = token.alt;
            image.title = token.title;
            image.draggable = false;
            image.dataset.dataKind = "nebula";
            image.dataset.dataTokenId = token.tokenId;
            image.dataset.dataIndex = String(token.tokenIndex);
            image.dataset.nebulaId = panelView.nebulaId;
            image.dataset.nebulaSlotIndex = String(token.slotIndex);
            image.style.left = `${token.percentX}%`;
            image.style.top = `${token.percentY}%`;
            image.style.width = `${token.widthPercent}%`;
            layer.append(image);
          }
          panel.append(layer);
          sectorElement.append(panel);
          if (panelView.winMarkers?.length) {
            let winLayer = sectorElement.querySelector(".sector-win-marker-layer");
            if (!winLayer) {
              winLayer = document.createElement("div");
              winLayer.className = "sector-win-marker-layer";
              sectorElement.append(winLayer);
            }
            for (const marker of panelView.winMarkers) {
              const image = document.createElement("img");
              image.className = "sector-win-token sector-win-token-owned sector-win-token-positioned";
              image.src = marker.imageSrc;
              image.alt = marker.alt;
              image.title = marker.title;
              image.draggable = false;
              image.style.left = `${marker.percentX}%`;
              image.style.top = `${marker.percentY}%`;
              image.style.width = `${marker.widthPercent}%`;
              winLayer.append(image);
            }
          }
        }
      }
      els.tokenLayer?.querySelector(".aomomo-nebula-data-layer")?.remove();
      if (els.tokenLayer && dataPresentation().aomomoTokens?.length) {
        const layer = document.createElement("div");
        layer.className = "aomomo-nebula-data-layer";
        layer.dataset.nebulaId = "aomomo";
        for (const token of dataPresentation().aomomoTokens) {
          const image = document.createElement("img");
          image.className = "data-token nebula-data-token aomomo-nebula-data-token nebula-data-token-positioned";
          image.src = token.imageSrc;
          image.alt = token.alt;
          image.title = token.title;
          image.draggable = false;
          image.style.left = `${token.percentX}%`;
          image.style.top = `${token.percentY}%`;
          image.style.width = `${token.widthPercent}%`;
          layer.append(image);
        }
        els.tokenLayer.append(layer);
      }
    }

    function renderWheels() {
      for (const wheel of boardChrome().wheelTransforms || []) {
        if (els.wheels[wheel.wheelId]) els.wheels[wheel.wheelId].style.transform = wheel.transform;
      }
      if (els.wheels[3]) {
        els.wheels[3].style.backgroundImage = boardChrome().aomomoWheelImageSrc
          ? `url("${boardChrome().aomomoWheelImageSrc}")`
          : "";
      }
    }

    function renderSectors() {
      for (const sectorId of [1, 2, 3, 4]) {
        delete sectorElements[sectorId];
      }

      for (const sectorView of boardChrome().sectors || []) {
        const wrap = els.sectorWraps[sectorView.slotId];
        wrap.innerHTML = "";
        const sectorId = sectorView.sectorId;
        if (!sectorId) continue;

        const sector = document.createElement("div");
        sector.className = `sector sector-${sectorId}`;
        sector.dataset.sectorId = String(sectorId);
        sector.dataset.boardSlot = String(sectorView.slotId);
        wrap.appendChild(sector);
        sectorElements[sectorId] = sector;
      }

      renderSectorNebulaDataBoard();
    }

    function renderStateReadout() {
      els.stateReadout.textContent = (readProjection().readoutLines || []).join("\n");
    }

    function renderRotateStateToken() {
      if (!els.roundStatusToken) return;

      const slot = boardChrome().rotateTokenSlot;
      if (!slot) return;
      els.roundStatusToken.style.setProperty("--rotate-token-x", `${slot.percentX}%`);
      els.roundStatusToken.style.setProperty("--rotate-token-y", `${slot.percentY}%`);
      els.roundStatusToken.dataset.slotId = slot.id;
    }

    return Object.freeze({
      setTokenAssetSizes: withProjection(setTokenAssetSizes),
      renderRocketElement: withProjection(renderRocketElement),
      renderChongFossilOwnerTokenForRocket: withProjection(renderChongFossilOwnerTokenForRocket),
      renderChongFossilOwnerTokens: withProjection(renderChongFossilOwnerTokens),
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
    createCoordinateOwnerInputPort,
    RENDER_CONTEXT_CAPABILITY_INVENTORY,
    cloneSelectorResult,
    createRenderRuntime,
    createCardHoverPreviewRuntime,
    createCoordinateRuntime,
    createBrowserLayoutRuntime,
    createCoordinatePort,
    createFrameRenderScheduler,
    createMovePaymentAiGuard,
    createInteractionChrome,
    createPlayerHandTitlePresenter,
  };
});
