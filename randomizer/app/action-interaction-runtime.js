(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SetiAppActionInteractionRuntime = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createActionInteractionRuntime(context) {
    const headless = context.headless === true;
    const {
      HISTORY_SOURCE_MAIN,
      SCORE_SOURCE_KEYS,
      abilities,
      actionShared,
      addPlayerScoreSource,
      beginCardSelection,
      beginDiscardSelection,
      beginEffectHistoryStep,
      blockIncompatiblePendingQuickAction,
      buildPlutoChoiceRewardSummary,
      buildPlutoRewardEffectsForAction,
      canStartMainAction,
      cancelMovePaymentSelection,
      cardEffects,
      createActionContext,
      data,
      decisionSessions,
      els,
      getBoardPointFromPolarPoint,
      getMainActionStartBlockReason,
      getPendingOwnerFields,
      getPendingOwnerPlayer,
      getPlaceDataSlotBonuses,
      hasActiveCardTriggerResolution,
      historyCommands,
      isActionEffectFlowActive,
      isMovePaymentSelectionActive,
      markerBelongsToPlayer,
      markerOwnerLabel,
      openLandTargetPicker,
      players,
      recordAtomicActionHistory,
      recordHistoryCommand,
      recordPlaceDataActionHistory,
      removeRocketElement,
      renderInitialSelectionArea,
      renderPlayerStats,
      renderReservedCards,
      renderRocketElement,
      renderRockets,
      renderStateReadout,
      resumeDataPlacementContinuation,
      restoreMutableObject,
      rocketActions,
      runAction,
      settleCardTasksAfterEffect,
      solar,
      startCardEffectFlow,
      syncInteractionFocusChrome,
      tokenWidths,
      uiRuntimeState,
      updateActionButtons,
      validateIndustryHuanyuMoveRocket,
      withPendingOwnerPlayer
    } = context;
    const decisionState = context.decisionSessions?.createFacade?.({
      discardAction: "discard_action",
      cardSelectionAction: "card_selection_action",
      alienTraceAction: "alien_trace_action",
      alienTracePickerState: "alien_trace_picker_state",
      actionEffectFlow: "action_effect_flow",
    }) || {};
    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("action interaction operation requires an explicit workingRoot");
      }
      return workingRoot;
    }

    function getCurrentPlayerForRoot(workingRoot) {
      requireWorkingRoot(workingRoot);
      return players.getCurrentPlayer(workingRoot.playerState);
    }

    function getPendingDataPlacement(workingRoot) {
      return requireWorkingRoot(workingRoot).match?.dataPlacementContinuation || null;
    }

    function setPendingDataPlacement(workingRoot, pending) {
      const activeRoot = requireWorkingRoot(workingRoot);
      if (pending) activeRoot.match.dataPlacementContinuation = pending;
      else delete activeRoot.match.dataPlacementContinuation;
    }
    let moveArrowRenderFrame = 0;

  function getPlutoReservedCards(workingRoot, player = getCurrentPlayerForRoot(workingRoot)) {
    requireWorkingRoot(workingRoot);
    return (player?.reservedCards || []).filter((card) => cardEffects.getCardModel?.(card)?.pluto);
  }

  function getAllPlutoReservedCardEntries(workingRoot) {
    requireWorkingRoot(workingRoot);
    return (workingRoot.playerState.players || []).flatMap((player) => (
      getPlutoReservedCards(workingRoot, player).map((card) => ({ player, card }))
    ));
  }

  function ensurePlutoCardEffectState(card) {
    if (!card) return null;
    let state = cardEffects.ensureCardEffectState(card);
    if (!state) {
      const modelCardId = cardEffects.getCardId?.(card) || card.cardId || card.id || "b_139.webp";
      if (!card.cardEffectState || card.cardEffectState.modelCardId !== modelCardId) {
        card.cardEffectState = {
          modelCardId,
          consumedTriggerIds: [],
          completedTaskIds: [],
        };
      }
      state = card.cardEffectState;
    }
    if (!Array.isArray(state.consumedTriggerIds)) state.consumedTriggerIds = [];
    if (!Array.isArray(state.completedTaskIds)) state.completedTaskIds = [];
    if (!state.pluto) state.pluto = {};
    const pluto = state.pluto;
    if (!Array.isArray(pluto.orbitMarkers)) {
      const orbitCount = Math.max(0, Math.round(Number(pluto.orbitCount) || (pluto.orbitDone ? 1 : 0)));
      pluto.orbitMarkers = Array.from({ length: orbitCount }, (_, index) => ({
        kind: "orbit",
        sequence: index + 1,
      }));
    }
    if (!Array.isArray(pluto.landingMarkers)) {
      const landCount = Math.max(0, Math.round(Number(pluto.landCount) || (pluto.landDone ? 1 : 0)));
      pluto.landingMarkers = Array.from({ length: landCount }, (_, index) => ({
        kind: "land",
        sequence: index + 1,
      }));
    }
    pluto.orbitDone = pluto.orbitMarkers.length > 0;
    pluto.landDone = pluto.landingMarkers.length > 0;
    pluto.orbitCount = pluto.orbitMarkers.length;
    pluto.landCount = pluto.landingMarkers.length;
    return state;
  }

  function getPlutoActionState(card) {
    const state = ensurePlutoCardEffectState(card);
    if (!state) return { orbitDone: false, landDone: false };
    return state.pluto;
  }

  function getNextPlutoMarkerSequence(markers) {
    return (markers || []).reduce((max, marker) => Math.max(max, Math.round(Number(marker.sequence) || 0)), 0) + 1;
  }

  function getPlutoMarkerSector(rocket) {
    const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
    return coordinate ? { sectorX: coordinate.x, sectorY: coordinate.y } : {};
  }

  function addPlutoMarker(card, actionType, player, options = {}) {
    const state = getPlutoActionState(card);
    const list = actionType === "orbit" ? state.orbitMarkers : state.landingMarkers;
    if (!options.allowDuplicate && list.length > 0) {
      return { ok: false, message: actionType === "orbit" ? "冥王星已环绕" : "冥王星已登陆" };
    }
    const marker = {
      kind: actionType,
      planetId: "pluto",
      sequence: getNextPlutoMarkerSequence(list),
      playerId: player?.id || null,
      playerColor: player?.color || null,
      color: player?.color || null,
      cardId: card?.id || null,
      ...getPlutoMarkerSector(options.rocket),
    };
    list.push(marker);
    state.orbitDone = state.orbitMarkers.length > 0;
    state.landDone = state.landingMarkers.length > 0;
    state.orbitCount = state.orbitMarkers.length;
    state.landCount = state.landingMarkers.length;
    return { ok: true, marker };
  }

  function removePlutoMarker(workingRoot, choice, player, owner = "current") {
    const entry = getAllPlutoReservedCardEntries(workingRoot).find((item) => item.card.id === choice.cardId);
    if (!entry) return { ok: false, message: "没有可移除的冥王星标记" };
    if (owner !== "any" && entry.player?.id !== player?.id) {
      return { ok: false, message: "只能移除自己的冥王星标记" };
    }
    const state = getPlutoActionState(entry.card);
    const list = choice.kind === "plutoOrbit" ? state.orbitMarkers : state.landingMarkers;
    const markerIndex = list.findIndex((marker) => Number(marker.sequence) === Number(choice.sequence));
    if (markerIndex < 0) return { ok: false, message: "没有可移除的冥王星标记" };
    const [marker] = list.splice(markerIndex, 1);
    state.orbitDone = state.orbitMarkers.length > 0;
    state.landDone = state.landingMarkers.length > 0;
    state.orbitCount = state.orbitMarkers.length;
    state.landCount = state.landingMarkers.length;
    return { ok: true, marker, card: entry.card, ownerPlayer: entry.player, message: "已移除冥王星标记" };
  }

  function collectPlutoMarkers(workingRoot) {
    requireWorkingRoot(workingRoot);
    const markers = [];
    for (const { player, card } of getAllPlutoReservedCardEntries(workingRoot)) {
      const state = getPlutoActionState(card);
      for (const marker of state.orbitMarkers || []) {
        markers.push({
          ...marker,
          kind: "orbit",
          planetId: "pluto",
          cardId: card.id,
          playerId: marker.playerId || player.id,
          playerColor: marker.playerColor || player.color,
          color: marker.color || player.color,
        });
      }
      for (const marker of state.landingMarkers || []) {
        markers.push({
          ...marker,
          kind: "land",
          planetId: "pluto",
          cardId: card.id,
          playerId: marker.playerId || player.id,
          playerColor: marker.playerColor || player.color,
          color: marker.color || player.color,
        });
      }
    }
    return markers;
  }

  function buildPlutoMarkerContext(workingRoot) {
    return { plutoMarkers: collectPlutoMarkers(workingRoot) };
  }

  function playerHasOwnPlutoLanding(workingRoot, player) {
    return collectPlutoMarkers(workingRoot).some((marker) => marker.kind === "land" && markerBelongsToPlayer(marker, player));
  }

  function buildPlutoMarkerRemovalChoices(workingRoot, owner, markerKinds) {
    const currentPlayer = getCurrentPlayerForRoot(workingRoot);
    const choices = [];
    for (const { player, card } of getAllPlutoReservedCardEntries(workingRoot)) {
      if (owner !== "any" && player?.id !== currentPlayer?.id) continue;
      const state = getPlutoActionState(card);
      if (markerKinds.has("orbit")) {
        for (const marker of state.orbitMarkers || []) {
          choices.push({
            id: `plutoOrbit:${card.id}:${marker.sequence}`,
            kind: "plutoOrbit",
            planetId: "pluto",
            cardId: card.id,
            sequence: marker.sequence,
            sectorX: marker.sectorX,
            sectorY: marker.sectorY,
            label: `冥王星 环绕 ${marker.sequence}`,
            description: `${markerOwnerLabel(marker.playerId ? marker : player)}标记`,
          });
        }
      }
      if (markerKinds.has("land")) {
        for (const marker of state.landingMarkers || []) {
          choices.push({
            id: `plutoLand:${card.id}:${marker.sequence}`,
            kind: "plutoLand",
            planetId: "pluto",
            cardId: card.id,
            sequence: marker.sequence,
            label: `冥王星 登陆 ${marker.sequence}`,
            description: `${markerOwnerLabel(marker.playerId ? marker : player)}标记`,
          });
        }
      }
    }
    return choices;
  }

  function getPlutoCandidateRockets(workingRoot, player = getCurrentPlayerForRoot(workingRoot), options = {}) {
    requireWorkingRoot(workingRoot);
    const preferredRocketId = options.preferredRocketId ?? workingRoot.rocketState.activeRocketId ?? null;
    const candidates = (workingRoot.rocketState.rockets || []).filter((rocket) => {
      if (rocket.playerId !== player?.id) return false;
      const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
      return Number(coordinate?.y) === 4;
    });
    if (preferredRocketId == null) return candidates;
    return candidates.sort((left, right) => {
      if (left.id === preferredRocketId) return -1;
      if (right.id === preferredRocketId) return 1;
      return 0;
    });
  }

  function getPlutoActionCost(workingRoot, actionType, card) {
    requireWorkingRoot(workingRoot);
    if (actionType === "orbit") return { ...abilities.planet.DEFAULT_ORBIT_COST };
    const currentPlayer = getCurrentPlayerForRoot(workingRoot);
    const state = getPlutoActionState(card);
    let energy = abilities.planet.BASE_LAND_ENERGY_COST;
    if (state.orbitDone) energy -= 1;
    if (players.playerOwnsTech(currentPlayer, "orange3", createActionContext(workingRoot))) {
      energy -= abilities.planet.ORANGE3_LAND_DISCOUNT;
    }
    return energy > 0 ? { energy } : {};
  }

  function getAvailablePlutoAction(workingRoot, actionType, options = {}) {
    const currentPlayer = getCurrentPlayerForRoot(workingRoot);
    const card = getPlutoReservedCards(workingRoot, currentPlayer).find((item) => {
      const state = getPlutoActionState(item);
      return actionType === "orbit" ? !state.orbitDone : !state.landDone;
    });
    if (!card) return { ok: false, message: "没有可用的冥王星保留牌" };
    const rockets = getPlutoCandidateRockets(workingRoot, currentPlayer, options);
    if (!rockets.length) return { ok: false, message: "没有 y=4 的己方探测器可前往冥王星" };
    const cost = getPlutoActionCost(workingRoot, actionType, card);
    if (!players.canAfford(currentPlayer, cost)) {
      return { ok: false, message: `资源不足，需要 ${players.formatResourceCost(cost)}` };
    }
    return { ok: true, card, rocket: rockets[0], cost };
  }

  function executePlutoAction(workingRoot, actionType, options = {}) {
    requireWorkingRoot(workingRoot);
    const { playerState, rocketState } = workingRoot;
    if (!canStartMainAction()) {
      rocketState.statusNote = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const available = getAvailablePlutoAction(workingRoot, actionType, options);
    if (!available.ok) {
      rocketState.statusNote = available.message;
      renderStateReadout();
      return available;
    }
    const currentPlayer = getCurrentPlayerForRoot(workingRoot);
    const beforePlayer = structuredClone(currentPlayer);
    const beforeRocketState = structuredClone(rocketState);
    const beforeCard = structuredClone(available.card);
    const spendResult = players.spendResources(currentPlayer, available.cost);
    if (!spendResult.ok) {
      rocketState.statusNote = spendResult.message;
      renderStateReadout();
      return spendResult;
    }
    const removeResult = rocketActions.removeRocket(rocketState, available.rocket.id);
    if (!removeResult.ok) {
      players.gainResources(currentPlayer, available.cost);
      rocketState.statusNote = removeResult.message;
      renderStateReadout();
      return removeResult;
    }
    const markerResult = addPlutoMarker(available.card, actionType, currentPlayer, {
      rocket: available.rocket,
    });
    if (!markerResult.ok) {
      restoreMutableObject(currentPlayer, beforePlayer);
      restoreMutableObject(rocketState, beforeRocketState);
      rocketState.statusNote = markerResult.message;
      renderStateReadout();
      return markerResult;
    }
    if (actionType === "orbit") {
      players.incrementPlayerOrbitCount(playerState, currentPlayer.id);
    }
    const actionLabel = actionType === "orbit" ? "环绕冥王星" : "登陆冥王星";
    const result = {
      ok: true,
      undoable: true,
      message: `${actionLabel}，消耗 ${players.formatResourceCost(available.cost) || "0"}，移除 R${available.rocket.id}`,
      commands: [
        historyCommands.createRestorePlayerCommand(currentPlayer, beforePlayer, "恢复冥王星行动前玩家状态"),
        historyCommands.createRestoreRocketStateCommand(rocketState, beforeRocketState, "恢复冥王星行动前探测器状态"),
        historyCommands.createRestoreObjectCommand(available.card, beforeCard, "恢复冥王星卡牌状态"),
      ],
      events: [{
        type: actionType,
        planetId: "pluto",
        playerId: currentPlayer.id,
        playerColor: currentPlayer.color,
        source: "pluto",
      }],
      removedRocketId: available.rocket.id,
      planetId: "pluto",
      markerKind: actionType === "orbit" ? "pluto-orbit" : "pluto-land",
      markerSequence: markerResult.marker.sequence,
    };
    removeRocketElement(available.rocket.id);
    recordAtomicActionHistory(actionType, actionLabel, result, { workingRoot });
    const rewardEffects = buildPlutoRewardEffectsForAction(actionType);
    rocketState.statusNote = result.message;
    renderPlayerStats();
    renderReservedCards();
    updateActionButtons();
    renderStateReadout();
    const startedRewardFlow = startCardEffectFlow(
      `pluto-${actionType}-rewards`,
      actionLabel,
      rewardEffects,
      { workingRoot, actionType, historySource: HISTORY_SOURCE_MAIN, consumesMainAction: true },
    );
    const settlement = settleCardTasksAfterEffect({ events: result.events, render: false });
    renderPlayerStats();
    renderReservedCards();
    updateActionButtons();
    renderStateReadout();
    return startedRewardFlow
      || Boolean(settlement?.type1Result)
      || hasActiveCardTriggerResolution()
      || isActionEffectFlowActive();
  }

  function getCurrentPlanetActionPlacement(workingRoot, context = createActionContext(workingRoot)) {
    requireWorkingRoot(workingRoot);
    return actionShared?.getRocketPlanet?.(context) || { ok: false };
  }

  function getPlutoChoiceActionLabel(actionType) {
    return actionType === "orbit" ? "环绕" : "登陆";
  }

  function formatPlutoChoiceLabel(actionType, available, effect = null) {
    const actionLabel = getPlutoChoiceActionLabel(actionType);
    const costLabel = players.formatResourceCost(available?.cost || {}) || "0";
    const rocketLabel = available?.rocket?.id != null ? `R${available.rocket.id}` : "探测器";
    const rewardSummary = buildPlutoChoiceRewardSummary(actionType, effect);
    return `${actionLabel}冥王星${rewardSummary ? ` - 奖励：${rewardSummary}` : ""}（${rocketLabel}，${costLabel}）`;
  }

  function buildPlutoActionChoiceOptions(workingRoot, actionType) {
    const context = createActionContext(requireWorkingRoot(workingRoot));
    const actionLabel = getPlutoChoiceActionLabel(actionType);
    const normalCheck = actionType === "orbit"
      ? abilities.planet.getOrbitOptions(context)
      : abilities.planet.getLandOptions(context);
    const placement = getCurrentPlanetActionPlacement(workingRoot, context);
    const preferredRocketId = normalCheck?.defaultRocketId || (placement?.ok ? placement.rocket?.id : null);
    const plutoCheck = getAvailablePlutoAction(workingRoot, actionType, { preferredRocketId });
    const choices = [];

    if (normalCheck.ok) {
      if (actionType === "orbit") {
        choices.push(...normalCheck.choices.map((choice) => ({
          ...choice,
          kind: "normal",
        })));
      } else {
        const landOptions = abilities.planet.getLandOptions(context);
        if (landOptions.ok) {
          choices.push(...landOptions.choices.map((choice) => ({
            ...choice,
            kind: "normal",
          })));
        }
      }
    }

    if (plutoCheck.ok) {
      choices.push({
        kind: "pluto",
        label: formatPlutoChoiceLabel(actionType, plutoCheck),
        preferredRocketId,
      });
    }

    if (!choices.length) {
      return {
        ok: false,
        message: normalCheck.message || plutoCheck.message || `当前无法${actionLabel}`,
      };
    }

    return {
      ok: true,
      actionType,
      title: `选择${actionLabel}目标`,
      selectLabel: `${actionLabel}到`,
      confirmText: `确认${actionLabel}`,
      planet: { planetId: `pluto-${actionType}-choice`, name: `${actionLabel}目标` },
      choices,
      needsChoice: choices.length > 1,
      defaultTarget: choices[0].target,
    };
  }

  function openPlutoActionChoicePicker(workingRoot, actionType) {
    requireWorkingRoot(workingRoot);
    const { rocketState } = workingRoot;
    const options = buildPlutoActionChoiceOptions(workingRoot, actionType);
    if (!options.ok) {
      rocketState.statusNote = options.message;
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return { ok: false, message: options.message };
    }
    if (options.choices.length === 1) {
      const [choice] = options.choices;
      return choice.kind === "pluto"
        ? executePlutoAction(workingRoot, actionType, { preferredRocketId: choice.preferredRocketId })
        : runAction(actionType, actionType === "land"
          ? { target: choice.target, rocketId: choice.rocketId }
          : { rocketId: choice.rocketId });
    }
    openLandTargetPicker({
      ...options,
      getOptions: () => buildPlutoActionChoiceOptions(workingRoot, actionType),
      onConfirm: (choice) => (
        choice.kind === "pluto"
          ? executePlutoAction(workingRoot, actionType, { preferredRocketId: choice.preferredRocketId })
          : runAction(actionType, actionType === "land"
            ? { target: choice.target, rocketId: choice.rocketId }
            : { rocketId: choice.rocketId })
      ),
    });
    rocketState.statusNote = `请选择${getPlutoChoiceActionLabel(actionType)}目标`;
    renderStateReadout();
    return { ok: true, pendingChoice: true };
  }

  function getMoveArrowDirectionRotation(angleDegrees, kind) {
    const rad = angleDegrees * (Math.PI / 180);
    let dx;
    let dy;
    if (kind === "out") {
      dx = Math.cos(rad);
      dy = Math.sin(rad);
    } else if (kind === "in") {
      dx = -Math.cos(rad);
      dy = -Math.sin(rad);
    } else if (kind === "cw") {
      dx = -Math.sin(rad);
      dy = Math.cos(rad);
    } else {
      dx = Math.sin(rad);
      dy = -Math.cos(rad);
    }
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  function getRocketPolarAnchor(rocket) {
    const sector = rocketActions.getRocketSectorCoordinate(rocket);
    if (!sector) return null;

    const radius = Number(rocket.radius);
    const angleDegrees = Number(rocket.angleDegrees);
    if (Number.isFinite(radius) && Number.isFinite(angleDegrees)) {
      return { sector, radius, angleDegrees };
    }

    if (Number.isInteger(rocket.slotIndex)) {
      const slot = solar.getSectorLaunchSlot(sector.x, sector.y, rocket.slotIndex);
      return {
        sector,
        radius: slot.radius,
        angleDegrees: slot.angleDegrees,
      };
    }

    const boardPoint = getBoardPointFromPolarPoint(rocket);
    const polar = solar.globalPointToPolarPoint(boardPoint);
    return {
      sector,
      radius: polar.radius,
      angleDegrees: polar.angleDegrees,
    };
  }

  function getMoveArrowOffsets(anchor) {
    const boundary = solar.getSectorCoordinateBoundary(anchor.sector.x, anchor.sector.y);
    const radialSpan = boundary.polarBoundary.outerRadius - boundary.polarBoundary.innerRadius;
    const angleSpan = Math.abs(
      boundary.polarBoundary.endAngleDegrees - boundary.polarBoundary.startAngleDegrees,
    );

    const boardSize = solar.GLOBAL_COORDINATE_SYSTEM.size;
    const wheelPx = Math.max(1, els.wheelWrap?.clientWidth || boardSize);
    const rocketHalfPx = ((tokenWidths.rocket || 41) * 1.2) / 2;
    const arrowHalfPx = 15;
    const clearanceBoard = (rocketHalfPx + arrowHalfPx + 6) * (boardSize / wheelPx);

    const radialOffset = Math.max(30, radialSpan * 0.42) + clearanceBoard * 0.7;
    const tangentialAngle = Math.max(
      11,
      angleSpan * 0.2,
      (Math.atan(clearanceBoard / Math.max(anchor.radius, 1)) * 180) / Math.PI,
    );

    return {
      radius: radialOffset,
      angle: tangentialAngle,
    };
  }

  function buildMoveArrowSpecs(rocket) {
    const anchor = getRocketPolarAnchor(rocket);
    if (!anchor) return [];

    const { sector, radius, angleDegrees } = anchor;
    const offsets = getMoveArrowOffsets(anchor);
    const size = solar.GLOBAL_COORDINATE_SYSTEM.size;
    const specs = [];

    const push = (kind, deltaX, deltaY, pointRadius, pointAngle) => {
      const board = solar.polarToGlobalPoint(pointRadius, pointAngle);
      const labels = {
        out: "向外移动一个扇区",
        in: "向内移动一个扇区",
        cw: "顺时针移动",
        ccw: "逆时针移动",
      };
      specs.push({
        kind,
        deltaX,
        deltaY,
        left: `${(board.x / size) * 100}%`,
        top: `${(board.y / size) * 100}%`,
        rotation: getMoveArrowDirectionRotation(pointAngle, kind),
        ariaLabel: labels[kind],
      });
    };

    if (sector.y < rocketActions.SECTOR_RING_MAX) {
      push("out", 0, 1, radius + offsets.radius, angleDegrees);
    }
    if (sector.y > rocketActions.SECTOR_RING_MIN) {
      push("in", 0, -1, radius - offsets.radius, angleDegrees);
    }
    push("cw", 1, 0, radius, angleDegrees + offsets.angle);
    push("ccw", -1, 0, radius, angleDegrees - offsets.angle);
    return specs;
  }

  function scheduleRenderMoveArrows(workingRoot) {
    requireWorkingRoot(workingRoot);
    if (headless) return;
    moveArrowRenderFrame += 1;
    const frameId = moveArrowRenderFrame;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (frameId !== moveArrowRenderFrame) return;
        renderMoveArrows(workingRoot);
      });
    });
  }

  function renderMoveArrows(workingRoot) {
    requireWorkingRoot(workingRoot);
    if (!els.moveArrowLayer) return;

    if (uiRuntimeState.moveHighlightRocketId == null) {
      moveArrowRenderFrame += 1;
      els.moveArrowLayer.hidden = true;
      els.moveArrowLayer.replaceChildren();
      return;
    }

    const rocket = workingRoot.rocketState.rockets.find((item) => item.id === uiRuntimeState.moveHighlightRocketId);
    if (!rocket || !(rocketActions.isMovablePlayerToken?.(rocket) || rocketActions.isControllablePlayerRocket(rocket))) {
      deactivateMoveMode(workingRoot);
      return;
    }

    const specs = buildMoveArrowSpecs(rocket);
    els.moveArrowLayer.hidden = false;
    els.moveArrowLayer.replaceChildren(...specs.map((spec) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `move-arrow-button move-arrow-${spec.kind}`;
      button.dataset.moveX = String(spec.deltaX);
      button.dataset.moveY = String(spec.deltaY);
      button.style.left = spec.left;
      button.style.top = spec.top;
      button.style.setProperty("--move-arrow-rotation", `${spec.rotation}deg`);
      button.setAttribute("aria-label", spec.ariaLabel);
      button.title = spec.ariaLabel;
      button.innerHTML = '<span class="move-arrow-glyph" aria-hidden="true"></span>';
      return button;
    }));
  }

  function syncMoveModeChrome() {
    els.appWrap?.classList.toggle("move-mode-active", uiRuntimeState.moveHighlightRocketId != null);
    syncInteractionFocusChrome();
    renderRockets();
  }

  function updateMoveRocketHighlight(workingRoot, rocketId) {
    requireWorkingRoot(workingRoot);
    const { rocketState } = workingRoot;
    const previousId = uiRuntimeState.moveHighlightRocketId;
    uiRuntimeState.moveHighlightRocketId = rocketId;

    if (previousId != null && previousId !== rocketId) {
      const previousRocket = rocketState.rockets.find((item) => item.id === previousId);
      if (previousRocket) renderRocketElement(previousRocket);
    }

    if (rocketId != null) {
      const rocket = rocketState.rockets.find((item) => item.id === rocketId);
      if (rocket) renderRocketElement(rocket);
    }

    syncMoveModeChrome();
    scheduleRenderMoveArrows(workingRoot);
  }

  function clearMoveRocketHighlight(workingRoot) {
    updateMoveRocketHighlight(workingRoot, null);
  }

  function activateMoveMode(workingRoot, rocketId) {
    requireWorkingRoot(workingRoot);
    const { rocketState } = workingRoot;
    if (!Number.isInteger(rocketId) || rocketId <= 0) return false;

    const currentPlayer = getCurrentPlayerForRoot(workingRoot);
    const rocketsForPlayer = (rocketState.rockets || []).filter((rocket) => (
      rocket.playerId === currentPlayer?.id
      && (rocketActions.isMovablePlayerToken?.(rocket) || rocketActions.isControllablePlayerRocket(rocket))
    ));
    if (!rocketsForPlayer.some((rocket) => rocket.id === rocketId)) return false;

    const cardMoveContinuation = workingRoot.match?.cardMoveContinuation || null;
    const cardMoveEffect = (decisionState.actionEffectFlow?.effects || [])
      .find((effect) => effect.id === cardMoveContinuation?.effectId) || null;
    const huanyuRocketCheck = validateIndustryHuanyuMoveRocket(cardMoveEffect, rocketId);
    if (!huanyuRocketCheck.ok) {
      rocketState.statusNote = huanyuRocketCheck.message;
      renderStateReadout();
      return false;
    }

    rocketActions.setActiveRocket(rocketState, rocketId);
    updateMoveRocketHighlight(workingRoot, rocketId);
    renderStateReadout();
    return true;
  }

  function deactivateMoveMode(workingRoot) {
    requireWorkingRoot(workingRoot);
    if (isMovePaymentSelectionActive()) {
      cancelMovePaymentSelection();
    }
    clearMoveRocketHighlight(workingRoot);
    renderRockets();
  }

  function closeDataPlacePicker(workingRoot, options = {}) {
    if (els.dataPlaceOverlay) els.dataPlaceOverlay.hidden = true;
    if (!options.keepPending) setPendingDataPlacement(workingRoot, null);
  }

  function shouldPromptDataPlaceChoice(choices) {
    return abilities.data.needsPlacementChoice(choices);
  }

  function getDataPoolCount(player) {
    const dataState = data.ensurePlayerDataState?.(player) || player?.dataState || {};
    return Array.isArray(dataState.poolTokens)
      ? dataState.poolTokens.length
      : Math.max(0, Math.round(Number(player?.resources?.availableData) || 0));
  }

  function isDataPoolFull(player) {
    return getDataPoolCount(player) >= players.RESOURCE_LIMITS.availableData;
  }

  function getAutoDataPlacementCheck(player) {
    if (!isDataPoolFull(player)) return { ok: false, reason: "not_full" };
    const placeCheck = data.canPlaceAnyData?.(player);
    if (!placeCheck?.ok) {
      return {
        ok: false,
        reason: "no_place",
        message: placeCheck?.message || "数据池已满，且没有可用的数据放置位置",
      };
    }
    return { ok: true, choices: placeCheck.choices || data.listPlaceDataChoices(player) };
  }

  function openDataPlacePicker(workingRoot, options = {}) {
    requireWorkingRoot(workingRoot);
    const player = options.player || getCurrentPlayerForRoot(workingRoot);
    const choiceResult = abilities.data.listPlacementChoices(player);
    if (!choiceResult.ok) {
      workingRoot.rocketState.statusNote = choiceResult.message;
      renderStateReadout();
      return;
    }

    const choices = choiceResult.choices;
    const forcePrompt = Boolean(options.forcePrompt);
    if (options.pendingAction) {
      setPendingDataPlacement(workingRoot, {
        ...getPendingOwnerFields(options.pendingAction.effect || null, player),
        ...options.pendingAction,
      });
    } else {
      setPendingDataPlacement(workingRoot, null);
    }
    if (!els.dataPlaceOverlay || !els.dataPlaceActions) {
      return { ok: true, pendingChoice: true, choices };
    }
    if (!forcePrompt && !shouldPromptDataPlaceChoice(choices)) {
      const [choice] = choices;
      confirmDataPlacement(workingRoot, choice.target, choice.blueSlot);
      return;
    }

    if (els.dataPlaceSubtitle) {
      els.dataPlaceSubtitle.textContent = options.subtitle
        || "请选择将数据放入第一排，或放入满足条件的蓝色科技下方。";
    }

    const choiceButtons = choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "data-place-option-button";
      button.dataset.placeTarget = choice.target;
      if (choice.blueSlot != null) {
        button.dataset.blueSlot = String(choice.blueSlot);
      }
      button.innerHTML = `${choice.label}<small>${choice.description}</small>`;
      return button;
    });
    if (options.allowSkip) {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "data-place-option-button";
      skip.dataset.placeSkip = "true";
      skip.innerHTML = `${options.skipLabel || "跳过"}<small>${options.skipDescription || "不获得本次数据"}</small>`;
      choiceButtons.push(skip);
    }

    els.dataPlaceActions.replaceChildren(...choiceButtons);

    els.dataPlaceOverlay.hidden = false;
  }

  function openAutoDataPlacementPrompt(workingRoot, effect, player, options = {}) {
    requireWorkingRoot(workingRoot);
    const check = getAutoDataPlacementCheck(player);
    if (!check.ok) return check;
    const beforePlayerState = structuredClone(player);
    const beforeCardState = structuredClone(workingRoot.cardState);
    const pendingAction = {
      type: "auto_data_place_before_gain",
      effect,
      playerId: player?.id || null,
      playerColor: player?.color || null,
      beforePlayerState,
      beforeCardState,
      messages: [],
      restoreRecorded: false,
      resumeKind: options.resumeKind,
    };
    openDataPlacePicker(workingRoot, {
      player,
      forcePrompt: true,
      allowSkip: true,
      skipLabel: options.skipLabel || "跳过获得数据",
      skipDescription: options.skipDescription || "不放置数据，也不获得这次数据",
      subtitle: options.subtitle
        || "可先放置 1 个数据空出数据池位置，再获得本次数据；也可以跳过本次数据获得。",
      pendingAction,
    });
    workingRoot.rocketState.statusNote = options.statusNote || "数据池已满：请先放置数据，或跳过本次数据获得";
    renderStateReadout();
    return { ok: true, awaitingDataPlacement: true, message: workingRoot.rocketState.statusNote };
  }

  function getPendingDataPlacementPlayer(workingRoot, pending) {
    return getPendingOwnerPlayer(workingRoot, pending, pending?.effect || null);
  }

  function ensurePendingDataPlacementEffectStep(pending, player) {
    if (!pending?.effect) return;
    if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effect.label);
    if (!pending.restoreRecorded) {
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        pending.beforePlayerState,
        "恢复自动放置数据前玩家状态",
      ));
      pending.restoreRecorded = true;
    }
  }

  function applyAutoDataPlacementSlotBonuses(player, placeResult, pending) {
    const bonuses = getPlaceDataSlotBonuses(placeResult);
    const messages = [];
    for (const bonus of bonuses) {
      if (bonus.type === "income") {
        const incomeStart = beginDiscardSelection(1, {
          type: "place_data_income",
          player,
          beforePlayerState: pending.beforePlayerState,
          beforeCardState: pending.beforeCardState,
          effectLabel: pending.effect?.label || "自动放置数据",
          fromEffectFlow: true,
          autoDataPlacement: true,
        });
        if (!incomeStart.ok) {
          messages.push(incomeStart.message);
          continue;
        }
        pending.messages.push(...messages);
        return { ok: true, pendingIncome: true, messages };
      }

      if (bonus.type === "choose_card") {
        const selectionStart = beginCardSelection({
          type: "place_data_choose_card",
          player,
          beforePlayerState: pending.beforePlayerState,
          beforeCardState: pending.beforeCardState,
          fromEffectFlow: true,
          autoDataPlacement: true,
        });
        if (!selectionStart.ok) {
          messages.push(selectionStart.message);
          continue;
        }
        pending.messages.push(...messages);
        return { ok: true, pendingCardSelection: true, messages };
      }

      if (bonus.type === "publicity") {
        players.gainResources(player, { publicity: bonus.publicity });
        messages.push(`获得 ${bonus.publicity} 宣传`);
      } else if (bonus.type === "score") {
        players.gainResources(player, { score: bonus.score });
        addPlayerScoreSource(player, SCORE_SOURCE_KEYS.BLUE_TECH, bonus.score);
        messages.push(`获得 ${bonus.score} 分`);
      } else if (bonus.type === "credits") {
        players.gainResources(player, { credits: bonus.credits });
        messages.push(`获得 ${bonus.credits} 信用点`);
      } else if (bonus.type === "energy") {
        players.gainResources(player, { energy: bonus.energy });
        messages.push(`获得 ${bonus.energy} 能量`);
      }
    }
    return { ok: true, pendingIncome: false, pendingCardSelection: false, messages };
  }

  function continuePendingDataPlacementAfterBonus(workingRoot, message = null) {
    const pending = getPendingDataPlacement(workingRoot);
    if (!pending) return null;
    if (message) pending.messages.push(message);
    setPendingDataPlacement(workingRoot, null);
    return resumeDataPlacementContinuation(workingRoot, pending, {
      skipped: false,
      messages: pending.messages.filter(Boolean),
      restoreRecorded: pending.restoreRecorded,
      beforePlayerState: pending.beforePlayerState,
    });
  }

  function confirmPendingDataPlacement(workingRoot, target, blueSlot) {
    requireWorkingRoot(workingRoot);
    const pending = getPendingDataPlacement(workingRoot);
    const player = getPendingDataPlacementPlayer(workingRoot, pending);
    closeDataPlacePicker(workingRoot, { keepPending: true });
    return withPendingOwnerPlayer(workingRoot, pending, () => {
    ensurePendingDataPlacementEffectStep(pending, player);

    const result = abilities.executeAbility("placeData", createActionContext(workingRoot), {
      target,
      blueSlot,
    });
    if (!result.ok) {
      workingRoot.rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    pending.messages.push(result.message);
    const bonusResult = applyAutoDataPlacementSlotBonuses(player, result, pending);
    if (bonusResult.pendingIncome || bonusResult.pendingCardSelection) {
      workingRoot.rocketState.statusNote = bonusResult.pendingIncome
        ? `${result.message}，请选择 1 张手牌获得收入`
        : `${result.message}，请选择 1 张公共牌`;
      renderPlayerStats();
      renderStateReadout();
      return result;
    }
    pending.messages.push(...(bonusResult.messages || []));
    renderPlayerStats();
    renderInitialSelectionArea();
    return continuePendingDataPlacementAfterBonus(workingRoot);
    });
  }

  function skipPendingDataPlacement(workingRoot) {
    const pending = getPendingDataPlacement(workingRoot);
    if (!pending) {
      closeDataPlacePicker(workingRoot);
      return null;
    }
    closeDataPlacePicker(workingRoot, { keepPending: true });
    setPendingDataPlacement(workingRoot, null);
    return resumeDataPlacementContinuation(workingRoot, pending, {
      skipped: true,
      messages: [],
      restoreRecorded: false,
      beforePlayerState: pending.beforePlayerState,
    });
  }

  function cancelDataPlacePicker(workingRoot) {
    requireWorkingRoot(workingRoot);
    if (getPendingDataPlacement(workingRoot)) return skipPendingDataPlacement(workingRoot);
    closeDataPlacePicker(workingRoot);
    workingRoot.rocketState.statusNote = "已取消放置数据";
    renderStateReadout();
    return { ok: true, canceled: true };
  }

  function confirmDataPlacement(workingRoot, target, blueSlot, execution = {}) {
    requireWorkingRoot(workingRoot);
    if (getPendingDataPlacement(workingRoot)) {
      return confirmPendingDataPlacement(workingRoot, target, blueSlot);
    }
    closeDataPlacePicker(workingRoot);
    const blocked = blockIncompatiblePendingQuickAction("place-data");
    if (blocked) return blocked;
    const actionRocketState = workingRoot.rocketState;
    const player = players.getCurrentPlayer(workingRoot.playerState);
    const result = abilities.executeAbility("placeData", createActionContext(
      workingRoot,
      execution.standardAction,
    ), {
      target,
      blueSlot,
    });
    actionRocketState.statusNote = result.message;
    if (result.ok) {
      const bonusResult = recordPlaceDataActionHistory(workingRoot, player, result);
      if (bonusResult?.message && !bonusResult.pendingIncome) {
        actionRocketState.statusNote = `${result.message}（${bonusResult.message}）`;
      } else if (bonusResult?.pendingIncome) {
        actionRocketState.statusNote = `${result.message}，请选择 1 张手牌获得收入`;
      } else if (bonusResult?.ok === false && bonusResult.message) {
        actionRocketState.statusNote = `${result.message}（${bonusResult.message}）`;
      }
    }
    renderPlayerStats();
    updateActionButtons();
    renderStateReadout();
    return result;
  }

    return {
      activateMoveMode,
      addPlutoMarker,
      buildPlutoMarkerContext,
      buildPlutoMarkerRemovalChoices,
      cancelDataPlacePicker,
      clearMoveRocketHighlight,
      closeDataPlacePicker,
      collectPlutoMarkers,
      confirmDataPlacement,
      continuePendingDataPlacementAfterBonus,
      deactivateMoveMode,
      ensurePlutoCardEffectState,
      executePlutoAction,
      formatPlutoChoiceLabel,
      getAutoDataPlacementCheck,
      getAvailablePlutoAction,
      getCurrentPlanetActionPlacement,
      getPlutoActionCost,
      getPlutoActionState,
      getPlutoCandidateRockets,
      getPlutoChoiceActionLabel,
      getPlutoReservedCards,
      isDataPoolFull,
      openAutoDataPlacementPrompt,
      openDataPlacePicker,
      openPlutoActionChoicePicker,
      playerHasOwnPlutoLanding,
      removePlutoMarker,
      scheduleRenderMoveArrows,
      skipPendingDataPlacement,
    };
  }

  return {
    createActionInteractionRuntime,
  };
});
