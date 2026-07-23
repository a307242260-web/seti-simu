(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppScanFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function buildSectorScanChoicesForXs(sectorXs, buildSectorScanChoicesForX) {
    return (sectorXs || []).flatMap((x) => buildSectorScanChoicesForX(x));
  }

  function createProbeDecisionPort(context = {}) {
    function handleSectorChoice(rocketId) {
      const pending = context.getPendingProbeSectorScanDecision();
      const maxTargets = Math.max(1, Math.round(Number(pending?.effect?.options?.maxTargets) || 1));
      if (maxTargets === 1) {
        return context.submitActiveDecision(
          "probe-sector-selection",
          (target) => (target.rocketIds || []).length === 1
            && String(target.rocketIds[0]) === String(rocketId),
        );
      }
      return context.handleMultiSectorChoice(context.getRuleReadout(), rocketId);
    }
    function confirmSectorSelection() {
      const selected = [...(context.getSelectedRocketIds() || [])].map(String).sort();
      return context.submitActiveDecision(
        "probe-sector-selection",
        (target) => [...(target.rocketIds || [])].map(String).sort().join(",") === selected.join(","),
      );
    }
    function handleLocationRewardChoice(rocketId) {
      return context.submitActiveDecision(
        "probe-location-reward",
        (target) => String(target.rocketId ?? target.choiceId) === String(rocketId),
      );
    }
    return Object.freeze({ handleSectorChoice, confirmSectorSelection, handleLocationRewardChoice });
  }

  function requireFunction(name, fn) {
    if (typeof fn !== "function") {
      throw new Error(`createScanFlowHelpers requires function: ${name}`);
    }
    return fn;
  }

  const BROWSER_STATIC_DEPENDENCY_KEYS = Object.freeze([
    "cards", "players", "data", "scanEffects", "planetRewards", "cardEffects",
    "abilities", "solar", "runezu", "aomomo", "historyCommands",
  ]);
  const BROWSER_STATIC_CONSTANT_KEYS = Object.freeze([
    "PUBLIC_SCAN_MAX_BONUS_CARDS", "SECTOR_FINISH_ICON_BY_COLOR", "SECTOR_WIN_REWARDS",
    "PUBLIC_SCAN_TARGETS_BY_CODE", "PUBLIC_SCAN_CODE_LABELS",
  ]);

  function selectRequired(source, keys, label) {
    const missing = keys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(source, key) || source[key] == null,
    );
    if (missing.length) throw new Error(`${label} 缺少依赖：${missing.join(", ")}`);
    return Object.fromEntries(keys.map((key) => [key, source[key]]));
  }

  function createBrowserScanStaticContext(dependencies = {}, constants = {}) {
    return Object.freeze({
      ...selectRequired(dependencies, BROWSER_STATIC_DEPENDENCY_KEYS, "Browser Scan 静态模块"),
      ...selectRequired(constants, BROWSER_STATIC_CONSTANT_KEYS, "Browser Scan 静态常量"),
    });
  }

  function createBrowserScanFlow(options = {}) {
    const {
      staticContext,
      getActionInteractionRuntime,
      getAlienSpeciesRuntime,
      getCardRuntime,
      getEffectExecutionPort,
      getIndustryRuntime,
      getTechRuntime,
      actionSessionRuntime,
      browserContextRuntime,
      cardSelectionDecisionOwner,
      cardSelectionState,
      effectExecutorPort,
      effectFlowRuntime,
      effectHistoryPort,
      effectSkipRuntime,
      handFlowRuntime,
      interactionChrome,
      pendingSubFlowRuntime,
      playerEffectOwnerRuntime,
      renderRuntime,
      hostPort = {},
    } = options;
    const requireGetter = (name, getter) => {
      if (typeof getter !== "function") {
        throw new TypeError(`Browser Scan bootstrap 缺少 owner getter：${name}`);
      }
      return getter;
    };
    const lazy = (ownerName, getter, methodName) => {
      const getOwner = requireGetter(ownerName, getter);
      return (...args) => {
        const method = getOwner()?.[methodName];
        if (typeof method !== "function") {
          throw new Error(`Browser Scan owner ${ownerName} 缺少方法：${methodName}`);
        }
        return method(...args);
      };
    };
    const alien = (methodName) => lazy("alienSpecies", getAlienSpeciesRuntime, methodName);
    const card = (methodName) => lazy("card", getCardRuntime, methodName);
    const industry = (methodName) => lazy("industry", getIndustryRuntime, methodName);
    const tech = (methodName) => lazy("tech", getTechRuntime, methodName);
    const actionInteraction = (methodName) => (
      lazy("actionInteraction", getActionInteractionRuntime, methodName)
    );
    const effectExecution = (methodName) => (
      lazy("effectExecution", getEffectExecutionPort, methodName)
    );

    return createScanFlowHelpers({
      ...staticContext,
      uiRuntimeState: hostPort.uiRuntimeState,
      openPendingDecision: hostPort.openPendingDecision,
      readPendingDecision: hostPort.readPendingDecision,
      clearPendingAmibaSymbolChoice: alien("clearAmibaSymbolDecisionDraft"),
      clearPendingRunezuSymbolBranch: alien("clearRunezuSymbolBranchDecisionDraft"),
      clearPendingRunezuFaceSymbolPlacement: alien("clearRunezuFaceSymbolDecisionDraft"),
      getPendingYichangdianCornerAction: hostPort.getPendingYichangdianCornerAction,
      clearPendingAmibaCardGain: alien("clearAmibaCardGainDecisionDraft"),
      clearPendingAomomoCardGain: alien("clearAomomoCardGainDecisionDraft"),
      clearPendingRunezuCardGain: alien("clearRunezuCardGainDecisionDraft"),
      clearPendingAmibaTraceRemoval: alien("clearAmibaTraceRemovalDecisionDraft"),
      document: hostPort.document,
      structuredClone: hostPort.structuredClone,
      els: hostPort.els,
      PUBLIC_SCAN_MAX_BONUS_CARDS: staticContext.PUBLIC_SCAN_MAX_BONUS_CARDS,
      SECTOR_FINISH_ICON_BY_COLOR: staticContext.SECTOR_FINISH_ICON_BY_COLOR,
      SECTOR_WIN_REWARDS: staticContext.SECTOR_WIN_REWARDS,
      PUBLIC_SCAN_TARGETS_BY_CODE: staticContext.PUBLIC_SCAN_TARGETS_BY_CODE,
      PUBLIC_SCAN_CODE_LABELS: staticContext.PUBLIC_SCAN_CODE_LABELS,
      SCAN_TARGET_ACTION_LAYOUT_CLASSES: hostPort.SCAN_TARGET_ACTION_LAYOUT_CLASSES,
      renderStateReadout: renderRuntime?.renderStateReadout,
      renderPlayerStats: renderRuntime?.renderPlayerStats,
      renderPublicCards: renderRuntime?.renderPublicCards,
      renderPlayerHand: renderRuntime?.renderPlayerHand,
      updatePublicCardControls: card("updatePublicCardControls"),
      updateActionButtons: hostPort.updateActionButtons,
      syncPublicScanConfirmButton: hostPort.syncPublicScanConfirmButton,
      syncCardSelectionChrome: interactionChrome?.syncCardSelectionChrome,
      syncHandScanSelectionChrome: handFlowRuntime?.syncHandScanSelectionChrome,
      beginEffectHistoryStep: effectFlowRuntime?.beginEffectHistoryStep,
      endEffectHistoryStep: effectFlowRuntime?.endEffectHistoryStep,
      recordHistoryCommand: effectFlowRuntime?.recordHistoryCommand,
      recordAbilityCommands: effectHistoryPort?.recordAbilityCommands,
      actionHistory: hostPort.actionHistory,
      isTechTilePickingActive: tech("isTechTilePickingActive"),
      isCardSelectionActive: cardSelectionState?.isCardSelectionActive,
      isDiscardSelectionActive: cardSelectionState?.isDiscardSelectionActive,
      isPlayCardSelectionActive: cardSelectionState?.isPlayCardSelectionActive,
      readCardSelectionDecision: cardSelectionDecisionOwner?.read,
      openCardSelectionDecision: cardSelectionDecisionOwner?.open,
      isMovePaymentSelectionActive: handFlowRuntime?.isMovePaymentSelectionActive,
      isHandScanSelectionActive: handFlowRuntime?.isHandScanSelectionActive,
      getFlowMarkedNebulaIds: hostPort.getFlowMarkedNebulaIds,
      normalizeResourceCost: hostPort.normalizeResourceCost,
      createActionContext: hostPort.createActionContext,
      canStartMainAction: actionSessionRuntime?.canStartMainAction,
      getMainActionStartBlockReason: actionSessionRuntime?.getMainActionStartBlockReason,
      HISTORY_SOURCE_MAIN: hostPort.HISTORY_SOURCE_MAIN,
      startActionLogDraft: effectFlowRuntime?.startActionLogDraft,
      clearHistoryStepOrderForSource: effectFlowRuntime?.clearHistoryStepOrderForSource,
      removeActionLogStepsBySource: effectFlowRuntime?.removeActionLogStepsBySource,
      maybeConsumeAlienLabPanelForMainAction: industry("maybeConsumeAlienLabPanelForMainAction"),
      rememberHistoryStep: effectFlowRuntime?.rememberHistoryStep,
      appendActionLogStep: effectFlowRuntime?.appendActionLogStep,
      actionLogOptionsFromHistoryStep: effectFlowRuntime?.actionLogOptionsFromHistoryStep,
      createScanRunId: browserContextRuntime?.createScanRunId,
      assignEffectFlowOwner: playerEffectOwnerRuntime?.assignEffectFlowOwner,
      enrichScanResultEvents: effectExecutorPort?.enrichScanResultEvents,
      renderSectors: renderRuntime?.renderSectors,
      insertActionEffectsAfterCurrent: effectExecutorPort?.insertActionEffectsAfterCurrent,
      completeCurrentActionEffect: effectFlowRuntime?.completeCurrentActionEffect,
      finishAutomaticRewardEffect: effectExecutorPort?.finishAutomaticRewardEffect,
      setActiveEffectFlowOwner: playerEffectOwnerRuntime?.setActiveEffectFlowOwner,
      getNormalTokenAssetForPlayer: hostPort.getNormalTokenAssetForPlayer,
      renderSectorNebulaDataBoard: renderRuntime?.renderSectorNebulaDataBoard,
      renderAlienPanels: alien("renderAlienPanels"),
      renderRockets: renderRuntime?.renderRockets,
      assignEffectOwner: playerEffectOwnerRuntime?.assignEffectOwner,
      activateNextActionEffect: effectFlowRuntime?.activateNextActionEffect,
      getPendingOwnerFields: playerEffectOwnerRuntime?.getPendingOwnerFields,
      withPendingOwnerPlayer: playerEffectOwnerRuntime?.withPendingOwnerPlayer,
      confirmIndustryHeliosRemoveTech: industry("confirmIndustryHeliosRemoveTech"),
      isActionEffectFlowActive: effectFlowRuntime?.isActionEffectFlowActive,
      skipActionEffectWithMessage: effectSkipRuntime?.skipWithMessage,
      getCurrentActionEffect: effectFlowRuntime?.getCurrentActionEffect,
      applyAomomoScanCostAndBonus: effectExecutorPort?.applyAomomoScanCostAndBonus,
      maybeReturnPlayedCardToHandAfterSectorScan: effectExecutorPort?.maybeReturnPlayedCardToHandAfterSectorScan,
      maybeCompleteActionEffectFromScan: effectExecution("maybeCompleteFromScan"),
      markCurrentActionIrreversible: actionSessionRuntime?.markCurrentActionIrreversible,
      syncInteractionFocusChrome: interactionChrome?.syncInteractionFocusChrome,
      openYichangdianCornerPicker: effectExecutorPort?.openYichangdianCornerPicker,
      rollbackPendingIndustryQuickAction: industry("rollbackPendingIndustryQuickAction"),
      beginCardSelection: card("beginCardSelection"),
      renderRocketElement: renderRuntime?.renderRocketElement,
      maybeApplyIndustryLaunchScan: industry("maybeApplyIndustryLaunchScan"),
      getMovableTokensForWorkingRoot: hostPort.getMovableTokensForWorkingRoot,
      activateMoveMode: actionInteraction("activateMoveMode"),
      deactivateMoveMode: actionInteraction("deactivateMoveMode"),
      selectDefaultRocketForCurrentPlayer: hostPort.selectDefaultRocketForCurrentPlayer,
      beginSupplementalMovePayment: handFlowRuntime?.beginSupplementalMovePayment,
      getRequiredMovePointsForWorkingRoot: hostPort.getRequiredMovePointsForWorkingRoot,
    });
  }

  function createScanAction4Picker(context = {}) {
    const { document, els = {}, players, scanEffects } = context;
    function close() {
      if (!els.scanAction4Overlay) return;
      els.scanAction4Overlay.hidden = true;
      els.scanAction4Actions?.replaceChildren();
    }
    function open(workingRoot) {
      if (!els.scanAction4Overlay || !els.scanAction4Actions) {
        return { ok: false, message: "无法打开发射/移动选择" };
      }
      const currentPlayer = context.getCurrentPlayer(workingRoot);
      const skipCost = Boolean(context.getCurrentEffect(workingRoot)?.options?.skipCost);
      const hasRocket = context.getMovableTokensForPlayer(workingRoot, currentPlayer?.id).length > 0;
      const canLaunch = skipCost || players.canAfford(currentPlayer, {
        energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY,
      });
      const choices = [{
        id: "launch",
        label: "发射",
        description: canLaunch
          ? (skipCost ? "免费在地球扇区发射火箭" : "消耗 1 能量，在地球扇区发射火箭")
          : "能量不足，无法发射",
        disabled: !canLaunch,
      }];
      if (hasRocket) choices.push({ id: "move", label: "移动", description: "选择飞船并移动，不消耗能量或手牌" });
      choices.push({ id: "skip", label: "跳过", description: "不执行本次发射/移动效果" });
      context.openPendingDecision(workingRoot, "scan_free_move", {
        stage: "action_choice",
        effectId: context.getCurrentEffect(workingRoot)?.id || null,
        playerId: currentPlayer?.id || null,
        choices: choices.filter((choice) => !choice.disabled).map((choice) => choice.id),
      });
      if (els.scanAction4Subtitle) {
        els.scanAction4Subtitle.textContent = hasRocket
          ? "选择发射、移动，或跳过此效果。" : "没有飞船时只能选择发射或跳过。";
      }
      els.scanAction4Actions.replaceChildren(...choices.map((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.scanAction4Choice = choice.id;
        button.disabled = Boolean(choice.disabled);
        button.innerHTML = `${choice.label}<small>${choice.description || ""}</small>`;
        return button;
      }));
      els.scanAction4Overlay.hidden = false;
      return { ok: true };
    }
    return Object.freeze({ open, close });
  }

  function createScanFlowHelpers(context = {}) {
    const cards = context.cards || {};
    const players = context.players || {};
    const data = context.data || {};
    const scanEffects = context.scanEffects || {};
    const planetRewards = context.planetRewards || {};
    const cardEffects = context.cardEffects || {};
    const abilities = context.abilities || {};
    const solar = context.solar || {};
    const runezu = context.runezu || null;
    const aomomo = context.aomomo || null;
    const historyCommands = context.historyCommands || {};
    const documentRef = context.document || null;
    const structuredCloneRef = context.structuredClone || globalThis.structuredClone;
    const document = documentRef;
    const structuredClone = structuredCloneRef;

    const readCardSelectionDecision = () => context.readCardSelectionDecision?.() || null;
    function clearCardSelectionDecision(workingRoot) {
      requireWorkingRoot(workingRoot);
      uiRuntimeState.publicCardSelectedSlots = [];
      uiRuntimeState.cardSelectionType = null;
    }
    const uiRuntimeState = context.uiRuntimeState || {};
    const getHandScanDecision = () => context.readPendingDecision?.("hand_scan") || null;
    function setHandScanContinuation(workingRoot, continuation) {
      requireWorkingRoot(workingRoot);
      if (!continuation) return null;
      return context.openPendingDecision(workingRoot, "hand_scan", continuation);
    }
    const clearPendingAmibaSymbolChoice = requireFunction(
      "clearPendingAmibaSymbolChoice",
      context.clearPendingAmibaSymbolChoice,
    );
    const clearPendingRunezuSymbolBranch = requireFunction(
      "clearPendingRunezuSymbolBranch",
      context.clearPendingRunezuSymbolBranch,
    );
    const clearPendingRunezuFaceSymbolPlacement = requireFunction(
      "clearPendingRunezuFaceSymbolPlacement",
      context.clearPendingRunezuFaceSymbolPlacement,
    );
    const getPendingYichangdianCornerAction = requireFunction(
      "getPendingYichangdianCornerAction",
      context.getPendingYichangdianCornerAction,
    );
    const clearPendingAmibaCardGain = requireFunction("clearPendingAmibaCardGain", context.clearPendingAmibaCardGain);
    const clearPendingAomomoCardGain = requireFunction("clearPendingAomomoCardGain", context.clearPendingAomomoCardGain);
    const clearPendingRunezuCardGain = requireFunction("clearPendingRunezuCardGain", context.clearPendingRunezuCardGain);
    const clearPendingAmibaTraceRemoval = requireFunction("clearPendingAmibaTraceRemoval", context.clearPendingAmibaTraceRemoval);
    const getScanTargetDecision = () => (
      context.readPendingDecision?.("scan_target")
      || context.readPendingDecision?.("public_scan")
      || null
    );
    const getPublicScanQueue = () => (
      context.readPendingDecision?.("public_scan")?.publicScanQueue || null
    );
    function openScanTargetDecision(workingRoot, pending) {
      requireWorkingRoot(workingRoot);
      if (!pending) return null;
      const normalized = structuredClone(pending);
      normalized.playerId ||= pending.player?.id || null;
      normalized.playerColor ||= pending.player?.color || null;
      normalized.cardId ||= pending.card?.id || pending.card?.cardId || null;
      delete normalized.player;
      delete normalized.card;
      const kind = normalized.type === "public_scan" ? "public_scan" : "scan_target";
      return context.openPendingDecision(workingRoot, kind, normalized);
    }
    function hydrateScanTargetDecision(workingRoot, pending) {
      if (!pending) return null;
      const player = resolveWorkingPlayerReference(workingRoot, pending)
        || getWorkingCurrentPlayer(workingRoot);
      const cardPool = pending.type === "hand_scan"
        ? (player?.hand || [])
        : (workingRoot.cardState?.publicCards || []);
      const card = pending.cardId
        ? cardPool.find((candidate) => String(candidate?.id || candidate?.cardId) === String(pending.cardId)) || null
        : null;
      return { ...pending, player, card };
    }
    const els = context.els || {};

    const PUBLIC_SCAN_MAX_BONUS_CARDS = Number(context.PUBLIC_SCAN_MAX_BONUS_CARDS || 0);
    const SECTOR_FINISH_ICON_BY_COLOR = context.SECTOR_FINISH_ICON_BY_COLOR || {};
    const SECTOR_WIN_REWARDS = context.SECTOR_WIN_REWARDS || {};
    const PUBLIC_SCAN_TARGETS_BY_CODE = context.PUBLIC_SCAN_TARGETS_BY_CODE || {};
    const PUBLIC_SCAN_CODE_LABELS = context.PUBLIC_SCAN_CODE_LABELS || {};
    const SCAN_TARGET_ACTION_LAYOUT_CLASSES = context.SCAN_TARGET_ACTION_LAYOUT_CLASSES || [];
    const getPublicScanChoicesForCardOverride = typeof context.getPublicScanChoicesForCard === "function"
      ? context.getPublicScanChoicesForCard
      : null;
    const openScanTargetPickerOverride = typeof context.openScanTargetPicker === "function"
      ? context.openScanTargetPicker
      : null;
    const discardPublicScanCardOverride = typeof context.discardPublicScanCard === "function"
      ? context.discardPublicScanCard
      : null;

    const renderStateReadout = requireFunction("renderStateReadout", context.renderStateReadout);
    const renderPlayerStats = requireFunction("renderPlayerStats", context.renderPlayerStats);
    const renderPublicCards = requireFunction("renderPublicCards", context.renderPublicCards);
    const renderPlayerHand = requireFunction("renderPlayerHand", context.renderPlayerHand);
    const updatePublicCardControls = requireFunction("updatePublicCardControls", context.updatePublicCardControls);
    const updateActionButtons = requireFunction("updateActionButtons", context.updateActionButtons);
    const syncPublicScanConfirmButton = requireFunction("syncPublicScanConfirmButton", context.syncPublicScanConfirmButton);
    const syncCardSelectionChrome = requireFunction("syncCardSelectionChrome", context.syncCardSelectionChrome);
    const syncHandScanSelectionChrome = requireFunction("syncHandScanSelectionChrome", context.syncHandScanSelectionChrome);
    const beginEffectHistoryStep = requireFunction("beginEffectHistoryStep", context.beginEffectHistoryStep);
    const endEffectHistoryStep = requireFunction("endEffectHistoryStep", context.endEffectHistoryStep);
    const recordHistoryCommand = requireFunction("recordHistoryCommand", context.recordHistoryCommand);
    const recordAbilityCommands = requireFunction("recordAbilityCommands", context.recordAbilityCommands);
    const isTechTilePickingActive = requireFunction("isTechTilePickingActive", context.isTechTilePickingActive);
    const isCardSelectionActive = requireFunction("isCardSelectionActive", context.isCardSelectionActive);
    const isDiscardSelectionActive = requireFunction("isDiscardSelectionActive", context.isDiscardSelectionActive);
    const isPlayCardSelectionActive = requireFunction("isPlayCardSelectionActive", context.isPlayCardSelectionActive);
    const isMovePaymentSelectionActive = requireFunction("isMovePaymentSelectionActive", context.isMovePaymentSelectionActive);
    const isHandScanSelectionActive = requireFunction("isHandScanSelectionActive", context.isHandScanSelectionActive);
    const getFlowMarkedNebulaIds = requireFunction("getFlowMarkedNebulaIds", context.getFlowMarkedNebulaIds);
    const normalizeResourceCost = requireFunction("normalizeResourceCost", context.normalizeResourceCost);
    const createActionContext = requireFunction("createActionContext", context.createActionContext);
    const enrichScanResultEvents = requireFunction("enrichScanResultEvents", context.enrichScanResultEvents);
    const renderSectors = requireFunction("renderSectors", context.renderSectors);
    const insertActionEffectsAfterCurrent = requireFunction(
      "insertActionEffectsAfterCurrent",
      context.insertActionEffectsAfterCurrent,
    );
    const completeCurrentActionEffect = requireFunction(
      "completeCurrentActionEffect",
      context.completeCurrentActionEffect,
    );
    const finishAutomaticRewardEffect = requireFunction(
      "finishAutomaticRewardEffect",
      context.finishAutomaticRewardEffect,
    );
    const setActiveEffectFlowOwner = requireFunction("setActiveEffectFlowOwner", context.setActiveEffectFlowOwner);
    const getNormalTokenAssetForPlayer = requireFunction(
      "getNormalTokenAssetForPlayer",
      context.getNormalTokenAssetForPlayer,
    );
    const renderSectorNebulaDataBoard = requireFunction(
      "renderSectorNebulaDataBoard",
      context.renderSectorNebulaDataBoard,
    );
    const renderAlienPanels = requireFunction("renderAlienPanels", context.renderAlienPanels);
    const renderRockets = requireFunction("renderRockets", context.renderRockets);
    const assignEffectOwner = requireFunction("assignEffectOwner", context.assignEffectOwner);
    const activateNextActionEffect = requireFunction("activateNextActionEffect", context.activateNextActionEffect);
    const getPendingOwnerFields = requireFunction("getPendingOwnerFields", context.getPendingOwnerFields);
    const withPendingOwnerPlayer = requireFunction("withPendingOwnerPlayer", context.withPendingOwnerPlayer);
    const confirmIndustryHeliosRemoveTech = requireFunction(
      "confirmIndustryHeliosRemoveTech",
      context.confirmIndustryHeliosRemoveTech,
    );
    const isActionEffectFlowActive = requireFunction(
      "isActionEffectFlowActive",
      context.isActionEffectFlowActive,
    );
    const skipActionEffectWithMessage = requireFunction(
      "skipActionEffectWithMessage",
      context.skipActionEffectWithMessage,
    );
    const getCurrentActionEffect = requireFunction("getCurrentActionEffect", context.getCurrentActionEffect);
    const applyAomomoScanCostAndBonus = requireFunction(
      "applyAomomoScanCostAndBonus",
      context.applyAomomoScanCostAndBonus,
    );
    const maybeReturnPlayedCardToHandAfterSectorScan = requireFunction(
      "maybeReturnPlayedCardToHandAfterSectorScan",
      context.maybeReturnPlayedCardToHandAfterSectorScan,
    );
    const maybeCompleteActionEffectFromScan = requireFunction(
      "maybeCompleteActionEffectFromScan",
      context.maybeCompleteActionEffectFromScan,
    );
    const markCurrentActionIrreversible = requireFunction(
      "markCurrentActionIrreversible",
      context.markCurrentActionIrreversible,
    );
    const syncInteractionFocusChrome = requireFunction(
      "syncInteractionFocusChrome",
      context.syncInteractionFocusChrome,
    );
    const openYichangdianCornerPicker = requireFunction(
      "openYichangdianCornerPicker",
      context.openYichangdianCornerPicker,
    );
    const rollbackPendingIndustryQuickAction = requireFunction(
      "rollbackPendingIndustryQuickAction",
      context.rollbackPendingIndustryQuickAction,
    );
    const beginCardSelection = requireFunction("beginCardSelection", context.beginCardSelection);

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("scan-flow operation requires an explicit workingRoot");
      }
      return workingRoot;
    }
    const getActionEffectFlow = (workingRoot) => requireWorkingRoot(workingRoot).match?.actionEffectFlow || null;

    function getWorkingCurrentPlayer(workingRoot) {
      const { playerState } = requireWorkingRoot(workingRoot);
      return players.getCurrentPlayer(playerState);
    }

    function resolveWorkingPlayerReference(workingRoot, reference = {}) {
      const { playerState } = requireWorkingRoot(workingRoot);
      const playerId = reference.playerId || reference.targetPlayerId || reference.id || null;
      if (playerId) {
        const player = (playerState.players || []).find((entry) => entry.id === playerId);
        if (player) return player;
      }
      const playerColor = reference.playerColor || reference.targetPlayerColor || reference.color || null;
      return playerColor
        ? (playerState.players || []).find((entry) => entry.color === playerColor) || null
        : null;
    }

    function getCardLabel(card) {
      return typeof cards.getCardLabel === "function" ? cards.getCardLabel(card) : String(card?.cardName || card?.id || "");
    }

    function setSelectionActive(workingRoot, active) {
      const { cardState } = requireWorkingRoot(workingRoot);
      if (typeof cards.setSelectionActive === "function") {
        cards.setSelectionActive(cardState, active);
      }
    }

    function getPublicScanBonusSelectableCount(player) {
      return Math.min(
        Math.max(0, player?.resources?.additionalPublicScan || 0),
        PUBLIC_SCAN_MAX_BONUS_CARDS,
      );
    }

    function getPublicScanMaxSelectable(workingRoot, player) {
      const { cardState } = requireWorkingRoot(workingRoot);
      const filledSlots = (cardState.publicCards || []).filter(Boolean).length;
      return Math.min(1 + getPublicScanBonusSelectableCount(player), 3, filledSlots);
    }

    function getPublicScanMinSelectable(pending = null) {
      const maxSelectable = Math.max(1, Math.round(Number(pending?.maxSelectable) || 1));
      const requested = Math.max(1, Math.round(Number(pending?.minSelectable) || 1));
      return Math.min(maxSelectable, requested);
    }

    function getPublicScanSelectionInstruction(pending) {
      const maxSelectable = Math.max(1, Math.round(Number(pending?.maxSelectable) || 1));
      const minSelectable = getPublicScanMinSelectable(pending);
      return minSelectable >= maxSelectable
        ? `请选择 ${maxSelectable} 张公共牌，确认后依次扫描`
        : `最多选择 ${maxSelectable} 张公共牌，确认后依次扫描`;
    }

    function ensureDelayedPublicRefills(flow = null) {
      if (!flow) return [];
      if (!Array.isArray(flow.delayedPublicRefills)) {
        flow.delayedPublicRefills = [];
      }
      return flow.delayedPublicRefills;
    }

    function registerDelayedPublicRefill(workingRoot, scanRunId, slotIndex, card) {
      if (!scanRunId || !getActionEffectFlow(workingRoot)) return null;
      const index = Number(slotIndex);
      if (!Number.isInteger(index)) return null;
      const list = ensureDelayedPublicRefills(getActionEffectFlow(workingRoot));
      const existing = list.find((item) => item.scanRunId === scanRunId && item.slotIndex === index);
      if (existing) {
        existing.card = card || existing.card || null;
        existing.cardLabel = card ? getCardLabel(card) : existing.cardLabel;
        return existing;
      }
      const entry = {
        scanRunId,
        slotIndex: index,
        card: card || null,
        cardLabel: card ? getCardLabel(card) : null,
      };
      list.push(entry);
      return entry;
    }

    function getDelayedPublicRefillSlots(scanRunId, flow = null) {
      return ensureDelayedPublicRefills(flow)
        .filter((item) => !scanRunId || item.scanRunId === scanRunId)
        .map((item) => ({ ...item }));
    }

    function clearDelayedPublicRefillSlots(scanRunId, flow = null) {
      if (!flow || !Array.isArray(flow.delayedPublicRefills)) return;
      flow.delayedPublicRefills = flow.delayedPublicRefills
        .filter((item) => scanRunId && item.scanRunId !== scanRunId);
    }

    function cloneDelayedPublicRefills(flow = null) {
      return Array.isArray(flow?.delayedPublicRefills)
        ? flow.delayedPublicRefills.map((item) => ({ ...item }))
        : [];
    }

    function getSectorFinishIcon(sectorId) {
      return SECTOR_FINISH_ICON_BY_COLOR[data.getNebulaColor?.(sectorId)] || "sector_finish_scan";
    }

    function getSectorFinishWinnerTarget(workingRoot, sectorId) {
      const { nebulaDataState } = requireWorkingRoot(workingRoot);
      if (!sectorId || sectorId === aomomo?.NEBULA_ID) return null;
      const winner = data.getSectorRanking?.(nebulaDataState, sectorId)
        ?.find((entry) => Number(entry?.count) > 0) || null;
      const player = winner ? resolveWorkingPlayerReference(workingRoot, winner) : null;
      if (player) {
        return {
          playerId: player.id || null,
          playerColor: player.color || null,
          playerLabel: player.colorLabel || player.name || player.color || null,
        };
      }
      if (!winner) return null;
      return {
        playerId: winner.playerId || null,
        playerColor: winner.playerColor || null,
        playerLabel: winner.playerLabel || winner.playerColor || null,
      };
    }

    function buildReadySectorFinishEffects(workingRoot, options = {}) {
      const { nebulaDataState } = requireWorkingRoot(workingRoot);
      const sectorFilter = options.nebulaIds
        ? new Set([...options.nebulaIds].map((sectorId) => String(sectorId)))
        : null;
      return (data.NEBULA_IDS || [])
        .filter((sectorId) => (!sectorFilter || sectorFilter.has(String(sectorId))))
        .filter((sectorId) => data.isSectorReadyToSettle(nebulaDataState, sectorId))
        .map((sectorId) => {
          const target = getSectorFinishWinnerTarget(workingRoot, sectorId);
          return {
            type: scanEffects.EFFECT_TYPES.SECTOR_FINISH_SCAN,
            playerId: target?.playerId || null,
            playerColor: target?.playerColor || null,
            icon: getSectorFinishIcon(sectorId),
            label: `完成扇区：${data.getNebulaLabel(sectorId)}`,
            required: true,
            undoable: true,
            options: {
              sectorId,
              required: true,
              skippable: false,
              targetPlayerId: target?.playerId || null,
              targetPlayerColor: target?.playerColor || null,
              winnerPlayerId: target?.playerId || null,
              winnerPlayerColor: target?.playerColor || null,
            },
          };
        });
    }

    function getSectorWinnerRewardKey(settlement) {
      const config = data.getSectorWinMarkerConfig?.(settlement?.sectorId);
      if (config?.firstKind === "circle" && Number(settlement?.settlementNumber) === 1) {
        return "first";
      }
      if (config?.firstKind !== "circle") return "repeat";
      return "repeat";
    }

    function createTargetResourceEffect(id, label, icon, target, gain) {
      return {
        id,
        type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
        playerId: target?.id || null,
        playerColor: target?.color || null,
        icon,
        label,
        options: {
          gain,
          targetPlayerId: target?.id || null,
          targetPlayerColor: target?.color || null,
        },
      };
    }

    function createTargetPinkTraceEffect(id, label, target) {
      return {
        id,
        type: planetRewards.EFFECT_TYPES.ALIEN_TRACE,
        playerId: target?.id || null,
        playerColor: target?.color || null,
        icon: "alien_pink",
        label,
        options: {
          traceType: "pink",
          targetPlayerId: target?.id || null,
          targetPlayerColor: target?.color || null,
        },
      };
    }

    function buildSectorSettlementRewardEffects(workingRoot, settlement) {
      requireWorkingRoot(workingRoot);
      if (!settlement?.ok) return [];
      const sectorLabel = data.getNebulaLabel(settlement.sectorId);
      const effects = [];
      const participants = settlement.participants || [];

      if (settlement.sectorId === aomomo?.NEBULA_ID) {
        for (const participant of participants) {
          const player = resolveWorkingPlayerReference(workingRoot, participant);
          if (!player) continue;
          effects.push(createTargetResourceEffect(
            `sector-${settlement.sectorId}-fossil-${player.id}-${settlement.settlementNumber}`,
            `${sectorLabel}参与奖励：${player.colorLabel || player.name} +1化石`,
            "aomomoFossil",
            player,
            { aomomoFossils: 1 },
          ));
        }
        return effects;
      }

      for (const participant of participants) {
        const player = resolveWorkingPlayerReference(workingRoot, participant);
        if (!player) continue;
        effects.push(createTargetResourceEffect(
          `sector-${settlement.sectorId}-publicity-${player.id}-${settlement.settlementNumber}`,
          `${sectorLabel}参与奖励：${player.colorLabel || player.name} +1宣传`,
          "publicity",
          player,
          { publicity: 1 },
        ));
      }

      const winner = resolveWorkingPlayerReference(workingRoot, settlement.winner || {});
      const rewardConfig = SECTOR_WIN_REWARDS[settlement.sectorId];
      const rewards = rewardConfig?.[getSectorWinnerRewardKey(settlement)] || [];
      for (const reward of rewards) {
        if (!winner) continue;
        if (reward.resource) {
          effects.push(createTargetResourceEffect(
            `sector-${settlement.sectorId}-winner-${reward.resource}-${settlement.settlementNumber}`,
            `${sectorLabel}赢家奖励：${winner.colorLabel || winner.name} +${reward.amount}${reward.resource === "score" ? "分" : ""}`,
            reward.resource === "score" ? "score" : reward.resource,
            winner,
            { [reward.resource]: reward.amount },
          ));
        } else if (reward.traceType === "pink") {
          effects.push(createTargetPinkTraceEffect(
            `sector-${settlement.sectorId}-winner-pink-trace-${settlement.settlementNumber}`,
            `${sectorLabel}赢家奖励：${winner.colorLabel || winner.name}放置粉色外星人痕迹`,
            winner,
          ));
        }
      }
      return effects;
    }

    function buildScanFinalizeFollowupEffects(workingRoot, _scanRunId, flow = getActionEffectFlow(workingRoot)) {
      return [
        ...buildReadySectorFinishEffects(workingRoot, { nebulaIds: getFlowMarkedNebulaIds(flow) }),
      ];
    }

    function isKnownScanEffectType(type) {
      if (!type) return false;
      const scanEffectTypes = new Set(Object.values(scanEffects.EFFECT_TYPES || {}));
      if (scanEffectTypes.has(type)) return true;
      return String(type).toLowerCase().includes("scan");
    }

    function isScanRelatedEffect(effect) {
      if (!effect) return false;
      if (isKnownScanEffectType(effect.type)) return true;
      const abilityId = String(effect.abilityId || "").toLowerCase();
      return abilityId.includes("scan");
    }

    function isScanRelatedEffectFlow(flow) {
      if (!flow) return false;
      if (flow.actionType === "scan" || flow.scanRunId || flow.scanActionEvent) return true;
      const marked = getFlowMarkedNebulaIds(flow);
      if (Array.isArray(marked) && marked.length) return true;
      return (flow.effects || []).some(isScanRelatedEffect);
    }

    function beginPublicScanForSingleCard(workingRoot, index, card, optionsOrFromEffectFlow = false) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const options = typeof optionsOrFromEffectFlow === "object"
        ? optionsOrFromEffectFlow
        : { fromEffectFlow: Boolean(optionsOrFromEffectFlow) };
      const scanChoices = getPublicScanChoicesForCard(workingRoot, card);
      if (!scanChoices.ok) {
        rocketState.statusNote = scanChoices.message;
        renderStateReadout();
        return scanChoices;
      }

      clearCardSelectionDecision(workingRoot);
      setSelectionActive(workingRoot, false);
      syncCardSelectionChrome();
      rocketState.statusNote = `公共牌区扫描：${getCardLabel(card)}，请选择${scanChoices.scanLabel}目标`;
      renderStateReadout();
      return openScanTargetPicker(workingRoot, {
        type: "public_scan",
        card,
        publicSlotIndex: index,
        scanCode: scanChoices.scanCode,
        fromEffectFlow: Boolean(options.fromEffectFlow),
        scanRunId: options.scanRunId || null,
        deferPublicRefill: Boolean(options.deferPublicRefill),
        title: "公共牌区扫描",
        subtitle: `${getCardLabel(card)}：${scanChoices.scanLabel}，请选择 2 选 1 星云。`,
        choices: scanChoices.choices,
      });
    }

    function openPublicScanNebulaPickerForCurrentQueueItem(workingRoot, queue = getPublicScanQueue()) {
      if (!queue) return { ok: false, message: "没有待扫描的公共牌" };
      const item = queue.items[queue.currentIndex];
      if (!item) return { ok: false, message: "没有待扫描的公共牌" };

      const { card, scanChoices, publicSlotIndex } = item;
      const total = queue.items.length;
      const current = queue.currentIndex + 1;
      return openScanTargetPicker(workingRoot, {
        type: "public_scan",
        card,
        publicSlotIndex,
        scanCode: scanChoices.scanCode,
        fromEffectFlow: queue.fromEffectFlow,
        queueMode: true,
        publicScanQueue: queue,
        scanRunId: queue.scanRunId || null,
        deferPublicRefill: Boolean(queue.deferPublicRefill),
        title: "公共牌区扫描",
        subtitle: total > 1
          ? `第 ${current}/${total} 张：${getCardLabel(card)}，${scanChoices.scanLabel}，请选择 2 选 1 星云。`
          : `${getCardLabel(card)}：${scanChoices.scanLabel}，请选择 2 选 1 星云。`,
        choices: scanChoices.choices,
      });
    }

    function confirmPublicScanSelection(workingRoot) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      const pending = readCardSelectionDecision();
      if (pending?.type !== "public_scan") {
        return { ok: false, message: "当前不是公共牌区扫描" };
      }

      const selectedSlots = [...(uiRuntimeState.publicCardSelectedSlots || [])].sort((a, b) => a - b);
      const minSelectable = getPublicScanMinSelectable(pending);
      if (selectedSlots.length < minSelectable) {
        const message = minSelectable > 1
          ? `请至少选择 ${minSelectable} 张公共牌`
          : "请至少选择一张公共牌";
        rocketState.statusNote = message;
        renderStateReadout();
        return { ok: false, message };
      }

      const items = [];
      for (const slotIndex of selectedSlots) {
        const card = cardState.publicCards[slotIndex];
        if (!card) {
          rocketState.statusNote = "所选公共牌已不可用";
          renderStateReadout();
          return { ok: false, message: rocketState.statusNote };
        }
        const scanChoices = getPublicScanChoicesForCard(workingRoot, card);
        if (!scanChoices.ok) {
          rocketState.statusNote = scanChoices.message;
          renderStateReadout();
          return scanChoices;
        }
        items.push({ card, publicSlotIndex: slotIndex, scanChoices });
      }

      const player = resolveWorkingPlayerReference(workingRoot, pending)
        || getWorkingCurrentPlayer(workingRoot);
      const extraUsed = pending.freeAdditionalPublicScans ? 0 : selectedSlots.length - 1;
      if (extraUsed > 0 && !players.canAfford(player, { additionalPublicScan: extraUsed })) {
        rocketState.statusNote = `额外公共扫描不足，需要 ${extraUsed} 个`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const fromEffectFlow = Boolean(pending.fromEffectFlow || getActionEffectFlow(workingRoot));
      clearCardSelectionDecision(workingRoot);
      setSelectionActive(workingRoot, false);
      syncCardSelectionChrome();

      if (fromEffectFlow) {
        beginEffectHistoryStep(workingRoot, "公共牌区扫描");
      }

      if (extraUsed > 0) {
        players.spendResources(player, { additionalPublicScan: extraUsed });
        recordHistoryCommand(workingRoot, historyCommands.createResourceSpendCommand(
          player,
          { additionalPublicScan: extraUsed },
          `消耗 ${extraUsed} 额外公共扫描`,
        ));
        renderPlayerStats();
      }

      const discardOrder = [...selectedSlots].sort((a, b) => b - a);
      for (const slotIndex of discardOrder) {
        const item = items.find((entry) => entry.publicSlotIndex === slotIndex);
        if (!item) continue;
        discardPublicScanCard(workingRoot, {
          card: item.card,
          publicSlotIndex: slotIndex,
          scanRunId: pending.scanRunId || null,
          deferPublicRefill: Boolean(pending.deferPublicRefill),
        });
      }

      const queue = {
        items,
        currentIndex: 0,
        fromEffectFlow,
        scanRunId: pending.scanRunId || null,
        deferPublicRefill: Boolean(pending.deferPublicRefill),
      };
      rocketState.statusNote = `公共牌区扫描：已弃除 ${items.length} 张牌，请依次选择星云`;
      renderPlayerStats();
      renderPublicCards();
      updatePublicCardControls();
      updateActionButtons();
      renderStateReadout();
      return openPublicScanNebulaPickerForCurrentQueueItem(workingRoot, queue);
    }

    function handlePublicScanCardClick(workingRoot, slotIndex) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      const index = Number(slotIndex);
      const card = cardState.publicCards[index];
      if (!card) {
        rocketState.statusNote = "该公共牌位没有卡牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = readCardSelectionDecision();
      const maxSelectable = pending?.maxSelectable ?? 1;
      const fromEffectFlow = Boolean(pending?.fromEffectFlow || getActionEffectFlow(workingRoot));

      if (maxSelectable <= 1) {
        return beginPublicScanForSingleCard(workingRoot, index, card, {
          fromEffectFlow,
          scanRunId: pending?.scanRunId || null,
          deferPublicRefill: Boolean(pending?.deferPublicRefill),
        });
      }

      const selectedSlots = uiRuntimeState.publicCardSelectedSlots || [];
      const existingIndex = selectedSlots.indexOf(index);
      if (existingIndex >= 0) {
        selectedSlots.splice(existingIndex, 1);
      } else if (selectedSlots.length >= maxSelectable) {
        rocketState.statusNote = `最多选择 ${maxSelectable} 张公共牌`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      } else {
        const scanChoices = getPublicScanChoicesForCard(workingRoot, card);
        if (!scanChoices.ok) {
          rocketState.statusNote = scanChoices.message;
          renderStateReadout();
          return scanChoices;
        }
        selectedSlots.push(index);
      }

      uiRuntimeState.publicCardSelectedSlots = selectedSlots;
      const count = selectedSlots.length;
      const minSelectable = getPublicScanMinSelectable(pending);
      rocketState.statusNote = count > 0
        ? `公共牌区扫描：已选 ${count}/${maxSelectable} 张${count < minSelectable ? `，至少需要 ${minSelectable} 张` : "，点击确认开始扫描"}`
        : `公共牌区扫描：${getPublicScanSelectionInstruction(pending)}`;
      syncPublicScanConfirmButton();
      renderPublicCards();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function beginHandScan(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (isTechTilePickingActive()) {
        rocketState.statusNote = "请先完成科技选择";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (isCardSelectionActive()) {
        rocketState.statusNote = "请先完成精选";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (isDiscardSelectionActive()) {
        rocketState.statusNote = "请先完成弃牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (isPlayCardSelectionActive()) {
        rocketState.statusNote = "请先完成打牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (isMovePaymentSelectionActive()) {
        rocketState.statusNote = "请先完成移动";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      if (!currentPlayer?.hand?.length) {
        rocketState.statusNote = "没有手牌可用于扫描";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      setHandScanContinuation(workingRoot, { type: "hand_scan", playerId: currentPlayer.id });
      rocketState.statusNote = "手牌扫描：请选择一张手牌弃除并扫描";
      syncHandScanSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function cancelHandScanSelection(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!isHandScanSelectionActive(workingRoot)) return;
      setHandScanContinuation(workingRoot, null);
      rocketState.statusNote = "已取消手牌扫描";
      syncHandScanSelectionChrome(workingRoot);
      updateActionButtons();
      renderStateReadout();
    }

    function handleHandScanCardClick(workingRoot, handIndex, pendingOverride = null) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!isHandScanSelectionActive(workingRoot)) return;

      const fromEffectFlow = Boolean(
        (pendingOverride || getHandScanDecision())?.fromEffectFlow
        || getActionEffectFlow(workingRoot)
      );
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const scanChoices = getPublicScanChoicesForCard(workingRoot, card);
      if (!scanChoices.ok) {
        rocketState.statusNote = scanChoices.message;
        renderStateReadout();
        return scanChoices;
      }

      setHandScanContinuation(workingRoot, null);
      syncHandScanSelectionChrome(workingRoot);
      rocketState.statusNote = `手牌扫描：${getCardLabel(card)}，请选择${scanChoices.scanLabel}目标`;
      renderStateReadout();
      return openScanTargetPicker(workingRoot, {
        type: "hand_scan",
        card,
        handIndex: index,
        player: currentPlayer,
        scanCode: scanChoices.scanCode,
        fromEffectFlow,
        title: "手牌扫描",
        subtitle: `${getCardLabel(card)}：${scanChoices.scanLabel}，请选择 2 选 1 星云。确认后弃除这张手牌。`,
        choices: scanChoices.choices,
      });
    }


    function isExhaustedNebulaScanMessage(message) {
      return /没有可替换的数据|已没有未替换的数据/.test(String(message || ""));
    }

    function replaceNebulaDataForCurrentPlayer(workingRoot, nebulaId, options = {}) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const currentPlayer = getWorkingCurrentPlayer(workingRoot);
      const cost = normalizeResourceCost(options.cost) || {};
      const hasCost = Object.keys(cost).length > 0;
      if (hasCost && (!currentPlayer || !players.canAfford(currentPlayer, cost))) {
        const message = `资源不足，需要 ${players.formatResourceCost(cost)}`;
        rocketState.statusNote = message;
        renderStateReadout();
        return { ok: false, message };
      }

      beginEffectHistoryStep(workingRoot, options.prefix || "星云扫描");

      if (hasCost) {
        const spendResult = players.spendResources(currentPlayer, cost);
        if (!spendResult.ok) {
          endEffectHistoryStep(workingRoot);
          rocketState.statusNote = spendResult.message;
          renderStateReadout();
          return spendResult;
        }
      }

      const result = abilities.executeAbility("scanSector", createActionContext(workingRoot), {
        ...options,
        nebulaId,
      });

      if (!result.ok) {
        if (hasCost) players.gainResources(currentPlayer, cost);
        endEffectHistoryStep(workingRoot);
        if (isExhaustedNebulaScanMessage(result.message)) {
          const skipped = {
            ok: true,
            undoable: true,
            skipped: true,
            message: `${result.message}，已跳过`,
            payload: { nebulaId, skipped: true },
            events: [],
          };
          rocketState.statusNote = skipped.message;
          renderSectors();
          renderStateReadout();
          return skipped;
        }
        rocketState.statusNote = result.message;
        renderSectors();
        renderStateReadout();
        return result;
      }

      if (hasCost) {
        const costText = players.formatResourceCost(cost);
        recordHistoryCommand(workingRoot, historyCommands.createResourceSpendCommand(
          currentPlayer,
          cost,
          `${options.prefix || "星云扫描"}：消耗 ${costText}`,
        ));
        result.cost = { ...cost };
        result.message = `${result.message}；消耗 ${costText}`;
        result.payload = {
          ...(result.payload || {}),
          cost: { ...cost },
        };
      }
      enrichScanResultEvents(result, nebulaId, { sectorX: options.sectorX });
      recordAbilityCommands(result, undefined, workingRoot);
      rocketState.statusNote = result.message;

      renderSectors();
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    function appendSectorSettlementResultToFlow(workingRoot, settlementResult) {
      if (!getActionEffectFlow(workingRoot) || !settlementResult?.ok) return;
      if (!getActionEffectFlow(workingRoot).sectorSettlementResult) {
        getActionEffectFlow(workingRoot).sectorSettlementResult = {
          ok: true,
          settlements: [],
          message: "",
        };
      }
      const aggregate = getActionEffectFlow(workingRoot).sectorSettlementResult;
      aggregate.settlements.push(settlementResult);
      aggregate.message = aggregate.settlements.map((item) => item.message).join("；");
      aggregate.runezuSymbolClaims = [
        ...(aggregate.runezuSymbolClaims || []),
        ...(settlementResult.runezuSymbolClaims || []),
      ];
    }

    function isKnownScanEffectType(type) {
      if (!type) return false;
      const scanEffectTypes = new Set(Object.values(scanEffects.EFFECT_TYPES || {}));
      if (scanEffectTypes.has(type)) return true;

      const cardTypes = cardEffects.EFFECT_TYPES || {};
      const cardScanEffectTypes = [
        cardTypes.SCAN_NEBULA,
        cardTypes.SCAN_COLOR_CHOICE,
        cardTypes.PUBLIC_SCAN,
        cardTypes.ANY_SECTOR_SCAN,
        cardTypes.SCAN_ACTION,
        cardTypes.PROBE_SECTOR_SCAN,
        cardTypes.PLANET_SECTOR_SCAN,
        cardTypes.SECTOR_X_SCAN,
        cardTypes.DRAW_THEN_SCAN,
        cardTypes.OPTIONAL_DISCARD_SCAN,
        cardTypes.HAND_SCAN,
        cardTypes.LANDING_SECTOR_SCAN,
        cardTypes.CONDITIONAL_SECTOR_SCAN,
        cardTypes.YICHANGDIAN_NEXT_ANOMALY_SCAN,
        "card_color_scan",
      ].filter(Boolean);
      if (cardScanEffectTypes.includes(type)) return true;

      return [
        aomomo?.EFFECT_SCAN_AOMOMO_X,
        aomomo?.EFFECT_SCAN_AOMOMO_X_GAIN_FOSSIL,
        aomomo?.EFFECT_SCAN_AOMOMO_X_SCORE,
      ].filter(Boolean).includes(type);
    }

    function isScanRelatedEffect(effect) {
      if (!effect) return false;
      if (isKnownScanEffectType(effect.type)) return true;
      const abilityId = String(effect.abilityId || "").toLowerCase();
      return abilityId.includes("scan");
    }

    function executeScanActionFinalizeEffect(workingRoot, effect) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const scanRunId = effect.options?.scanRunId || getActionEffectFlow(workingRoot)?.scanRunId || null;
      const followups = buildScanFinalizeFollowupEffects(workingRoot, scanRunId, getActionEffectFlow(workingRoot));
      if (followups.length) {
        insertActionEffectsAfterCurrent(followups);
      }
      effect.result = {
        ok: true,
        undoable: true,
        message: followups.length
          ? `扫描收尾：追加 ${followups.length} 个后续效果`
          : "扫描收尾：没有待处理的扇区结算",
        payload: { inserted: followups.length, scanRunId },
      };
      rocketState.statusNote = effect.result.message;
      completeCurrentActionEffect(workingRoot);
      renderStateReadout();
      return effect.result;
    }

    function executeSectorFinishScanEffect(workingRoot, effect) {
      const { alienGameState, nebulaDataState, playerState, rocketState } = requireWorkingRoot(workingRoot);
      const sectorId = effect.options?.sectorId;
      if (!sectorId) {
        rocketState.statusNote = "完成扇区缺少扇区ID";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const beforeNebulaState = structuredClone(nebulaDataState);
      const beforeAlienState = structuredClone(alienGameState);
      beginEffectHistoryStep(workingRoot, effect.label, { effectType: scanEffects.EFFECT_TYPES.SECTOR_FINISH_SCAN });
      const result = data.settleSector(nebulaDataState, sectorId, {
        players: playerState.players,
        getPlayerTokenSrc: getNormalTokenAssetForPlayer,
        source: getActionEffectFlow(workingRoot)?.actionType || "scan",
      });
      if (!result.ok) {
        endEffectHistoryStep(workingRoot);
        if (effect.type === "aomomo_land_only") {
          return finishAutomaticRewardEffect(effect, {
            ok: true,
            skipped: true,
            undoable: true,
            message: `${effect.label}：无法登陆（${result.message}），已跳过`,
            payload: { failedMessage: result.message },
          }, [renderRockets, renderAlienPanels]);
        }
        rocketState.statusNote = result.message;
        renderStateReadout();
        return result;
      }

      const winner = resolveWorkingPlayerReference(workingRoot, result.winner || {});
      if (winner) {
        effect.options = {
          ...(effect.options || {}),
          targetPlayerId: winner.id || null,
          targetPlayerColor: winner.color || null,
          winnerPlayerId: winner.id || null,
          winnerPlayerColor: winner.color || null,
        };
        effect.playerId = winner.id || effect.playerId || null;
        effect.playerColor = winner.color || effect.playerColor || null;
        setActiveEffectFlowOwner(workingRoot, effect);
      }
      const claim = winner
        ? runezu?.claimSectorSymbol?.(alienGameState, result.sectorId, winner)
        : null;
      if (claim?.ok) {
        result.runezuSymbolClaims = [{
          sectorId: result.sectorId,
          playerId: winner.id,
          playerColor: winner.color,
          symbolId: claim.symbolId,
        }];
        result.message = `${result.message}；${claim.message}`;
      }

      recordHistoryCommand(workingRoot, historyCommands.createRestoreObjectCommand(
        nebulaDataState,
        beforeNebulaState,
        "恢复完成扇区前星云状态",
      ));
      recordHistoryCommand(workingRoot, historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复完成扇区前外星人状态",
      ));

      appendSectorSettlementResultToFlow(workingRoot, result);
      const rewardEffects = buildSectorSettlementRewardEffects(workingRoot, result);
      if (rewardEffects.length) {
        insertActionEffectsAfterCurrent(rewardEffects);
      }

      effect.result = {
        ok: true,
        undoable: true,
        message: rewardEffects.length
          ? `${result.message}；追加 ${rewardEffects.length} 个奖励效果`
          : result.message,
        events: [{
          type: "sectorCompleted",
          sectorId: result.sectorId,
          settlementNumber: result.settlementNumber,
          winnerPlayerId: result.winner?.playerId || null,
          winnerPlayerColor: result.winner?.playerColor || null,
        }],
        payload: { settlement: result, rewardCount: rewardEffects.length },
      };
      rocketState.statusNote = effect.result.message;
      renderSectorNebulaDataBoard();
      renderAlienPanels();
      renderPlayerStats();
      completeCurrentActionEffect(workingRoot);
      renderStateReadout();
      return effect.result;
    }

    function normalizeDelayedPublicRefillSlotIndexes(slots) {
      return (slots || [])
        .map((item) => Number(typeof item === "number" ? item : item?.slotIndex))
        .filter((slotIndex, index, list) => Number.isInteger(slotIndex) && list.indexOf(slotIndex) === index)
        .sort((a, b) => a - b);
    }

    function replenishDelayedPublicRefillSlots(workingRoot, scanRunId, slots, options = {}) {
      const { cardState, playerState } = requireWorkingRoot(workingRoot);
      const flow = options.flow || getActionEffectFlow(workingRoot);
      const slotIndexes = normalizeDelayedPublicRefillSlotIndexes(slots);
      if (!slotIndexes.length) {
        clearDelayedPublicRefillSlots(scanRunId, flow);
        return {
          ok: true,
          undoable: true,
          message: "公共牌区没有待补牌位",
          payload: { scanRunId, slots: [] },
        };
      }

      const publicCardsSnapshot = cardState.publicCards.slice();
      const discardPileSnapshot = (cardState.discardPile || []).slice();
      const hasEffectIndex = Object.prototype.hasOwnProperty.call(options, "effectIndex");
      beginEffectHistoryStep(workingRoot, options.label || "补充公共牌区", {
        effectIndex: hasEffectIndex ? options.effectIndex : getActionEffectFlow(workingRoot)?.currentIndex ?? null,
        effectType: scanEffects.EFFECT_TYPES.SCAN_PUBLIC_REFILL,
      });
      const replenished = [];
      for (const slotIndex of slotIndexes) {
        if (cardState.publicCards?.[slotIndex]) continue;
        const card = cards.replenishPublicSlot(cardState, playerState, slotIndex);
        if (card) replenished.push({ slotIndex, card });
      }
      recordHistoryCommand(workingRoot, historyCommands.createRestorePublicCardsCommand(
        cardState,
        publicCardsSnapshot,
        discardPileSnapshot,
      ));
      clearDelayedPublicRefillSlots(scanRunId, flow);

      const labels = replenished
        .map((item) => `${item.slotIndex + 1}:${cards.getCardLabel(item.card)}`)
        .join("、");
      return {
        ok: true,
        undoable: false,
        irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
        message: labels ? `公共牌区补牌：${labels}` : "公共牌区补牌：没有空位需要补牌",
        payload: { scanRunId, slots: slotIndexes, replenished },
      };
    }

    function executeScanPublicRefillEffect(workingRoot, effect) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const scanRunId = effect.options?.scanRunId || null;
      const result = replenishDelayedPublicRefillSlots(workingRoot, scanRunId, effect.options?.slots || [], {
        label: effect.label,
      });
      if (!normalizeDelayedPublicRefillSlotIndexes(effect.options?.slots || []).length) {
        effect.result = result;
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect(workingRoot);
        renderStateReadout();
        return effect.result;
      }
      return finishAutomaticRewardEffect(effect, result);
    }

    function settleDelayedPublicRefillsAfterScanFlow(workingRoot, flow) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const scanRunId = flow?.scanRunId || null;
      const slots = getDelayedPublicRefillSlots(scanRunId, flow);
      if (!slots.length) {
        return null;
      }
      const syntheticEffect = {
        type: scanEffects.EFFECT_TYPES.SCAN_PUBLIC_REFILL,
        label: "补充公共牌区",
        undoable: false,
      };
      const result = replenishDelayedPublicRefillSlots(workingRoot, scanRunId, slots, {
        flow,
        label: syntheticEffect.label,
        effectIndex: null,
      });
      syntheticEffect.result = result;
      endEffectHistoryStep(workingRoot, { effect: syntheticEffect, result });
      rocketState.statusNote = result.message;
      renderPublicCards();
      updatePublicCardControls();
      return result;
    }

    function buildEndOfFlowFollowupEffects(workingRoot, flow) {
      if (!flow || flow.actionType === "initialIncome") return [];
      const effects = [];
      const markedNebulaIds = getFlowMarkedNebulaIds(flow);
      if (markedNebulaIds.size) {
        effects.push(...buildReadySectorFinishEffects(workingRoot, { nebulaIds: markedNebulaIds }));
      }
      if (isScanRelatedEffectFlow(flow)) {
        const queuedSectorIds = new Set(effects.map((effect) => String(effect.options?.sectorId || "")));
        for (const effect of buildReadySectorFinishEffects(workingRoot)) {
          const sectorId = String(effect.options?.sectorId || "");
          if (queuedSectorIds.has(sectorId)) continue;
          queuedSectorIds.add(sectorId);
          effects.push(effect);
        }
      }
      return effects;
    }

    function shouldAppendQueuedSectorFinishEffects(workingRoot, flow) {
      if (!flow?.completed || flow.endOfFlowSettlementScheduled) return false;
      return buildEndOfFlowFollowupEffects(workingRoot, flow).length > 0;
    }

    function createEndOfFlowInsertionSource(flow) {
      if (!flow?.effects?.length) return null;
      const effectIndex = Number.isInteger(flow.currentIndex)
        ? flow.currentIndex
        : flow.effects.length - 1;
      const effect = flow.effects[effectIndex];
      if (!effect) return null;
      return {
        chainId: flow.chainId || null,
        effectIndex,
        effectId: effect.id || null,
        effectType: effect.type || effect.abilityId || null,
      };
    }

    function isEndOfFlowSettlementEffect(effect) {
      if (!effect) return false;
      if (effect.endOfFlowSettlement || effect.options?.endOfFlowSettlement) return true;
      return effect.type === scanEffects.EFFECT_TYPES.SECTOR_FINISH_SCAN
        && String(effect.id || "").startsWith("end-flow-followup-");
    }

    function pruneEndOfFlowSettlementEffectsAfterUndo(flow, effectIndex) {
      if (!flow?.effects?.length || !Number.isInteger(effectIndex)) return 0;
      let removed = 0;
      for (let index = flow.effects.length - 1; index > effectIndex; index -= 1) {
        if (!isEndOfFlowSettlementEffect(flow.effects[index])) continue;
        flow.effects.splice(index, 1);
        if (index < flow.currentIndex) {
          flow.currentIndex = Math.max(0, flow.currentIndex - 1);
        }
        removed += 1;
      }
      if (removed) {
        flow.endOfFlowSettlementScheduled = false;
      }
      return removed;
    }

    function appendEndOfFlowSectorFinishEffects(workingRoot, flow) {
      if (!shouldAppendQueuedSectorFinishEffects(workingRoot, flow)) return false;
      const effects = buildEndOfFlowFollowupEffects(workingRoot, flow);
      if (!effects.length) return false;
      flow.endOfFlowSettlementScheduled = true;
      flow.completed = false;
      const ownerId = flow.playerId || flow.defaultPlayerId || getActionEffectFlow(workingRoot)?.playerId || null;
      const insertionSource = createEndOfFlowInsertionSource(flow);
      for (const effect of effects) {
        const node = {
          ...assignEffectOwner({ ...effect }, ownerId),
          id: effect.id || `end-flow-followup-${flow.effects.length}`,
          endOfFlowSettlement: true,
          options: { ...(effect.options || {}), endOfFlowSettlement: true },
          status: "pending",
        };
        flow.effects.push(abilities.chain.markInsertedNode?.(node, insertionSource) || node);
      }
      activateNextActionEffect(workingRoot);
      return true;
    }

    function appendDeferredEndOfFlowEffects(flow) {
      if (!flow?.completed || flow.deferredEndEffectsFlushed) return false;
      const deferredEffects = Array.isArray(flow.deferredEndEffects)
        ? flow.deferredEndEffects.filter(Boolean)
        : [];
      flow.deferredEndEffects = [];
      flow.deferredEndEffectsFlushed = true;
      if (!deferredEffects.length) return false;

      const existingIds = new Set((flow.effects || []).map((effect) => effect?.id).filter(Boolean));
      const ownerId = flow.playerId || flow.defaultPlayerId || getActionEffectFlow(workingRoot)?.playerId || null;
      const effectsToAppend = deferredEffects.filter((effect) => !effect.id || !existingIds.has(effect.id));
      if (!effectsToAppend.length) return false;

      flow.completed = false;
      for (const effect of effectsToAppend) {
        flow.effects.push({
          ...assignEffectOwner({ ...effect }, ownerId),
          id: effect.id || `deferred-end-flow-${flow.effects.length}`,
          options: { ...(effect.options || {}) },
          status: "pending",
        });
      }
      activateNextActionEffect(workingRoot);
      return true;
    }

    function discardPublicScanCard(workingRoot, pending) {
      const { cardState, playerState } = requireWorkingRoot(workingRoot);
      if (discardPublicScanCardOverride) return discardPublicScanCardOverride(pending);
      const slotIndex = Number(pending?.publicSlotIndex);
      const card = pending?.card;
      if (!card || !Number.isInteger(slotIndex)) {
        return { ok: false, message: "没有可弃除的公共牌" };
      }

      const publicCardsSnapshot = cardState.publicCards.slice();
      const discardPileSnapshot = (cardState.discardPile || []).slice();

      cards.addToDiscardPile(cardState, card);
      let replenished = null;
      const deferPublicRefill = Boolean(pending?.deferPublicRefill && pending?.scanRunId);
      if (cardState.publicCards?.[slotIndex]?.id === card.id) {
        cardState.publicCards[slotIndex] = null;
        if (deferPublicRefill) {
          registerDelayedPublicRefill(workingRoot, pending.scanRunId, slotIndex, card);
        } else {
          replenished = cards.replenishPublicSlot(cardState, playerState, slotIndex);
        }
      }

      recordHistoryCommand(workingRoot, historyCommands.createRestorePublicCardsCommand(
        cardState,
        publicCardsSnapshot,
        discardPileSnapshot,
      ));

      renderPublicCards();
      updatePublicCardControls();
      return {
        ok: true,
        card,
        replenished,
        delayedRefill: deferPublicRefill,
        message: deferPublicRefill
          ? `弃除 ${cards.getCardLabel(card)}，公共区留空待扫描结束补牌`
          : replenished
          ? `弃除 ${cards.getCardLabel(card)}，公共区补牌：${cards.getCardLabel(replenished)}`
          : `弃除 ${cards.getCardLabel(card)}`,
      };
    }

    function discardHandScanCard(workingRoot, pending) {
      const { cardState } = requireWorkingRoot(workingRoot);
      const player = resolveWorkingPlayerReference(workingRoot, pending?.player || {})
        || getWorkingCurrentPlayer(workingRoot);
      const handIndex = Number(pending?.handIndex);
      const card = pending?.card;
      if (!player || !card || !Number.isInteger(handIndex)) {
        return { ok: false, message: "没有可弃除的手牌" };
      }

      const currentIndex = player.hand?.findIndex((item) => item.id === card.id);
      const discardIndex = currentIndex >= 0 ? currentIndex : handIndex;
      const handSnapshot = player.hand.slice();
      const discardPileSnapshot = (cardState.discardPile || []).slice();
      const discardResult = cards.discardFromHandAtIndex(player, discardIndex);
      if (!discardResult.ok) return discardResult;

      cards.addToDiscardPile(cardState, discardResult.card);
      recordHistoryCommand(workingRoot, historyCommands.createDiscardHandCardCommand(
        cardState,
        player,
        handSnapshot,
        discardPileSnapshot,
      ));
      renderPlayerStats();
      return {
        ok: true,
        card: discardResult.card,
        message: `弃除手牌 ${cards.getCardLabel(discardResult.card)}`,
      };
    }

    function finalizeScanSourceCard(workingRoot, pending, scanResult) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!scanResult?.ok) return scanResult;

      let discardResult = null;
      if (pending?.type === "public_scan") {
        discardResult = discardPublicScanCard(workingRoot, pending);
      } else if (pending?.type === "hand_scan") {
        discardResult = discardHandScanCard(workingRoot, pending);
      }

      if (discardResult?.ok) {
        rocketState.statusNote = `${scanResult.message}；${discardResult.message}`;
        renderPlayerStats();
        renderPublicCards();
        updatePublicCardControls();
        updateActionButtons();
        renderStateReadout();
        return {
          ...scanResult,
          discardedCard: discardResult.card,
          replenished: discardResult.replenished || null,
          message: rocketState.statusNote,
        };
      }

      return scanResult;
    }

    function restoreYichangdianCornerPickerIfPending(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (!getPendingYichangdianCornerAction()) return false;
      const result = openYichangdianCornerPicker();
      if (!result?.ok) {
        rocketState.statusNote = result?.message || "异常点：请完成角标选择";
        renderStateReadout();
      }
      return true;
    }

    function setScanTargetActionLayout(layoutClass = null) {
      if (!els.scanTargetActions) return;
      els.scanTargetActions.classList.remove(...SCAN_TARGET_ACTION_LAYOUT_CLASSES);
      if (layoutClass) els.scanTargetActions.classList.add(layoutClass);
    }

    function closeScanTargetPicker(workingRoot, options = {}) {
      requireWorkingRoot(workingRoot);
      if (!els.scanTargetOverlay) {
        uiRuntimeState.probeSectorSelectedRocketIds = [];
        delete workingRoot.match.strategySlotContinuation;
        return;
      }
      if (!options.forceYichangdianCornerClose && restoreYichangdianCornerPickerIfPending(workingRoot)) {
        return;
      }
      if (!options.preserveIndustryAction && getScanTargetDecision()?.type === "industry_remove_tech") {
        rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
        return;
      }
      delete workingRoot.match.cardTriggerContinuation;
      delete workingRoot.match.cardTaskCompletionContinuation;
      clearPendingAmibaCardGain();
      clearPendingAmibaSymbolChoice();
      clearPendingAmibaTraceRemoval();
      clearPendingAomomoCardGain();
      clearPendingRunezuCardGain();
      clearPendingRunezuSymbolBranch();
      clearPendingRunezuFaceSymbolPlacement();
      delete workingRoot.match.strategySlotContinuation;
      setScanTargetActionLayout();
      uiRuntimeState.probeSectorSelectedRocketIds = [];
      els.scanTargetOverlay.hidden = true;
      if (els.scanTargetCancel) {
        els.scanTargetCancel.hidden = false;
      }
      renderPlayerHand();
      syncInteractionFocusChrome();
    }

    function nebulaHasScannableData(workingRoot, nebulaId) {
      const { nebulaDataState } = requireWorkingRoot(workingRoot);
      return (data.listNebulaTokens(nebulaDataState, nebulaId) || []).length > 0;
    }

    function buildNebulaScanChoice(workingRoot, nebulaId, extra = {}) {
      const { nebulaDataState } = requireWorkingRoot(workingRoot);
      const nextToken = data.getNextReplaceableNebulaToken(nebulaDataState, nebulaId);
      const tokens = data.listNebulaTokens(nebulaDataState, nebulaId);
      const label = data.getNebulaLabel(nebulaId);
      const canScan = Boolean(nextToken || tokens.length);
      return {
        nebulaId,
        label: extra.label || label,
        description: extra.description || (nextToken
          ? `下一次替换槽位 ${nextToken.slotIndex}`
          : tokens.length
            ? "已无未替换数据：继续扫描会追加计数，不获得数据"
            : "该星云没有已填充数据"),
        disabled: !canScan,
        title: canScan
          ? (nextToken ? "" : "继续扫描会追加计数标记，不获得数据")
          : "需要先填充星云数据",
        ...extra,
      };
    }

    function isAomomoActive(workingRoot) {
      const { alienGameState, solarState } = requireWorkingRoot(workingRoot);
      return Boolean(solarState.aomomoActive && aomomo?.isAomomoRevealedSlot?.(
        alienGameState,
        alienGameState.aomomo?.revealedSlotId,
      ));
    }

    function getAomomoPlanetLocation(workingRoot) {
      const { solarState } = requireWorkingRoot(workingRoot);
      if (!solarState.aomomoActive) return null;
      return solar.createSolarSnapshot(solarState).planetLocations
        .find((planet) => planet.planetId === aomomo?.PLANET_ID) || null;
    }

    function getAomomoCurrentX(workingRoot) {
      const location = getAomomoPlanetLocation(workingRoot);
      return location ? solar.mod8(location.x) : null;
    }

    function getNebulaCurrentX(workingRoot, nebulaId) {
      const { solarState } = requireWorkingRoot(workingRoot);
      const found = solar.getNebulaLocations(solarState.sectorBySlot)
        .find((nebula) => nebula.id === nebulaId);
      return found ? solar.mod8(found.x) : null;
    }

    function getSectorScanTargetLabel(workingRoot, sectorX) {
      const { solarState } = requireWorkingRoot(workingRoot);
      const x = solar.mod8(sectorX);
      const nebula = solar.getNebulaAtCoordinate(x, 5, solarState.sectorBySlot);
      return nebula?.label || `扇区${x}`;
    }

    function buildAomomoScanChoiceForX(workingRoot, sectorX, extra = {}) {
      return buildNebulaScanChoice(workingRoot, aomomo.NEBULA_ID, {
        sectorX,
        label: extra.label || `扇区 ${sectorX}：奥陌陌`,
        descriptionPrefix: extra.descriptionPrefix,
        ...extra,
      });
    }

    function hasAomomoScanAtX(workingRoot, sectorX) {
      const currentX = getAomomoCurrentX(workingRoot);
      return isAomomoActive(workingRoot) && currentX != null && solar.mod8(sectorX) === currentX;
    }

    function buildSectorScanChoicesForX(workingRoot, sectorX) {
      const { solarState } = requireWorkingRoot(workingRoot);
      const x = solar.mod8(sectorX);
      const choices = [];
      const nebula = solar.getNebulaAtCoordinate(x, 5, solarState.sectorBySlot);
      if (nebula) {
        choices.push(buildNebulaScanChoice(workingRoot, nebula.id, {
          sectorX: x,
          label: `扇区 ${x}：${nebula.label}`,
        }));
      }
      if (hasAomomoScanAtX(workingRoot, x)) {
        choices.push(buildAomomoScanChoiceForX(workingRoot, x));
      }
      if (!choices.length) {
        choices.push({
          nebulaId: "",
          sectorX: x,
          label: `扇区 ${x}`,
          description: "当前没有星云",
          disabled: true,
        });
      }
      return choices;
    }

    function expandScanChoicesWithAomomoTargets(workingRoot, choices) {
      if (!isAomomoActive(workingRoot)) return choices;
      const next = [];
      const seenAomomo = new Set();
      for (const choice of choices || []) {
        next.push(choice);
        const sectorX = choice?.sectorX != null
          ? Number(choice.sectorX)
          : getNebulaCurrentX(workingRoot, choice?.nebulaId);
        if (sectorX == null || !hasAomomoScanAtX(workingRoot, sectorX)) continue;
        const key = solar.mod8(sectorX);
        if (seenAomomo.has(key) || choice.nebulaId === aomomo.NEBULA_ID) continue;
        seenAomomo.add(key);
        next.push(buildAomomoScanChoiceForX(workingRoot, key));
      }
      return next;
    }

    function openScanTargetPicker(workingRoot, config) {
      if (openScanTargetPickerOverride) return openScanTargetPickerOverride(workingRoot, config);
      config = config || {};
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        return { ok: false, message: "无法打开扫描目标选择" };
      }
      openScanTargetDecision(workingRoot, {
        ...getPendingOwnerFields(workingRoot, config.effect || null, config.player || null),
        ...config,
      });
      if (els.scanTargetTitle) {
        els.scanTargetTitle.textContent = config.title || "选择扫描目标";
      }
      if (els.scanTargetSubtitle) {
        els.scanTargetSubtitle.textContent = config.subtitle || "";
      }

      const choiceNodes = (config.choices || []).map((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.nebulaId = choice.nebulaId;
        if (choice.sectorX != null) button.dataset.sectorX = String(choice.sectorX);
        button.disabled = Boolean(choice.disabled);
        button.title = choice.title || "";
        button.innerHTML = `${choice.label}<small>${choice.description || ""}</small>`;
        return button;
      });
      if (config.discardDrawnOnSkip) {
        const skipButton = document.createElement("button");
        skipButton.type = "button";
        skipButton.className = "scan-target-option-button";
        skipButton.dataset.drawnHandScanSkip = "true";
        skipButton.innerHTML = "跳过<small>弃掉这张刚抽到的牌，不执行扫描。</small>";
        choiceNodes.push(skipButton);
      }
      els.scanTargetActions.replaceChildren(...choiceNodes);

      if (els.scanTargetCancel) {
        els.scanTargetCancel.hidden = true;
      }
      els.scanTargetOverlay.hidden = false;
      renderPlayerHand();
      return { ok: true, message: config.subtitle || "" };
    }

    function confirmScanTarget(workingRoot, nebulaId, sectorX, pendingContext = null) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      const pending = hydrateScanTargetDecision(workingRoot, pendingContext || getScanTargetDecision());
      return withPendingOwnerPlayer(workingRoot, pending, () => {
      closeScanTargetPicker(workingRoot, { preserveIndustryAction: true });

      if (pending?.type === "industry_remove_tech") {
        return confirmIndustryHeliosRemoveTech(nebulaId);
      }

      const scanSource = pending?.fromEffectFlow || isActionEffectFlowActive() ? "scan" : "debug";

      if (pending?.type === "sector_scan") {
        const cost = normalizeResourceCost(pending.cost) || {};
        if (Object.keys(cost).length && !players.canAfford(getWorkingCurrentPlayer(workingRoot), cost)) {
          const message = `${pending.title || "扇区扫描"}：资源不足，需要 ${players.formatResourceCost(cost)}，已跳过`;
          return skipActionEffectWithMessage(workingRoot, pending.effect || getCurrentActionEffect(workingRoot), message, {
            cost,
            sectorX,
          });
        }
        const repeat = Math.max(1, Math.round(Number(pending.repeat) || 1));
        if (repeat > 1) {
          const effects = Array.from({ length: repeat }, (_item, index) => ({
            id: `${pending.effect?.id || "selected-sector-scan"}-${index + 1}`,
            type: cardEffects.EFFECT_TYPES.SCAN_NEBULA,
            playerId: pending.playerId || null,
            playerColor: pending.playerColor || null,
            label: `${pending.title || "选定扇区扫描"} ${index + 1}/${repeat}`,
            icon: pending.effect?.icon || "scan",
            options: {
              nebulaId,
              sectorX,
              gainData: pending.gainData,
            },
          }));
          insertActionEffectsAfterCurrent(effects);
          const effect = pending.effect || getCurrentActionEffect(workingRoot);
          const result = {
            ok: true,
            undoable: true,
            message: `${pending.title || "选定扇区扫描"}：已选定扇区 ${sectorX}，追加 ${repeat} 次扫描`,
            payload: { nebulaId, sectorX, repeat },
            events: [],
          };
          if (effect) effect.result = result;
          rocketState.statusNote = result.message;
          completeCurrentActionEffect(workingRoot);
          renderStateReadout();
          return result;
        }
        let result = replaceNebulaDataForCurrentPlayer(workingRoot, nebulaId, {
          prefix: pending.title || (sectorX != null ? `扇区${sectorX}扫描` : "星云扫描"),
          source: scanSource,
          sectorX,
          gainData: pending.gainData,
          cost,
        });
        result = applyAomomoScanCostAndBonus(pending, result);
        if (result.ok && Number.isFinite(Number(pending.returnToHandIfSignalCount))) {
          maybeReturnPlayedCardToHandAfterSectorScan({
            options: { returnToHandIfSignalCount: pending.returnToHandIfSignalCount },
          }, sectorX);
        }
        maybeCompleteActionEffectFromScan(workingRoot, result);
        return result;
      }

      if (pending?.type === "public_scan") {
        if (pending.queueMode && pending.publicScanQueue) {
          const scanResult = replaceNebulaDataForCurrentPlayer(workingRoot, nebulaId, {
            prefix: `公共牌区扫描 ${cards.getCardLabel(pending.card)}`,
            source: scanSource,
            sectorX,
          });
          if (!scanResult.ok) {
            rocketState.statusNote = scanResult.message;
            renderSectors();
            renderStateReadout();
            return scanResult;
          }
          const queue = structuredClone(pending.publicScanQueue);
          if (!Array.isArray(queue.events)) queue.events = [];
          queue.events.push(...(scanResult.events || []));
          queue.currentIndex += 1;
          if (queue.currentIndex < queue.items.length) {
            rocketState.statusNote = scanResult.message;
            renderSectors();
            renderPlayerStats();
            updateActionButtons();
            renderStateReadout();
            openPublicScanNebulaPickerForCurrentQueueItem(workingRoot, queue);
            return scanResult;
          }
          closeScanTargetPicker(workingRoot);
          scanResult.events = queue.events.slice();
          rocketState.statusNote = scanResult.message;
          renderSectors();
          renderPlayerStats();
          updateActionButtons();
          renderStateReadout();
          maybeCompleteActionEffectFromScan(workingRoot, scanResult);
          return scanResult;
        }

        if (pending.deferPublicRefill && pending.scanRunId) {
          let scanResult = replaceNebulaDataForCurrentPlayer(workingRoot, nebulaId, {
            prefix: `公共牌区扫描 ${cards.getCardLabel(pending.card)}`,
            source: scanSource,
            sectorX,
          });
          if (!scanResult.ok) {
            rocketState.statusNote = scanResult.message;
            renderSectors();
            renderStateReadout();
            return scanResult;
          }
          scanResult = finalizeScanSourceCard(workingRoot, pending, scanResult);
          rocketState.statusNote = scanResult.message;
          renderSectors();
          renderPlayerStats();
          renderPublicCards();
          updatePublicCardControls();
          updateActionButtons();
          maybeCompleteActionEffectFromScan(workingRoot, scanResult);
          return scanResult;
        }

        beginEffectHistoryStep(workingRoot, `公共牌区扫描 ${cards.getCardLabel(pending.card)}`);
        const result = abilities.executeAbility("scanPublicCard", createActionContext(workingRoot), {
          nebulaId,
          prefix: `公共牌区扫描 ${cards.getCardLabel(pending.card)}`,
          source: scanSource,
          card: pending.card,
          publicSlotIndex: pending.publicSlotIndex,
        });
        if (!result.ok) {
          endEffectHistoryStep(workingRoot);
          rocketState.statusNote = result.message;
          renderSectors();
          renderStateReadout();
          return result;
        }
        enrichScanResultEvents(result, nebulaId, { sectorX });
        recordAbilityCommands(result, undefined, workingRoot);
        if (pending.irreversibleDraw) {
          result.undoable = false;
          result.irreversible = { code: "hidden_card_reveal", reason: "盲抽翻出新牌" };
          markCurrentActionIrreversible(result.irreversible.reason, result.irreversible.code);
        }
        rocketState.statusNote = result.message;
        renderSectors();
        renderPlayerStats();
        renderPublicCards();
        updatePublicCardControls();
        updateActionButtons();
        maybeCompleteActionEffectFromScan(workingRoot, result);
        return result;
      }

      if (pending?.type === "hand_scan") {
        beginEffectHistoryStep(workingRoot, `手牌扫描 ${cards.getCardLabel(pending.card)}`);
        const result = abilities.executeAbility("scanHandCard", createActionContext(workingRoot), {
          nebulaId,
          prefix: `手牌扫描 ${cards.getCardLabel(pending.card)}`,
          source: scanSource,
          card: pending.card,
          handIndex: pending.handIndex,
          player: pending.player,
        });
        if (!result.ok) {
          endEffectHistoryStep(workingRoot);
          rocketState.statusNote = result.message;
          renderSectors();
          renderStateReadout();
          return result;
        }
        enrichScanResultEvents(result, nebulaId, { sectorX });
        recordAbilityCommands(result, undefined, workingRoot);
        if (pending.irreversibleDraw) {
          result.undoable = false;
          result.irreversible = { code: "hidden_card_reveal", reason: "盲抽翻出新牌" };
          markCurrentActionIrreversible(result.irreversible.reason, result.irreversible.code);
        }
        rocketState.statusNote = result.message;
        renderSectors();
        renderPlayerStats();
        renderPublicCards();
        updatePublicCardControls();
        updateActionButtons();
        maybeCompleteActionEffectFromScan(workingRoot, result);
        return result;
      }

      return { ok: false, message: "没有待确认的扫描目标" };
      });
    }

    function findPendingHandScanCardIndex(player, pending) {
      const requestedIndex = Math.round(Number(pending?.handIndex));
      const cardId = pending?.card?.id;
      if (
        Number.isInteger(requestedIndex)
        && requestedIndex >= 0
        && player?.hand?.[requestedIndex]
        && (!cardId || player.hand[requestedIndex].id === cardId)
      ) {
        return requestedIndex;
      }
      if (!cardId) return -1;
      return player?.hand?.findIndex((card) => card.id === cardId) ?? -1;
    }

    function handleDrawnHandScanSkip(workingRoot, pendingContext = null) {
      const { cardState, rocketState } = requireWorkingRoot(workingRoot);
      const pending = hydrateScanTargetDecision(workingRoot, pendingContext || getScanTargetDecision());
      if (pending?.type !== "hand_scan" || !pending.discardDrawnOnSkip) {
        return { ok: false, message: "没有可跳过的盲抽弃牌扫描" };
      }
      const player = resolveWorkingPlayerReference(workingRoot, pending.player || {})
        || getWorkingCurrentPlayer(workingRoot);
      const handIndex = findPendingHandScanCardIndex(player, pending);
      if (handIndex < 0) {
        rocketState.statusNote = "找不到刚抽到的卡牌，无法跳过";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const effect = pending.effect || getCurrentActionEffect(workingRoot);
      closeScanTargetPicker(workingRoot);
      beginEffectHistoryStep(workingRoot, effect?.label || "跳过盲抽弃牌扫描");
      const discardResult = cards.discardFromHandAtIndex(player, handIndex);
      if (!discardResult.ok) {
        endEffectHistoryStep(workingRoot);
        rocketState.statusNote = discardResult.message;
        renderPlayerHand();
        renderStateReadout();
        return discardResult;
      }
      cards.addToDiscardPile(cardState, discardResult.card);
      markCurrentActionIrreversible("盲抽翻出新牌", "hidden_card_reveal");
      const message = `${effect?.label || "盲抽并弃牌扫描"}：跳过扫描，弃掉 ${cards.getCardLabel(discardResult.card)}`;
      const result = {
        ok: true,
        undoable: false,
        skipped: true,
        irreversible: { code: "hidden_card_reveal", reason: "盲抽翻出新牌" },
        message,
        payload: {
          cardId: discardResult.card.cardId || null,
          instanceId: discardResult.card.id || null,
          skipped: true,
        },
      };
      if (effect) effect.result = result;
      rocketState.statusNote = message;
      renderPlayerStats();
      renderPlayerHand();
      renderPublicCards();
      updatePublicCardControls();
      updateActionButtons();
      completeCurrentActionEffect(workingRoot);
      renderStateReadout();
      return result;
    }

    function beginSectorScan(workingRoot) {
      const { rocketState } = requireWorkingRoot(workingRoot);
      if (isCardSelectionActive() || isDiscardSelectionActive() || isPlayCardSelectionActive() || isTechTilePickingActive()) {
        rocketState.statusNote = "请先完成当前选择";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const choices = Array.from({ length: 8 }, (_item, x) => buildSectorScanChoicesForX(workingRoot, x)).flat();

      rocketState.statusNote = "扇区扫描：请选择 0-7 号扇区";
      renderStateReadout();
      return openScanTargetPicker(workingRoot, {
        type: "sector_scan",
        title: "扇区扫描",
        subtitle: "选择当前 0-7 号扇区中的一个星云；无可替换数据时追加扫描计数且不获得数据。",
        choices,
      });
    }

    function getSectorOpenDataCount(workingRoot, sectorId) {
      const { nebulaDataState } = requireWorkingRoot(workingRoot);
      return data.listNebulaTokens(nebulaDataState, sectorId)
        .filter((token) => !token.replacedByPlayerColor && !token.playerColor)
        .length;
    }

    function getSectorCapacity(sectorId) {
      return data.getNebulaCapacity(sectorId);
    }

    function getSectorReplacedCount(workingRoot, sectorId) {
      return getSectorCapacity(sectorId) - getSectorOpenDataCount(workingRoot, sectorId);
    }

    function getSectorExtraMarkCount(workingRoot, sectorId) {
      const { nebulaDataState } = requireWorkingRoot(workingRoot);
      return typeof data.listSectorExtraMarks === "function"
        ? data.listSectorExtraMarks(nebulaDataState, sectorId).length
        : 0;
    }

    function getSectorNebulaLabelText(sectorId) {
      return data.getNebulaLabel(sectorId);
    }

    function getPublicScanChoicesForCard(workingRoot, card) {
      if (getPublicScanChoicesForCardOverride) return getPublicScanChoicesForCardOverride(card);
      const scanCode = Number(card?.scanActionCode);
      const nebulaIds = PUBLIC_SCAN_TARGETS_BY_CODE[scanCode];
      if (!nebulaIds) {
        return {
          ok: false,
          message: `无法识别卡牌右上角扫描效果：${cards.getCardLabel(card) || "未知卡牌"}`,
        };
      }

      return {
        ok: true,
        scanCode,
        scanLabel: PUBLIC_SCAN_CODE_LABELS[scanCode] || `扫描${scanCode}`,
        choices: expandScanChoicesWithAomomoTargets(
          workingRoot,
          nebulaIds.map((nebulaId) => buildNebulaScanChoice(workingRoot, nebulaId)),
        ),
      };
    }

    function hasHandScanTargetCard(workingRoot, player) {
      return (player?.hand || []).some((card) => card && getPublicScanChoicesForCard(workingRoot, card).ok);
    }

    function getPublicScanIconForScanCode(scanCode) {
      switch (Number(scanCode)) {
        case 0:
          return "yellow_scan";
        case 1:
          return "red_scan";
        case 2:
          return "blue_scan";
        case 3:
          return "black_scan";
        default:
          return "scan";
      }
    }

    function createPublicScanPendingAction(workingRoot, player, fromEffectFlow = false, options = {}) {
      const { cardState } = requireWorkingRoot(workingRoot);
      const requestedMaxSelectable = Math.max(
        1,
        Math.round(Number(options.maxSelectable || getPublicScanMaxSelectable(workingRoot, player))),
      );
      const filledSlots = cardState.publicCards.filter(Boolean).length;
      const maxSelectable = Math.min(requestedMaxSelectable, Math.max(1, filledSlots));
      const minSelectable = Math.min(
        maxSelectable,
        Math.max(1, Math.round(Number(options.minSelectable || 1))),
      );
      return {
        type: "public_scan",
        player,
        allowBlindDraw: false,
        fromEffectFlow,
        scanRunId: options.scanRunId || null,
        deferPublicRefill: Boolean(options.deferPublicRefill),
        freeAdditionalPublicScans: Boolean(options.freeAdditionalPublicScans),
        maxSelectable,
        minSelectable,
        selectedSlots: [],
      };
    }

    function beginPublicDeckScan(workingRoot) {
      return beginCardSelection(createPublicScanPendingAction(workingRoot, getWorkingCurrentPlayer(workingRoot)));
    }

    function executeMainScanAction(workingRoot, descriptor) {
      const actionRocketState = workingRoot.rocketState;
      const reject = (message, result = null) => {
        actionRocketState.statusNote = message;
        renderStateReadout();
        return result || { ok: false, message };
      };
      if (!context.canStartMainAction()) {
        return reject(context.getMainActionStartBlockReason() || "本回合已经开始或完成主要行动");
      }
      const pendingReason = [
        [isActionEffectFlowActive(), "请先完成当前行动的效果"],
        [isTechTilePickingActive(), "请先完成科技选择"],
        [isCardSelectionActive(), "请先完成精选"],
        [isDiscardSelectionActive(), "请先完成弃牌"],
        [isPlayCardSelectionActive(), "请先完成打牌"],
        [isMovePaymentSelectionActive(), "请先完成移动"],
        [isHandScanSelectionActive(workingRoot), "请先完成手牌扫描"],
      ].find(([active]) => active)?.[1];
      if (pendingReason) return reject(pendingReason);

      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const check = scanEffects.canExecuteScan(currentPlayer, { standardAction: true });
      if (!check.ok) return reject(check.message, check);

      context.startActionLogDraft("scan", "扫描行动", {
        source: context.HISTORY_SOURCE_MAIN,
        player: currentPlayer,
      });
      context.actionHistory.beginSession("scan", "扫描行动");
      context.actionHistory.beginStep({
        source: context.HISTORY_SOURCE_MAIN,
        type: "action-cost",
        label: "扫描费用",
      });
      let costResult = abilities.executeAbility(
        "payScanCost",
        createActionContext(workingRoot, descriptor),
        { cost: scanEffects.getStandardScanCost(currentPlayer) },
      );
      if (!costResult.ok) {
        context.actionHistory.rollbackSession();
        context.clearHistoryStepOrderForSource(context.HISTORY_SOURCE_MAIN);
        context.removeActionLogStepsBySource(context.HISTORY_SOURCE_MAIN);
        return reject(costResult.message, costResult);
      }
      costResult = context.maybeConsumeAlienLabPanelForMainAction("scan", costResult, currentPlayer);
      recordAbilityCommands(costResult, undefined, workingRoot);
      const costStep = context.actionHistory.endStep();
      if (costStep) {
        context.rememberHistoryStep(context.HISTORY_SOURCE_MAIN, costStep.id);
        context.appendActionLogStep(
          context.HISTORY_SOURCE_MAIN,
          costStep.label,
          costResult.message,
          context.actionLogOptionsFromHistoryStep(costStep),
        );
      }
      const scanRunId = context.createScanRunId("main-scan");
      workingRoot.match.actionEffectFlow = abilities.chain.startAbilityChain(
        "scan",
        "扫描行动",
        scanEffects.buildScanEffectQueue(currentPlayer, {
          includeFinalize: true,
          fullScanAction: true,
          scanRunId,
          turnState: workingRoot.turnState,
          roundNumber: workingRoot.turnState.roundNumber,
          turnNumber: workingRoot.turnState.turnNumber,
        }),
      );
      getActionEffectFlow(workingRoot).playerId = currentPlayer.id;
      context.assignEffectFlowOwner(getActionEffectFlow(workingRoot), currentPlayer.id);
      getActionEffectFlow(workingRoot).scanRunId = scanRunId;
      getActionEffectFlow(workingRoot).scanActionEvent = {
        type: "scanAction",
        source: "main",
        scanRunId,
        playerId: currentPlayer.id,
      };
      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      actionRocketState.statusNote = "扫描：请依次点击能力效果";
      renderPlayerStats();
      activateNextActionEffect(workingRoot);
      return {
        ok: true,
        message: actionRocketState.statusNote,
        cost: costResult.cost || {},
        history: costResult.commands || [],
        effects: structuredClone(getActionEffectFlow(workingRoot).effects || []),
      };
    }
    function launchRocketForScanAction4(workingRoot) {
      requireWorkingRoot(workingRoot);
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const currentEffect = context.getCurrentActionEffect(workingRoot);
      const skipCost = Boolean(currentEffect?.options?.skipCost);
      if (!skipCost && !players.canAfford(currentPlayer, { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY })) {
        return { ok: false, message: "能量不足，发射需要 1 能量" };
      }
      context.beginEffectHistoryStep(workingRoot, "发射/移动");
      const result = abilities.executeAbility("scanAction4", context.createActionContext(workingRoot), {
        choice: "launch",
        skipCost,
        cost: skipCost ? {} : { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY },
      });
      if (!result.ok) {
        context.endEffectHistoryStep(workingRoot);
        return result;
      }
      context.maybeApplyIndustryLaunchScan(result);
      context.recordAbilityCommands(result, context.actionHistory, workingRoot);
      context.renderRocketElement(result.rocket);
      const current = context.getCurrentActionEffect(workingRoot);
      if (current) current.result = result;
      return result;
    }

    function beginScanAction4FreeMove(workingRoot) {
      requireWorkingRoot(workingRoot);
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const rockets = context.getMovableTokensForWorkingRoot(workingRoot, currentPlayer?.id);
      if (!rockets.length) {
        workingRoot.rocketState.statusNote = "没有可移动的飞船";
        context.renderStateReadout();
        return { ok: false, message: workingRoot.rocketState.statusNote };
      }
      context.openPendingDecision(workingRoot, "scan_free_move", {
        effectId: context.getCurrentActionEffect(workingRoot)?.id || null,
        playerId: currentPlayer?.id || null,
      });
      workingRoot.rocketState.statusNote = rockets.length > 1
        ? "扫描效果：请点击要移动的飞船"
        : "扫描效果：使用方向键移动飞船";
      if (rockets.length === 1) context.activateMoveMode(workingRoot, rockets[0].id);
      else context.selectDefaultRocketForCurrentPlayer(workingRoot);
      context.renderStateReadout();
      return { ok: true, message: workingRoot.rocketState.statusNote };
    }

    function executeFreeMoveForScanAction4(workingRoot, deltaX, deltaY, rocketId, payment = {}) {
      requireWorkingRoot(workingRoot);
      const { playerState, rocketState } = workingRoot;
      const moveCheck = context.rocketActions.canMoveRocket(rocketState, rocketId, deltaX, deltaY);
      if (!moveCheck.ok) {
        rocketState.statusNote = moveCheck.message;
        context.renderStateReadout();
        return moveCheck;
      }
      const currentPlayer = players.getCurrentPlayer(playerState);
      const providedMovePoints = Math.max(0, Math.round(Number(payment.providedMovePoints ?? 1) || 0));
      const terrainRequired = Number.isFinite(Number(payment.terrainRequired))
        ? Math.max(1, Math.round(Number(payment.terrainRequired)))
        : context.getRequiredMovePointsForWorkingRoot(workingRoot, currentPlayer, rocketId, deltaX, deltaY);
      if (!payment.fromMovePayment && providedMovePoints < terrainRequired) {
        return context.beginSupplementalMovePayment(workingRoot, {
          deltaX,
          deltaY,
          rocketId,
          terrainRequired,
          providedMovePoints,
          context: { type: "scan_action_4", terrainRequired },
          message: `发射/移动：已有 ${providedMovePoints} 点移动力，还需 ${terrainRequired - providedMovePoints} 点（可弃移动牌或用能量）`,
        });
      }
      const energyCost = Math.max(0, Math.round(Number(payment.energyCost) || 0));
      context.beginEffectHistoryStep(workingRoot, "发射/移动");
      const result = abilities.executeAbility("scanAction4", context.createActionContext(workingRoot), {
        choice: "move",
        cost: energyCost > 0 ? { energy: energyCost } : {},
        movementPoints: Math.max(terrainRequired, providedMovePoints + energyCost),
        rocketId,
        deltaX,
        deltaY,
      });
      if (result.rocket) context.renderRocketElement(result.rocket);
      if (!result.ok) {
        if (payment.discardCommand) payment.discardCommand.undo();
        context.endEffectHistoryStep(workingRoot);
        rocketState.statusNote = result.message;
        context.renderStateReadout();
        return result;
      }
      if (payment.discardCommand) context.recordHistoryCommand(workingRoot, payment.discardCommand);
      context.recordAbilityCommands(result, context.actionHistory, workingRoot);
      context.deactivateMoveMode(workingRoot);
      const current = context.getCurrentActionEffect(workingRoot);
      if (current) current.result = result;
      rocketState.statusNote = `扫描效果：${result.message}`;
      context.renderPlayerStats();
      context.completeCurrentActionEffect(workingRoot);
      context.renderStateReadout();
      return result;
    }

    return {
      executeMainScanAction,
      launchRocketForScanAction4,
      beginScanAction4FreeMove,
      executeFreeMoveForScanAction4,
      getPublicScanBonusSelectableCount,
      getPublicScanMaxSelectable,
      getPublicScanMinSelectable,
      getPublicScanSelectionInstruction,
      ensureDelayedPublicRefills,
      registerDelayedPublicRefill,
      getDelayedPublicRefillSlots,
      clearDelayedPublicRefillSlots,
      cloneDelayedPublicRefills,
      buildReadySectorFinishEffects,
      buildSectorSettlementRewardEffects,
      buildScanFinalizeFollowupEffects,
      isExhaustedNebulaScanMessage,
      replaceNebulaDataForCurrentPlayer,
      getSectorFinishIcon,
      getSectorFinishWinnerTarget,
      appendSectorSettlementResultToFlow,
      getSectorWinnerRewardKey,
      createTargetResourceEffect,
      createTargetPinkTraceEffect,
      isKnownScanEffectType,
      isScanRelatedEffect,
      isScanRelatedEffectFlow,
      executeScanActionFinalizeEffect,
      executeSectorFinishScanEffect,
      normalizeDelayedPublicRefillSlotIndexes,
      replenishDelayedPublicRefillSlots,
      executeScanPublicRefillEffect,
      settleDelayedPublicRefillsAfterScanFlow,
      buildEndOfFlowFollowupEffects,
      shouldAppendQueuedSectorFinishEffects,
      createEndOfFlowInsertionSource,
      isEndOfFlowSettlementEffect,
      pruneEndOfFlowSettlementEffectsAfterUndo,
      appendEndOfFlowSectorFinishEffects,
      appendDeferredEndOfFlowEffects,
      discardPublicScanCard,
      discardHandScanCard,
      finalizeScanSourceCard,
      restoreYichangdianCornerPickerIfPending,
      setScanTargetActionLayout,
      closeScanTargetPicker,
      nebulaHasScannableData,
      buildNebulaScanChoice,
      isAomomoActive,
      getAomomoPlanetLocation,
      getAomomoCurrentX,
      getNebulaCurrentX,
      getSectorScanTargetLabel,
      buildAomomoScanChoiceForX,
      hasAomomoScanAtX,
      buildSectorScanChoicesForX,
      expandScanChoicesWithAomomoTargets,
      openScanTargetPicker,
      confirmScanTarget,
      findPendingHandScanCardIndex,
      handleDrawnHandScanSkip,
      beginSectorScan,
      getSectorOpenDataCount,
      getSectorCapacity,
      getSectorReplacedCount,
      getSectorExtraMarkCount,
      getSectorNebulaLabelText,
      getPublicScanChoicesForCard,
      hasHandScanTargetCard,
      getPublicScanIconForScanCode,
      createPublicScanPendingAction,
      beginPublicDeckScan,
      beginPublicScanForSingleCard,
      openPublicScanNebulaPickerForCurrentQueueItem,
      confirmPublicScanSelection,
      handlePublicScanCardClick,
      beginHandScan,
      cancelHandScanSelection,
      handleHandScanCardClick,
    };
  }

  function createSectorSettlementRuntime(context = {}) {
    const HISTORY_SOURCE_MAIN = context.HISTORY_SOURCE_MAIN || "main";
    const { data = {}, players = {}, aomomo = null, runezu = null, historyCommands = {} } = context;

    function resolveCompletedSectorSettlementsForRoot(workingRoot, actionType, options = {}) {
      if (typeof data.settleCompletedSectors !== "function") return null;
      const { nebulaDataState, playerState, alienGameState } = workingRoot;
      const beforeNebulaState = structuredClone(nebulaDataState);
      const beforePlayerState = structuredClone(playerState);
      const beforeAlienState = structuredClone(alienGameState);
      const result = data.settleCompletedSectors(nebulaDataState, {
        players: playerState.players,
        getPlayerTokenSrc: context.getNormalTokenAssetForPlayer,
        source: actionType || "mainAction",
      });
      if (!result.ok) return null;

      const awarded = new Set();
      const participantAwardLabels = new Set();
      for (const settlement of result.settlements || []) {
        const isAomomoSettlement = settlement.sectorId === aomomo?.NEBULA_ID;
        for (const participant of settlement.participants || []) {
          const player = playerState.players.find((item) => item.id === participant.playerId)
            || playerState.players.find((item) => item.color === participant.playerColor);
          if (!player) continue;
          const awardKey = `${settlement.sectorId}:${player.id}`;
          if (awarded.has(awardKey)) continue;
          awarded.add(awardKey);
          if (isAomomoSettlement) {
            players.gainResources(player, { aomomoFossils: 1 });
            participantAwardLabels.add("奥陌陌参与结算玩家各获得1化石");
          } else {
            players.gainResources(player, { publicity: 1 });
            participantAwardLabels.add("参与结算玩家各获得1宣传");
          }
        }
        const winner = playerState.players.find((item) => item.id === settlement.winner?.playerId)
          || playerState.players.find((item) => item.color === settlement.winner?.playerColor);
        const claim = winner
          ? runezu?.claimSectorSymbol?.(alienGameState, settlement.sectorId, winner)
          : null;
        if (claim?.ok) {
          if (!Array.isArray(result.runezuSymbolClaims)) result.runezuSymbolClaims = [];
          result.runezuSymbolClaims.push({
            sectorId: settlement.sectorId,
            playerId: winner.id,
            playerColor: winner.color,
            symbolId: claim.symbolId,
          });
        }
      }
      result.participantAwardMessage = [...participantAwardLabels].join("；") || "无参与奖励";

      const source = options.historySource || HISTORY_SOURCE_MAIN;
      const history = context.getHistoryForSource?.(source);
      if (history?.hasSession?.()) {
        history.beginStep({ source, type: "sector_settlement", label: "扇区结算" });
        history.record(historyCommands.createRestoreObjectCommand(
          nebulaDataState, beforeNebulaState, "恢复扇区结算前星云状态",
        ));
        history.record(historyCommands.createRestoreObjectCommand(
          playerState, beforePlayerState, "恢复扇区结算前玩家状态",
        ));
        history.record(historyCommands.createRestoreObjectCommand(
          alienGameState, beforeAlienState, "恢复扇区结算前外星人状态",
        ));
        const step = history.endStep();
        if (step) {
          context.rememberHistoryStep?.(source, step.id);
          context.appendActionLogStep?.(
            source,
            step.label,
            `${result.message}；${result.participantAwardMessage}`
              + `${result.runezuSymbolClaims?.length ? `；符文族symbol ${result.runezuSymbolClaims.length}个` : ""}`,
            context.actionLogOptionsFromHistoryStep?.(step),
          );
        }
      }
      context.renderSectorNebulaDataBoard?.();
      context.renderPlayerStats?.();
      context.renderAlienPanels?.();
      return result;
    }

    return Object.freeze({ resolveCompletedSectorSettlementsForRoot });
  }

  function createScanDecisionPort(context = {}) {
    const { inspectComposition, submitActiveDecision } = context;
    if (typeof inspectComposition !== "function" || typeof submitActiveDecision !== "function") {
      throw new TypeError("scan decision port requires composition inspection and decision submission");
    }

    function executeFreeMove(deltaX, deltaY, rocketId) {
      const direction = deltaX === 1 ? "cw" : deltaX === -1 ? "ccw" : deltaY === 1 ? "out" : "in";
      return submitActiveDecision(
        "scan-free-move",
        (target) => Number(target.rocketId) === Number(rocketId) && target.direction === direction,
      );
    }

    function confirmScanTarget(nebulaId, sectorX) {
      const choiceTarget = (inspectComposition()?.session?.decision?.choices || [])
        .map((choice) => choice?.target || choice?.standardAction?.target || null)
        .find((target) => (
          ["scan-target", "sector-scan-target"].includes(target?.kind)
          && String(target.nebulaId) === String(nebulaId)
          && (sectorX == null || String(target.sectorX) === String(sectorX))
        ));
      if (!choiceTarget) {
        return { ok: false, code: "SCAN_DECISION_REQUIRED", message: "当前扫描目标不在 active Decision 合法项中" };
      }
      return submitActiveDecision(
        choiceTarget.kind,
        (target) => String(target.nebulaId) === String(nebulaId)
          && (sectorX == null || String(target.sectorX) === String(sectorX)),
      );
    }

    const skipDrawnHandScan = () => submitActiveDecision("skip-drawn-hand-scan", () => true);

    return Object.freeze({ executeFreeMove, confirmScanTarget, skipDrawnHandScan });
  }

  return {
    BROWSER_STATIC_DEPENDENCY_KEYS,
    BROWSER_STATIC_CONSTANT_KEYS,
    createBrowserScanFlow,
    createBrowserScanStaticContext,
    createScanFlowHelpers,
    createScanAction4Picker,
    createSectorSettlementRuntime,
    buildSectorScanChoicesForXs,
    createProbeDecisionPort,
    createScanDecisionPort,
  };
});
