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
      primaryBoard: registry.register("primary_board", {
        execute: (workingRoot, command) => context.clonePresentation(
          context.executePrimaryBoardAction(
            context.createActionContext(workingRoot, command.descriptor),
            command.descriptor,
            command.executionOptions,
            command.options,
          ),
        ),
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



  function stripAssetExtension(value) {
    return String(value || "").replace(/\.[^.]+$/, "");
  }

  function shuffleList(items, random = Math.random) {
    const result = [...(items || [])];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const pickIndex = Math.floor(random() * (index + 1));
      [result[index], result[pickIndex]] = [result[pickIndex], result[index]];
    }
    return result;
  }

  function createInitialIncomeFlow(context = {}) {
    function buildEffectNodes(entries = []) {
      const effects = [];
      for (const entry of entries) {
        const total = Math.max(0, Math.round(Number(entry?.count) || 0));
        if (!entry?.playerId || total <= 0) continue;
        const companyLabel = entry.label || "公司牌";
        for (let sequence = 1; sequence <= total; sequence += 1) {
          effects.push({
            id: `initial-income-${entry.playerId}-${sequence}`,
            type: "initial_income",
            icon: "income",
            label: `${companyLabel}：收入增加 ${sequence}/${total}`,
            status: "pending",
            undoable: false,
            options: { playerId: entry.playerId, companyLabel, sequence, total },
          });
        }
      }
      return effects;
    }

    function start(workingRoot, entries = []) {
      const effects = buildEffectNodes(entries);
      if (!effects.length) return false;
      context.setActionEffectFlow(workingRoot, context.abilities.chain.startAbilityChain(
        "initialIncome",
        "初始收入增加",
        effects,
      ));
      const flow = context.getActionEffectFlow(workingRoot);
      flow.actionType = "initialIncome";
      flow.playerId = effects[0]?.options?.playerId || null;
      context.assignEffectFlowOwner(flow, flow.playerId);
      const firstPlayer = (workingRoot.playerState.players || []).find((player) => player.id === flow.playerId) || null;
      if (firstPlayer) workingRoot.playerState.currentPlayerId = firstPlayer.id;
      context.setActionEffectFlowActive(true);
      workingRoot.rocketState.statusNote = "初始收入增加：请依次点击收入效果";
      context.renderDebugPlayerSwitch();
      context.renderPlayerStats();
      context.renderPlayerHand();
      context.activateNextActionEffect(workingRoot);
      return true;
    }

    return Object.freeze({ buildInitialIncomeEffectNodes: buildEffectNodes, startInitialIncomeEffectFlow: start });
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

  function createInitialSelectionEffectsResolver(context = {}) {
    return function resolveInitialSelectionEffects(workingRoot) {
      if (!context.initialCards?.resolveInitialSelections) return null;
      const result = context.initialCards.resolveInitialSelections({
        ...context.createActionContext(workingRoot),
        alienGameState: workingRoot.alienGameState,
      }, {
        playerIds: context.getPlayerIds(workingRoot),
      });
      const hasSignalMarked = (result.events || []).some((event) => event?.type === "signalMarked");
      const settlement = hasSignalMarked
        ? context.resolveCompletedSectorSettlements("initialSelection", {
          markMainActionIrreversible: false,
        })
        : null;
      context.recordScoreSources(result);
      if (!settlement?.ok) return result;
      return {
        ...result,
        settlement,
        message: `${result.message}；${settlement.message}；${settlement.participantAwardMessage || "参与结算玩家各获得1宣传"}`,
      };
    };
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
    if (!context.setupSelectionState) {
      throw new Error("createActionRuntime requires setupSelectionState");
    }
    const {
      setupSelectionState,
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
      stripAssetExtension: stripAssetExtensionOption = stripAssetExtension,
      shuffleList: shuffleListOption = shuffleList,
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
      primaryBoardActionExecutor,
      engineActionExecutor,
      quickTurnActionExecutor,
      conditionalActionExecutor,
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
      passForCurrentPlayer,
      endCurrentTurn,
      blockManualAiPendingInputIfNeeded,
      getCurrentActionEffectIndex,
      confirmDataPlacement,
      standardActionAdapter,
    } = context;
    const PRIMARY_BOARD_FAMILIES = new Set(primaryBoardActionExecutor?.actionFamilies || []);
    const ENGINE_ACTION_FAMILIES = new Set(engineActionExecutor?.actionFamilies || []);
    const QUICK_TURN_ACTION_FAMILIES = new Set(quickTurnActionExecutor?.actionFamilies || []);
    const CONDITIONAL_ACTION_FAMILIES = new Set(conditionalActionExecutor?.actionFamilies || []);
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

    function createIndustrySelectionCard(fileName) {
      return {
        id: `industry:${fileName}`,
        kind: "industry",
        label: stripAssetExtensionOption(fileName),
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
      const allLabels = INDUSTRY_CARD_FILES.map(stripAssetExtensionOption);
      if (!Array.isArray(industryLabels)) return allLabels;
      const requested = new Set(industryLabels.map((label) => String(label)));
      const selectedLabels = allLabels.filter((label) => requested.has(label));
      return selectedLabels.length >= MIN_START_INDUSTRY_POOL_SIZE ? selectedLabels : allLabels;
    }

    function getSelectedStartIndustryCardFiles() {
      const selectedLabels = new Set(normalizeStartIndustryLabels(context.startScreenState?.selectedIndustryLabels));
      return INDUSTRY_CARD_FILES.filter((fileName) => selectedLabels.has(stripAssetExtensionOption(fileName)));
    }

    function createIndustrySelectionOffers(playerIds = []) {
      const poolFiles = getSelectedStartIndustryCardFiles();
      const requiredCount = playerIds.length * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT;
      const sharedDeck = poolFiles.length >= requiredCount
        ? shuffleListOption(poolFiles).slice(0, requiredCount)
        : null;
      const offersByPlayerId = {};

      playerIds.forEach((playerId, index) => {
        const optionFiles = sharedDeck
          ? sharedDeck.slice(
            index * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT,
            index * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT + INITIAL_SELECTION_INDUSTRY_OPTION_COUNT,
          )
          : shuffleListOption(poolFiles).slice(0, INITIAL_SELECTION_INDUSTRY_OPTION_COUNT);
        offersByPlayerId[playerId] = optionFiles.map(createIndustrySelectionCard);
      });

      return offersByPlayerId;
    }

    function getInitialSelectionPlayerIds(workingRoot) {
      const { playerState, turnState } = workingRoot;
      const activeIds = Array.isArray(turnState.activePlayerIds)
        ? turnState.activePlayerIds.filter((playerId) => (
          playerState.players.some((player) => player.id === playerId)
        ))
        : [];
      if (activeIds.length) return activeIds;
      return playerState.currentPlayerId ? [playerState.currentPlayerId] : [];
    }

    function isInitialSelectionActive() {
      return setupSelectionState.phase === "selecting";
    }

    function getInitialSelectionOffer(playerId) {
      return setupSelectionState.offersByPlayerId[playerId] || null;
    }

    function isInitialSelectionConfirmed(playerId) {
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

    function startInitialSelection(workingRoot) {
      const { playerState, rocketState } = workingRoot;
      const playerIds = getInitialSelectionPlayerIds(workingRoot);
      const industryOffersByPlayerId = createIndustrySelectionOffers(playerIds);
      const initialDeck = shuffleList(
        Array.from({ length: INITIAL_CARD_COUNT }, (_item, index) => createInitialSelectionCard(index + 1)),
      );

      setupSelectionState.phase = playerIds.length ? "selecting" : "complete";
      setupSelectionState.currentPlayerId = playerIds[0] || null;
      setupSelectionState.offersByPlayerId = {};
      setupSelectionState.confirmedPlayerIds = [];

      playerIds.forEach((playerId, index) => {
        const player = playerState.players.find((entry) => entry.id === playerId) || null;
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

    function handleInitialSelectionCardClick(workingRoot, kind, cardId) {
      if (!isInitialSelectionActive()) return;

      const playerId = workingRoot.playerState.currentPlayerId;
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

    function confirmInitialSelectionForCurrentPlayer(workingRoot) {
      if (!isInitialSelectionActive()) return;

      const { playerState, rocketState, turnState } = workingRoot;
      const player = playerState.players.find((entry) => entry.id === playerState.currentPlayerId) || null;
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

      const remainingPlayerId = getInitialSelectionPlayerIds(workingRoot)
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
        const initialResult = resolveInitialSelectionEffects?.(workingRoot);
        const roundStartResult = applyIndustryRoundStartBonuses?.(
          workingRoot,
          turnState.roundNumber,
          { appendLog: false },
        ) || { results: [] };
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
        const incomeStarted = startInitialIncomeEffectFlow?.(
          workingRoot,
          initialResult?.pendingIncomeIncreases || [],
        );
        applyIndustryStartupPassives?.(workingRoot);
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

    function executeStandardDescriptor(standardContext, descriptor, executionOptions = null) {
      const workingRoot = getExecutionWorkingRoot(standardContext);
      if (CONDITIONAL_ACTION_FAMILIES.has(descriptor?.family)) {
        return conditionalActionExecutor.execute(workingRoot, descriptor);
      }
      if (QUICK_TURN_ACTION_FAMILIES.has(descriptor?.family)) {
        return quickTurnActionExecutor.execute(workingRoot, descriptor, {
          validate: (workingRoot, action) => standardActionAdapter.validate(
            createActionContext(workingRoot, action),
            action,
          ),
        });
      }
      if (ENGINE_ACTION_FAMILIES.has(descriptor?.family)) {
        const actionLogBefore = createActionLogImpactSnapshot?.();
        const result = engineActionExecutor.execute(workingRoot, descriptor, {
          validate: (workingRoot, action) => standardActionAdapter.validate(
            createActionContext(workingRoot, action),
            action,
          ),
        });
        if (!result?.ok) return result;
        if (descriptor.family === "research_tech" && result.tileId) {
          workingRoot.rocketState.statusNote = result.message;
          finalizeTechTakeResult?.(result);
        }
        if (descriptor.family === "analyze") {
          recordAtomicActionHistory?.("analyze", ACTION_LOG_DEFAULT_LABELS.analyze, result, {
            logBefore: actionLogBefore,
          });
          const startedRewardFlow = startAnalyzeDataRewardFlow?.(workingRoot);
          if (startedRewardFlow) executeActionEffect?.(actionWorkingRoot, getCurrentActionEffect?.());
          settleCardTasksAfterEffect?.({ events: result.events, render: false });
          renderPlayerStats?.();
          updateActionButtons?.();
          renderStateReadout?.();
        }
        return result;
      }
      if (!PRIMARY_BOARD_FAMILIES.has(descriptor?.family)) {
        return standardActionAdapter.execute(standardContext, descriptor);
      }
      if (descriptor.family === "move") {
        const validation = standardActionAdapter.validate(standardContext, descriptor);
        if (!validation?.ok) return validation;
        return moveRocket?.(
          descriptor.target?.deltaX,
          descriptor.target?.deltaY,
          descriptor.target?.rocketId,
          { automated: true, standardAction: descriptor },
        ) || { ok: false, code: "PRIMARY_BOARD_MOVE_CALLER_MISSING", message: "移动 caller 未装配" };
      }
      return executePrimaryBoardAction(standardContext, descriptor, executionOptions);
    }

    function executePrimaryBoardAction(standardContext, descriptor, executionOptions = null, options = {}) {
      if (!PRIMARY_BOARD_FAMILIES.has(descriptor?.family)) {
        return { ok: false, code: "PRIMARY_BOARD_FAMILY_INVALID", message: `非 Primary Board family: ${descriptor?.family || "<missing>"}` };
      }
      return primaryBoardActionExecutor.execute(getExecutionWorkingRoot(standardContext), descriptor, {
        ...(options.skipValidation ? {} : { validate: standardActionAdapter.validate }),
        executionOptions,
      });
    }

    function resolvePrimaryBoardDescriptor(actionId, actionOptions = {}) {
      const selector = actionId === "land"
        ? {
          ...(actionOptions?.rocketId == null ? {} : { rocketId: Number(actionOptions.rocketId) }),
          ...(actionOptions?.target?.type ? { type: actionOptions.target.type } : {}),
          ...(actionOptions?.target?.satelliteId ? { satelliteId: actionOptions.target.satelliteId } : {}),
        }
        : (actionOptions?.rocketId == null ? {} : { rocketId: Number(actionOptions.rocketId) });
      const standardContext = createActionContext();
      const resolved = standardActionAdapter.resolveIntent(standardContext, actionId, selector);
      return resolved.ok
        ? { ok: true, result: executeStandardDescriptor(standardContext, resolved.action) }
        : resolved;
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
      const primaryExecution = PRIMARY_BOARD_FAMILIES.has(actionId) && actionId !== "move"
        ? resolvePrimaryBoardDescriptor(actionId, resolvedActionOptions)
        : null;
      const result = primaryExecution
        ? (primaryExecution.ok ? primaryExecution.result : primaryExecution)
        : abilityId
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
        case "confirmInitialSelection":
        case "confirm_initial_selection":
          return confirmInitialSelectionForCurrentPlayer();
        case "effect_step":
          return handleActionEffectButtonClick(explicitActionContext, action.effectIndex);
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
      executePrimaryBoardAction,
      executeStandardDescriptor,
      handleActionEffectButtonClick,
      dispatchAction,
    };
  }

  function createBrowserStandardActionAdapter(context = {}) {
    const {
      actions,
      players,
      scanEffects,
      data,
      cards,
      rocketActions,
      industry,
      abilities,
      aliens,
      runezu,
      canStartMainAction,
      getMainActionStartBlockReason,
      canAnalyzeDataForPlayer,
      getAnalyzeActionOptionsForPlayer,
      hasActivePendingSubFlow,
      getMovableTokensForPlayer,
      getRequiredMovePointsForUi,
      canPayForMove,
      moveRocket,
      canUseCardCornerQuickActionForRoot,
      getCardCornerQuickActionForCardForRoot,
      shouldQueueCardCornerMoveQuickActionForRoot,
      canStartCardCornerFreeMoveForRoot,
      isActionPending,
      isActionEffectFlowActive,
      createConditionalActionProvider,
    } = context;
    if (typeof actions?.createStandardAdapter !== "function") {
      throw new TypeError("browser standard action adapter requires actions.createStandardAdapter");
    }

    return actions.createStandardAdapter({
      stage2Actions: {
        scan: {
          label: "扫描",
          getOptions(actionContext) {
            const player = players.getCurrentPlayer(actionContext.playerState);
            const check = canStartMainAction(actionContext.workingRoot)
              ? scanEffects.canExecuteScan(player, { standardAction: true })
              : { ok: false, message: getMainActionStartBlockReason(actionContext.workingRoot) };
            return check.ok ? { ok: true, choices: [{ target: { kind: "standard-scan" }, label: "扫描" }] } : check;
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute() { return { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED" }; },
        },
        analyze: {
          label: "分析",
          getOptions(actionContext) {
            const player = players.getCurrentPlayer(actionContext.playerState);
            const check = canStartMainAction(actionContext.workingRoot)
              ? canAnalyzeDataForPlayer(player)
              : { ok: false, message: getMainActionStartBlockReason(actionContext.workingRoot) };
            return check.ok ? {
              ok: true,
              choices: [{
                target: { kind: "computer", requiredSlot: data.ANALYZE_REQUIRED_COMPUTER_SLOT },
                payload: getAnalyzeActionOptionsForPlayer(player),
                label: "分析",
              }],
            } : check;
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute() { return { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED" }; },
        },
        pass: {
          label: "PASS",
          getOptions(actionContext) {
            return canStartMainAction(actionContext.workingRoot)
              ? { ok: true, choices: [{ target: { kind: "pass" }, label: "PASS" }] }
              : { ok: false, message: getMainActionStartBlockReason(actionContext.workingRoot) };
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
      },
      stage3Actions: {
        move: {
          label: "移动",
          getOptions(actionContext) {
            if (hasActivePendingSubFlow(actionContext.workingRoot)) return { ok: false, message: "请先完成当前选择" };
            const player = players.getCurrentPlayer(actionContext.playerState);
            const directions = [
              { id: "out", deltaX: 0, deltaY: 1 },
              { id: "cw", deltaX: 1, deltaY: 0 },
              { id: "ccw", deltaX: -1, deltaY: 0 },
              { id: "in", deltaX: 0, deltaY: -1 },
            ];
            const choices = (getMovableTokensForPlayer(actionContext, player?.id) || []).flatMap((rocket) => directions
              .map((direction) => ({
                rocket,
                direction,
                requiredMovePoints: getRequiredMovePointsForUi(
                  actionContext,
                  player,
                  rocket.id,
                  direction.deltaX,
                  direction.deltaY,
                ),
              }))
              .filter(({ rocket, direction, requiredMovePoints }) => (
                rocketActions.canMoveRocket(
                  actionContext.rocketState,
                  rocket.id,
                  direction.deltaX,
                  direction.deltaY,
                ).ok
                && canPayForMove(player, requiredMovePoints).ok
              ))
              .map(({ rocket, direction, requiredMovePoints }) => ({
                target: { rocketId: rocket.id, deltaX: direction.deltaX, deltaY: direction.deltaY },
                payload: { requiredMovePoints },
                label: `移动火箭 ${rocket.id} ${direction.id}`,
              })));
            return choices.length ? { ok: true, choices } : { ok: false, message: "没有合法移动目标" };
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute(_actionContext, option) {
            return moveRocket(
              option.target.deltaX,
              option.target.deltaY,
              option.target.rocketId,
              { automated: true },
            );
          },
        },
        industry: {
          label: "公司 1x",
          getOptions(actionContext) {
            const player = players.getCurrentPlayer(actionContext.playerState);
            const companyCard = player?.initialSelection?.industry || null;
            const layout = industry.getIndustryActionMarkerLayout?.(companyCard);
            const markCheck = industry.canMarkIndustryAction?.(player, actionContext.turnState.roundNumber, {
              turnNumber: actionContext.turnState.turnNumber,
              hasMarker: Boolean(layout),
              industryCard: companyCard,
              requireIndustryCard: true,
            });
            const abilityCheck = industry.canStartActiveAbility?.(player, companyCard?.label);
            if (!markCheck?.ok || !abilityCheck?.ok) return markCheck?.ok ? abilityCheck : markCheck;
            return {
              ok: true,
              choices: [{ target: { companyLabel: companyCard.label }, label: companyCard.label }],
            };
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        cardCorner: {
          label: "弃牌角标",
          getOptions(actionContext) {
            if (!canUseCardCornerQuickActionForRoot(actionContext.workingRoot)) {
              return { ok: false, message: "当前无法使用卡牌快速行动" };
            }
            const player = players.getCurrentPlayer(actionContext.playerState);
            const choices = (player?.hand || []).map((card, handIndex) => ({
              card,
              handIndex,
              action: getCardCornerQuickActionForCardForRoot(actionContext.workingRoot, card),
            }))
              .filter(({ action }) => Boolean(action))
              .filter(({ action }) => action.actionKind !== "move"
                || shouldQueueCardCornerMoveQuickActionForRoot(actionContext.workingRoot, action, player)
                || canStartCardCornerFreeMoveForRoot(actionContext.workingRoot).ok)
              .map(({ card, handIndex, action }) => ({
                target: { cardInstanceId: card.id },
                payload: { handIndex, actionKind: action.actionKind, symbolId: action.symbolId || null },
                label: action.label,
              }));
            return choices.length ? { ok: true, choices } : { ok: false, message: "没有可用弃牌角标" };
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        placeData: {
          label: "放置数据",
          getOptions(actionContext) {
            const player = players.getCurrentPlayer(actionContext.playerState);
            const result = abilities.data.listPlacementChoices(player);
            const choices = (result.choices || []).map((choice) => ({
              target: { target: choice.target, blueSlot: choice.blueSlot ?? null },
              label: choice.label || "放置数据",
            }));
            return result.ok && choices.length
              ? { ok: true, choices }
              : { ok: false, message: result.message || "没有数据放置目标" };
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        runezuFaceSymbol: {
          label: "符文族面部符号",
          getOptions(actionContext) {
            const player = players.getCurrentPlayer(actionContext.playerState);
            const choices = (aliens.ALIEN_SLOT_IDS || []).flatMap((alienSlotId) => (
              runezu.isRunezuRevealedSlot(actionContext.alienGameState, alienSlotId)
                ? (runezu.FACE_SYMBOL_POSITIONS || []).flatMap((position) => {
                  const check = runezu.canPlaceFaceSymbol(actionContext.alienGameState, position, player);
                  return (check.ok ? check.choices : []).map((choice) => ({
                    target: {
                      alienSlotId: Number(alienSlotId),
                      position: Number(position),
                      symbolId: choice.symbolId,
                    },
                    label: `${runezu.formatSymbolLabel(choice.symbolId)} → ${position}`,
                  }));
                })
                : []
            ));
            return choices.length ? { ok: true, choices } : { ok: false, message: "没有可放置的符文族面部符号" };
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        endTurn: {
          label: "结束回合",
          getOptions(actionContext) {
            const legal = isActionPending() && !isActionEffectFlowActive(actionContext.workingRoot)
              && !hasActivePendingSubFlow(actionContext.workingRoot);
            return legal
              ? { ok: true, choices: [{ target: { kind: "end-turn" }, label: "结束回合" }] }
              : { ok: false, message: "主行动未完成或仍有待决选择" };
          },
          canExecute(actionContext) { return this.getOptions(actionContext); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
      },
      stage4Actions: Object.fromEntries(
        actions.standardAction.CONDITIONAL_FAMILIES.map((family) => [
          family,
          createConditionalActionProvider(family),
        ]),
      ),
    });
  }

  return {
    createActionOwnerInputPorts,
    createActionRuntime,
    createBrowserStandardActionAdapter,
    createInitialIncomeFlow,
    createInitialSelectionEffectsResolver,
    createActionContextFactory,
    createCompositionActionRegistry,
    createActionRuntimePort,
    shuffleList,
    stripAssetExtension,
  };
});
