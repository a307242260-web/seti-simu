(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppActionRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function createActionRuntime(context = {}) {
    if (!context.setupSelectionState) {
      throw new Error("createActionRuntime requires setupSelectionState");
    }
    if (!context.playerState) {
      throw new Error("createActionRuntime requires playerState");
    }
    if (!context.turnState) {
      throw new Error("createActionRuntime requires turnState");
    }
    if (!context.pendingState) {
      throw new Error("createActionRuntime requires pendingState");
    }
    if (!context.rocketState) {
      throw new Error("createActionRuntime requires rocketState");
    }

    const {
      setupSelectionState,
      playerState,
      turnState,
      pendingState,
      rocketState,
      INITIAL_SELECTION_REQUIRED = { initial: 2 },
      INITIAL_CARD_COUNT = 12,
      INITIAL_SELECTION_CARD_SIZE = {
        industry: { width: 0, height: 0 },
        initial: { width: 0, height: 0 },
      },
      MIN_START_INDUSTRY_POOL_SIZE = 2,
      INITIAL_SELECTION_INDUSTRY_OPTION_COUNT = 2,
      INDUSTRY_CARD_FILES = [],
      HISTORY_SOURCE_SETUP = "setup",
      ACTION_LOG_DEFAULT_LABELS = {},
      stripAssetExtension = (value) => String(value || "").replace(/\.[^.]+$/, ""),
      shuffleList = (items) => [...(items || [])],
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
      resolveInitialSelectionEffects,
      applyIndustryRoundStartBonuses,
      startInitialIncomeEffectFlow,
      applyIndustryStartupPassives,
      appendConfirmedActionLogEntry,
      actionLogState,
      isInitialIncomeFlowActive,
      renderActionLog,
      refreshLatestActionLogRecoverySnapshot,
      scrollToPlayerCommandPanel,
      normalizeActionLogText = (value) => String(value || "").trim(),
      industry,
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
      analyzeDataForCurrentPlayer,
      passForCurrentPlayer,
      endCurrentTurn,
      blockManualAiPendingInputIfNeeded,
      getCurrentActionEffectIndex,
      runQuickTrade,
      confirmDataPlacement,
      standardActionAdapter,
    } = context;

    function createIndustrySelectionCard(fileName) {
      return {
        id: `industry:${fileName}`,
        kind: "industry",
        label: stripAssetExtension(fileName),
        src: `../assets/industry/${fileName}`,
        width: INITIAL_SELECTION_CARD_SIZE.industry.width,
        height: INITIAL_SELECTION_CARD_SIZE.industry.height,
      };
    }

    function createInitialSelectionCard(index) {
      return {
        id: `initial:${index}`,
        kind: "initial",
        label: `初始牌 ${index}`,
        src: `../assets/initial_card/split/${index}.png`,
        width: INITIAL_SELECTION_CARD_SIZE.initial.width,
        height: INITIAL_SELECTION_CARD_SIZE.initial.height,
      };
    }

    function normalizeStartIndustryLabels(industryLabels) {
      const allLabels = INDUSTRY_CARD_FILES.map(stripAssetExtension);
      if (!Array.isArray(industryLabels)) return allLabels;
      const requested = new Set(industryLabels.map((label) => String(label)));
      const selectedLabels = allLabels.filter((label) => requested.has(label));
      return selectedLabels.length >= MIN_START_INDUSTRY_POOL_SIZE ? selectedLabels : allLabels;
    }

    function getSelectedStartIndustryCardFiles() {
      const selectedLabels = new Set(normalizeStartIndustryLabels(context.startScreenState?.selectedIndustryLabels));
      return INDUSTRY_CARD_FILES.filter((fileName) => selectedLabels.has(stripAssetExtension(fileName)));
    }

    function createIndustrySelectionOffers(playerIds = []) {
      const poolFiles = getSelectedStartIndustryCardFiles();
      const requiredCount = playerIds.length * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT;
      const sharedDeck = poolFiles.length >= requiredCount
        ? shuffleList(poolFiles).slice(0, requiredCount)
        : null;
      const offersByPlayerId = {};

      playerIds.forEach((playerId, index) => {
        const optionFiles = sharedDeck
          ? sharedDeck.slice(
            index * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT,
            index * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT + INITIAL_SELECTION_INDUSTRY_OPTION_COUNT,
          )
          : shuffleList(poolFiles).slice(0, INITIAL_SELECTION_INDUSTRY_OPTION_COUNT);
        offersByPlayerId[playerId] = optionFiles.map(createIndustrySelectionCard);
      });

      return offersByPlayerId;
    }

    function getInitialSelectionPlayerIds() {
      const activeIds = Array.isArray(turnState.activePlayerIds)
        ? turnState.activePlayerIds.filter((playerId) => getPlayerById(playerId))
        : [];
      if (activeIds.length) return activeIds;
      return playerState.currentPlayerId ? [playerState.currentPlayerId] : [];
    }

    function isInitialSelectionActive() {
      return setupSelectionState.phase === "selecting";
    }

    function getInitialSelectionOffer(playerId = playerState.currentPlayerId) {
      return setupSelectionState.offersByPlayerId[playerId] || null;
    }

    function isInitialSelectionConfirmed(playerId = playerState.currentPlayerId) {
      return setupSelectionState.confirmedPlayerIds.includes(playerId)
        || Boolean(getInitialSelectionOffer(playerId)?.confirmed);
    }

    function canConfirmInitialSelection(offer) {
      return Boolean(
        offer?.selectedIndustryId
        && Array.isArray(offer.selectedInitialIds)
        && offer.selectedInitialIds.length === INITIAL_SELECTION_REQUIRED.initial,
      );
    }

    function getCardFromInitialOffer(offer, kind, cardId) {
      const options = kind === "industry" ? offer?.industryOptions : offer?.initialOptions;
      return (options || []).find((card) => card.id === cardId) || null;
    }

    function getInitialEffectLogSource(result) {
      if (result?.effect?.label) return result.effect.label;
      if (result?.cardNumber) return `初始牌 ${result.cardNumber}`;
      return result?.card?.label || "初始效果";
    }

    function formatInitialEffectLogDetail(result) {
      const playerLabel = getPlayerLabelById(result?.playerId)
        || result?.playerColorLabel
        || "玩家";
      const source = getInitialEffectLogSource(result);
      const detailMessages = (result?.results || [])
        .map((entry) => normalizeActionLogText(entry?.message))
        .filter(Boolean);
      const detail = detailMessages.length
        ? detailMessages.join("；")
        : normalizeActionLogText(result?.message);
      return `${playerLabel} ${source}${detail ? `：${detail}` : ""}`;
    }

    function buildInitialEffectLogSteps(initialResult) {
      const resultEntries = Array.isArray(initialResult?.results)
        ? initialResult.results
        : [];
      if (!resultEntries.length) {
        return initialResult?.message
          ? [`结算初始效果：${initialResult.message}`]
          : [];
      }
      return resultEntries.map((result) => `结算初始效果：${formatInitialEffectLogDetail(result)}`);
    }

    function recordInitialSelectionActionLog(player, selectedIndustry, selectedInitialCards, initialResult = null) {
      const initialLabels = selectedInitialCards.map((card) => card.label).filter(Boolean);
      const steps = [];
      if (selectedIndustry?.label) {
        steps.push({
          source: HISTORY_SOURCE_SETUP,
          text: `选择公司：${selectedIndustry.label}`,
        });
      }
      if (initialLabels.length) {
        steps.push({
          source: HISTORY_SOURCE_SETUP,
          text: `移出初始牌：${initialLabels.join("、")}`,
        });
      }
      for (const text of buildInitialEffectLogSteps(initialResult)) {
        steps.push({
          source: HISTORY_SOURCE_SETUP,
          text,
        });
      }
      appendConfirmedActionLogEntry?.({
        title: "初始选择",
        player,
        actionType: "initialSelection",
        actionLabel: "初始选择",
        steps,
      });
    }

    function startInitialSelection() {
      const playerIds = getInitialSelectionPlayerIds();
      const industryOffersByPlayerId = createIndustrySelectionOffers(playerIds);
      const initialDeck = shuffleList(
        Array.from({ length: INITIAL_CARD_COUNT }, (_item, index) => createInitialSelectionCard(index + 1)),
      );

      setupSelectionState.phase = playerIds.length ? "selecting" : "complete";
      setupSelectionState.currentPlayerId = playerIds[0] || null;
      setupSelectionState.offersByPlayerId = {};
      setupSelectionState.confirmedPlayerIds = [];

      playerIds.forEach((playerId, index) => {
        const player = getPlayerById(playerId);
        if (player) player.initialSelection = null;
        setupSelectionState.offersByPlayerId[playerId] = {
          playerId,
          industryOptions: industryOffersByPlayerId[playerId] || [],
          initialOptions: initialDeck.slice(index * 3, index * 3 + 3),
          selectedIndustryId: null,
          selectedInitialIds: [],
          confirmed: false,
        };
      });

      if (setupSelectionState.currentPlayerId) {
        playerState.currentPlayerId = setupSelectionState.currentPlayerId;
        rocketState.statusNote = "请完成初始选择：公司 2 选 1，初始牌 3 选 2。";
      }

      ensurePublicCardsFilledRespectingDelayedRefills?.();
      renderReservedCards?.();
      renderPublicCards?.();
      renderDebugPlayerSwitch?.();
      renderPlayerStats?.();
      updateActionButtons?.();
      renderStateReadout?.();
      schedulePersistentGameStateSave?.({ label: "初始选择开始" });
    }

    function handleInitialSelectionCardClick(kind, cardId) {
      if (!isInitialSelectionActive()) return;

      const playerId = playerState.currentPlayerId;
      const offer = getInitialSelectionOffer(playerId);
      if (!offer || offer.confirmed) return;

      if (kind === "industry") {
        offer.selectedIndustryId = cardId;
      } else if (kind === "initial") {
        const selected = offer.selectedInitialIds;
        const existingIndex = selected.indexOf(cardId);
        if (existingIndex >= 0) {
          selected.splice(existingIndex, 1);
        } else if (selected.length < INITIAL_SELECTION_REQUIRED.initial) {
          selected.push(cardId);
        }
      }

      renderReservedCards?.();
      renderStateReadout?.();
      schedulePersistentGameStateSave?.({ label: "初始选择更新" });
    }

    function confirmInitialSelectionForCurrentPlayer() {
      if (!isInitialSelectionActive()) return;

      const player = getCurrentPlayer();
      const offer = getInitialSelectionOffer(player?.id);
      if (!player || !offer || offer.confirmed) return;

      if (!canConfirmInitialSelection(offer)) {
        rocketState.statusNote = "初始选择未完成：请选择 1 张公司和 2 张初始牌。";
        renderStateReadout?.();
        return;
      }

      const selectedIndustry = getCardFromInitialOffer(offer, "industry", offer.selectedIndustryId);
      const selectedInitialCards = offer.selectedInitialIds
        .map((cardId) => getCardFromInitialOffer(offer, "initial", cardId))
        .filter(Boolean);

      offer.confirmed = true;
      if (!setupSelectionState.confirmedPlayerIds.includes(player.id)) {
        setupSelectionState.confirmedPlayerIds.push(player.id);
      }
      player.initialSelection = {
        industry: selectedIndustry ? { ...selectedIndustry } : null,
        removedInitialCards: selectedInitialCards.map((card) => ({ ...card })),
      };

      if (industry?.shouldInitializeStrategyPassiveMarkers?.(player)) {
        industry.initializeStrategyPassiveMarkers(player);
      }
      if (industry?.shouldInitializeHeliosPassiveMarkers?.(player)) {
        industry.initializeHeliosPassiveMarkers(player);
      }
      if (industry?.shouldInitializeAlienLabPanels?.(player)) {
        industry.initializeAlienLabPanels(player);
      }
      if (industry?.shouldInitializeFutureSpan?.(player)) {
        industry.initializeFutureSpanState(player);
      }
      if (industry?.shouldInitializePiratesRaidMarkers?.(player)) {
        industry.initializePiratesRaidMarkers(player);
      }

      const remainingPlayerId = getInitialSelectionPlayerIds()
        .find((playerId) => !isInitialSelectionConfirmed(playerId));
      let initialSelectionCompleted = false;
      if (remainingPlayerId) {
        recordInitialSelectionActionLog(player, selectedIndustry, selectedInitialCards);
        setupSelectionState.currentPlayerId = remainingPlayerId;
        playerState.currentPlayerId = remainingPlayerId;
        rocketState.statusNote = `已确认 ${player.colorLabel}玩家，轮到 ${getPlayerLabelById(remainingPlayerId)} 初始选择。`;
      } else {
        initialSelectionCompleted = true;
        setupSelectionState.phase = "complete";
        setupSelectionState.currentPlayerId = null;
        playerState.currentPlayerId = turnState.startPlayerId || playerState.currentPlayerId;
        const initialResult = resolveInitialSelectionEffects?.();
        const roundStartResult = applyIndustryRoundStartBonuses?.(turnState.roundNumber, { appendLog: false }) || { results: [] };
        const initialLogResult = roundStartResult.results.length
          ? {
            ...(initialResult || { ok: roundStartResult.ok, results: [], message: "" }),
            ok: Boolean((initialResult?.ok ?? true) && roundStartResult.ok),
            results: [
              ...(initialResult?.results || []),
              ...roundStartResult.results,
            ],
            message: [initialResult?.message, roundStartResult.message].filter(Boolean).join("；"),
          }
          : initialResult;
        recordInitialSelectionActionLog(player, selectedIndustry, selectedInitialCards, initialLogResult);
        const incomeStarted = startInitialIncomeEffectFlow?.(initialResult?.pendingIncomeIncreases || []);
        applyIndustryStartupPassives?.();
        if (!incomeStarted) {
          rocketState.statusNote = initialResult?.message
            ? `所有玩家已完成初始选择，${initialResult.message}，游戏开始。`
            : "所有玩家已完成初始选择，游戏开始。";
        }
      }

      renderDebugPlayerSwitch?.();
      renderPlayerStats?.();
      renderTechBoard?.();
      renderSectorNebulaDataBoard?.();
      syncPlanetOrbitLandMarkers?.();
      renderAlienPanels?.();
      renderPublicCards?.();
      renderReservedCards?.();
      renderPlayerHand?.();
      renderRockets?.();
      syncInteractionFocusChrome?.();
      updateActionButtons?.();
      renderStateReadout?.();
      if (initialSelectionCompleted) {
        scrollToPlayerCommandPanel?.();
      }
      if (isInitialIncomeFlowActive?.()) {
        const latestEntry = actionLogState?.entries?.[actionLogState.entries.length - 1];
        if (latestEntry) delete latestEntry.recoverySnapshot;
        renderActionLog?.();
      } else {
        refreshLatestActionLogRecoverySnapshot?.("初始选择后状态");
      }
      schedulePersistentGameStateSave?.({ label: "初始选择确认" });
    }

    function runAction(actionId, actionOptions) {
      if (!canStartMainAction?.()) {
        rocketState.statusNote = getMainActionStartBlockReason?.() || "本回合已经开始或完成主要行动";
        renderStateReadout?.();
        return { ok: false, message: rocketState.statusNote };
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
      const resolvedActionOptions = actionId === "analyze"
        ? getAnalyzeActionOptionsForPlayer?.(getCurrentPlayer?.(), actionOptions)
        : actionOptions;
      const actionLogBefore = createActionLogImpactSnapshot?.();
      const result = abilityId
        ? abilities.executeAbility(abilityId, createActionContext(), resolvedActionOptions)
        : actionId === "researchTech"
          ? abilities.executeAbility("researchTechPrepare", createActionContext(), resolvedActionOptions)
          : actions.execute(actionId, createActionContext(), resolvedActionOptions);

      let startedRewardFlow = false;

      if (result.ok && result.markerKind) {
        if (result.removedRocketId != null) removeRocketElement?.(result.removedRocketId);
        syncPlanetOrbitLandMarkersAfterAction?.();
        renderAlienPanels?.();
        if (actionId === "orbit" || actionId === "land") {
          startedRewardFlow = startPlanetRewardEffectFlow?.(actionId, result);
          if (startedRewardFlow) {
            settleCardTasksAfterEffect?.({ events: result.events, render: false });
            maybeAutoExecuteAomomoRewardEffects?.();
          }
        }
      } else if (actionId === "researchTech") {
        if (result.awaitingTileSelection) {
          rocketState.statusNote = result.message;
          startResearchTechEffectFlow?.(result, { logBefore: actionLogBefore });
          syncTechSelectionChrome?.();
          renderTechBoard?.();
          updateActionButtons?.();
        } else if (result.tileId) {
          rocketState.statusNote = result.message;
          finalizeTechTakeResult?.(result);
          return result;
        } else if (!result.ok) {
          rocketState.statusNote = result.message;
        }
      } else {
        if (result.rocket) renderRocketElement?.(result.rocket);
        if (result.removedRocketId != null) removeRocketElement?.(result.removedRocketId);
      }

      if (result.ok && actionId === "analyze") {
        recordAtomicActionHistory?.(actionId, ACTION_LOG_DEFAULT_LABELS.analyze, result, {
          logBefore: actionLogBefore,
        });
        startedRewardFlow = startAnalyzeDataRewardFlow?.();
        if (startedRewardFlow) {
          executeActionEffect?.(getCurrentActionEffect?.());
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
          rocketState.statusNote = result.message;
          startedRewardFlow = startLaunchSectorFinishEffectFlow?.(result) || false;
        }
        if (startedRewardFlow) {
          settleCardTasksAfterEffect?.({ events: result.events, render: false });
        } else {
          if ((abilityId || result.commands?.length) && result.undoable !== false) {
            recordAtomicActionHistory?.(actionId, result.message || actionId, result, {
              logBefore: actionLogBefore,
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

    function handleActionEffectButtonClick(effectIndex) {
      if (!pendingState.actionEffectFlow) return;
      if (Number(effectIndex) !== getCurrentActionEffectIndex?.()) return;

      const effect = getCurrentActionEffect?.();
      const blocked = blockManualAiPendingInputIfNeeded?.(null, {}, "效果结算", effect);
      if (blocked) return blocked;
      return executeActionEffect?.(effect);
    }

    function dispatchAction(request, fallbackOptions) {
      const action = typeof request === "string"
        ? { kind: request, payload: fallbackOptions || null }
        : { ...(request || {}) };
      if (action.kind === "standard_enumerate") {
        if (!standardActionAdapter) {
          return { ok: false, code: "STANDARD_ACTION_ADAPTER_UNAVAILABLE", candidates: [] };
        }
        return {
          ok: true,
          candidates: standardActionAdapter.enumerate(
            createActionContext(),
            action.payload || {},
          ),
        };
      }
      const standardDescriptor = action.standardAction
        || (action.schemaVersion === "seti-standard-action-v1" ? action : null);
      if (standardDescriptor) {
        if (!standardActionAdapter) {
          return { ok: false, code: "STANDARD_ACTION_ADAPTER_UNAVAILABLE" };
        }
        return standardActionAdapter.execute(createActionContext(), standardDescriptor);
      }
      const kind = action.kind || action.id || null;
      const payload = action.payload || fallbackOptions || {};
      const standardFamily = {
        scan: "scan",
        analyze: "analyze",
        playCard: "play_card",
        play_card: "play_card",
        pass: "pass",
        move: "move",
        quickTrade: "quick_trade",
        quick_trade: "quick_trade",
        industry: "industry",
        cardCorner: "card_corner",
        card_corner: "card_corner",
        placeData: "place_data",
        place_data: "place_data",
        runezuFaceSymbol: "runezu_face_symbol",
        runezu_face_symbol: "runezu_face_symbol",
        "end-turn": "end_turn",
        end_turn: "end_turn",
      }[kind];
      if (standardFamily && standardActionAdapter) {
        const selector = standardFamily === "quick_trade"
          ? { tradeId: payload.tradeId }
          : standardFamily === "industry"
            ? { companyLabel: payload.companyLabel || payload.industryCard?.label }
            : standardFamily === "card_corner"
              ? { cardInstanceId: payload.cardInstanceId || payload.cardId }
              : standardFamily === "move"
                ? { rocketId: payload.rocketId, deltaX: payload.deltaX, deltaY: payload.deltaY }
                : standardFamily === "place_data"
                  ? { target: payload.target, blueSlot: payload.blueSlot ?? null }
                  : standardFamily === "runezu_face_symbol"
                    ? { alienSlotId: payload.alienSlotId, position: payload.position, symbolId: payload.symbolId }
                    : payload.cardInstanceId
                      ? { cardInstanceId: payload.cardInstanceId }
                      : {};
        const standardResult = action.validateOnly === true && standardActionAdapter.resolveLegacy
          ? standardActionAdapter.resolveLegacy(
            createActionContext(),
            standardFamily,
            selector,
          )
          : standardActionAdapter.executeLegacy(
          createActionContext(),
          standardFamily,
          selector,
        );
        return standardResult;
      }
      switch (kind) {
        case "launch":
          return runAction("launch", payload);
        case "researchTech":
        case "research_tech":
          return researchTechForCurrentPlayer?.();
        case "orbit":
          return orbitForCurrentPlayer?.();
        case "land":
          return landForCurrentPlayer?.();
        case "scan":
          return beginScanAction?.();
        case "analyze":
          return analyzeDataForCurrentPlayer?.();
        case "playCard":
        case "play_card":
          return beginPlayCardSelection?.();
        case "pass":
          return passForCurrentPlayer?.();
        case "end-turn":
        case "end_turn":
          return endCurrentTurn?.();
        case "quickTrade":
        case "quick_trade":
          return runQuickTrade?.(payload.tradeId, payload);
        case "placeData":
        case "place_data":
          return confirmDataPlacement?.(payload.target, payload.blueSlot);
        case "confirmInitialSelection":
        case "confirm_initial_selection":
          return confirmInitialSelectionForCurrentPlayer();
        case "effect_step":
          return handleActionEffectButtonClick(action.effectIndex);
        default:
          return { ok: false, message: `未知 action kind: ${kind}` };
      }
    }

    return {
      createIndustrySelectionCard,
      createInitialSelectionCard,
      getInitialSelectionPlayerIds,
      isInitialSelectionActive,
      getInitialSelectionOffer,
      isInitialSelectionConfirmed,
      canConfirmInitialSelection,
      getCardFromInitialOffer,
      startInitialSelection,
      handleInitialSelectionCardClick,
      confirmInitialSelectionForCurrentPlayer,
      runAction,
      handleActionEffectButtonClick,
      dispatchAction,
    };
  }

  return {
    createActionRuntime,
  };
});
