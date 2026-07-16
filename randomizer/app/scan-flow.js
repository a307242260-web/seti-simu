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
    const aomomo = context.aomomo || null;
    const historyCommands = context.historyCommands || {};

    const pendingState = context.pendingState || {};
    const cardState = context.cardState || {};
    const nebulaDataState = context.nebulaDataState || {};
    const rocketState = context.rocketState || {};
    const playerState = context.playerState || {};

    const PUBLIC_SCAN_MAX_BONUS_CARDS = Number(context.PUBLIC_SCAN_MAX_BONUS_CARDS || 0);
    const SECTOR_FINISH_ICON_BY_COLOR = context.SECTOR_FINISH_ICON_BY_COLOR || {};
    const SECTOR_WIN_REWARDS = context.SECTOR_WIN_REWARDS || {};

    const getCurrentPlayer = requireFunction("getCurrentPlayer", context.getCurrentPlayer);
    const getPublicScanChoicesForCard = requireFunction("getPublicScanChoicesForCard", context.getPublicScanChoicesForCard);
    const renderStateReadout = requireFunction("renderStateReadout", context.renderStateReadout);
    const renderPlayerStats = requireFunction("renderPlayerStats", context.renderPlayerStats);
    const renderPublicCards = requireFunction("renderPublicCards", context.renderPublicCards);
    const renderPlayerHand = requireFunction("renderPlayerHand", context.renderPlayerHand);
    const updatePublicCardControls = requireFunction("updatePublicCardControls", context.updatePublicCardControls);
    const updateActionButtons = requireFunction("updateActionButtons", context.updateActionButtons);
    const syncPublicScanConfirmButton = requireFunction("syncPublicScanConfirmButton", context.syncPublicScanConfirmButton);
    const syncCardSelectionChrome = requireFunction("syncCardSelectionChrome", context.syncCardSelectionChrome);
    const syncHandScanSelectionChrome = requireFunction("syncHandScanSelectionChrome", context.syncHandScanSelectionChrome);
    const openScanTargetPicker = requireFunction("openScanTargetPicker", context.openScanTargetPicker);
    const beginEffectHistoryStep = requireFunction("beginEffectHistoryStep", context.beginEffectHistoryStep);
    const recordHistoryCommand = requireFunction("recordHistoryCommand", context.recordHistoryCommand);
    const isTechTilePickingActive = requireFunction("isTechTilePickingActive", context.isTechTilePickingActive);
    const isCardSelectionActive = requireFunction("isCardSelectionActive", context.isCardSelectionActive);
    const isDiscardSelectionActive = requireFunction("isDiscardSelectionActive", context.isDiscardSelectionActive);
    const isPlayCardSelectionActive = requireFunction("isPlayCardSelectionActive", context.isPlayCardSelectionActive);
    const isMovePaymentSelectionActive = requireFunction("isMovePaymentSelectionActive", context.isMovePaymentSelectionActive);
    const isHandScanSelectionActive = requireFunction("isHandScanSelectionActive", context.isHandScanSelectionActive);
    const discardPublicScanCard = requireFunction("discardPublicScanCard", context.discardPublicScanCard);
    const resolvePlayerReference = requireFunction("resolvePlayerReference", context.resolvePlayerReference);
    const getFlowMarkedNebulaIds = requireFunction("getFlowMarkedNebulaIds", context.getFlowMarkedNebulaIds);

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

    function getPublicScanMinSelectable(pending = pendingState.cardSelectionAction) {
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

    function ensureDelayedPublicRefills(flow = pendingState.actionEffectFlow) {
      if (!flow) return [];
      if (!Array.isArray(flow.delayedPublicRefills)) {
        flow.delayedPublicRefills = [];
      }
      return flow.delayedPublicRefills;
    }

    function registerDelayedPublicRefill(scanRunId, slotIndex, card) {
      if (!scanRunId || !pendingState.actionEffectFlow) return null;
      const index = Number(slotIndex);
      if (!Number.isInteger(index)) return null;
      const list = ensureDelayedPublicRefills(pendingState.actionEffectFlow);
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

    function getDelayedPublicRefillSlots(scanRunId, flow = pendingState.actionEffectFlow) {
      return ensureDelayedPublicRefills(flow)
        .filter((item) => !scanRunId || item.scanRunId === scanRunId)
        .map((item) => ({ ...item }));
    }

    function clearDelayedPublicRefillSlots(scanRunId, flow = pendingState.actionEffectFlow) {
      if (!flow || !Array.isArray(flow.delayedPublicRefills)) return;
      flow.delayedPublicRefills = flow.delayedPublicRefills
        .filter((item) => scanRunId && item.scanRunId !== scanRunId);
    }

    function cloneDelayedPublicRefills(flow = pendingState.actionEffectFlow) {
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

    function buildScanFinalizeFollowupEffects(_scanRunId, flow = pendingState.actionEffectFlow) {
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

      pendingState.cardSelectionAction = null;
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
      const queue = pendingState.publicScanQueue;
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
      const pending = pendingState.cardSelectionAction;
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

      const fromEffectFlow = Boolean(pending.fromEffectFlow || pendingState.actionEffectFlow);
      pendingState.cardSelectionAction = null;
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

      pendingState.publicScanQueue = {
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

      const pending = pendingState.cardSelectionAction;
      const maxSelectable = pending?.maxSelectable ?? 1;
      const fromEffectFlow = Boolean(pending?.fromEffectFlow || pendingState.actionEffectFlow);

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

      pendingState.handScanAction = { type: "hand_scan", player: currentPlayer };
      rocketState.statusNote = "手牌扫描：请选择一张手牌弃除并扫描";
      syncHandScanSelectionChrome();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function cancelHandScanSelection() {
      if (!isHandScanSelectionActive()) return;
      pendingState.handScanAction = null;
      rocketState.statusNote = "已取消手牌扫描";
      syncHandScanSelectionChrome();
      updateActionButtons();
      renderStateReadout();
    }

    function handleHandScanCardClick(handIndex) {
      if (!isHandScanSelectionActive()) return;

      const fromEffectFlow = Boolean(pendingState.handScanAction?.fromEffectFlow || pendingState.actionEffectFlow);
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

      pendingState.handScanAction = null;
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
      isScanRelatedEffectFlow,
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
