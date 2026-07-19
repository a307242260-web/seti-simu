(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppScanFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function requireFunction(name, fn) {
    if (typeof fn !== "function") {
      throw new Error(`createScanFlowHelpers requires function: ${name}`);
    }
    return fn;
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

    const pendingState = context.pendingState || {};
    const decisionState = context.decisionSessions?.createFacade?.({
      discardAction: "discard_action",
      cardSelectionAction: "card_selection_action",
      scanTargetAction: "scan_target_action",
      handScanAction: "hand_scan_action",
      alienTraceAction: "alien_trace_action",
      alienTracePickerState: "alien_trace_picker_state",
      alienRevealConfirmation: "alien_reveal_confirmation",
      actionEffectFlow: "action_effect_flow",
    }) || {};
    const decisionSessions = context.decisionSessions;
    const PUBLIC_SCAN_QUEUE_SESSION = "public_scan_queue";
    const getPublicScanQueue = () => decisionSessions.peek(PUBLIC_SCAN_QUEUE_SESSION);
    const cardState = context.cardState || {};
    const nebulaDataState = context.nebulaDataState || {};
    const alienGameState = context.alienGameState || {};
    const solarState = context.solarState || {};
    const rocketState = context.rocketState || {};
    const playerState = context.playerState || {};
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

    const getCurrentPlayer = requireFunction("getCurrentPlayer", context.getCurrentPlayer);
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
    const resolvePlayerReference = requireFunction("resolvePlayerReference", context.resolvePlayerReference);
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

    function getCardLabel(card) {
      return typeof cards.getCardLabel === "function" ? cards.getCardLabel(card) : String(card?.cardName || card?.id || "");
    }

    function setSelectionActive(active) {
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

    function getPublicScanMaxSelectable(player) {
      const filledSlots = (cardState.publicCards || []).filter(Boolean).length;
      return Math.min(1 + getPublicScanBonusSelectableCount(player), 3, filledSlots);
    }

    function getPublicScanMinSelectable(pending = decisionState.cardSelectionAction) {
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

    function ensureDelayedPublicRefills(flow = decisionState.actionEffectFlow) {
      if (!flow) return [];
      if (!Array.isArray(flow.delayedPublicRefills)) {
        flow.delayedPublicRefills = [];
      }
      return flow.delayedPublicRefills;
    }

    function registerDelayedPublicRefill(scanRunId, slotIndex, card) {
      if (!scanRunId || !decisionState.actionEffectFlow) return null;
      const index = Number(slotIndex);
      if (!Number.isInteger(index)) return null;
      const list = ensureDelayedPublicRefills(decisionState.actionEffectFlow);
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

    function getDelayedPublicRefillSlots(scanRunId, flow = decisionState.actionEffectFlow) {
      return ensureDelayedPublicRefills(flow)
        .filter((item) => !scanRunId || item.scanRunId === scanRunId)
        .map((item) => ({ ...item }));
    }

    function clearDelayedPublicRefillSlots(scanRunId, flow = decisionState.actionEffectFlow) {
      if (!flow || !Array.isArray(flow.delayedPublicRefills)) return;
      flow.delayedPublicRefills = flow.delayedPublicRefills
        .filter((item) => scanRunId && item.scanRunId !== scanRunId);
    }

    function cloneDelayedPublicRefills(flow = decisionState.actionEffectFlow) {
      return Array.isArray(flow?.delayedPublicRefills)
        ? flow.delayedPublicRefills.map((item) => ({ ...item }))
        : [];
    }

    function getSectorFinishIcon(sectorId) {
      return SECTOR_FINISH_ICON_BY_COLOR[data.getNebulaColor?.(sectorId)] || "sector_finish_scan";
    }

    function getSectorFinishWinnerTarget(sectorId) {
      if (!sectorId || sectorId === aomomo?.NEBULA_ID) return null;
      const winner = data.getSectorRanking?.(nebulaDataState, sectorId)
        ?.find((entry) => Number(entry?.count) > 0) || null;
      const player = winner ? resolvePlayerReference(winner) : null;
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

    function buildReadySectorFinishEffects(options = {}) {
      const sectorFilter = options.nebulaIds
        ? new Set([...options.nebulaIds].map((sectorId) => String(sectorId)))
        : null;
      return (data.NEBULA_IDS || [])
        .filter((sectorId) => (!sectorFilter || sectorFilter.has(String(sectorId))))
        .filter((sectorId) => data.isSectorReadyToSettle(nebulaDataState, sectorId))
        .map((sectorId) => {
          const target = getSectorFinishWinnerTarget(sectorId);
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

    function buildSectorSettlementRewardEffects(settlement) {
      if (!settlement?.ok) return [];
      const sectorLabel = data.getNebulaLabel(settlement.sectorId);
      const effects = [];
      const participants = settlement.participants || [];

      if (settlement.sectorId === aomomo?.NEBULA_ID) {
        for (const participant of participants) {
          const player = resolvePlayerReference(participant);
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
        const player = resolvePlayerReference(participant);
        if (!player) continue;
        effects.push(createTargetResourceEffect(
          `sector-${settlement.sectorId}-publicity-${player.id}-${settlement.settlementNumber}`,
          `${sectorLabel}参与奖励：${player.colorLabel || player.name} +1宣传`,
          "publicity",
          player,
          { publicity: 1 },
        ));
      }

      const winner = resolvePlayerReference(settlement.winner || {});
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

    function buildScanFinalizeFollowupEffects(_scanRunId, flow = decisionState.actionEffectFlow) {
      return [
        ...buildReadySectorFinishEffects({ nebulaIds: getFlowMarkedNebulaIds(flow) }),
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

    function beginPublicScanForSingleCard(index, card, optionsOrFromEffectFlow = false) {
      const options = typeof optionsOrFromEffectFlow === "object"
        ? optionsOrFromEffectFlow
        : { fromEffectFlow: Boolean(optionsOrFromEffectFlow) };
      const scanChoices = getPublicScanChoicesForCard(card);
      if (!scanChoices.ok) {
        rocketState.statusNote = scanChoices.message;
        renderStateReadout();
        return scanChoices;
      }

      decisionState.cardSelectionAction = null;
      setSelectionActive(false);
      syncCardSelectionChrome();
      rocketState.statusNote = `公共牌区扫描：${getCardLabel(card)}，请选择${scanChoices.scanLabel}目标`;
      renderStateReadout();
      return openScanTargetPicker({
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

    function openPublicScanNebulaPickerForCurrentQueueItem() {
      const queue = getPublicScanQueue();
      if (!queue) return { ok: false, message: "没有待扫描的公共牌" };
      const item = queue.items[queue.currentIndex];
      if (!item) return { ok: false, message: "没有待扫描的公共牌" };

      const { card, scanChoices, publicSlotIndex } = item;
      const total = queue.items.length;
      const current = queue.currentIndex + 1;
      return openScanTargetPicker({
        type: "public_scan",
        card,
        publicSlotIndex,
        scanCode: scanChoices.scanCode,
        fromEffectFlow: queue.fromEffectFlow,
        queueMode: true,
        scanRunId: queue.scanRunId || null,
        deferPublicRefill: Boolean(queue.deferPublicRefill),
        title: "公共牌区扫描",
        subtitle: total > 1
          ? `第 ${current}/${total} 张：${getCardLabel(card)}，${scanChoices.scanLabel}，请选择 2 选 1 星云。`
          : `${getCardLabel(card)}：${scanChoices.scanLabel}，请选择 2 选 1 星云。`,
        choices: scanChoices.choices,
      });
    }

    function confirmPublicScanSelection() {
      const pending = decisionState.cardSelectionAction;
      if (pending?.type !== "public_scan") {
        return { ok: false, message: "当前不是公共牌区扫描" };
      }

      const selectedSlots = [...(pending.selectedSlots || [])].sort((a, b) => a - b);
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
        const scanChoices = getPublicScanChoicesForCard(card);
        if (!scanChoices.ok) {
          rocketState.statusNote = scanChoices.message;
          renderStateReadout();
          return scanChoices;
        }
        items.push({ card, publicSlotIndex: slotIndex, scanChoices });
      }

      const player = pending.player || getCurrentPlayer();
      const extraUsed = pending.freeAdditionalPublicScans ? 0 : selectedSlots.length - 1;
      if (extraUsed > 0 && !players.canAfford(player, { additionalPublicScan: extraUsed })) {
        rocketState.statusNote = `额外公共扫描不足，需要 ${extraUsed} 个`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const fromEffectFlow = Boolean(pending.fromEffectFlow || decisionState.actionEffectFlow);
      decisionState.cardSelectionAction = null;
      setSelectionActive(false);
      syncCardSelectionChrome();

      if (fromEffectFlow) {
        beginEffectHistoryStep("公共牌区扫描");
      }

      if (extraUsed > 0) {
        players.spendResources(player, { additionalPublicScan: extraUsed });
        recordHistoryCommand(historyCommands.createResourceSpendCommand(
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
        discardPublicScanCard({
          card: item.card,
          publicSlotIndex: slotIndex,
          scanRunId: pending.scanRunId || null,
          deferPublicRefill: Boolean(pending.deferPublicRefill),
        });
      }

      decisionSessions.open(PUBLIC_SCAN_QUEUE_SESSION, {
        items,
        currentIndex: 0,
        fromEffectFlow,
        scanRunId: pending.scanRunId || null,
        deferPublicRefill: Boolean(pending.deferPublicRefill),
      });
      rocketState.statusNote = `公共牌区扫描：已弃除 ${items.length} 张牌，请依次选择星云`;
      renderPlayerStats();
      renderPublicCards();
      updatePublicCardControls();
      updateActionButtons();
      renderStateReadout();
      return openPublicScanNebulaPickerForCurrentQueueItem();
    }

    function handlePublicScanCardClick(slotIndex) {
      const index = Number(slotIndex);
      const card = cardState.publicCards[index];
      if (!card) {
        rocketState.statusNote = "该公共牌位没有卡牌";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const pending = decisionState.cardSelectionAction;
      const maxSelectable = pending?.maxSelectable ?? 1;
      const fromEffectFlow = Boolean(pending?.fromEffectFlow || decisionState.actionEffectFlow);

      if (maxSelectable <= 1) {
        return beginPublicScanForSingleCard(index, card, {
          fromEffectFlow,
          scanRunId: pending?.scanRunId || null,
          deferPublicRefill: Boolean(pending?.deferPublicRefill),
        });
      }

      const selectedSlots = pending.selectedSlots || [];
      const existingIndex = selectedSlots.indexOf(index);
      if (existingIndex >= 0) {
        selectedSlots.splice(existingIndex, 1);
      } else if (selectedSlots.length >= maxSelectable) {
        rocketState.statusNote = `最多选择 ${maxSelectable} 张公共牌`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      } else {
        const scanChoices = getPublicScanChoicesForCard(card);
        if (!scanChoices.ok) {
          rocketState.statusNote = scanChoices.message;
          renderStateReadout();
          return scanChoices;
        }
        selectedSlots.push(index);
      }

      pending.selectedSlots = selectedSlots;
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

    function beginHandScan() {
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

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer?.hand?.length) {
        rocketState.statusNote = "没有手牌可用于扫描";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      decisionState.handScanAction = { type: "hand_scan", player: currentPlayer };
      rocketState.statusNote = "手牌扫描：请选择一张手牌弃除并扫描";
      syncHandScanSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function cancelHandScanSelection() {
      if (!isHandScanSelectionActive()) return;
      decisionState.handScanAction = null;
      rocketState.statusNote = "已取消手牌扫描";
      syncHandScanSelectionChrome();
      updateActionButtons();
      renderStateReadout();
    }

    function handleHandScanCardClick(handIndex) {
      if (!isHandScanSelectionActive()) return;

      const fromEffectFlow = Boolean(decisionState.handScanAction?.fromEffectFlow || decisionState.actionEffectFlow);
      const currentPlayer = getCurrentPlayer();
      const index = Math.round(handIndex);
      const card = currentPlayer?.hand?.[index];
      if (!card) {
        rocketState.statusNote = "无效的手牌位置";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const scanChoices = getPublicScanChoicesForCard(card);
      if (!scanChoices.ok) {
        rocketState.statusNote = scanChoices.message;
        renderStateReadout();
        return scanChoices;
      }

      decisionState.handScanAction = null;
      syncHandScanSelectionChrome();
      rocketState.statusNote = `手牌扫描：${getCardLabel(card)}，请选择${scanChoices.scanLabel}目标`;
      renderStateReadout();
      return openScanTargetPicker({
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

    function replaceNebulaDataForCurrentPlayer(nebulaId, options = {}) {
      const currentPlayer = getCurrentPlayer();
      const cost = normalizeResourceCost(options.cost) || {};
      const hasCost = Object.keys(cost).length > 0;
      if (hasCost && (!currentPlayer || !players.canAfford(currentPlayer, cost))) {
        const message = `资源不足，需要 ${players.formatResourceCost(cost)}`;
        rocketState.statusNote = message;
        renderStateReadout();
        return { ok: false, message };
      }

      beginEffectHistoryStep(options.prefix || "星云扫描");

      if (hasCost) {
        const spendResult = players.spendResources(currentPlayer, cost);
        if (!spendResult.ok) {
          endEffectHistoryStep();
          rocketState.statusNote = spendResult.message;
          renderStateReadout();
          return spendResult;
        }
      }

      const result = abilities.executeAbility("scanSector", createActionContext(), {
        ...options,
        nebulaId,
      });

      if (!result.ok) {
        if (hasCost) players.gainResources(currentPlayer, cost);
        endEffectHistoryStep();
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
        recordHistoryCommand(historyCommands.createResourceSpendCommand(
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
      recordAbilityCommands(result);
      rocketState.statusNote = result.message;

      renderSectors();
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    function appendSectorSettlementResultToFlow(settlementResult) {
      if (!decisionState.actionEffectFlow || !settlementResult?.ok) return;
      if (!decisionState.actionEffectFlow.sectorSettlementResult) {
        decisionState.actionEffectFlow.sectorSettlementResult = {
          ok: true,
          settlements: [],
          message: "",
        };
      }
      const aggregate = decisionState.actionEffectFlow.sectorSettlementResult;
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

    function executeScanActionFinalizeEffect(effect) {
      const scanRunId = effect.options?.scanRunId || decisionState.actionEffectFlow?.scanRunId || null;
      const followups = buildScanFinalizeFollowupEffects(scanRunId, decisionState.actionEffectFlow);
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
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function executeSectorFinishScanEffect(effect) {
      const sectorId = effect.options?.sectorId;
      if (!sectorId) {
        rocketState.statusNote = "完成扇区缺少扇区ID";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const beforeNebulaState = structuredClone(nebulaDataState);
      const beforeAlienState = structuredClone(alienGameState);
      beginEffectHistoryStep(effect.label, { effectType: scanEffects.EFFECT_TYPES.SECTOR_FINISH_SCAN });
      const result = data.settleSector(nebulaDataState, sectorId, {
        players: playerState.players,
        getPlayerTokenSrc: getNormalTokenAssetForPlayer,
        source: decisionState.actionEffectFlow?.actionType || "scan",
      });
      if (!result.ok) {
        endEffectHistoryStep();
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

      const winner = resolvePlayerReference(result.winner || {});
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
        setActiveEffectFlowOwner(effect);
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

      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        nebulaDataState,
        beforeNebulaState,
        "恢复完成扇区前星云状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复完成扇区前外星人状态",
      ));

      appendSectorSettlementResultToFlow(result);
      const rewardEffects = buildSectorSettlementRewardEffects(result);
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
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function normalizeDelayedPublicRefillSlotIndexes(slots) {
      return (slots || [])
        .map((item) => Number(typeof item === "number" ? item : item?.slotIndex))
        .filter((slotIndex, index, list) => Number.isInteger(slotIndex) && list.indexOf(slotIndex) === index)
        .sort((a, b) => a - b);
    }

    function replenishDelayedPublicRefillSlots(scanRunId, slots, options = {}) {
      const flow = options.flow || decisionState.actionEffectFlow;
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
      beginEffectHistoryStep(options.label || "补充公共牌区", {
        effectIndex: hasEffectIndex ? options.effectIndex : decisionState.actionEffectFlow?.currentIndex ?? null,
        effectType: scanEffects.EFFECT_TYPES.SCAN_PUBLIC_REFILL,
      });
      const replenished = [];
      for (const slotIndex of slotIndexes) {
        if (cardState.publicCards?.[slotIndex]) continue;
        const card = cards.replenishPublicSlot(cardState, playerState, slotIndex);
        if (card) replenished.push({ slotIndex, card });
      }
      recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
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

    function executeScanPublicRefillEffect(effect) {
      const scanRunId = effect.options?.scanRunId || null;
      const result = replenishDelayedPublicRefillSlots(scanRunId, effect.options?.slots || [], {
        label: effect.label,
      });
      if (!normalizeDelayedPublicRefillSlotIndexes(effect.options?.slots || []).length) {
        effect.result = result;
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect();
        renderStateReadout();
        return effect.result;
      }
      return finishAutomaticRewardEffect(effect, result);
    }

    function settleDelayedPublicRefillsAfterScanFlow(flow) {
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
      const result = replenishDelayedPublicRefillSlots(scanRunId, slots, {
        flow,
        label: syntheticEffect.label,
        effectIndex: null,
      });
      syntheticEffect.result = result;
      endEffectHistoryStep({ effect: syntheticEffect, result });
      rocketState.statusNote = result.message;
      renderPublicCards();
      updatePublicCardControls();
      return result;
    }

    function buildEndOfFlowFollowupEffects(flow) {
      if (!flow || flow.actionType === "initialIncome") return [];
      const effects = [];
      const markedNebulaIds = getFlowMarkedNebulaIds(flow);
      if (markedNebulaIds.size) {
        effects.push(...buildReadySectorFinishEffects({ nebulaIds: markedNebulaIds }));
      }
      if (isScanRelatedEffectFlow(flow)) {
        const queuedSectorIds = new Set(effects.map((effect) => String(effect.options?.sectorId || "")));
        for (const effect of buildReadySectorFinishEffects()) {
          const sectorId = String(effect.options?.sectorId || "");
          if (queuedSectorIds.has(sectorId)) continue;
          queuedSectorIds.add(sectorId);
          effects.push(effect);
        }
      }
      return effects;
    }

    function shouldAppendQueuedSectorFinishEffects(flow) {
      if (!flow?.completed || flow.endOfFlowSettlementScheduled) return false;
      return buildEndOfFlowFollowupEffects(flow).length > 0;
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

    function appendEndOfFlowSectorFinishEffects(flow) {
      if (!shouldAppendQueuedSectorFinishEffects(flow)) return false;
      const effects = buildEndOfFlowFollowupEffects(flow);
      if (!effects.length) return false;
      flow.endOfFlowSettlementScheduled = true;
      flow.completed = false;
      const ownerId = flow.playerId || flow.defaultPlayerId || decisionState.actionEffectFlow?.playerId || null;
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
      activateNextActionEffect();
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
      const ownerId = flow.playerId || flow.defaultPlayerId || decisionState.actionEffectFlow?.playerId || null;
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
      activateNextActionEffect();
      return true;
    }

    function discardPublicScanCard(pending) {
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
          registerDelayedPublicRefill(pending.scanRunId, slotIndex, card);
        } else {
          replenished = cards.replenishPublicSlot(cardState, playerState, slotIndex);
        }
      }

      recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
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

    function discardHandScanCard(pending) {
      const player = pending?.player || getCurrentPlayer();
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
      recordHistoryCommand(historyCommands.createDiscardHandCardCommand(
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

    function finalizeScanSourceCard(pending, scanResult) {
      if (!scanResult?.ok) return scanResult;

      let discardResult = null;
      if (pending?.type === "public_scan") {
        discardResult = discardPublicScanCard(pending);
      } else if (pending?.type === "hand_scan") {
        discardResult = discardHandScanCard(pending);
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

    function restoreYichangdianCornerPickerIfPending() {
      if (!decisionSessions.peek("yichangdian_corner_action")) return false;
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

    function closeScanTargetPicker(options = {}) {
      if (!els.scanTargetOverlay) {
        if (getPublicScanQueue() && !options.forcePublicScanQueueClose) return;
        if (options.forcePublicScanQueueClose) decisionSessions.clear(PUBLIC_SCAN_QUEUE_SESSION);
        decisionState.scanTargetAction = null;
        decisionSessions.clear("probe_sector_scan");
        decisionSessions.clear("probe_location_reward");
        decisionSessions.clear("strategy_passive_slot");
        return;
      }
      if (getPublicScanQueue()) {
        if (options.forcePublicScanQueueClose) {
          decisionSessions.clear(PUBLIC_SCAN_QUEUE_SESSION);
        } else {
        rocketState.statusNote = "公共牌区扫描：请完成全部星云选择";
        renderStateReadout();
        return;
        }
      }
      if (!options.forceYichangdianCornerClose && restoreYichangdianCornerPickerIfPending()) {
        return;
      }
      if (!options.preserveIndustryAction && decisionState.scanTargetAction?.type === "industry_remove_tech") {
        rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
        return;
      }
      decisionSessions.clear("card_trigger_action");
      decisionSessions.clear("card_task_completion");
      decisionSessions.clear("chong_task_completion");
      decisionSessions.clear("amiba_card_gain");
      decisionSessions.clear("amiba_symbol_choice");
      decisionSessions.clear("amiba_trace_removal");
      decisionSessions.clear("aomomo_card_gain");
      decisionSessions.clear("runezu_card_gain");
      decisionSessions.clear("runezu_symbol_branch");
      decisionSessions.clear("runezu_face_symbol_placement");
      decisionSessions.clear("strategy_passive_slot");
      setScanTargetActionLayout();
      decisionState.scanTargetAction = null;
      decisionSessions.clear("probe_sector_scan");
      decisionSessions.clear("probe_location_reward");
      els.scanTargetOverlay.hidden = true;
      if (els.scanTargetCancel) {
        els.scanTargetCancel.hidden = false;
      }
      renderPlayerHand();
      syncInteractionFocusChrome();
    }

    function nebulaHasScannableData(nebulaId) {
      return (data.listNebulaTokens(nebulaDataState, nebulaId) || []).length > 0;
    }

    function buildNebulaScanChoice(nebulaId, extra = {}) {
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

    function isAomomoActive() {
      return Boolean(solarState.aomomoActive && aomomo?.isAomomoRevealedSlot?.(
        alienGameState,
        alienGameState.aomomo?.revealedSlotId,
      ));
    }

    function getAomomoPlanetLocation() {
      if (!solarState.aomomoActive) return null;
      return solar.createSolarSnapshot(solarState).planetLocations
        .find((planet) => planet.planetId === aomomo?.PLANET_ID) || null;
    }

    function getAomomoCurrentX() {
      const location = getAomomoPlanetLocation();
      return location ? solar.mod8(location.x) : null;
    }

    function getNebulaCurrentX(nebulaId) {
      const found = solar.getNebulaLocations(solarState.sectorBySlot)
        .find((nebula) => nebula.id === nebulaId);
      return found ? solar.mod8(found.x) : null;
    }

    function getSectorScanTargetLabel(sectorX) {
      const x = solar.mod8(sectorX);
      const nebula = solar.getNebulaAtCoordinate(x, 5, solarState.sectorBySlot);
      return nebula?.label || `扇区${x}`;
    }

    function buildAomomoScanChoiceForX(sectorX, extra = {}) {
      return buildNebulaScanChoice(aomomo.NEBULA_ID, {
        sectorX,
        label: extra.label || `扇区 ${sectorX}：奥陌陌`,
        descriptionPrefix: extra.descriptionPrefix,
        ...extra,
      });
    }

    function hasAomomoScanAtX(sectorX) {
      const currentX = getAomomoCurrentX();
      return isAomomoActive() && currentX != null && solar.mod8(sectorX) === currentX;
    }

    function buildSectorScanChoicesForX(sectorX) {
      const x = solar.mod8(sectorX);
      const choices = [];
      const nebula = solar.getNebulaAtCoordinate(x, 5, solarState.sectorBySlot);
      if (nebula) {
        choices.push(buildNebulaScanChoice(nebula.id, {
          sectorX: x,
          label: `扇区 ${x}：${nebula.label}`,
        }));
      }
      if (hasAomomoScanAtX(x)) {
        choices.push(buildAomomoScanChoiceForX(x));
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

    function expandScanChoicesWithAomomoTargets(choices) {
      if (!isAomomoActive()) return choices;
      const next = [];
      const seenAomomo = new Set();
      for (const choice of choices || []) {
        next.push(choice);
        const sectorX = choice?.sectorX != null
          ? Number(choice.sectorX)
          : getNebulaCurrentX(choice?.nebulaId);
        if (sectorX == null || !hasAomomoScanAtX(sectorX)) continue;
        const key = solar.mod8(sectorX);
        if (seenAomomo.has(key) || choice.nebulaId === aomomo.NEBULA_ID) continue;
        seenAomomo.add(key);
        next.push(buildAomomoScanChoiceForX(key));
      }
      return next;
    }

    function openScanTargetPicker(config) {
      if (openScanTargetPickerOverride) return openScanTargetPickerOverride(config);
      config = config || {};
      decisionState.scanTargetAction = {
        ...getPendingOwnerFields(config.effect || null),
        ...config,
      };
      if (!els.scanTargetOverlay || !els.scanTargetActions) {
        if (globalThis.SetiHeadlessRuntimeConfig?.enabled) {
          return { ok: true, pendingChoice: true, message: config.subtitle || "请选择扫描目标" };
        }
        decisionState.scanTargetAction = null;
        return { ok: false, message: "无法打开扫描目标选择" };
      }
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
        els.scanTargetCancel.hidden = Boolean(config.queueMode || config.hideCancel);
      }
      els.scanTargetOverlay.hidden = false;
      renderPlayerHand();
      return { ok: true, message: config.subtitle || "" };
    }

    function confirmScanTarget(nebulaId, sectorX) {
      const pending = decisionState.scanTargetAction;
      return withPendingOwnerPlayer(pending, () => {
      closeScanTargetPicker({ preserveIndustryAction: true });

      if (pending?.type === "industry_remove_tech") {
        return confirmIndustryHeliosRemoveTech(nebulaId);
      }

      const scanSource = pending?.fromEffectFlow || isActionEffectFlowActive() ? "scan" : "debug";

      if (pending?.type === "sector_scan") {
        const cost = normalizeResourceCost(pending.cost) || {};
        if (Object.keys(cost).length && !players.canAfford(getCurrentPlayer(), cost)) {
          const message = `${pending.title || "扇区扫描"}：资源不足，需要 ${players.formatResourceCost(cost)}，已跳过`;
          return skipActionEffectWithMessage(pending.effect || getCurrentActionEffect(), message, {
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
          const effect = pending.effect || getCurrentActionEffect();
          const result = {
            ok: true,
            undoable: true,
            message: `${pending.title || "选定扇区扫描"}：已选定扇区 ${sectorX}，追加 ${repeat} 次扫描`,
            payload: { nebulaId, sectorX, repeat },
            events: [],
          };
          if (effect) effect.result = result;
          rocketState.statusNote = result.message;
          completeCurrentActionEffect();
          renderStateReadout();
          return result;
        }
        let result = replaceNebulaDataForCurrentPlayer(nebulaId, {
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
        maybeCompleteActionEffectFromScan(result);
        return result;
      }

      if (pending?.type === "public_scan") {
        if (pending.queueMode && getPublicScanQueue()) {
          const scanResult = replaceNebulaDataForCurrentPlayer(nebulaId, {
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
          const queue = getPublicScanQueue();
          if (!Array.isArray(queue.events)) queue.events = [];
          queue.events.push(...(scanResult.events || []));
          queue.currentIndex += 1;
          if (queue.currentIndex < queue.items.length) {
            rocketState.statusNote = scanResult.message;
            renderSectors();
            renderPlayerStats();
            updateActionButtons();
            renderStateReadout();
            openPublicScanNebulaPickerForCurrentQueueItem();
            return scanResult;
          }
          decisionSessions.clear(PUBLIC_SCAN_QUEUE_SESSION);
          closeScanTargetPicker();
          scanResult.events = queue.events.slice();
          rocketState.statusNote = scanResult.message;
          renderSectors();
          renderPlayerStats();
          updateActionButtons();
          renderStateReadout();
          maybeCompleteActionEffectFromScan(scanResult);
          return scanResult;
        }

        if (pending.deferPublicRefill && pending.scanRunId) {
          let scanResult = replaceNebulaDataForCurrentPlayer(nebulaId, {
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
          scanResult = finalizeScanSourceCard(pending, scanResult);
          rocketState.statusNote = scanResult.message;
          renderSectors();
          renderPlayerStats();
          renderPublicCards();
          updatePublicCardControls();
          updateActionButtons();
          maybeCompleteActionEffectFromScan(scanResult);
          return scanResult;
        }

        beginEffectHistoryStep(`公共牌区扫描 ${cards.getCardLabel(pending.card)}`);
        const result = abilities.executeAbility("scanPublicCard", createActionContext(), {
          nebulaId,
          prefix: `公共牌区扫描 ${cards.getCardLabel(pending.card)}`,
          source: scanSource,
          card: pending.card,
          publicSlotIndex: pending.publicSlotIndex,
        });
        if (!result.ok) {
          endEffectHistoryStep();
          rocketState.statusNote = result.message;
          renderSectors();
          renderStateReadout();
          return result;
        }
        enrichScanResultEvents(result, nebulaId, { sectorX });
        recordAbilityCommands(result);
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
        maybeCompleteActionEffectFromScan(result);
        return result;
      }

      if (pending?.type === "hand_scan") {
        beginEffectHistoryStep(`手牌扫描 ${cards.getCardLabel(pending.card)}`);
        const result = abilities.executeAbility("scanHandCard", createActionContext(), {
          nebulaId,
          prefix: `手牌扫描 ${cards.getCardLabel(pending.card)}`,
          source: scanSource,
          card: pending.card,
          handIndex: pending.handIndex,
          player: pending.player,
        });
        if (!result.ok) {
          endEffectHistoryStep();
          rocketState.statusNote = result.message;
          renderSectors();
          renderStateReadout();
          return result;
        }
        enrichScanResultEvents(result, nebulaId, { sectorX });
        recordAbilityCommands(result);
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
        maybeCompleteActionEffectFromScan(result);
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

    function handleDrawnHandScanSkip() {
      const pending = decisionState.scanTargetAction;
      if (pending?.type !== "hand_scan" || !pending.discardDrawnOnSkip) {
        return { ok: false, message: "没有可跳过的盲抽弃牌扫描" };
      }
      const player = pending.player || getCurrentPlayer();
      const handIndex = findPendingHandScanCardIndex(player, pending);
      if (handIndex < 0) {
        rocketState.statusNote = "找不到刚抽到的卡牌，无法跳过";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const effect = pending.effect || getCurrentActionEffect();
      closeScanTargetPicker();
      beginEffectHistoryStep(effect?.label || "跳过盲抽弃牌扫描");
      const discardResult = cards.discardFromHandAtIndex(player, handIndex);
      if (!discardResult.ok) {
        endEffectHistoryStep();
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
      completeCurrentActionEffect();
      renderStateReadout();
      return result;
    }

    function beginSectorScan() {
      if (isCardSelectionActive() || isDiscardSelectionActive() || isPlayCardSelectionActive() || isTechTilePickingActive()) {
        rocketState.statusNote = "请先完成当前选择";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      const choices = Array.from({ length: 8 }, (_item, x) => buildSectorScanChoicesForX(x)).flat();

      rocketState.statusNote = "扇区扫描：请选择 0-7 号扇区";
      renderStateReadout();
      return openScanTargetPicker({
        type: "sector_scan",
        title: "扇区扫描",
        subtitle: "选择当前 0-7 号扇区中的一个星云；无可替换数据时追加扫描计数且不获得数据。",
        choices,
      });
    }

    function getSectorOpenDataCount(sectorId) {
      return data.listNebulaTokens(nebulaDataState, sectorId)
        .filter((token) => !token.replacedByPlayerColor && !token.playerColor)
        .length;
    }

    function getSectorCapacity(sectorId) {
      return data.getNebulaCapacity(sectorId);
    }

    function getSectorReplacedCount(sectorId) {
      return getSectorCapacity(sectorId) - getSectorOpenDataCount(sectorId);
    }

    function getSectorExtraMarkCount(sectorId) {
      return typeof data.listSectorExtraMarks === "function"
        ? data.listSectorExtraMarks(nebulaDataState, sectorId).length
        : 0;
    }

    function getSectorNebulaLabelText(sectorId) {
      return data.getNebulaLabel(sectorId);
    }

    function getPublicScanChoicesForCard(card) {
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
        choices: expandScanChoicesWithAomomoTargets(nebulaIds.map((nebulaId) => buildNebulaScanChoice(nebulaId))),
      };
    }

    function hasHandScanTargetCard(player) {
      return (player?.hand || []).some((card) => card && getPublicScanChoicesForCard(card).ok);
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

    function createPublicScanPendingAction(player, fromEffectFlow = false, options = {}) {
      const requestedMaxSelectable = Math.max(
        1,
        Math.round(Number(options.maxSelectable || getPublicScanMaxSelectable(player))),
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

    function beginPublicDeckScan() {
      return beginCardSelection(createPublicScanPendingAction(getCurrentPlayer()));
    }
    return {
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

  return {
    createScanFlowHelpers,
  };
});
