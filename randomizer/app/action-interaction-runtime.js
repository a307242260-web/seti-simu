(function (root, factory) {
  "use strict";
  let turnFlow = root.SetiTurnFlow;
  if (!turnFlow && typeof require === "function") turnFlow = require("../game/turn-flow");
  const api = factory(turnFlow);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SetiAppActionInteractionRuntime = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (turnFlow) {
  "use strict";
  const BROWSER_INPUT_NAMES = Object.freeze([
    "getPlutoReservedCards", "removePlutoMarker", "collectPlutoMarkers", "buildPlutoMarkerContext",
    "playerHasOwnPlutoLanding", "buildPlutoMarkerRemovalChoices", "getPlutoCandidateRockets",
    "getPlutoActionCost", "getAvailablePlutoAction", "executePlutoAction", "getCurrentPlanetActionPlacement",
    "openPlutoActionChoicePicker", "scheduleRenderMoveArrows", "clearMoveRocketHighlight", "activateMoveMode",
    "deactivateMoveMode", "openDataPlacePicker", "openAutoDataPlacementPrompt", "cancelDataPlacePicker",
    "confirmDataPlacement",
  ]);

  function createBrowserInputPort(registry, getTarget) {
    if (typeof registry?.registerTarget !== "function") {
      throw new TypeError("action_interaction input port 需要已校验 registry");
    }
    if (typeof getTarget !== "function") throw new TypeError("action_interaction input port 缺少 owner resolver");
    return registry.registerTarget("action_interaction", BROWSER_INPUT_NAMES, getTarget);
  }

  function createInteractionOwnerInputPorts(registry, context = {}) {
    return Object.freeze({
      landTarget: registry.register("land_target", {
        open: (workingRoot, command) => ({
          ok: true,
          value: context.clonePresentation(
            context.openLandTarget(workingRoot, command.options ?? command.args?.[0]),
          ),
        }),
        cancel: (workingRoot) => ({
          ok: true,
          value: context.clonePresentation(context.cancelLandTarget(workingRoot)),
        }),
      }),
      boardQuery: registry.register("board_query", {
        currentPlanet: (workingRoot, command) => ({
          ok: true,
          value: context.getRocketCurrentPlanet(
            workingRoot,
            command.rocketId ?? command.args?.[0],
          ),
        }),
      }),
      dataInteraction: registry.register("data_interaction", {
        placeBlueSlot: (workingRoot, command) => ({
          ok: true,
          value: context.clonePresentation(
            context.placeDataToBlueSlot(workingRoot, command.blueSlot ?? command.args?.[0]),
          ),
        }),
        openComputerPicker: (workingRoot) => ({
          ok: true,
          value: context.clonePresentation(context.openComputerPicker(workingRoot)),
        }),
      }),
      solar: registry.register("solar", {
        rotate: (workingRoot, command) => ({
          ok: true,
          value: context.clonePresentation(
            context.rotateSolarOrbit(workingRoot, command.count ?? command.args?.[0]),
          ),
        }),
      }),
    });
  }



  function createBoardPointerHandlers(context = {}) {
    const required = [
      "getRocketState", "getHighlightedRocketId", "isAiInputLocked", "blockManualInput",
      "isPlanetMarkerRocket", "activateMoveMode", "hasBlockingMoveDecision", "deactivateMoveMode",
      "renderStateReadout",
    ];
    for (const name of required) {
      if (typeof context[name] !== "function") {
        throw new TypeError(`createBoardPointerHandlers requires function: ${name}`);
      }
    }

    function handleRocketPointerDown(event) {
      if (event.button !== 0) return;
      if (context.isAiInputLocked()) {
        event.preventDefault();
        event.stopPropagation();
        context.blockManualInput();
        return;
      }
      const rocketId = Number(event.currentTarget.dataset.rocketId);
      if (!Number.isInteger(rocketId)) return;
      const rocket = (context.getRocketState().rockets || []).find((item) => item.id === rocketId);
      if (!rocket || context.isPlanetMarkerRocket(rocket)) return;
      event.stopPropagation();
      if (context.getHighlightedRocketId() === rocketId) {
        event.preventDefault();
        return;
      }
      if (!context.activateMoveMode(rocketId)) return;
      event.preventDefault();
    }

    function handleBoardPointerDown(event) {
      if (event.button !== 0) return;
      if (context.isAiInputLocked()) {
        event.preventDefault();
        context.blockManualInput();
        return;
      }
      if (event.target.closest(".rocket-token") || event.target.closest(".move-arrow-button")) return;
      if (context.getHighlightedRocketId() == null || context.hasBlockingMoveDecision()) return;
      context.deactivateMoveMode();
      context.renderStateReadout();
    }

    return Object.freeze({ handleRocketPointerDown, handleBoardPointerDown });
  }

  function createLandTargetPicker(context = {}) {
    const { document, els = {} } = context;
    if (typeof context.inputPort?.open !== "function"
      || typeof context.inputPort?.cancel !== "function") {
      throw new TypeError("land target picker requires narrow inputPort");
    }
    if (typeof context.submitChoice !== "function") {
      throw new TypeError("land target picker requires submitChoice()");
    }

    function close(workingRoot = null) {
      if (!els.landTargetOverlay) return;
      els.landTargetOverlay.hidden = true;
      delete els.landTargetOverlay.dataset.planetId;
    }

    function cancel(workingRoot = null) {
      if (!workingRoot?.match) {
        if (context.readPendingDecision?.("land_target")) return context.submitCancel();
        return context.inputPort.cancel();
      }
      const pending = context.readPendingDecision?.("land_target") || null;
      close(workingRoot);
      if (pending?.cancelKind === "chong-travel") {
        workingRoot.rocketState.statusNote = "已取消虫族环绕/登陆目标选择";
        context.renderStateReadout?.();
      }
      return { ok: true, canceled: true };
    }

    function open(workingRoot, options = {}) {
      if (!workingRoot?.match) throw new TypeError("land target requires Composition workingRoot.match");
      const effect = options.effect || null;
      const pending = {
        ...(context.getPendingOwnerFields?.(effect, options.player || null) || {}),
        type: "land_target",
        resumeKind: options.resumeKind || "main-planet-action",
        cancelKind: options.cancelKind || null,
        actionType: options.actionType || null,
        effectId: effect?.id || options.effectId || null,
        choices: structuredClone(options.choices || []),
        title: options.title || null,
        selectLabel: options.selectLabel || null,
        confirmText: options.confirmText || null,
        planet: structuredClone(options.planet || null),
      };
      context.openPendingDecision(workingRoot, "land_target", pending);
      if (!els.landTargetOverlay || !els.landTargetSelect) {
        return { ok: true, pending: true, message: "请选择登陆目标" };
      }
      els.landTargetTitle.textContent = options.title || `选择登陆目标：${options.planet.name}`;
      if (els.landTargetLabel) els.landTargetLabel.textContent = options.selectLabel || "登陆到";
      if (els.landTargetConfirm) els.landTargetConfirm.textContent = options.confirmText || "确认登陆";
      els.landTargetSelect.replaceChildren(...(options.choices || []).map((choice, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = choice.label;
        return option;
      }));
      els.landTargetOverlay.dataset.planetId = options.planet?.planetId || "";
      els.landTargetOverlay.hidden = false;
      els.landTargetSelect.focus();
      return { ok: true, pending: true, message: "请选择登陆目标" };
    }

    function request(options) {
      return context.inputPort.open(structuredClone(options));
    }

    function confirm() {
      return context.submitChoice(Number(els.landTargetSelect?.value));
    }

    return Object.freeze({ close, cancel, open, request, confirm });
  }

  function createMoveUiRuntime(context = {}) {
    const {
      cards,
      els = {},
      moveDiscardActionCode,
      moveEnergyCost = 1,
      players,
      requestAnimationFrame = (callback) => callback(),
      rocketActions,
      solar,
      uiRuntimeState,
    } = context;
    const INTERACTION_FOCUS = Object.freeze({
      PUBLIC_CARDS: "public-cards",
      HAND_CARDS: "hand-cards",
      TECH_PANEL: "tech-panel",
      BOARD_ROCKETS: "board-rockets",
      PLAYER_BOARD: "player-board",
    });

    function isBoardRocketInteractionActive() {
      return uiRuntimeState.moveHighlightRocketId != null
        || Boolean(context.readPendingDecision("industry_free_move"))
        || Boolean(context.getPendingCardTriggerFreeMove())
        || Boolean(context.getPendingCardCornerFreeMove())
        || Boolean(context.getPendingScanFreeMoveDecision())
        || Boolean(context.getPendingCardMoveDecision());
    }

    function getInteractionFocusMode() {
      if (context.isIndustryHandSelectionActive()) return INTERACTION_FOCUS.HAND_CARDS;
      if (context.isDiscardSelectionActive()
        || context.isPlayCardSelectionActive()
        || context.isMovePaymentSelectionActive()
        || context.isHandScanSelectionActive()) {
        return INTERACTION_FOCUS.HAND_CARDS;
      }
      if (context.isCardSelectionActive()) return INTERACTION_FOCUS.PUBLIC_CARDS;
      if (context.isTechTilePickingActive() || context.getActionInteractionProjection().industryBorrowMode) {
        return INTERACTION_FOCUS.TECH_PANEL;
      }
      if (isBoardRocketInteractionActive()) return INTERACTION_FOCUS.BOARD_ROCKETS;
      if ((context.canUseCardCornerQuickAction() && context.getPendingCardCornerQuickAction())
        || context.getPendingHandCardPlayAction()) {
        return INTERACTION_FOCUS.HAND_CARDS;
      }
      return null;
    }

    function canSelectRocketForMoveInteraction(rocket) {
      const player = context.getCurrentPlayer();
      if (rocket.playerId !== player?.id) return false;
      if (!(rocketActions.isMovablePlayerToken?.(rocket) || rocketActions.isControllablePlayerRocket(rocket))) return false;
      if (context.isRocketOnPlanetsReference(rocket)) return false;
      if (context.readPendingDecision("industry_free_move")?.movedRocketIds?.includes(rocket.id)) return false;
      return true;
    }

    function isRocketMoveCandidate(rocket) {
      if (!isBoardRocketInteractionActive()) return false;
      if (uiRuntimeState.moveHighlightRocketId != null) return rocket.id === uiRuntimeState.moveHighlightRocketId;
      return canSelectRocketForMoveInteraction(rocket);
    }

    function isRocketMoveMuted(rocket) {
      return isBoardRocketInteractionActive()
        && !isRocketMoveCandidate(rocket)
        && !context.isRocketOnPlanetsReference(rocket);
    }

    function isMovePaymentCard(card) {
      return Number(card?.discardActionCode) === moveDiscardActionCode
        || Boolean(cards.getDiscardActionMoveRewardForCard?.(card));
    }

    function playerHasMovePaymentCard(player) {
      return (player?.hand || []).some(isMovePaymentCard);
    }

    function getMovePaymentCardCount(player) {
      return (player?.hand || []).filter(isMovePaymentCard).length;
    }

    function getSectorContentForMove(coordinate, workingRoot = null) {
      if (!coordinate) return null;
      if (!workingRoot) throw new TypeError("move legality query requires explicit workingRoot");
      return solar.resolveVisibleContent(coordinate.x, coordinate.y, workingRoot.solarState)?.content || null;
    }

    function isAsteroidContent(content) {
      return content?.kind === solar.layout.CONTENT_KIND.ASTEROID;
    }

    function getRequiredMovePointsForUi(workingRoot, player, rocketId, _deltaX, _deltaY, options = {}) {
      const rocket = workingRoot.rocketState.rockets.find((item) => item.id === rocketId);
      const from = rocketActions.getRocketSectorCoordinate(rocket);
      if (!from) return 1;
      const fromContent = getSectorContentForMove(from, workingRoot);
      if (!options.ignoreAsteroidRestriction
        && isAsteroidContent(fromContent)
        && !players.playerOwnsTech(player, "orange2", workingRoot.turnState)) {
        return 2;
      }
      return 1;
    }

    function canPayForMove(player, requiredMovePoints = moveEnergyCost) {
      const energy = Number(player?.resources?.energy) || 0;
      const movementCards = getMovePaymentCardCount(player);
      return energy + movementCards >= requiredMovePoints
        ? { ok: true }
        : { ok: false, message: `移动力不足，需要 ${requiredMovePoints} 点移动力` };
    }

    function scrollToPlayerCommandPanel() {
      const panel = els.playerCommand || els.actionEffectBar || els.actionLaunchButton;
      if (!panel) return;
      requestAnimationFrame(() => panel.scrollIntoView({
        behavior: "auto",
        block: "start",
        inline: "nearest",
      }));
    }

    return Object.freeze({
      canPayForMove,
      canSelectRocketForMoveInteraction,
      getInteractionFocusMode,
      getMovePaymentCardCount,
      getRequiredMovePointsForUi,
      getSectorContentForMove,
      isAsteroidContent,
      isBoardRocketInteractionActive,
      isMovePaymentCard,
      isRocketMoveCandidate,
      isRocketMoveMuted,
      playerHasMovePaymentCard,
      scrollToPlayerCommandPanel,
    });
  }

  function createPrimaryActionUiRuntime(context = {}) {
    function failWithStatus(message, extra = {}) {
      context.setStatusNote(message);
      context.renderStateReadout();
      return { ok: false, message, ...extra };
    }

    function listActions(family) {
      const actions = context.enumerateActions({ family });
      if (!Array.isArray(actions)) {
        throw new TypeError(`Primary Action inputPort 未返回 ${family} descriptor 数组`);
      }
      return actions;
    }

    function submitMainAction(action) {
      if (!action || action.schemaVersion !== "seti-standard-action-v1") {
        return { ...failWithStatus("行动 descriptor 已失效"), code: "STANDARD_ACTION_NOT_LEGAL" };
      }
      return context.submitAction(action);
    }

    function launchRocketForCurrentPlayer() {
      const [action] = listActions("launch");
      return action
        ? submitMainAction(action)
        : { ...failWithStatus("当前无法发射"), code: "STANDARD_ACTION_NOT_LEGAL" };
    }

    function orbitForCurrentPlayer() {
      if (!context.canStartMainAction()) {
        return failWithStatus(context.getMainActionStartBlockReason() || "本回合已经开始或完成主要行动");
      }
      const descriptors = listActions("orbit");
      const preferredRocketId = descriptors[0]?.target?.rocketId ?? null;
      const pluto = context.getAvailablePlutoAction("orbit", { preferredRocketId });
      if (descriptors.length && pluto.ok) {
        return context.requestLandTargetPicker({
          resumeKind: "main-planet-action",
          actionType: "orbit",
          title: "选择环绕目标",
          selectLabel: "环绕到",
          confirmText: "确认环绕",
          planet: { planetId: "orbit-choice", name: "环绕目标" },
          choices: [
            ...descriptors.map((standardAction) => ({
              kind: "standard-action",
              label: standardAction.summary || "环绕",
              standardAction,
            })),
            { kind: "pluto", label: "环绕冥王星", preferredRocketId },
          ],
        });
      }
      if (!descriptors.length && pluto.ok) {
        return context.executePlutoAction("orbit", { preferredRocketId });
      }
      if (!descriptors.length) {
        context.renderPlayerStats();
        context.updateActionButtons();
        return { ...failWithStatus("当前无法环绕"), code: "STANDARD_ACTION_NOT_LEGAL" };
      }
      if (descriptors.length > 1) {
        context.requestLandTargetPicker({
          resumeKind: "main-planet-action",
          actionType: "orbit",
          title: "选择环绕目标",
          selectLabel: "环绕到",
          confirmText: "确认环绕",
          planet: { planetId: "orbit-choice", name: "环绕目标" },
          choices: descriptors.map((standardAction) => ({
            kind: "standard-action",
            label: standardAction.summary || "环绕",
            standardAction,
          })),
        });
        context.setStatusNote("请选择环绕目标");
        context.renderStateReadout();
        return { ok: true, pendingChoice: true };
      }
      return submitMainAction(descriptors[0]);
    }

    function landForCurrentPlayer() {
      if (!context.canStartMainAction()) {
        return failWithStatus(context.getMainActionStartBlockReason() || "本回合已经开始或完成主要行动");
      }
      const descriptors = listActions("land");
      const preferredRocketId = descriptors[0]?.target?.rocketId ?? null;
      const pluto = context.getAvailablePlutoAction("land", { preferredRocketId });
      if (!descriptors.length) {
        if (pluto.ok) return context.executePlutoAction("land", { preferredRocketId });
        context.renderPlayerStats();
        context.updateActionButtons();
        return { ...failWithStatus("当前无法登陆"), code: "STANDARD_ACTION_NOT_LEGAL" };
      }
      const choices = descriptors.map((standardAction) => ({
        kind: "standard-action",
        label: standardAction.summary || "登陆",
        standardAction,
      }));
      if (pluto.ok) choices.push({ kind: "pluto", label: "登陆冥王星", preferredRocketId });
      if (choices.length > 1) {
        context.requestLandTargetPicker({
          resumeKind: "main-planet-action",
          actionType: "land",
          title: "选择登陆目标",
          selectLabel: "登陆到",
          confirmText: "确认登陆",
          planet: { planetId: "land-choice", name: "登陆目标" },
          choices,
        });
        return { ok: true, pendingChoice: true };
      }
      return submitMainAction(descriptors[0]);
    }

    function moveRocket(deltaX, deltaY, rocketId, options = {}) {
      if (context.isAiInputLocked() && options.automated !== true) {
        return context.blockManualAiInput("电脑玩家自动移动中");
      }
      const selectedRocketId = rocketId
        ?? context.getHighlightedRocketId()
        ?? context.getActionInteractionProjection().activeRocketId;
      if (!selectedRocketId) return failWithStatus("请先点击要移动的火箭", { rocket: null });
      const standardAction = options.standardAction || context.enumerateActions({ family: "move" })
        .find((candidate) => Number(candidate.target?.rocketId) === Number(selectedRocketId)
          && Number(candidate.target?.deltaX) === Number(deltaX)
          && Number(candidate.target?.deltaY) === Number(deltaY)) || null;
      if (!standardAction) {
        return { ...failWithStatus("移动 intent 已失效"), code: "STANDARD_ACTION_NOT_LEGAL" };
      }
      return context.submitQuickAction(standardAction);
    }

    return Object.freeze({
      launchRocketForCurrentPlayer,
      orbitForCurrentPlayer,
      landForCurrentPlayer,
      moveRocket,
      moveActiveRocket: (deltaX, deltaY) => moveRocket(
        deltaX,
        deltaY,
        context.getActionInteractionProjection().activeRocketId,
      ),
    });
  }

  function createSolarRotationRuntime(context = {}) {
    function rotateSolarOrbitForRoot(workingRoot, count) {
      const workingSolarState = workingRoot.solarState;
      const iterations = Math.max(1, Math.round(Number(count || 1)));
      const rotationSettlements = [];
      const anomalyTriggers = [];
      const events = [];
      for (let index = 0; index < iterations; index += 1) {
        const settlement = turnFlow.rotateSolarSystem(
          workingRoot,
          1,
          workingRoot.playerState?.currentPlayerId,
        );
        if (settlement) {
          rotationSettlements.push(settlement);
          events.push(...(settlement.events || []));
        }
        const anomalyResult = context.triggerAnomalyForEarthX(workingRoot, context.getEarthSectorCoordinate().x);
        if (anomalyResult) {
          anomalyTriggers.push(anomalyResult);
          events.push(...(anomalyResult.events || []));
        }
      }
      const lastSettlement = rotationSettlements.at(-1);
      const lastAnomaly = anomalyTriggers.at(-1);
      context.renderWheels();
      context.renderSectorBoard();
      context.renderRotateStateToken();
      context.refreshBoardState({ includeTech: false, includeFinalScore: false, includeRunezuSymbols: true });
      context.refreshPlayerPanels();
      context.refreshAfterPendingChange({
        includeQuickPanel: false, includeEffectBar: false, includeStateReadout: true,
      });
      return {
        ok: true,
        message: lastAnomaly?.message || lastSettlement?.message || "太阳系旋转",
        payload: { rotationSettlements, anomalyTriggers },
        events,
      };
    }
    return Object.freeze({
      rotateSolarOrbitForRoot,
      rotateSolarOrbit: (count) => context.inputPort.rotate(count),
    });
  }

  function createActionInteractionPort(context = {}) {
    const directMethods = [
      "ensurePlutoCardEffectState", "getPlutoActionState", "addPlutoMarker",
      "getPlutoChoiceActionLabel", "formatPlutoChoiceLabel", "isDataPoolFull", "getAutoDataPlacementCheck",
    ];
    const commandFallbacks = {
      getPlutoReservedCards: [],
      collectPlutoMarkers: [],
      buildPlutoMarkerContext: { plutoMarkers: [] },
      playerHasOwnPlutoLanding: false,
      buildPlutoMarkerRemovalChoices: [],
      getPlutoCandidateRockets: [],
      getPlutoActionCost: {},
      getAvailablePlutoAction: { ok: false },
      getCurrentPlanetActionPlacement: { ok: false },
      activateMoveMode: false,
    };
    const commandMethods = [
      "getPlutoReservedCards", "removePlutoMarker", "collectPlutoMarkers", "buildPlutoMarkerContext",
      "playerHasOwnPlutoLanding", "buildPlutoMarkerRemovalChoices", "getPlutoCandidateRockets", "getPlutoActionCost",
      "getAvailablePlutoAction", "executePlutoAction", "getCurrentPlanetActionPlacement",
      "scheduleRenderMoveArrows", "clearMoveRocketHighlight", "activateMoveMode", "deactivateMoveMode",
      "closeDataPlacePicker", "openDataPlacePicker", "openAutoDataPlacementPrompt", "cancelDataPlacePicker",
    ];
    const port = {};
    for (const name of directMethods) {
      port[name] = (...args) => context.getRuntime()?.[name](...args);
    }
    for (const name of commandMethods) {
      port[name] = (...args) => context.dispatchCommand(name, args) ?? commandFallbacks[name];
    }
    port.continuePendingDataPlacementAfterBonus = (...args) => {
      const execution = args[1] || {};
      return execution.workingRoot
        ? context.getRuntime()?.continuePendingDataPlacementAfterBonus(execution.workingRoot, args[0])
        : context.dispatchCommand("continuePendingDataPlacementAfterBonus", args);
    };
    port.skipPendingDataPlacement = () => (context.getPendingDataPlacementDecision()
      ? context.submitActiveDecision("skip-pending-data-placement", () => true)
      : context.dispatchCommand("skipPendingDataPlacement", []));
    port.confirmDataPlacement = (...args) => {
      const execution = args[2] || {};
      if (execution.workingRoot) {
        return context.getRuntime()?.confirmDataPlacement(execution.workingRoot, args[0], args[1], execution);
      }
      if (context.getPendingDataPlacementDecision()) {
        return context.submitActiveDecision(
          "pending-data-placement",
          (target) => target.slotId === args[0]
            && String(target.blueSlot ?? "") === String(args[1] ?? ""),
        );
      }
      return context.dispatchCommand("confirmDataPlacement", [args[0], args[1], execution]);
    };
    return Object.freeze(port);
  }

  function createDataAnalyzeInteractionRuntime(context = {}) {
    function runPlaceDataToComputerForRoot(workingRoot) {
      const blocked = context.blockIncompatiblePendingQuickActionForRoot(workingRoot, "place-data");
      if (blocked) return blocked;
      const blockers = [
        [context.getGameplayLockReason(), null],
        [context.isTechTilePickingActive(), "请先完成科技选择"],
        [context.isCardSelectionActive(), "请先完成精选"],
        [context.isDiscardSelectionActive(), "请先完成弃牌"],
        [context.isPlayCardSelectionActive(), "请先完成打牌"],
        [context.isMovePaymentSelectionActive(), "请先完成移动"],
      ];
      const blocker = blockers.find(([active]) => Boolean(active));
      if (blocker) {
        const message = blocker[1] || blocker[0];
        workingRoot.rocketState.statusNote = message;
        context.renderStateReadout();
        return { ok: false, message };
      }
      context.openDataPlacePicker();
      return { ok: true };
    }

    function runPlaceDataToComputer() {
      return context.dispatchStandardIntent("place_data", { kind: "place-data" });
    }

    function canAnalyzeDataForPlayer(player = context.getCurrentPlayer()) {
      return context.data.canAnalyzeData(player, {
        skipEnergyCost: Boolean(context.industry.canAnalyzeWithoutEnergy?.(player)),
      });
    }

    function getAnalyzeActionOptionsForPlayer(player = context.getCurrentPlayer(), actionOptions = {}) {
      const options = { ...(actionOptions || {}) };
      if (context.industry.canAnalyzeWithoutEnergy?.(player)) options.skipCost = true;
      return options;
    }

    function analyzeDataForCurrentPlayer() {
      return context.dispatchStandardIntent("analyze", { kind: "computer" });
    }

    function startAnalyzeDataRewardFlow(workingRoot) {
      const currentPlayer = context.players.getCurrentPlayer(workingRoot.playerState);
      return context.startCardEffectFlow(
        "analyze-rewards",
        "分析奖励",
        [{
          id: "analyze-blue-alien-trace",
          type: context.planetRewards.EFFECT_TYPES.ALIEN_TRACE,
          label: "分析：获得 1 个蓝色外星人痕迹",
          icon: "alien_blue",
          needsUserChoice: true,
          options: {
            traceType: "blue",
            targetPlayerId: currentPlayer?.id || null,
            targetPlayerColor: currentPlayer?.color || null,
          },
        }],
        {
          workingRoot,
          actionType: "analyze",
          historySource: context.historySourceMain,
          consumesMainAction: true,
        },
      );
    }

    return Object.freeze({
      runPlaceDataToComputerForRoot,
      runPlaceDataToComputer,
      canAnalyzeDataForPlayer,
      getAnalyzeActionOptionsForPlayer,
      analyzeDataForCurrentPlayer,
      startAnalyzeDataRewardFlow,
    });
  }

  function createBoardQueryRuntime(context = {}) {
    function getPlanetSectorCoordinate(planetId) {
      const planet = context.getBoardCoordinateProjection().planetLocations
        .find((item) => item.planetId === planetId);
      if (!planet) throw new Error(`${planetId} position was not found in the current solar snapshot`);
      return { x: planet.x, y: planet.y };
    }

    function getRocketCurrentPlanetIdForRoot(workingRoot, rocketId) {
      const rocket = workingRoot.rocketState.rockets.find((item) => Number(item.id) === Number(rocketId));
      const coordinate = context.rocketActions.getRocketSectorCoordinate(rocket);
      if (!coordinate) return null;
      const snapshot = context.solar.createSolarSnapshot(workingRoot.solarState);
      const planet = snapshot.planetLocations.find((item) => (
        Number(item.x) === Number(coordinate.x) && Number(item.y) === Number(coordinate.y)
      ));
      return planet?.planetId || null;
    }

    function getRocketCurrentPlanetId(rocketId) {
      return context.inputPort.currentPlanet(rocketId);
    }

    return Object.freeze({ getPlanetSectorCoordinate, getRocketCurrentPlanetIdForRoot, getRocketCurrentPlanetId });
  }

  function createDataPlacementDecisionRuntime(context = {}) {
    function resume(workingRoot, pending, outcome) {
      const effect = pending?.effect;
      if (!effect) return { ok: false, message: "放置数据续体缺少效果上下文" };
      if (pending.resumeKind === "gain-data-reward") {
        const executors = context.getEffectExecutors();
        const player = executors.getEffectTargetPlayer(workingRoot, effect);
        return executors.finishGainDataRewardEffect(
          workingRoot,
          effect,
          player,
          Math.max(0, Math.round(effect.options?.count || 0)),
          effect.options?.source || "planet_reward",
          {
            placementMessages: outcome.messages,
            restoreRecorded: outcome.restoreRecorded,
            skipGain: outcome.skipped,
          },
        );
      }
      if (pending.resumeKind === "industry-strategy-passive") {
        return context.getIndustryRuntime().finishIndustryStrategyPassiveRewardEffect(workingRoot, effect, {
          placementMessages: outcome.messages,
          restoreRecorded: outcome.restoreRecorded,
          beforePlayerState: outcome.beforePlayerState,
          skipDataGain: outcome.skipped,
        });
      }
      return { ok: false, message: `未知放置数据续体：${pending.resumeKind || "missing"}` };
    }
    return Object.freeze({ resume });
  }

  function createLandDecisionPort(context = {}) {
    function confirm(choiceIndex = 0) {
      return context.submitActiveDecision(
        "land-target",
        (target) => Number(target.choiceId) === Number(choiceIndex),
      );
    }
    return Object.freeze({ confirm });
  }

  function createLandTargetDecisionRuntime(context = {}) {
    function resume(workingRoot, pending, choice) {
      const actionType = pending.actionType || choice.actionType || (choice.kind === "orbit" ? "orbit" : "land");
      if (pending.resumeKind === "main-planet-action") {
        if (choice.kind === "pluto") {
          return context.executePlutoAction(workingRoot, actionType, {
            preferredRocketId: choice.preferredRocketId,
          });
        }
        if (choice.kind !== "standard-action" || !choice.standardAction) {
          return { ok: false, code: "STANDARD_ACTION_NOT_LEGAL", message: "行动 descriptor 已失效" };
        }
        return context.submitAction(choice.standardAction);
      }
      const effect = context.getCurrentActionEffect(workingRoot);
      if (!effect || (pending.effectId && effect.id !== pending.effectId)) {
        return { ok: false, code: "LAND_TARGET_EFFECT_STALE", message: "登陆目标所属效果已失效" };
      }
      if (pending.resumeKind === "card-pluto-action") {
        if (choice.kind === "pluto") {
          return context.effectExecutors().executePlutoCardActionEffect(workingRoot, effect, actionType, choice.available, {
            preOwnLandingMarker: choice.preOwnLandingMarker,
          });
        }
        if (actionType === "orbit") return context.effectExecutors().executeNormalCardOrbitEffect(workingRoot, effect, choice);
        return context.effectExecutors().executeCardLandTarget(workingRoot, effect, choice.target, {
          preOwnLandingMarker: choice.preOwnLandingMarker,
        });
      }
      if (pending.resumeKind === "chong-travel") {
        return context.effectExecutors().executeChongTravelForPickupChoice(workingRoot, effect, choice);
      }
      return { ok: false, code: "LAND_TARGET_RESUME_UNMIGRATED", message: `未知登陆目标续体：${pending.resumeKind}` };
    }

    function confirmForRoot(workingRoot, choiceIndex = 0, pendingOverride = null) {
      const pending = pendingOverride || context.getPendingLandTargetDecision(workingRoot);
      return context.withPendingOwnerPlayer(pending, () => {
        if (!pending?.choices?.length) {
          context.closeLandTargetPicker(workingRoot);
          context.setBrowserStatusNote("登陆目标已失效");
          context.renderStateReadout();
          return { ok: false, message: "登陆目标已失效" };
        }
        const choice = pending.choices[choiceIndex] || pending.choices[0];
        context.closeLandTargetPicker(workingRoot);
        return resume(workingRoot, pending, choice);
      });
    }

    function cancelForRoot(workingRoot, pendingOverride = null) {
      const pending = pendingOverride || context.getPendingLandTargetDecision(workingRoot);
      context.closeLandTargetPicker(workingRoot);
      if (pending?.cancelKind === "chong-travel") {
        workingRoot.rocketState.statusNote = "已取消虫族环绕/登陆目标选择";
        context.renderStateReadout();
      }
      return { ok: true, progressed: true, skipped: true, canceled: true };
    }

    return Object.freeze({ resume, confirmForRoot, cancelForRoot });
  }

  const BROWSER_ACTION_INTERACTION_STATIC_KEYS = Object.freeze([
    "abilities",
    "actionShared",
    "cardEffects",
    "data",
    "historyCommands",
    "players",
    "rocketActions",
    "solar",
  ]);

  function createBrowserActionInteractionStaticContext(dependencies = {}, constants = {}) {
    const context = {};
    for (const key of BROWSER_ACTION_INTERACTION_STATIC_KEYS) {
      if (dependencies[key] == null) {
        throw new TypeError(`ActionInteraction 静态模块缺少依赖：${key}`);
      }
      context[key] = dependencies[key];
    }
    if (!constants.HISTORY_SOURCE_MAIN || !constants.SCORE_SOURCE_KEYS) {
      throw new TypeError("ActionInteraction 静态模块缺少 HISTORY_SOURCE_MAIN/SCORE_SOURCE_KEYS");
    }
    return Object.freeze({
      ...context,
      HISTORY_SOURCE_MAIN: constants.HISTORY_SOURCE_MAIN,
      SCORE_SOURCE_KEYS: constants.SCORE_SOURCE_KEYS,
    });
  }

  function createBrowserActionInteractionRuntime(options = {}) {
    const {
      staticContext,
      actionGuardRuntime,
      actionPort,
      actionSessionRuntime,
      cardTriggerPort,
      dataPlacementPort,
      effectFlowRuntime,
      effectHistoryPort,
      handFlowRuntime,
      interactionChrome,
      playerEffectOwnerRuntime,
      plutoRewardPort,
      renderRuntime,
      scoreSourceRuntime,
      hostPort,
    } = options;
    const owners = {
      staticContext,
      actionGuardRuntime,
      actionPort,
      actionSessionRuntime,
      cardTriggerPort,
      dataPlacementPort,
      effectFlowRuntime,
      effectHistoryPort,
      handFlowRuntime,
      interactionChrome,
      playerEffectOwnerRuntime,
      plutoRewardPort,
      renderRuntime,
      scoreSourceRuntime,
      hostPort,
    };
    for (const [name, owner] of Object.entries(owners)) {
      if (!owner || typeof owner !== "object") {
        throw new TypeError(`ActionInteraction bootstrap 缺少 owner：${name}`);
      }
    }
    const requireCapability = (ownerName, capability) => {
      const value = owners[ownerName][capability];
      if (typeof value !== "function") {
        throw new TypeError(`ActionInteraction ${ownerName} 缺少能力：${capability}`);
      }
      return value;
    };

    return createActionInteractionRuntime({
      ...staticContext,
      addPlayerScoreSource: requireCapability("scoreSourceRuntime", "addPlayerScoreSource"),
      beginCardSelection: requireCapability("actionPort", "beginCardSelection"),
      beginDiscardSelection: requireCapability("handFlowRuntime", "beginDiscardSelection"),
      beginEffectHistoryStep: requireCapability("effectFlowRuntime", "beginEffectHistoryStep"),
      beginQuickActionStep: requireCapability("effectFlowRuntime", "beginQuickActionStep"),
      blockIncompatiblePendingQuickAction: requireCapability(
        "actionGuardRuntime",
        "blockIncompatiblePendingQuickAction",
      ),
      blockIncompatiblePendingQuickActionForRoot: requireCapability(
        "actionGuardRuntime",
        "blockIncompatiblePendingQuickActionForRoot",
      ),
      buildPlutoChoiceRewardSummary: requireCapability("plutoRewardPort", "buildChoiceRewardSummary"),
      buildPlutoRewardEffectsForAction: requireCapability("plutoRewardPort", "buildRewardEffects"),
      canStartMainAction: requireCapability("actionSessionRuntime", "canStartMainAction"),
      cancelMovePaymentSelection: requireCapability("handFlowRuntime", "cancelMovePaymentSelection"),
      createActionContext: requireCapability("actionPort", "createActionContext"),
      getMainActionStartBlockReason: requireCapability(
        "actionSessionRuntime",
        "getMainActionStartBlockReason",
      ),
      getPendingOwnerFields: requireCapability("playerEffectOwnerRuntime", "getPendingOwnerFields"),
      getPendingOwnerPlayer: requireCapability("playerEffectOwnerRuntime", "getPendingOwnerPlayer"),
      hasActiveCardTriggerResolution: requireCapability(
        "cardTriggerPort",
        "hasActiveCardTriggerResolution",
      ),
      isActionEffectFlowActive: requireCapability("actionGuardRuntime", "isActionEffectFlowActive"),
      isMovePaymentSelectionActive: requireCapability(
        "handFlowRuntime",
        "isMovePaymentSelectionActive",
      ),
      recordAtomicActionHistory: requireCapability("effectHistoryPort", "recordAtomicActionHistory"),
      recordAbilityCommands: requireCapability("effectHistoryPort", "recordAbilityCommands"),
      recordHistoryCommand: requireCapability("effectFlowRuntime", "recordHistoryCommand"),
      recordQuickHistoryCommand: requireCapability("effectFlowRuntime", "recordQuickHistoryCommand"),
      renderInitialSelectionArea: requireCapability("renderRuntime", "renderInitialSelectionArea"),
      renderPlayerStats: requireCapability("renderRuntime", "renderPlayerStats"),
      renderReservedCards: requireCapability("renderRuntime", "renderReservedCards"),
      renderRocketElement: requireCapability("renderRuntime", "renderRocketElement"),
      renderRockets: requireCapability("renderRuntime", "renderRockets"),
      renderStateReadout: requireCapability("renderRuntime", "renderStateReadout"),
      resumeDataPlacementDecision: requireCapability("dataPlacementPort", "resume"),
      runAction: requireCapability("actionPort", "runAction"),
      settleCardTasksAfterEffect: requireCapability("cardTriggerPort", "settleCardTasksAfterEffect"),
      startCardEffectFlow: requireCapability("effectFlowRuntime", "startCardEffectFlow"),
      syncInteractionFocusChrome: requireCapability("interactionChrome", "syncInteractionFocusChrome"),
      validateIndustryHuanyuMoveRocket: requireCapability(
        "actionPort",
        "validateIndustryHuanyuMoveRocket",
      ),
      withPendingOwnerPlayer: requireCapability("playerEffectOwnerRuntime", "withPendingOwnerPlayer"),
      completeQuickActionStep: requireCapability("effectFlowRuntime", "completeQuickActionStep"),
      ...hostPort,
    });
  }

  function createActionInteractionRuntime(context) {
    const {
      HISTORY_SOURCE_MAIN,
      SCORE_SOURCE_KEYS,
      abilities,
      actionShared,
      addPlayerScoreSource,
      beginCardSelection,
      beginDiscardSelection,
      beginEffectHistoryStep,
      beginQuickActionStep,
      blockIncompatiblePendingQuickAction,
      blockIncompatiblePendingQuickActionForRoot,
      buildPlutoChoiceRewardSummary,
      buildPlutoRewardEffectsForAction,
      canStartMainAction,
      cancelMovePaymentSelection,
      cardEffects,
      createActionContext,
      data,
      els,
      getBoardPointFromPolarPoint,
      getMainActionStartBlockReason,
      getPendingOwnerFields,
      getPendingOwnerPlayer,
      hasActiveCardTriggerResolution,
      historyCommands,
      isActionEffectFlowActive,
      isMovePaymentSelectionActive,
      markerBelongsToPlayer,
      markerOwnerLabel,
      openLandTargetPicker,
      openPendingDecision,
      players,
      quickActionHistory,
      readCardSelectionDecision,
      readPendingDecision,
      recordAtomicActionHistory,
      recordAbilityCommands,
      recordHistoryCommand,
      recordQuickHistoryCommand,
      removeRocketElement,
      renderInitialSelectionArea,
      renderPlayerStats,
      renderReservedCards,
      renderRocketElement,
      renderRockets,
      renderStateReadout,
      resumeDataPlacementDecision,
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
      withPendingOwnerPlayer,
      completeQuickActionStep,
    } = context;
    const getActionEffectFlow = (workingRoot) => requireWorkingRoot(workingRoot).match?.actionEffectFlow || null;
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

    function getPendingDataPlacement(workingRoot, pendingOverride = null) {
      requireWorkingRoot(workingRoot);
      return pendingOverride
        || readPendingDecision?.("data_placement")
        || readCardSelectionDecision?.()?.dataPlacementDecision
        || readPendingDecision?.("discard")?.dataPlacementDecision
        || null;
    }

    function setPendingDataPlacement(workingRoot, pending) {
      requireWorkingRoot(workingRoot);
      if (pending) openPendingDecision(workingRoot, "data_placement", pending);
      return pending || null;
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

  function collectPlutoMarkersFromPlayerProjection(playerProjection) {
    const markers = [];
    for (const player of playerProjection?.players || []) {
      for (const card of player?.reservedCards || []) {
        if (!cardEffects.getCardModel?.(card)?.pluto) continue;
        const pluto = card?.cardEffectState?.pluto || {};
        for (const marker of pluto.orbitMarkers || []) {
          markers.push({
            ...structuredClone(marker),
            kind: "orbit",
            planetId: "pluto",
            cardId: card.id,
            playerId: marker.playerId || player.id,
            playerColor: marker.playerColor || player.color,
            color: marker.color || player.color,
          });
        }
        for (const marker of pluto.landingMarkers || []) {
          markers.push({
            ...structuredClone(marker),
            kind: "land",
            planetId: "pluto",
            cardId: card.id,
            playerId: marker.playerId || player.id,
            playerColor: marker.playerColor || player.color,
            color: marker.color || player.color,
          });
        }
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

    const pendingCardMove = context.getPendingCardMoveDecision?.() || null;
    const cardMoveEffect = (getActionEffectFlow(workingRoot)?.effects || [])
      .find((effect) => effect.id === pendingCardMove?.effectId) || null;
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
    if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(workingRoot, pending.effect.label);
    if (!pending.restoreRecorded) {
      recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
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
        const incomeStart = beginDiscardSelection(workingRoot, 1, {
          type: "place_data_income",
          player,
          beforePlayerState: pending.beforePlayerState,
          beforeCardState: pending.beforeCardState,
          effectLabel: pending.effect?.label || "自动放置数据",
          fromEffectFlow: true,
          autoDataPlacement: true,
          dataPlacementDecision: structuredClone(pending),
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
          dataPlacementDecision: structuredClone(pending),
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

  function continuePendingDataPlacementAfterBonus(workingRoot, message = null, pendingOverride = null) {
    const pending = getPendingDataPlacement(workingRoot, pendingOverride);
    if (!pending) return null;
    if (message) pending.messages.push(message);
    return resumeDataPlacementDecision(workingRoot, pending, {
      skipped: false,
      messages: pending.messages.filter(Boolean),
      restoreRecorded: pending.restoreRecorded,
      beforePlayerState: pending.beforePlayerState,
    });
  }

  function confirmPendingDataPlacement(workingRoot, target, blueSlot, pendingOverride = null) {
    requireWorkingRoot(workingRoot);
    const pending = getPendingDataPlacement(workingRoot, pendingOverride);
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
    return continuePendingDataPlacementAfterBonus(workingRoot, null, pending);
    });
  }

  function getPlaceDataSlotBonuses(placeResult) {
    if (placeResult?.slotBonuses?.length) return placeResult.slotBonuses;
    return placeResult?.slotBonus ? [placeResult.slotBonus] : [];
  }

  function applyAutomaticPlaceDataBonus(player, bonus) {
    const beforePlayer = structuredClone(player);
    const resourceKey = bonus.type === "publicity"
      ? "publicity"
      : bonus.type === "score"
        ? "score"
        : bonus.type === "credits"
          ? "credits"
          : bonus.type === "energy"
            ? "energy"
            : null;
    if (!resourceKey) return { ok: true, message: null };

    const amount = bonus[resourceKey];
    players.gainResources(player, { [resourceKey]: amount });
    if (resourceKey === "score") {
      addPlayerScoreSource(player, SCORE_SOURCE_KEYS.BLUE_TECH, amount);
    }
    const labels = {
      publicity: "宣传",
      score: "分",
      credits: "信用点",
      energy: "能量",
    };
    recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      `恢复放置数据${labels[resourceKey]}奖励`,
    ));
    return { ok: true, message: `获得 ${amount} ${labels[resourceKey]}` };
  }

  function applyPendingPlaceDataBonus(workingRoot, player, bonus) {
    if (bonus.type === "income") {
      const incomeStart = beginDiscardSelection(1, {
        type: "place_data_income",
        player,
        beforePlayerState: structuredClone(player),
        beforeCardState: structuredClone(workingRoot.cardState),
        effectLabel: "放置数据：收入奖励",
      });
      if (!incomeStart.ok) {
        completeQuickActionStep();
        return { ok: false, pendingIncome: false, message: incomeStart.message };
      }
      return { ok: true, pendingIncome: true };
    }

    if (bonus.type === "choose_card") {
      const selectionStart = beginCardSelection({
        type: "place_data_choose_card",
        player,
        beforePlayerState: structuredClone(player),
        beforeCardState: structuredClone(workingRoot.cardState),
      });
      if (!selectionStart.ok) {
        completeQuickActionStep();
        return { ok: false, pendingIncome: false, message: selectionStart.message };
      }
      return { ok: true, pendingIncome: false, pendingCardSelection: true };
    }

    return { ok: true, pendingIncome: false };
  }

  function applyPlaceDataSlotBonus(workingRoot, player, placeResult) {
    const bonuses = getPlaceDataSlotBonuses(placeResult);
    if (!bonuses.length) {
      completeQuickActionStep();
      return { ok: true, pendingIncome: false };
    }

    const autoMessages = [];
    for (const bonus of bonuses) {
      if (bonus.type === "income" || bonus.type === "choose_card") {
        const pendingResult = applyPendingPlaceDataBonus(workingRoot, player, bonus);
        if (pendingResult.message && !pendingResult.pendingIncome && !pendingResult.pendingCardSelection) {
          return pendingResult;
        }
        if (pendingResult.pendingIncome || pendingResult.pendingCardSelection) return pendingResult;
        continue;
      }
      const autoResult = applyAutomaticPlaceDataBonus(player, bonus);
      if (autoResult.message) autoMessages.push(autoResult.message);
    }

    completeQuickActionStep();
    return {
      ok: true,
      pendingIncome: false,
      message: autoMessages.length ? autoMessages.join("；") : null,
    };
  }

  function recordPlaceDataActionHistory(workingRoot, player, placeResult) {
    beginQuickActionStep("place-data", "放置数据");
    recordAbilityCommands(placeResult, quickActionHistory, workingRoot);
    return applyPlaceDataSlotBonus(workingRoot, player, placeResult);
  }

  function skipPendingDataPlacement(workingRoot, pendingOverride = null) {
    const pending = getPendingDataPlacement(workingRoot, pendingOverride);
    if (!pending) {
      closeDataPlacePicker(workingRoot);
      return null;
    }
    closeDataPlacePicker(workingRoot, { keepPending: true });
    return resumeDataPlacementDecision(workingRoot, pending, {
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
    if (execution.pending || getPendingDataPlacement(workingRoot)) {
      return confirmPendingDataPlacement(workingRoot, target, blueSlot, execution.pending);
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

  function placeDataToBlueSlot(workingRoot, blueSlot) {
    requireWorkingRoot(workingRoot);
    const blocked = blockIncompatiblePendingQuickActionForRoot(workingRoot, "place-data");
    if (blocked) return blocked;

    const player = players.getCurrentPlayer(workingRoot.playerState);
    if (!data.listPoolTokens(player).length) {
      workingRoot.rocketState.statusNote = "数据池没有可放置的数据";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }
    const check = data.canPlaceDataToBlueBonus(player, blueSlot);
    if (!check.ok) {
      workingRoot.rocketState.statusNote = check.message;
      renderStateReadout();
      return check;
    }
    return confirmDataPlacement(workingRoot, data.PLACEMENT_KIND_BLUE_BONUS, blueSlot);
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
      collectPlutoMarkersFromPlayerProjection,
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
      placeDataToBlueSlot,
      playerHasOwnPlutoLanding,
      removePlutoMarker,
      scheduleRenderMoveArrows,
      skipPendingDataPlacement,
    };
  }

  return {
    BROWSER_INPUT_NAMES,
    createBrowserInputPort,
    createInteractionOwnerInputPorts,
    createBoardPointerHandlers,
    createLandTargetPicker,
    createMoveUiRuntime,
    createPrimaryActionUiRuntime,
    createSolarRotationRuntime,
    createActionInteractionPort,
    createDataAnalyzeInteractionRuntime,
    createBoardQueryRuntime,
    createDataPlacementDecisionRuntime,
    createLandDecisionPort,
    createLandTargetDecisionRuntime,
    BROWSER_ACTION_INTERACTION_STATIC_KEYS,
    createBrowserActionInteractionStaticContext,
    createBrowserActionInteractionRuntime,
    createActionInteractionRuntime,
  };
});
