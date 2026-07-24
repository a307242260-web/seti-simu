(function (root, factory) {
  "use strict";
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppActionRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";
  function createActionOwnerInputPorts(registry, context = {}) {
    return Object.freeze({
      probeQuery: registry.register("probe_query", {
        getRequiredMovePoints: (workingRoot, command) => ({
          ok: true,
          value: context.getRequiredMovePoints(workingRoot, ...(command.args || [])),
        }),
      }),
      recovery: registry.register("action_recovery", {
        recoverPending: (workingRoot) => ({
          ok: true,
          value: context.clonePresentation(context.recoverPending(workingRoot)),
        }),
      }),
    });
  }
  function createCompositionActionRegistry(context = {}) {
    function getController() {
      return context.getController?.() || null;
    }
    function enumerate(workingState, request = {}) {
      return getController()?.dispatchAction(
        { kind: "standard_enumerate", payload: request },
        null,
        context.createActionContext(workingState),
      )?.candidates || [];
    }
    function validate(workingState, action) {
      return getController()?.dispatchAction(
        { kind: "standard_validate", standardAction: action },
        null,
        context.createActionContext(workingState, action),
      ) || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE" };
    }
    function execute(workingState, action) {
      return getController()?.executeStandardDescriptor(
        context.createActionContext(workingState, action),
        action,
      ) || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE" };
    }
    return Object.freeze({ enumerate, validate, execute });
  }

  function createActionRuntimePort(context = {}) {
    function handleActionEffectButtonClickForRoot(workingRoot, effectIndex) {
      return context.getController().handleActionEffectButtonClick(workingRoot, effectIndex);
    }
    function beginScanAction() {
      return context.getController()?.dispatchAction({
        kind: "standard_intent",
        family: "scan",
        selector: { kind: "standard-scan" },
      }) || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE", message: "Standard Action runtime 尚未装配" };
    }
    return Object.freeze({ handleActionEffectButtonClickForRoot, beginScanAction });
  }

  function createActionContextFactory(context = {}) {
    function createActionContext(workingRoot, descriptor = null) {
      if (!workingRoot?.playerState || !workingRoot?.turnState || !workingRoot?.match) {
        throw new TypeError("Action context 缺少 Composition workingRoot");
      }
      const actorId = descriptor?.actorId || workingRoot.playerState.currentPlayerId;
      const actionPlayerState = actorId === workingRoot.playerState.currentPlayerId
        ? workingRoot.playerState
        : { ...workingRoot.playerState, currentPlayerId: actorId, players: workingRoot.playerState.players };
      return {
        workingRoot,
        solarState: workingRoot.solarState,
        playerState: actionPlayerState,
        cardState: workingRoot.cardState,
        rocketState: workingRoot.rocketState,
        nebulaDataState: workingRoot.nebulaDataState,
        planetStatsState: workingRoot.planetStatsState,
        alienGameState: workingRoot.alienGameState,
        finalScoringState: workingRoot.finalScoringState,
        techBoardState: workingRoot.techGameState.board,
        techUiState: workingRoot.techGameState.ui,
        techGameState: workingRoot.techGameState,
        turnState: workingRoot.turnState,
        metaState: workingRoot.meta,
        matchState: workingRoot.match,
        stateVersion: workingRoot.meta?.stateVersion ?? 0,
        decisionVersion: workingRoot.match?.decisionVersion ?? 0,
        standardActionAuthority: {
          actorId,
          stateVersion: workingRoot.meta?.stateVersion ?? 0,
          decisionVersion: workingRoot.match?.decisionVersion ?? 0,
        },
        ...(context.buildPlutoMarkerContext(workingRoot) || { plutoMarkers: [] }),
        roundNumber: workingRoot.turnState.roundNumber,
        turnNumber: workingRoot.turnState.turnNumber,
        getPlayerTokenSrc: context.getNormalTokenAssetForPlayer,
        getEarthSectorCoordinate: context.getEarthSectorCoordinate,
        getPlanetLocations: () => context.solar.createSolarSnapshot(workingRoot.solarState).planetLocations,
        rotateSolarOrbit: (count) => context.rotateSolarOrbit(workingRoot, count),
        drawBasicCardToPlayer: (player) => context.drawBasicCardToPlayer(workingRoot, player),
        drawBasicCard: () => context.drawBasicCard(workingRoot),
        blindDrawCard: (player) => context.blindDrawCard(workingRoot, player),
        launchRocketAtEarth: (player) => context.rocketActions.launchRocketAtSector(
          workingRoot.rocketState,
          context.getEarthSectorCoordinate(),
          { playerId: player.id, color: player.color },
        ),
        replenishPublicSlot: (slotIndex) => context.cards.replenishPublicSlot(
          workingRoot.cardState,
          workingRoot.playerState,
          slotIndex,
        ),
        beginCardSelection: (pendingAction) => context.beginCardSelection(workingRoot, pendingAction),
        beginDiscardSelection: (count, pendingAction) => context.beginDiscardSelection(workingRoot, count, pendingAction),
        beginIncome: (options) => context.beginIncome(workingRoot, options),
        getPlayerCompanyBaseIncome: context.getPlayerCompanyBaseIncome,
        ensurePlayerTechState: (player) => {
          if (!player.techState) player.techState = context.players.normalizePlayerTechState(null);
        },
      };
    }

    return Object.freeze({
      createActionContext,
    });
  }

  function createActionRuntime(context = {}) {
    const {
      ACTION_LOG_DEFAULT_LABELS = {},
      getCurrentPlayer,
      getPlayerById,
      getPlayerLabelById,
      ensurePublicCardsFilledRespectingDelayedRefills,
      renderReservedCards,
      renderPublicCards,
      renderDebugPlayerSwitch,
      renderPlayerStats,
      renderPlayerHand,
      renderTechBoard,
      renderSectorNebulaDataBoard,
      syncPlanetOrbitLandMarkers,
      renderRockets,
      syncInteractionFocusChrome,
      updateActionButtons,
      renderStateReadout,
      schedulePersistentGameStateSave,
      actionLogState,
      renderActionLog,
      canStartMainAction,
      getMainActionStartBlockReason,
      getAnalyzeActionOptionsForPlayer,
      createActionLogImpactSnapshot,
      abilities,
      createActionContext,
      actions,
      removeRocketElement,
      syncPlanetOrbitLandMarkersAfterAction = syncPlanetOrbitLandMarkers,
      renderAlienPanels,
      startPlanetRewardEffectFlow,
      startLaunchSectorFinishEffectFlow,
      settleCardTasksAfterEffect,
      maybeAutoExecuteAomomoRewardEffects,
      startResearchTechEffectFlow,
      syncTechSelectionChrome,
      finalizeTechTakeResult,
      renderRocketElement,
      recordAtomicActionHistory,
      startAnalyzeDataRewardFlow,
      executeActionEffect,
      getCurrentActionEffect,
      maybeApplyIndustryLaunchScan,
      maybeConsumeAlienLabPanelForMainAction,
      markActionPending,
      beginScanAction,
      beginPlayCardSelection,
      researchTechForCurrentPlayer,
      orbitForCurrentPlayer,
      landForCurrentPlayer,
      moveRocket,
      analyzeDataForCurrentPlayer,
      blockManualAiPendingInputIfNeeded,
      getCurrentActionEffectIndex,
      confirmDataPlacement,
      standardActionAdapter,
    } = context;
    const getActionEffectFlow = (workingRoot) => requireWorkingRoot(workingRoot).match?.actionEffectFlow || null;

    function getExecutionWorkingRoot(standardContext) {
      const required = [
        "solarState", "playerState", "cardState", "rocketState", "nebulaDataState",
        "planetStatsState", "alienGameState", "finalScoringState", "techGameState", "turnState", "metaState", "matchState",
      ];
      const missing = required.filter((key) => !standardContext?.[key]);
      if (missing.length) {
        throw new TypeError(`Standard Action context 缺少 working root slices: ${missing.join(", ")}`);
      }
      return {
        solarState: standardContext.solarState,
        playerState: standardContext.playerState,
        cardState: standardContext.cardState,
        rocketState: standardContext.rocketState,
        nebulaDataState: standardContext.nebulaDataState,
        planetStatsState: standardContext.planetStatsState,
        alienGameState: standardContext.alienGameState,
        finalScoringState: standardContext.finalScoringState,
        techGameState: standardContext.techGameState,
        turnState: standardContext.turnState,
        meta: standardContext.metaState,
        match: standardContext.matchState,
      };
    }

    function executeStandardDescriptor(standardContext, descriptor, executionOptions = null) {
      return standardActionAdapter.execute(standardContext, descriptor);
    }

    function runAction(actionId, actionOptions) {
      const requestedWorkingRoot = actionOptions?.workingRoot || null;
      const requestedActionContext = requestedWorkingRoot
        ? createActionContext(requestedWorkingRoot, actionOptions?.standardAction || null)
        : createActionContext();
      const actionWorkingRoot = requestedWorkingRoot || getExecutionWorkingRoot(requestedActionContext);
      if (!canStartMainAction?.()) {
        actionWorkingRoot.rocketState.statusNote = getMainActionStartBlockReason?.() || "本回合已经开始或完成主要行动";
        renderStateReadout?.();
        return { ok: false, message: actionWorkingRoot.rocketState.statusNote };
      }

      const abilityByAction = {
        ...(actions?.createStandardAdapter ? {} : {
          launch: "launchProbe",
          orbit: "orbitProbe",
          land: "landProbe",
        }),
        analyze: "analyzeData",
      };
      const abilityId = abilityByAction[actionId];
      const workingRoot = requestedWorkingRoot;
      const standardDescriptor = actionOptions?.standardAction || null;
      const cleanActionOptions = actionOptions && (workingRoot || standardDescriptor)
        ? Object.fromEntries(Object.entries(actionOptions)
          .filter(([key]) => key !== "workingRoot" && key !== "standardAction"))
        : actionOptions;
      const resolvedActionOptions = actionId === "analyze"
        ? getAnalyzeActionOptionsForPlayer?.(
          workingRoot
            ? (workingRoot.playerState.players || [])
              .find((player) => player.id === workingRoot.playerState.currentPlayerId)
            : getCurrentPlayer?.(),
          cleanActionOptions,
        )
        : cleanActionOptions;
      const actionContext = requestedActionContext;
      const actionLogBefore = createActionLogImpactSnapshot?.();
      const result = abilityId
        ? abilities.executeAbility(abilityId, actionContext, resolvedActionOptions)
        : actionId === "researchTech"
          ? abilities.executeAbility("researchTechPrepare", actionContext, resolvedActionOptions)
          : actions.execute(actionId, actionContext, resolvedActionOptions);

      let startedRewardFlow = false;

      if (result.ok && result.markerKind) {
        if (result.removedRocketId != null) removeRocketElement?.(result.removedRocketId);
        syncPlanetOrbitLandMarkersAfterAction?.();
        renderAlienPanels?.();
        if (actionId === "orbit" || actionId === "land") {
          startedRewardFlow = startPlanetRewardEffectFlow?.(actionWorkingRoot, actionId, result);
          if (startedRewardFlow) {
            settleCardTasksAfterEffect?.({ events: result.events, render: false });
            maybeAutoExecuteAomomoRewardEffects?.();
          }
        }
      } else if (actionId === "researchTech") {
        if (result.awaitingTileSelection) {
          actionWorkingRoot.rocketState.statusNote = result.message;
          startResearchTechEffectFlow?.(actionWorkingRoot, result, { logBefore: actionLogBefore });
          syncTechSelectionChrome?.();
          renderTechBoard?.();
          updateActionButtons?.();
        } else if (result.tileId) {
          actionWorkingRoot.rocketState.statusNote = result.message;
          finalizeTechTakeResult?.(result);
          return result;
        } else if (!result.ok) {
          actionWorkingRoot.rocketState.statusNote = result.message;
        }
      } else {
        if (result.rocket) renderRocketElement?.(result.rocket);
        if (result.removedRocketId != null) removeRocketElement?.(result.removedRocketId);
      }

      if (result.ok && actionId === "analyze") {
        recordAtomicActionHistory?.(actionId, ACTION_LOG_DEFAULT_LABELS.analyze, result, {
          logBefore: actionLogBefore,
          workingRoot: actionWorkingRoot,
        });
        startedRewardFlow = startAnalyzeDataRewardFlow?.(
          workingRoot || getExecutionWorkingRoot(actionContext),
        );
        if (startedRewardFlow) {
          executeActionEffect?.(actionWorkingRoot, getCurrentActionEffect?.());
        }
        settleCardTasksAfterEffect?.({ events: result.events, render: false });
        renderPlayerStats?.();
        updateActionButtons?.();
        renderStateReadout?.();
        return result;
      }

      if (result.ok && !result.awaitingTileSelection && !startedRewardFlow) {
        if (actionId === "launch") {
          maybeApplyIndustryLaunchScan?.(result);
          maybeConsumeAlienLabPanelForMainAction?.("launch", result);
          actionWorkingRoot.rocketState.statusNote = result.message;
          startedRewardFlow = startLaunchSectorFinishEffectFlow?.(result) || false;
        }
        if (startedRewardFlow) {
          settleCardTasksAfterEffect?.({ events: result.events, render: false });
        } else {
          if ((abilityId || result.commands?.length) && result.undoable !== false) {
            recordAtomicActionHistory?.(actionId, result.message || actionId, result, {
              logBefore: actionLogBefore,
              workingRoot: actionWorkingRoot,
            });
          } else {
            markActionPending?.();
          }
          settleCardTasksAfterEffect?.({ events: result.events, render: false });
        }
      }

      renderPlayerStats?.();
      updateActionButtons?.();
      renderStateReadout?.();
      return result;
    }

    function handleActionEffectButtonClick(workingRoot, effectIndex) {
      if (!getActionEffectFlow(workingRoot)) return;
      if (Number(effectIndex) !== getCurrentActionEffectIndex?.()) return;

      const effect = getCurrentActionEffect?.();
      const blocked = blockManualAiPendingInputIfNeeded?.(null, {}, "效果结算", effect);
      if (blocked) return blocked;
      return executeActionEffect?.(workingRoot, effect);
    }

    function dispatchAction(request, fallbackOptions, explicitActionContext = null) {
      const action = typeof request === "string"
        ? { kind: request, payload: fallbackOptions || null }
        : { ...(request || {}) };
      if (action.kind === "standard_enumerate") {
        if (!standardActionAdapter) {
          return { ok: false, code: "STANDARD_ACTION_ADAPTER_UNAVAILABLE", candidates: [] };
        }
        const standardContext = explicitActionContext || createActionContext();
        if (action.payload?.actorId) {
          standardContext.standardActionAuthority = {
            actorId: action.payload.actorId,
            stateVersion: action.payload.stateVersion ?? 0,
            decisionVersion: action.payload.decisionVersion ?? 0,
          };
        }
        return {
          ok: true,
          candidates: standardActionAdapter.enumerate(
            standardContext,
            action.payload || {},
          ),
        };
      }
      if (action.kind === "standard_resolve") {
        if (!standardActionAdapter) {
          return { ok: false, code: "STANDARD_ACTION_ADAPTER_UNAVAILABLE" };
        }
        return standardActionAdapter.resolveIntent(
          explicitActionContext || createActionContext(),
          action.family,
          action.selector || {},
          action.payload || {},
        );
      }
      if (action.kind === "standard_validate") {
        if (!standardActionAdapter) {
          return { ok: false, code: "STANDARD_ACTION_ADAPTER_UNAVAILABLE" };
        }
        const descriptor = action.standardAction || action.action;
        const standardContext = explicitActionContext || createActionContext();
        standardContext.standardActionAuthority = {
          actorId: descriptor?.actorId,
          stateVersion: descriptor?.stateVersion,
          decisionVersion: descriptor?.decisionVersion,
        };
        return standardActionAdapter.validate(
          standardContext,
          descriptor,
        );
      }
      if (action.kind === "standard_intent") {
        if (!standardActionAdapter) {
          return { ok: false, code: "STANDARD_ACTION_ADAPTER_UNAVAILABLE" };
        }
        const standardContext = explicitActionContext || createActionContext();
        const resolved = standardActionAdapter.resolveIntent(
          standardContext,
          action.family,
          action.selector || {},
          action.payload || {},
        );
        return resolved.ok
          ? executeStandardDescriptor(standardContext, resolved.action)
          : resolved;
      }
      const standardDescriptor = action.standardAction
        || (action.schemaVersion === "seti-standard-action-v1" ? action : null);
      if (standardDescriptor) {
        if (!standardActionAdapter) {
          return { ok: false, code: "STANDARD_ACTION_ADAPTER_UNAVAILABLE" };
        }
        const standardContext = explicitActionContext || createActionContext();
        standardContext.standardActionAuthority = {
          actorId: standardDescriptor.actorId,
          stateVersion: standardDescriptor.stateVersion,
          decisionVersion: standardDescriptor.decisionVersion,
        };
        return executeStandardDescriptor(standardContext, standardDescriptor);
      }
      const kind = action.kind || action.id || null;
      switch (kind) {
        case "effect_step":
          return handleActionEffectButtonClick(explicitActionContext, action.effectIndex);
        default:
          return { ok: false, message: `未知 action kind: ${kind}` };
      }
    }

    return {
      runAction,
      executeStandardDescriptor,
      handleActionEffectButtonClick,
      dispatchAction,
    };
  }

  return {
    createActionOwnerInputPorts,
    createActionRuntime,
    createActionContextFactory,
    createCompositionActionRegistry,
    createActionRuntimePort,
  };
});
