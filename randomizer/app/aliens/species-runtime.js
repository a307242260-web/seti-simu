(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAlienSpeciesRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createAlienSpeciesRuntime(context = {}) {
    const headless = context.headless === true;
    const {
      actionHistory,
      alienGameState,
      aliens,
      amiba,
      aomomo,
      Array,
      banrenma,
      BANRENMA_PANEL_BONUS_EFFECT_TYPE,
      banrenmaBonusMarkerElements,
      beginAlienTraceBoardPlacement,
      beginCardSelection,
      beginEffectHistoryStep,
      beginQuickActionStep,
      blindDrawCardForPlayer,
      blockManualAiPendingInput,
      blockManualAiPendingInputIfNeeded,
      Boolean,
      buildAlienTraceEvent,
      buildPlutoMarkerContext,
      buildProbeLocationIndex,
      canPlaceAmibaTrace,
      canPlaceAnyStateExtraTrace,
      canPlaceAomomoTrace,
      canPlaceBanrenmaTrace,
      canPlaceChongTrace,
      canPlaceFangzhouTrace,
      canPlaceJiuzheTrace,
      canPlaceRunezuFaceSymbol,
      canPlaceRunezuTrace,
      canPlaceStateTrace,
      canPlaceYichangdianTrace,
      cardEffects,
      cards,
      cardState,
      chong,
      closeAlienTracePicker,
      completeCurrentActionEffect,
      completeQuickActionStep,
      continueAfterCardTriggerResolution,
      createActionLogImpactSnapshot,
      data,
      debugRuntimeController,
      decisionSessions,
      discardReservedCardIfFinished,
      document,
      els,
      endEffectHistoryStep,
      failMissingAlienTraceTargetPlayer,
      fangzhou,
      finishAutomaticRewardEffect,
      formatPlanetRewardGain,
      getAlienCardGainIrreversible,
      getAlienTraceActionPlayer,
      getCurrentActionEffect,
      getCurrentPlayer,
      getEffectOwnerPlayer,
      getPendingOwnerFields,
      getPendingOwnerPlayer,
      getPlanetSectorCoordinate,
      getPlayerByColor,
      getPlayerById,
      getPlayerCompanyBaseIncome,
      getReadyChongTaskForReservedCard,
      getTargetPlayerOptions,
      hasActivePendingSubFlow,
      hasAlienTracePanelPlacementTarget,
      HISTORY_SOURCE_QUICK,
      historyCommands,
      incrementCompletedTaskCount,
      insertActionEffectsAfterCurrent,
      isActionEffectFlowActive,
      isPendingLockedForAiAutomation,
      jiuzhe,
      JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
      markActionPending,
      markCurrentActionIrreversible,
      Math,
      maybeContinueAlienRevealQueuedOpportunities,
      maybeContinuePendingTurnEndRevealFlow,
      maybeRestoreAlienLabPanelForTrace,
      nebulaDataState,
      Number,
      Object,
      openCardTaskCompletionPicker,
      openFangzhouTraceDestinationChoice,
      planetRewards,
      planetStatsState,
      players,
      playerState,
      quickActionHistory,
      recordHistoryCommand,
      recordAlienTraceScore,
      recordQuickHistoryCommand,
      removeReservedCardToDiscard,
      removeRocketElement,
      renderActionEffectBar,
      renderPlayerHand,
      renderPlayerStats,
      renderReservedCardsFromTaskState,
      renderRockets,
      renderRunezuBoardSymbols,
      renderStateReadout,
      resolvePlayerReference,
      RESOURCE_ICON_SRC,
      rocketActions,
      rocketState,
      runezu,
      Set,
      setScanTargetActionLayout,
      settleCardTasksAfterEffect,
      shouldShowStateTraceSlots,
      skipActionEffectWithMessage,
      startCardEffectFlow,
      startScreenState,
      String,
      structuredClone,
      uiRuntimeState,
      updateActionButtons,
      window,
      yichangdian,
      yichangdianAnomalyMarkerElements,
    } = context;
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
    const getCardTaskCompletion = () => decisionSessions.peek("card_task_completion");
    const getChongTaskCompletion = () => decisionSessions.peek("chong_task_completion");
    const replaceDecisionSession = (kind, session) => {
      if (session == null) return decisionSessions.clear(kind);
      return decisionSessions.open(kind, session);
    };
    const alienCardGainSessions = {
      get runezuCardGain() { return decisionSessions.peek("runezu_card_gain"); },
      set runezuCardGain(session) { replaceDecisionSession("runezu_card_gain", session); },
      get amibaCardGain() { return decisionSessions.peek("amiba_card_gain"); },
      set amibaCardGain(session) { replaceDecisionSession("amiba_card_gain", session); },
      get aomomoCardGain() { return decisionSessions.peek("aomomo_card_gain"); },
      set aomomoCardGain(session) { replaceDecisionSession("aomomo_card_gain", session); },
      get yichangdianCardGain() { return decisionSessions.peek("yichangdian_card_gain"); },
      set yichangdianCardGain(session) { replaceDecisionSession("yichangdian_card_gain", session); },
      get banrenmaCardGain() { return decisionSessions.peek("banrenma_card_gain"); },
      set banrenmaCardGain(session) { replaceDecisionSession("banrenma_card_gain", session); },
      get chongCardGain() { return decisionSessions.peek("chong_card_gain"); },
      set chongCardGain(session) { replaceDecisionSession("chong_card_gain", session); },
    };
    const alienChoiceSessions = {
      get yichangdianCornerAction() { return decisionSessions.peek("yichangdian_corner_action"); },
      set yichangdianCornerAction(session) { replaceDecisionSession("yichangdian_corner_action", session); },
      get chongFossilChoice() { return decisionSessions.peek("chong_fossil_choice"); },
      set chongFossilChoice(session) { replaceDecisionSession("chong_fossil_choice", session); },
      get amibaSymbolChoice() { return decisionSessions.peek("amiba_symbol_choice"); },
      set amibaSymbolChoice(session) { replaceDecisionSession("amiba_symbol_choice", session); },
      get amibaTraceRemoval() { return decisionSessions.peek("amiba_trace_removal"); },
      set amibaTraceRemoval(session) { replaceDecisionSession("amiba_trace_removal", session); },
      get runezuSymbolBranch() { return decisionSessions.peek("runezu_symbol_branch"); },
      set runezuSymbolBranch(session) { replaceDecisionSession("runezu_symbol_branch", session); },
      get runezuFaceSymbolPlacement() { return decisionSessions.peek("runezu_face_symbol_placement"); },
      set runezuFaceSymbolPlacement(session) { replaceDecisionSession("runezu_face_symbol_placement", session); },
    };
    const getOpportunityQueue = (kind) => {
      let session = decisionSessions.peek(kind);
      if (!session) {
        decisionSessions.open(kind, { items: [] });
        session = decisionSessions.peek(kind);
      }
      return session.items;
    };
    const alienOpportunitySessions = {
      get jiuzheCardPlay() { return decisionSessions.peek("jiuzhe_card_play"); },
      set jiuzheCardPlay(session) { replaceDecisionSession("jiuzhe_card_play", session); },
      get jiuzheOpportunityOpen() { return Boolean(decisionSessions.peek("jiuzhe_opportunity_open")?.open); },
      set jiuzheOpportunityOpen(open) {
        replaceDecisionSession("jiuzhe_opportunity_open", open ? { open: true } : null);
      },
      get jiuzheOpportunityQueue() { return getOpportunityQueue("jiuzhe_opportunity_queue"); },
      set jiuzheOpportunityQueue(items) {
        replaceDecisionSession("jiuzhe_opportunity_queue", items?.length ? { items } : null);
      },
      get banrenmaOpportunity() { return decisionSessions.peek("banrenma_opportunity"); },
      set banrenmaOpportunity(session) { replaceDecisionSession("banrenma_opportunity", session); },
      get banrenmaOpportunityQueue() { return getOpportunityQueue("banrenma_opportunity_queue"); },
      set banrenmaOpportunityQueue(items) {
        replaceDecisionSession("banrenma_opportunity_queue", items?.length ? { items } : null);
      },
    };

    function addFangzhouUnlockedCardToHand(player, handCard) {
      if (!player || !handCard) return false;
      if (!Array.isArray(player.hand)) player.hand = [];
      player.hand.push(handCard);
      if (player.resources) player.resources.handSize = player.hand.length;
      return true;
    }

    function applyAlienStateExtraTraceReward(alienSlotId, traceType, player, placementResult) {
      if (!placementResult?.ok || !placementResult.extraOnly) return null;
      const reward = aliens.getExtraTraceReward?.(alienSlotId, traceType);
      const gain = reward?.gain || null;
      if (!gain || !Object.values(gain).some((value) => Number(value) !== 0)) return null;
      players.gainResources(player, gain);
      recordAlienTraceScore(player, traceType, gain);
      return {
        kind: "stateExtraTraceReward",
        reward,
        gain: { ...gain },
        message: `${aliens.getAlienSlotLabel(alienSlotId)} state额外痕迹奖励：${formatPlanetRewardGain(gain) || "无奖励"}`,
      };
    }

    function applyAlienTraceAfterReward(pending, player, traceType) {
      const reward = pending?.afterTraceReward;
      if (!reward || reward.kind !== "traceCountScore") return null;
      const scorePer = Math.max(0, Math.round(Number(reward.scorePer) || 1));
      const count = Math.max(0, Math.round(Number(
        cardEffects.countTraceMarkers?.(player, alienGameState, traceType) || 0,
      )));
      const gain = { score: count * scorePer };
      if (gain.score > 0) {
        players.gainResources(player, gain);
        recordAlienTraceScore(player, traceType, gain);
      }
      return {
        kind: reward.kind,
        count,
        gain,
        message: `${aliens.getTraceTypeLabel(traceType)}痕迹 ${count} 个：${formatPlanetRewardGain(gain) || "无奖励"}`,
      };
    }

    function appendAlienTraceAfterRewardMessage(afterReward) {
      if (afterReward?.message) {
        rocketState.statusNote = `${rocketState.statusNote ? `${rocketState.statusNote}；` : ""}${afterReward.message}`;
      }
    }

function getAlienTraceLayer(alienSlotId) {
    return [...els.alienTraceLayers].find(
      (layer) => Number(layer.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienJiuzheTraceLayer(alienSlotId) {
    return [...els.alienJiuzheTraceLayers].find(
      (layer) => Number(layer.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienYichangdianCardArea(alienSlotId) {
    return [...els.alienYichangdianCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienBanrenmaCardArea(alienSlotId) {
    return [...els.alienBanrenmaCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienChongCardArea(alienSlotId) {
    return [...els.alienChongCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienAmibaCardArea(alienSlotId) {
    return [...els.alienAmibaCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienAomomoCardArea(alienSlotId) {
    return [...els.alienAomomoCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienRunezuCardArea(alienSlotId) {
    return [...els.alienRunezuCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienJiuzheThresholdElement(alienSlotId) {
    return [...els.alienJiuzheThresholds].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienBanrenmaScoremarkElement(alienSlotId) {
    return [...els.alienBanrenmaScoremarks].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function getAlienBackImage(alienSlotId) {
    return document.querySelector(`.alien-panel[data-alien-slot="${alienSlotId}"] .alien-back`);
  }

function createJiuzheThresholdNode(kind, iconSrc, score) {
    const item = document.createElement("div");
    const icon = document.createElement("img");
    const scoreEl = document.createElement("span");
    item.className = "alien-jiuzhe-threshold";
    item.dataset.jiuzheThreshold = kind;
    icon.className = "alien-jiuzhe-threshold-icon";
    icon.src = iconSrc;
    icon.alt = "";
    icon.decoding = "async";
    icon.setAttribute("aria-hidden", "true");
    scoreEl.className = "alien-jiuzhe-threshold-score";
    scoreEl.textContent = score == null ? "-" : String(score);
    item.title = kind === "free"
      ? `达到 ${score} 分：免费打出九折牌`
      : `达到 ${score} 分：支付 1 信用点打出九折牌`;
    item.append(icon, scoreEl);
    return item;
  }

function renderJiuzheThresholds() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const container = getAlienJiuzheThresholdElement(alienSlotId);
      if (!container) continue;
      const visible = Boolean(jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.jiuzhe || {};
      if (!visible) {
        container.hidden = true;
        container.replaceChildren();
        continue;
      }
      container.hidden = false;
      container.replaceChildren(
        createJiuzheThresholdNode("free", RESOURCE_ICON_SRC.jiuzheTimeFree, state.freeScoreThreshold),
        createJiuzheThresholdNode("paid", RESOURCE_ICON_SRC.jiuzheTimePaid, state.paidScoreThreshold),
      );
    }
  }

function maybeRevealAlienAfterTrace(alienSlotId, traceResult, options = {}) {
    if (!traceResult?.readyToReveal) return null;
    if (options.immediate === false) {
      return {
        ok: true,
        delayed: true,
        readyToReveal: true,
        alienSlotId,
        message: `${aliens.getAlienSlotLabel(alienSlotId)}三种首痕迹已满：将在该玩家回合结束时揭示外星人`,
      };
    }
    return aliens.revealRandomAlien(alienGameState, alienSlotId);
  }

function isDebugAlienTraceMode() {
    return Boolean(uiRuntimeState.debugAlienTraceModeActive);
  }

function setDebugAlienTraceModeActive(active, message = null) {
    return debugRuntimeController.setDebugAlienTraceModeActive(active, message);
  }

function toggleDebugAlienTraceMode() {
    return debugRuntimeController.toggleDebugAlienTraceMode();
  }

function enableDebugAlienTraceModeForReveal(message) {
    return debugRuntimeController.enableDebugAlienTraceModeForReveal(message);
  }

function renderYichangdianCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienYichangdianCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(yichangdian?.isYichangdianRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.yichangdian || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible || cardIndex == null) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-yichangdian-card-title";
      title.textContent = "异常点展示牌";

      const image = document.createElement("img");
      image.className = "alien-yichangdian-card-image";
      image.src = yichangdian.getCardSrc(cardIndex);
      image.alt = `异常点牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";
      area.replaceChildren(title, image);
    }
  }

function renderBanrenmaScoremarks() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const container = getAlienBanrenmaScoremarkElement(alienSlotId);
      if (!container) continue;
      const visible = Boolean(banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId));
      if (!visible) {
        container.hidden = true;
        container.replaceChildren();
        continue;
      }
      const marks = playerState.players.flatMap((player) => (
        banrenma.getPlayerScoreMarks(alienGameState, player)
          .filter((mark) => mark.source === "panel")
          .map((mark) => ({ player, mark }))
      ));
      container.hidden = !marks.length;
      container.replaceChildren(...marks.map(({ player, mark }) => {
        const item = document.createElement("div");
        item.className = "alien-banrenma-scoremark";
        const icon = document.createElement("img");
        icon.className = "alien-banrenma-scoremark-icon";
        icon.src = banrenma.getPlayerMarkSrc(player.color);
        icon.alt = "";
        icon.decoding = "async";
        icon.setAttribute("aria-hidden", "true");
        const score = document.createElement("span");
        score.className = "alien-banrenma-scoremark-score";
        score.textContent = String(mark.threshold);
        item.title = `${player.colorLabel}玩家达到 ${mark.threshold} 分：选择一个半人马顶部奖励`;
        item.append(icon, score);
        return item;
      }));
    }
  }

function renderBanrenmaCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienBanrenmaCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.banrenma || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-banrenma-card-title";
      title.textContent = "半人马展示牌";
      const image = document.createElement("img");
      image.className = "alien-banrenma-card-image";
      image.src = cardIndex == null ? banrenma.CARD_BACK_SRC : banrenma.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "半人马牌背" : `半人马牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";
      area.replaceChildren(title, image);
    }
  }

function renderChongCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienChongCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(chong?.isChongRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.chong || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-chong-card-title";
      title.textContent = "虫族展示牌";
      const image = document.createElement("img");
      image.className = "alien-chong-card-image";
      image.src = cardIndex == null ? chong.CARD_BACK_SRC : chong.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "虫族牌背" : `虫族牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";

      area.replaceChildren(title, image);
    }
  }

function renderAmibaCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienAmibaCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(amiba?.isAmibaRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.amiba || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-amiba-card-title";
      title.textContent = "阿米巴展示牌";
      const image = document.createElement("img");
      image.className = "alien-amiba-card-image";
      image.src = cardIndex == null ? amiba.CARD_BACK_SRC : amiba.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "阿米巴牌背" : `阿米巴牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";

      area.replaceChildren(title, image);
    }
  }

function renderAomomoCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienAomomoCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(aomomo?.isAomomoRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.aomomo || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-aomomo-card-title";
      title.textContent = "奥陌陌展示牌";
      const image = document.createElement("img");
      image.className = "alien-aomomo-card-image";
      image.src = cardIndex == null ? aomomo.CARD_BACK_SRC : aomomo.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "奥陌陌牌背" : `奥陌陌牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";

      area.replaceChildren(title, image);
    }
  }

function renderRunezuCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienRunezuCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.runezu || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-runezu-card-title";
      title.textContent = "符文族展示牌";
      const image = document.createElement("img");
      image.className = "alien-runezu-card-image";
      image.src = cardIndex == null ? runezu.CARD_BACK_SRC : runezu.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "符文族牌背" : `符文族牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";

      area.replaceChildren(title, image);
    }
  }

function renderBanrenmaBonusMarkers() {
    const activeKeys = new Set();
    const state = banrenma?.ensureBanrenmaState?.(alienGameState);
    const alienSlotId = Number(state?.revealedSlotId || 0);
    const layer = alienSlotId ? getAlienJiuzheTraceLayer(alienSlotId) : null;
    if (layer && banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) {
      for (const [position, slot] of Object.entries(state.bonusSlots || {})) {
        const layout = window.SetiAlienPlacement?.getBanrenmaBonusMarkerLayout?.(alienSlotId, Number(position));
        if (!layout || !slot) continue;
        const key = `banrenma-bonus:${alienSlotId}:${position}`;
        activeKeys.add(key);
        let element = banrenmaBonusMarkerElements.get(key);
        if (!element) {
          element = document.createElement("img");
          element.className = "alien-trace-token alien-trace-token-positioned alien-trace-token-banrenma-bonus";
          element.draggable = false;
          banrenmaBonusMarkerElements.set(key, element);
          layer.appendChild(element);
        }
        const scale = ((layout.scalePercent || 52) / 100)
          * (window.SetiAlienPlacement?.BANRENMA_BONUS_TOKEN_DISPLAY_SCALE || 1.18);
        element.style.position = "absolute";
        element.style.left = `${layout.percentX}%`;
        element.style.top = `${layout.percentY}%`;
        element.style.setProperty("--alien-trace-scale", String(scale));
        element.style.transform = "translate(-50%, -50%) scale(var(--alien-trace-scale, 1))";
        element.style.transformOrigin = "center center";
        element.src = banrenma.getPlayerMarkSrc?.(slot.playerColor) || aliens.ALIEN_TRACE_TOKEN_SRC;
        element.alt = `半人马顶部奖励${position}`;
        element.dataset.alienSlot = String(alienSlotId);
        element.dataset.banrenmaBonusPosition = String(position);
        element.title = `半人马顶部奖励${position}：${slot.playerLabel || slot.playerColor || "已使用"} @(${layout.percentX}%,${layout.percentY}%)`;
      }
    }
    for (const [key, element] of banrenmaBonusMarkerElements.entries()) {
      if (activeKeys.has(key)) continue;
      element.remove();
      banrenmaBonusMarkerElements.delete(key);
    }
  }

function renderAlienPanels() {
    if (headless) return;
    aliens.renderAllAlienBackImages(getAlienBackImage, alienGameState);
    aliens.renderAllAlienTraceMarkers(getAlienTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      showStateTraceSlots: shouldShowStateTraceSlots(),
      allowedTraceTypes: decisionState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES,
      canPlaceStateTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllJiuzheTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceJiuzheTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllYichangdianTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceYichangdianTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllFangzhouTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceFangzhouTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllBanrenmaTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceBanrenmaTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllChongTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceChongTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllAmibaTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceAmibaTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllAomomoTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceAomomoTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerOrbitAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.satelliteAsset
        || players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLandingAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.landdingAsset
        || players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllRunezuTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceRunezuTrace,
      canPlaceRunezuFaceSymbol,

      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    renderJiuzheThresholds();
    renderBanrenmaScoremarks();
    renderYichangdianCardDisplays();
    renderFangzhouCardDisplays();
    renderBanrenmaCardDisplays();
    renderChongCardDisplays();
    renderAmibaCardDisplays();
    renderAomomoCardDisplays();
    renderRunezuCardDisplays();
    renderBanrenmaBonusMarkers();
    renderRunezuBoardSymbols();
  }

function randomizeAliens() {
    const result = aliens.randomizeAlienAssignments(alienGameState, {
      alienPoolIds: startScreenState.selectedAlienIds,
    });
    if (!result.ok) return result;
    aliens.resetAlienTraceTokens();
    for (const element of yichangdianAnomalyMarkerElements.values()) {
      element.remove();
    }
    yichangdianAnomalyMarkerElements.clear();
    for (const element of banrenmaBonusMarkerElements.values()) {
      element.remove();
    }
    banrenmaBonusMarkerElements.clear();
    renderAlienPanels();
    renderRockets();
    return result;
  }

function applyFangzhouUnlockStateTraceReward(alienSlotId, player, traceType, placementResult) {
    return applyAlienStateExtraTraceReward(alienSlotId, traceType, player, placementResult);
  }

function confirmFangzhouCard2Unlock(alienSlotId, traceType) {
    const pending = decisionState.alienTraceAction;
    const inDebugMode = isDebugAlienTraceMode();
    const currentPlayer = getAlienTraceActionPlayer(pending || decisionState.alienTracePickerState, { allowFallback: inDebugMode });
    if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
    if (!fangzhou?.canUnlockCard2ForTrace?.(alienGameState, currentPlayer, traceType)) {
      rocketState.statusNote = "无法解锁该方舟卡牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (!canPlaceAnyStateExtraTrace(alienSlotId, traceType)) {
      rocketState.statusNote = "无法将该痕迹追加到方舟 state 额外位";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
    const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
    const beforeLogSnapshot = createActionLogImpactSnapshot(currentPlayer);
    if (!inDebugMode) {
      decisionState.alienTraceAction = null;
      if (decisionState.alienTracePickerState?.mode !== "debug-direct") {
        decisionState.alienTracePickerState = null;
      }
      closeAlienTracePicker();
    }

    const unlockResult = fangzhou.unlockCard2(alienGameState, currentPlayer, traceType);
    if (!unlockResult.ok) {
      rocketState.statusNote = unlockResult.message;
      renderStateReadout();
      return unlockResult;
    }
    const stateTraceResult = aliens.addExtraTrace(alienGameState, alienSlotId, traceType, currentPlayer.color);
    if (!stateTraceResult.ok) {
      rocketState.statusNote = stateTraceResult.message;
      renderStateReadout();
      return stateTraceResult;
    }
    addFangzhouUnlockedCardToHand(currentPlayer, unlockResult.handCard);

    const stateTraceReward = applyFangzhouUnlockStateTraceReward(alienSlotId, currentPlayer, traceType, stateTraceResult);
    rocketState.statusNote = [
      unlockResult.message,
      stateTraceResult.message,
      stateTraceReward.message,
    ].filter(Boolean).join("；");
    const traceEvents = !inDebugMode
      ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, fangzhou.ALIEN_ID)]
      : [];
    const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
    if (alienLabRestore?.changed) {
      rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
    }
    const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
    appendAlienTraceAfterRewardMessage(afterReward);

    if (pending?.type === "planet_reward_alien_trace") {
      beginEffectHistoryStep(pending.effectLabel || "方舟解锁卡牌", { logBefore: beforeLogSnapshot });
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复方舟解锁卡牌前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复方舟解锁卡牌前玩家状态",
      ));
      if (getCurrentActionEffect()) {
        getCurrentActionEffect().result = {
          ok: true,
          undoable: true,
          message: rocketState.statusNote,
          events: traceEvents,
          payload: {
            alienSlotId,
            traceType,
            unlocked: true,
            stateTrace: stateTraceResult,
            reward: stateTraceReward.reward || null,
            afterReward,
          },
        };
      }
      completeCurrentActionEffect();
    } else {
      beginQuickActionStep("fangzhou-unlock", rocketState.statusNote, { logBefore: beforeLogSnapshot });
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复方舟解锁卡牌前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复方舟解锁卡牌前玩家状态",
      ));
      completeQuickActionStep();
      settleCardTasksAfterEffect({ events: traceEvents, render: false });
    }

    renderAlienPanels();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return {
      ...unlockResult,
      message: rocketState.statusNote,
      stateTrace: stateTraceResult,
      reward: stateTraceReward.reward || null,
      events: traceEvents,
      afterReward,
    };
  }

function getAlienFangzhouCardArea(alienSlotId) {
    return [...els.alienFangzhouCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

function createFangzhouReservedButtons(player) {
    const reserved = fangzhou?.getPlayerCard2Reserved?.(alienGameState, player) || [];
    if (!reserved.length) return [];
    const debugUnlockMode = isDebugAlienTraceMode();
    return reserved.map((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reserved-card-button reserved-card-button-fangzhou";
      button.dataset.fangzhouReserved = card.traceType;
      if (debugUnlockMode) {
        button.dataset.fangzhouUnlock = card.traceType;
        button.classList.add("is-fangzhou-unlock-pending");
      }
      button.style.setProperty("--card-index", String(index + 1));
      button.title = debugUnlockMode
        ? `${card.label}（点击追加 state 额外痕迹并解锁）`
        : `${card.label}（未解锁）`;
      button.disabled = !debugUnlockMode;

      const image = document.createElement("img");
      image.className = "player-hand-card reserved-card";
      image.src = card.src;
      image.alt = card.label;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";
      image.setAttribute("aria-hidden", "true");
      button.append(image);
      return button;
    });
  }

function buildFangzhouCard1EffectQueue(effect, labelPrefix) {
    if (!effect) return [];
    const queueApi = aliens.fangzhouCard1Queue;
    if (!queueApi) return [];
    return queueApi.buildCard1EffectQueue(effect, labelPrefix, {
      getTraceTypeLabel: aliens.getTraceTypeLabel,
      formatGain: (gain) => players.formatResourceCost(gain),
    });
  }

function getFangzhouCard1RewardTargetOptions(flip, options = {}) {
    const targetPlayerId = flip?.targetPlayerId || flip?.playerId || options.targetPlayerId || options.playerId || null;
    const targetPlayerColor = flip?.targetPlayerColor || flip?.playerColor || options.targetPlayerColor || options.playerColor || null;
    const targetOptions = {};
    if (targetPlayerId) targetOptions.targetPlayerId = targetPlayerId;
    if (targetPlayerColor) targetOptions.targetPlayerColor = targetPlayerColor;
    return targetOptions;
  }

function enqueueFangzhouCard1RewardEffects(flips, flowLabel, options = {}) {
    const effects = [];
    for (const flip of flips || []) {
      if (!flip?.ok) continue;
      const targetOptions = getFangzhouCard1RewardTargetOptions(flip, options);
      effects.push(...buildFangzhouCard1EffectQueue(flip.effect, flip.label || flowLabel).map((effect) => ({
        ...effect,
        options: {
          ...(effect.options || {}),
          ...targetOptions,
          ...(options.scoreSourceKey ? { scoreSourceKey: options.scoreSourceKey } : {}),
        },
      })));
    }
    if (!effects.length) {
      return { ok: true, effects: [], message: "无奖励效果" };
    }

    const flowOptions = {
      actionType: options.actionType || "fangzhouBasic",
      ...options,
    };
    if (decisionState.actionEffectFlow && options.insertIntoCurrentFlow) {
      insertActionEffectsAfterCurrent(effects);
      renderActionEffectBar();
      return { ok: true, effects, inserted: true, message: flowLabel };
    }
    if (decisionState.actionEffectFlow && !options.forceNewFlow) {
      insertActionEffectsAfterCurrent(effects);
      renderActionEffectBar();
      return { ok: true, effects, inserted: true, message: flowLabel };
    }

    startCardEffectFlow(
      "fangzhou-card1-reward",
      flowLabel,
      effects,
      flowOptions,
    );
    return { ok: true, effects, message: flowLabel };
  }

function flipFangzhouCard1Rewards(count, tier = "basic") {
    const total = Math.max(0, Math.round(Number(count) || 0));
    const flips = [];
    for (let index = 0; index < total; index += 1) {
      const flip = fangzhou.flipCard1Reward(alienGameState, tier);
      if (!flip.ok) break;
      flips.push(flip);
    }
    if (flips.length) renderFangzhouCardDisplays();
    return flips;
  }

function applyFangzhouCard1Rewards(player, count = 1, tier = "basic", label = "方舟基础奖励", options = {}) {
    if (!fangzhou) return { ok: false, message: "方舟模块未加载" };
    const flips = flipFangzhouCard1Rewards(count, tier);
    if (!flips.length) return { ok: false, message: "没有可翻开的方舟奖励" };

    const queueResult = enqueueFangzhouCard1RewardEffects(
      flips,
      label,
      {
        actionType: tier === "advanced" ? "fangzhouAdvanced" : "fangzhouBasic",
        ...options,
        ...getTargetPlayerOptions(player, options),
      },
    );

    const messages = flips.map((flip) => flip.message).filter(Boolean);
    return {
      ok: true,
      flipResult: flips[0],
      flips,
      repeat: flips.length,
      message: messages.length > 1 ? messages.join("；") : (messages[0] || label),
      followUps: queueResult.effects || [],
    };
  }

function applyFangzhouCard1Reward(player, tier = "basic", label = "方舟基础奖励", options = {}) {
    return applyFangzhouCard1Rewards(player, 1, tier, label, options);
  }

function queueFangzhouBasicRewards(player, count, label = "方舟痕迹", options = {}) {
    const flips = flipFangzhouCard1Rewards(count, "basic");
    if (!flips.length) return [];
    const queueResult = enqueueFangzhouCard1RewardEffects(
      flips,
      `${label} 基础奖励`,
      { actionType: "fangzhouBasic", ...options, ...getTargetPlayerOptions(player, options) },
    );
    return [queueResult];
  }

function applyFangzhouTraceRewardToPlayer(player, reward, label = "方舟痕迹", options = {}) {
    if (!player || !reward) return { ok: false, message: "没有可结算的方舟奖励" };
    const messages = [];
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    const basicCount = Math.max(0, Math.round(Number(reward.basicRewardCount) || 0));
    let irreversible = null;
    if (basicCount > 0) {
      const basicResults = queueFangzhouBasicRewards(player, basicCount, label, {
        insertIntoCurrentFlow: isActionEffectFlowActive(),
        scoreSourceKey: options.scoreSourceKey,
      });
      for (const result of basicResults) {
        if (result.message) messages.push(result.message);
      }
      irreversible = {
        code: "fangzhou_card1_flip",
        reason: "方舟奖励牌翻开新牌",
      };
    }
    return {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message: `${label}：${messages.join("；") || "无奖励"}`,
    };
  }

function renderFangzhouCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienFangzhouCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.fangzhou || {};
      const cardIndex = state.displayedCard1Index;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-fangzhou-card-title";
      title.textContent = "方舟奖励牌";

      const stack = document.createElement("div");
      stack.className = "alien-fangzhou-card-stack";

      if (cardIndex != null) {
        const image = document.createElement("img");
        image.className = "alien-fangzhou-card-image";
        image.src = fangzhou.getCard1Src(cardIndex);
        image.alt = `方舟奖励牌 ${cardIndex}`;
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        stack.append(image);
      } else {
        const back = document.createElement("img");
        back.className = "alien-fangzhou-card-image";
        back.src = fangzhou.CARD1_BACK_SRC;
        back.alt = "方舟奖励牌背";
        stack.append(back);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "alien-fangzhou-card-view-button";
      button.dataset.fangzhouCardView = String(alienSlotId);
      button.textContent = "查看已翻开牌";
      area.replaceChildren(title, stack, button);
    }
  }

function openFangzhouCard1Dialog(alienSlotId = alienGameState.fangzhou?.revealedSlotId) {
    if (!fangzhou || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开方舟奖励牌窗口" };
    }
    const revealed = alienGameState.fangzhou?.card1Revealed || [];
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "方舟已翻开奖励牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = revealed.length
        ? `共 ${revealed.length} 张；若已翻开 5 张，下次获得奖励时会先洗混牌堆再翻出新牌。`
        : "尚未翻开任何方舟奖励牌。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    setScanTargetActionLayout("fangzhou-card-grid");
    els.scanTargetActions.replaceChildren(...revealed.map((index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button fangzhou-card-option";
      button.disabled = true;
      button.innerHTML = `<img class="jiuzhe-card-option-image" src="${fangzhou.getCard1Src(index)}" alt=""><small>方舟奖励 ${index}</small>`;
      return button;
    }));
    if (!revealed.length) {
      const empty = document.createElement("p");
      empty.textContent = "暂无已翻开牌";
      els.scanTargetActions.append(empty);
    }
    els.scanTargetOverlay.hidden = false;
    return { ok: true };
  }

function findPlayerForJiuzheEntry(entry) {
    if (!entry) return null;
    return getPlayerById(entry.playerId)
      || getPlayerByColor(entry.playerColor)
      || null;
  }

function applyJiuzheRewardToPlayer(player, reward, label = "九折痕迹") {
    if (!player || !reward) return { ok: false, message: "没有可结算的九折奖励" };
    const messages = [];
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "jiuzhe" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    if (reward.threat) {
      messages.push(`威胁度+${reward.threat}`);
    }
    if (reward.pickCard) {
      messages.push("精选1张牌");
    }
    return {
      ok: true,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

function findPlayerForYichangdianEntry(entry) {
    if (!entry) return null;
    return getPlayerById(entry.playerId)
      || getPlayerByColor(entry.playerColor)
      || null;
  }

function applyYichangdianRewardToPlayer(player, reward, label = "异常点奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的异常点奖励" };
    const messages = [];
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "yichangdian" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.pickCard) messages.push("精选1张牌");
    return {
      ok: true,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

function getAvailableDataTokenCount(player) {
    return data.ensurePlayerDataState(player).poolTokens.length;
  }

function spendAvailableDataTokens(player, count) {
    const needed = Math.max(0, Math.round(Number(count) || 0));
    if (needed <= 0) return { ok: true, removedTokens: [], message: "无需支付数据" };
    const dataState = data.ensurePlayerDataState(player);
    if (dataState.poolTokens.length < needed) {
      return {
        ok: false,
        message: `数据不足：需要 ${needed} 数据`,
      };
    }
    const removedTokens = [];
    for (let index = 0; index < needed; index += 1) {
      const sorted = [...dataState.poolTokens].sort((a, b) => a.slotIndex - b.slotIndex);
      const token = sorted[0];
      const poolIndex = dataState.poolTokens.findIndex((item) => item.id === token.id);
      if (poolIndex >= 0) {
        removedTokens.push(...dataState.poolTokens.splice(poolIndex, 1));
      }
    }
    player.resources.availableData = dataState.poolTokens.length;
    return {
      ok: true,
      removedTokens,
      message: `支付 ${needed} 数据`,
    };
  }

function applyBanrenmaRewardToPlayer(player, reward, label = "半人马奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的半人马奖励" };
    const messages = [];
    if (reward.payData) {
      const spendResult = spendAvailableDataTokens(player, reward.payData);
      if (!spendResult.ok) return spendResult;
      messages.push(spendResult.message);
    }
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.alienTrace) messages.push("任意外星人痕迹");
    return {
      ok: true,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

function applyAomomoRewardToPlayer(player, reward, label = "奥陌陌奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的奥陌陌奖励" };
    const messages = [];
    if (reward.payFossils) {
      const cost = { aomomoFossils: reward.payFossils };
      if (!players.canAfford(player, cost)) {
        return { ok: false, message: `化石不足：需要 ${reward.payFossils} 化石` };
      }
      const spend = players.spendResources(player, cost);
      if (!spend.ok) return spend;
      messages.push(`支付${reward.payFossils}化石`);
    }
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "aomomo" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    return {
      ok: true,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

function applyChongRewardToPlayer(player, reward, label = "虫族奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的虫族奖励" };
    const messages = [];
    let irreversible = null;
    const gain = reward.gain || {};
    const hasGain = Object.keys(gain).length > 0;
    if (hasGain) {
      players.gainResources(player, reward.gain);
      messages.push(formatChongGain(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "chong" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    const drawCount = Math.max(0, Math.round(Number(reward.drawCards) || 0));
    if (drawCount > 0) {
      let drawn = 0;
      for (let index = 0; index < drawCount; index += 1) {
        const result = blindDrawCardForPlayer(player);
        if (result.ok) drawn += 1;
      }
      messages.push(`${drawn}/${drawCount}盲抽`);
      irreversible = { code: "hidden_card_reveal", reason: "盲抽翻出新牌" };
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.pickCard) messages.push("精选1张牌");
    const hasDirectReward = hasGain
      || dataCount > 0
      || drawCount > 0
      || reward.pickAlienCard
      || reward.pickCard;
    if (reward.fossilId) {
      const fossilReward = reward.fossilPanel ? chong?.getFossilReward?.(reward.fossilId) : null;
      if (fossilReward) {
        const fossilResult = applyChongRewardToPlayer(player, fossilReward, `${label} ${reward.fossilId}`);
        if (fossilResult.message) messages.push(fossilResult.message);
        if (fossilResult.irreversible) irreversible = fossilResult.irreversible;
      } else if (!hasDirectReward) {
        messages.push(`化石 ${reward.fossilId}`);
      }
    }
    return {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

function applyAmibaRewardToPlayer(player, reward, label = "阿米巴奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的阿米巴奖励" };
    const messages = [];
    let irreversible = null;
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(formatChongGain(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "amiba" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    const drawCount = Math.max(0, Math.round(Number(reward.drawCards) || 0));
    if (drawCount > 0) {
      let drawn = 0;
      for (let index = 0; index < drawCount; index += 1) {
        const result = blindDrawCardForPlayer(player);
        if (result.ok) drawn += 1;
      }
      messages.push(`${drawn}/${drawCount}盲抽`);
      irreversible = { code: "hidden_card_reveal", reason: "盲抽翻出新牌" };
    }
    if (reward.region) {
      const regionResult = amiba?.resolveRegionReward?.(alienGameState, reward.region);
      for (const symbolResult of regionResult?.results || []) {
        const symbolRewardResult = applyAmibaRewardToPlayer(
          player,
          symbolResult.reward,
          `${amiba.formatRegionLabel(reward.region)}区域 ${symbolResult.symbolId}`,
        );
        if (symbolRewardResult.message) messages.push(symbolRewardResult.message);
        if (symbolRewardResult.irreversible) irreversible = symbolRewardResult.irreversible;
      }
      if (!regionResult?.results?.length) messages.push(`${amiba?.formatRegionLabel?.(reward.region) || reward.region}区域无 symbol`);
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.pickCard) messages.push("精选1张牌");
    return {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

function applyRunezuRewardToPlayer(player, reward, label = "符文族奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的符文族奖励" };
    const messages = [];
    let irreversible = null;
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(formatChongGain(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "runezu" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    const drawCount = Math.max(0, Math.round(Number(reward.drawCards) || 0));
    if (drawCount > 0) {
      let drawn = 0;
      for (let index = 0; index < drawCount; index += 1) {
        const result = blindDrawCardForPlayer(player);
        if (result.ok) drawn += 1;
      }
      messages.push(`${drawn}/${drawCount}盲抽`);
      irreversible = { code: "hidden_card_reveal", reason: "盲抽翻出新牌" };
    }
    if (reward.panelSymbol && reward.panelSymbolSlotId) {
      const symbolResult = runezu?.takePanelSymbol?.(alienGameState, reward.panelSymbolSlotId, player, {
        refill: Boolean(reward.refillPanelSymbol),
      });
      if (symbolResult?.ok) {
        messages.push(symbolResult.message);
      } else {
        messages.push(symbolResult?.message || "无白框symbol");
      }
    }
    if (reward.symbolId) {
      runezu?.gainPlayerSymbol?.(player, reward.symbolId);
      messages.push(`获得${runezu?.formatSymbolLabel?.(reward.symbolId) || reward.symbolId}`);
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.pickCard) messages.push("精选1张牌");
    return {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

function applyRunezuSymbolReward(player, symbolId, label = "符文族symbol奖励") {
    const resolved = runezu?.getTraceFaceRewardForSymbol?.(alienGameState, symbolId);
    if (!resolved?.ok) {
      return {
        ok: true,
        undoable: true,
        message: resolved?.message || `${runezu?.formatSymbolLabel?.(symbolId) || symbolId}无可结算黑圈奖励`,
      };
    }
    const result = applyRunezuRewardToPlayer(
      player,
      resolved.reward,
      `${label} ${runezu?.formatSymbolLabel?.(symbolId) || symbolId}(${runezu?.formatFaceSymbolSlotLabel?.(resolved.position) || resolved.position})`,
    );
    return {
      ...result,
      symbolId,
      position: resolved.position,
    };
  }

function claimRunezuSourceSymbolWithHistory(sourceType, sourceId, player, historyLabel = "获得符文族symbol") {
    if (!runezu || !alienGameState.runezu?.revealInitialized || !sourceType || !sourceId || !player) return null;
    const beforeAlienState = structuredClone(alienGameState);
    const beforePlayerState = structuredClone(playerState);
    const result = runezu.claimSourceSymbol(alienGameState, sourceType, sourceId, player);
    if (!result.ok) return result;
    const alienRestore = historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      `恢复${historyLabel}前外星人状态`,
    );
    const playerRestore = historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      `恢复${historyLabel}前玩家状态`,
    );
    if (quickActionHistory.hasSession() && !actionHistory.hasSession()) {
      recordQuickHistoryCommand(alienRestore);
      recordQuickHistoryCommand(playerRestore);
    } else if (actionHistory.hasSession() || uiRuntimeState.effectStepActive) {
      recordHistoryCommand(alienRestore);
      recordHistoryCommand(playerRestore);
    }
    return result;
  }

function closeRunezuCardGainDialog() {
    alienCardGainSessions.runezuCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openRunezuCardGainDialog(options = {}) {
    if (!runezu || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开符文族牌获取窗口" };
    }
    const state = runezu.ensureRunezuState(alienGameState);
    if (state.displayedCardIndex == null) runezu.drawDisplayedCardIndex?.(alienGameState);
    alienCardGainSessions.runezuCardGain = {
      playerId: options.player?.id || getCurrentPlayer()?.id || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "符文族外星人牌",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "获得符文族牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "选择当前展示牌、盲抽符文族牌，或取消。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const cardIndex = alienGameState.runezu?.displayedCardIndex;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "scan-target-option-button";
    confirm.dataset.runezuCardGain = "displayed";
    confirm.innerHTML = cardIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${runezu.getCardSrc(cardIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌 ${cardIndex}</small>`;
    confirm.disabled = cardIndex == null;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.runezuCardGain = "blind";
    blind.innerHTML = "盲抽<small>从符文族牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.runezuCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得符文族牌</small>";

    els.scanTargetActions.replaceChildren(confirm, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "符文族牌：请选择获取方式";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function finishRunezuCardGain(message, result = null) {
    const pending = alienCardGainSessions.runezuCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeRunezuCardGainDialog();
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      const existingResult = getCurrentActionEffect().result || {};
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复符文族牌获取前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复符文族牌获取前玩家状态",
      ));
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        events: existingResult.events || [],
        payload: result,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return getCurrentActionEffect()?.result || { ok: true, message };
    }
    if (irreversible && pending) {
      beginQuickActionStep("runezu-card", pending.effectLabel || "符文族外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复符文族牌获取前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复符文族牌获取前玩家状态",
      ));
      completeQuickActionStep(message, {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      });
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerHand();
    renderPlayerStats();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return { ok: true, message, result };
  }

function handleRunezuCardGainChoice(choice) {
    if (!alienCardGainSessions.runezuCardGain) return { ok: false, message: "没有符文族牌获取流程" };
    const pending = alienCardGainSessions.runezuCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到符文族牌获取玩家" };
    if (choice === "cancel") {
      return finishRunezuCardGain("已取消符文族外星人牌");
    }
    const result = choice === "blind"
      ? runezu.blindDrawCard(alienGameState)
      : runezu.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      return finishRunezuCardGain(result.message || "符文族牌获取失败", result);
    }
    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    return finishRunezuCardGain(result.message, result);
  }

function closeAmibaCardGainDialog() {
    alienCardGainSessions.amibaCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openAmibaCardGainDialog(options = {}) {
    if (!amiba || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开阿米巴牌获取窗口" };
    }
    const state = amiba.ensureAmibaState(alienGameState);
    if (state.displayedCardIndex == null) amiba.drawDisplayedCardIndex(alienGameState);
    alienCardGainSessions.amibaCardGain = {
      playerId: options.player?.id || getCurrentPlayer()?.id || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "阿米巴外星人牌",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "获得阿米巴牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "选择当前展示牌、盲抽阿米巴牌，或取消。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const cardIndex = alienGameState.amiba?.displayedCardIndex;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "scan-target-option-button";
    confirm.dataset.amibaCardGain = "displayed";
    confirm.innerHTML = cardIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${amiba.getCardSrc(cardIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌 ${cardIndex}</small>`;
    confirm.disabled = cardIndex == null;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.amibaCardGain = "blind";
    blind.innerHTML = "盲抽<small>从阿米巴牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.amibaCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得阿米巴牌</small>";

    els.scanTargetActions.replaceChildren(confirm, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "阿米巴牌：请选择获取方式";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function finishAmibaCardGain(message, result = null) {
    const pending = alienCardGainSessions.amibaCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeAmibaCardGainDialog();
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      const existingResult = getCurrentActionEffect().result || {};
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复阿米巴牌获取前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复阿米巴牌获取前玩家状态",
      ));
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        events: existingResult.events || [],
        payload: result,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return getCurrentActionEffect()?.result || { ok: true, message };
    }
    if (irreversible && pending) {
      beginQuickActionStep("amiba-card", pending.effectLabel || "阿米巴外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复阿米巴牌获取前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复阿米巴牌获取前玩家状态",
      ));
      completeQuickActionStep(message, {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      });
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerHand();
    renderPlayerStats();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return { ok: true, message, result };
  }

function handleAmibaCardGainChoice(choice) {
    if (!alienCardGainSessions.amibaCardGain) return { ok: false, message: "没有阿米巴牌获取流程" };
    const pending = alienCardGainSessions.amibaCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到阿米巴牌获取玩家" };
    if (choice === "cancel") {
      return finishAmibaCardGain("已取消阿米巴外星人牌");
    }
    const result = choice === "blind"
      ? amiba.blindDrawCard(alienGameState)
      : amiba.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      return finishAmibaCardGain(result.message || "阿米巴牌获取失败", result);
    }
    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    return finishAmibaCardGain(result.message, result);
  }

function closeAomomoCardGainDialog() {
    alienCardGainSessions.aomomoCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openAomomoCardGainDialog(options = {}) {
    if (!aomomo || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开奥陌陌牌获取窗口" };
    }
    const state = aomomo.ensureAomomoState(alienGameState);
    if (state.displayedCardIndex == null) aomomo.drawDisplayedCardIndex(alienGameState);
    alienCardGainSessions.aomomoCardGain = {
      playerId: options.player?.id || getCurrentPlayer()?.id || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "奥陌陌外星人牌",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
      deferredEvents: Array.isArray(options.deferredEvents) ? options.deferredEvents : [],
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "获得奥陌陌牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "选择当前展示牌、盲抽奥陌陌牌，或取消。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const cardIndex = alienGameState.aomomo?.displayedCardIndex;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "scan-target-option-button";
    confirm.dataset.aomomoCardGain = "displayed";
    confirm.innerHTML = cardIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${aomomo.getCardSrc(cardIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌 ${cardIndex}</small>`;
    confirm.disabled = cardIndex == null;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.aomomoCardGain = "blind";
    blind.innerHTML = "盲抽<small>从奥陌陌牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.aomomoCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得奥陌陌牌</small>";

    els.scanTargetActions.replaceChildren(confirm, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "奥陌陌牌：请选择获取方式";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function finishAomomoCardGain(message, result = null) {
    const pending = alienCardGainSessions.aomomoCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeAomomoCardGainDialog();
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      const existingResult = getCurrentActionEffect().result || {};
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复奥陌陌牌获取前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复奥陌陌牌获取前玩家状态",
      ));
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        events: existingResult.events || [],
        payload: result,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return getCurrentActionEffect()?.result || { ok: true, message };
    }
    if (irreversible && pending) {
      beginQuickActionStep("aomomo-card", pending.effectLabel || "奥陌陌外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复奥陌陌牌获取前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复奥陌陌牌获取前玩家状态",
      ));
      completeQuickActionStep(message, {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      });
    }
    rocketState.statusNote = message;
    if (pending?.deferredEvents?.length) {
      settleCardTasksAfterEffect({ events: pending.deferredEvents, render: false });
    }
    renderAlienPanels();
    renderPlayerHand();
    renderPlayerStats();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return { ok: true, message, result };
  }

function handleAomomoCardGainChoice(choice) {
    if (!alienCardGainSessions.aomomoCardGain) return { ok: false, message: "没有奥陌陌牌获取流程" };
    const pending = alienCardGainSessions.aomomoCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到奥陌陌牌获取玩家" };
    if (choice === "cancel") {
      return finishAomomoCardGain("已取消奥陌陌外星人牌");
    }
    const result = choice === "blind"
      ? aomomo.blindDrawCard(alienGameState)
      : aomomo.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      return finishAomomoCardGain(result.message || "奥陌陌牌获取失败", result);
    }
    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    return finishAomomoCardGain(result.message, result);
  }

function closeAmibaSymbolChoiceDialog() {
    alienChoiceSessions.amibaSymbolChoice = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openAmibaSymbolChoiceDialog(options = {}) {
    if (!amiba) {
      return { ok: false, message: "无法打开阿米巴 symbol 选择窗口" };
    }
    const player = options.player || getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };
    const region = options.region || options.effect?.options?.region || null;
    const symbols = amiba.listSymbolsInRegion(alienGameState, region);
    alienChoiceSessions.amibaSymbolChoice = {
      region,
      playerId: player.id,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      triggerMatch: options.triggerMatch || null,
      effectLabel: options.effectLabel || options.effect?.label || "阿米巴 symbol 奖励",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
      beforeCardState: options.beforeCardState || structuredClone(cardState),
      symbolSlotIds: symbols.map((symbol) => symbol.slotId),
    };
    if (!els.scanTargetOverlay || !els.scanTargetActions || !document?.createElement) {
      rocketState.statusNote = "阿米巴 symbol：请选择一个 symbol";
      renderStateReadout();
      return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
    }
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "阿米巴 symbol";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = `选择一个${amiba.formatRegionLabel(region)}区域内的 symbol 结算奖励。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const nodes = symbols.map((symbol) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button amiba-symbol-choice-button";
      button.dataset.amibaSymbolChoice = symbol.slotId;
      button.innerHTML = `<img class="amiba-symbol-choice-image" src="${amiba.getSymbolSrc(symbol.symbolId)}" alt="" aria-hidden="true"><small>${symbol.symbolId}：${amiba.formatSymbolReward(symbol.symbolId)}；${amiba.formatSymbolSlotLabel?.(symbol.slotId) || symbol.slotId}</small>`;
      return button;
    });
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.textContent = "该区域当前没有 symbol。";
      nodes.push(empty);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.amibaSymbolChoice = "cancel";
    cancel.innerHTML = "取消<small>不结算 symbol</small>";
    nodes.push(cancel);

    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "阿米巴 symbol：请选择一个 symbol";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function finishAmibaSymbolChoice(message, payload = {}, options = {}) {
    const pending = alienChoiceSessions.amibaSymbolChoice;
    closeAmibaSymbolChoiceDialog();
    if (pending?.triggerMatch?.card && pending?.triggerMatch?.trigger && options.consumeTrigger !== false) {
      cardEffects.consumeTrigger(pending.triggerMatch.card, pending.triggerMatch.trigger.id);
      discardReservedCardIfFinished(getPlayerById(pending.playerId) || getCurrentPlayer(), pending.triggerMatch.card);
    }
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      getCurrentActionEffect().result = {
        ok: true,
        undoable: options.undoable !== false,
        message,
        payload,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCardsFromTaskState();
      completeCurrentActionEffect();
      renderStateReadout();
      return { ok: true, message, payload };
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    if (pending?.triggerMatch && continueAfterCardTriggerResolution()) {
      return { ok: true, message, payload };
    }
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message, payload };
  }

function handleAmibaSymbolChoice(choice) {
    if (!alienChoiceSessions.amibaSymbolChoice) return { ok: false, message: "没有阿米巴 symbol 选择流程" };
    const pending = alienChoiceSessions.amibaSymbolChoice;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到阿米巴 symbol 玩家" };
    if (choice === "cancel") {
      return finishAmibaSymbolChoice("已取消阿米巴 symbol 奖励", { cancelled: true }, { consumeTrigger: false });
    }
    const beforeAlienState = pending.beforeAlienState;
    const beforePlayerState = pending.beforePlayerState;
    const beforeCardState = pending.beforeCardState;
    const slotId = String(choice || "");
    const result = amiba.resolveSymbolAtSlot(alienGameState, slotId);
    if (!result.ok) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }
    const rewardResult = applyAmibaRewardToPlayer(player, result.reward, `${pending.effectLabel} ${result.symbolId}`);
    const message = `${rewardResult.message}；${result.message}`;

    if (pending.fromEffectFlow) {
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复阿米巴 symbol 前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复阿米巴 symbol 前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        cardState,
        beforeCardState,
        "恢复阿米巴 symbol 前牌区状态",
      ));
    } else {
      beginQuickActionStep("amiba-symbol", pending.effectLabel);
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复阿米巴 symbol 前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复阿米巴 symbol 前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        cardState,
        beforeCardState,
        "恢复阿米巴 symbol 前牌区状态",
      ));
      if (pending?.triggerMatch?.card && pending?.triggerMatch?.trigger) {
        cardEffects.consumeTrigger(pending.triggerMatch.card, pending.triggerMatch.trigger.id);
        discardReservedCardIfFinished(player, pending.triggerMatch.card);
      }
      completeQuickActionStep(message, rewardResult.irreversible ? {
        irreversibleCode: rewardResult.irreversible.code,
        irreversibleReason: rewardResult.irreversible.reason,
      } : {});
    }
    return finishAmibaSymbolChoice(message, { symbol: result }, {
      undoable: rewardResult.undoable !== false,
      consumeTrigger: pending.fromEffectFlow,
    });
  }

function closeAmibaTraceRemovalDialog() {
    alienChoiceSessions.amibaTraceRemoval = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openAmibaTraceRemovalDialog(effect) {
    if (!amiba || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开阿米巴痕迹移除窗口" };
    }
    const player = getCurrentPlayer();
    const alienSlotId = alienGameState.amiba?.revealedSlotId;
    const options = amiba.listPlayerTraceOptions(alienGameState, alienSlotId, player);
    alienChoiceSessions.amibaTraceRemoval = {
      playerId: player.id,
      alienSlotId,
      effectLabel: effect.label,
      beforeAlienState: structuredClone(alienGameState),
      beforePlayerState: structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "移除阿米巴痕迹";
    if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择一个自己的阿米巴痕迹，按被移除的颜色结算对应区域奖励。";
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    const nodes = options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button";
      button.dataset.amibaTraceRemove = `${option.traceType}:${option.position}`;
      button.innerHTML = `${option.label}<small>${amiba.formatRegionLabel(option.region)}区域奖励</small>`;
      return button;
    });
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.textContent = "你没有可移除的阿米巴痕迹。";
      nodes.push(empty);
    }
    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "阿米巴：请选择要移除的痕迹";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function handleAmibaTraceRemovalChoice(choice) {
    if (!alienChoiceSessions.amibaTraceRemoval) return { ok: false, message: "没有阿米巴痕迹移除流程" };
    const pending = alienChoiceSessions.amibaTraceRemoval;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到阿米巴痕迹玩家" };
    if (choice === "cancel") {
      closeAmibaTraceRemovalDialog();
      rocketState.statusNote = "已取消阿米巴痕迹移除";
      if (getCurrentActionEffect()) {
        getCurrentActionEffect().result = { ok: true, undoable: true, message: rocketState.statusNote };
        completeCurrentActionEffect();
      }
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }
    const [traceType, positionText] = String(choice || "").split(":");
    beginEffectHistoryStep(pending.effectLabel || "阿米巴痕迹移除");
    const removeResult = amiba.removePlayerTrace(alienGameState, pending.alienSlotId, traceType, Number(positionText), player);
    if (!removeResult.ok) {
      endEffectHistoryStep();
      rocketState.statusNote = removeResult.message;
      renderStateReadout();
      return removeResult;
    }
    const rewardResult = applyAmibaRewardToPlayer(player, removeResult.reward, removeResult.message);
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      pending.beforeAlienState,
      "恢复阿米巴移除痕迹前外星人状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      pending.beforePlayerState,
      "恢复阿米巴移除痕迹前玩家状态",
    ));
    closeAmibaTraceRemovalDialog();
    const message = rewardResult.message;
    if (getCurrentActionEffect()) {
      getCurrentActionEffect().result = {
        ok: true,
        undoable: true,
        message,
        payload: { removed: removeResult },
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return { ok: true, message };
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerStats();
    renderStateReadout();
    return { ok: true, message };
  }

function applyChongFossilRewardToPlayer(player, fossilId, label = "虫族化石", repeat = 1) {
    const total = Math.max(1, Math.round(Number(repeat) || 1));
    const reward = chong?.getFossilReward?.(fossilId);
    if (!reward) return { ok: false, message: `找不到化石奖励 ${fossilId}` };
    const messages = [];
    let irreversible = null;
    for (let index = 0; index < total; index += 1) {
      const result = applyChongRewardToPlayer(player, reward, `${label}${total > 1 ? ` ${index + 1}/${total}` : ""}`);
      if (result.message) messages.push(result.message);
      if (result.irreversible) irreversible = result.irreversible;
    }
    return {
      ok: true,
      reward,
      undoable: !irreversible,
      irreversible,
      message: messages.join("；"),
    };
  }

function closeYichangdianCardGainDialog() {
    alienCardGainSessions.yichangdianCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openYichangdianCardGainDialog(options = {}) {
    if (!yichangdian || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开异常点牌窗口" };
    }
    const player = options.player || getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };
    alienCardGainSessions.yichangdianCardGain = {
      playerId: player.id,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "异常点外星人牌",
      beforePlayerState: options.beforePlayerState || null,
      beforeAlienState: options.beforeAlienState || null,
    };

    const displayedIndex = alienGameState.yichangdian?.displayedCardIndex;
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "异常点外星人牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = `${player.colorLabel}玩家可以拿取当前展示牌、盲抽一张异常点牌，或取消。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;

    const nodes = [];
    const displayed = document.createElement("button");
    displayed.type = "button";
    displayed.className = "scan-target-option-button jiuzhe-card-option yichangdian-card-option";
    displayed.dataset.yichangdianCardGain = "displayed";
    displayed.disabled = displayedIndex == null;
    displayed.innerHTML = displayedIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${yichangdian.getCardSrc(displayedIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌</small>`;
    nodes.push(displayed);

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.yichangdianCardGain = "blind";
    blind.innerHTML = "盲抽<small>从异常点牌堆随机获得 1 张</small>";
    nodes.push(blind);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.yichangdianCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得外星人牌</small>";
    nodes.push(cancel);

    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    return { ok: true, message: "异常点牌窗口已打开" };
  }

function finishYichangdianCardGain(message, result = null) {
    const pending = alienCardGainSessions.yichangdianCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeYichangdianCardGainDialog();
    rocketState.statusNote = message;
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        payload: { yichangdianCard: result?.card || null },
      };
      completeCurrentActionEffect();
    }
    renderAlienPanels();
    renderRockets();
    renderPlayerStats();
    renderPlayerHand();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return result || { ok: true, message };
  }

function handleYichangdianCardGainChoice(choice) {
    if (!alienCardGainSessions.yichangdianCardGain) return { ok: false, message: "没有异常点牌获取流程" };
    const pending = alienCardGainSessions.yichangdianCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到异常点牌玩家" };

    if (choice === "cancel") {
      return finishYichangdianCardGain("已取消异常点外星人牌");
    }

    const beforePlayerState = pending.beforePlayerState || structuredClone(playerState);
    const beforeAlienState = pending.beforeAlienState || structuredClone(alienGameState);
    const result = choice === "blind"
      ? yichangdian.blindDrawCard(alienGameState)
      : yichangdian.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    const irreversible = getAlienCardGainIrreversible(result);
    if (!pending.fromEffectFlow) {
      beginQuickActionStep("yichangdian-card", pending.effectLabel || "异常点外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复异常点拿牌前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复异常点拿牌前外星人状态",
      ));
      completeQuickActionStep(null, irreversible ? {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      } : {});
    }
    return finishYichangdianCardGain(result.message, result);
  }

function closeBanrenmaCardGainDialog() {
    alienCardGainSessions.banrenmaCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openBanrenmaCardGainDialog(options = {}) {
    if (!banrenma || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开半人马牌窗口" };
    }
    const player = options.player || getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };
    alienCardGainSessions.banrenmaCardGain = {
      playerId: player.id,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "半人马外星人牌",
      beforePlayerState: options.beforePlayerState || null,
      beforeAlienState: options.beforeAlienState || null,
      baseResult: options.baseResult || null,
    };

    const displayedIndex = alienGameState.banrenma?.displayedCardIndex;
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "半人马外星人牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = `${player.colorLabel}玩家可以拿取当前展示牌，或盲抽一张半人马牌。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;

    const displayed = document.createElement("button");
    displayed.type = "button";
    displayed.className = "scan-target-option-button jiuzhe-card-option banrenma-card-option";
    displayed.dataset.banrenmaCardGain = "displayed";
    displayed.disabled = displayedIndex == null;
    displayed.innerHTML = displayedIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${banrenma.getCardSrc(displayedIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌</small>`;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.banrenmaCardGain = "blind";
    blind.innerHTML = "盲抽<small>从半人马牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.banrenmaCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得外星人牌</small>";

    els.scanTargetActions.replaceChildren(displayed, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    return { ok: true, message: "半人马牌窗口已打开" };
  }

function finishBanrenmaCardGain(message, result = null) {
    const pending = alienCardGainSessions.banrenmaCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    const baseResult = pending?.baseResult || null;
    const combinedMessage = [baseResult?.message, message].filter(Boolean).join("；") || message;
    closeBanrenmaCardGainDialog();
    rocketState.statusNote = combinedMessage;
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible && baseResult?.undoable !== false,
        irreversible,
        message: combinedMessage,
        payload: { ...(baseResult?.payload || {}), banrenmaCard: result?.card || null },
      };
      completeCurrentActionEffect();
    }
    renderAlienPanels();
    renderRockets();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    maybeContinueAlienRevealQueuedOpportunities();
    renderStateReadout();
    return result || { ok: true, message };
  }

function handleBanrenmaCardGainChoice(choice) {
    if (!alienCardGainSessions.banrenmaCardGain) return { ok: false, message: "没有半人马牌获取流程" };
    const pending = alienCardGainSessions.banrenmaCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到半人马牌玩家" };

    if (choice === "cancel") {
      return finishBanrenmaCardGain("已取消半人马外星人牌");
    }

    const beforePlayerState = pending.beforePlayerState || structuredClone(playerState);
    const beforeAlienState = pending.beforeAlienState || structuredClone(alienGameState);
    const result = choice === "blind"
      ? banrenma.blindDrawCard(alienGameState)
      : banrenma.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    const irreversible = getAlienCardGainIrreversible(result);
    if (!pending.fromEffectFlow) {
      beginQuickActionStep("banrenma-card", pending.effectLabel || "半人马外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复半人马拿牌前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复半人马拿牌前外星人状态",
      ));
      completeQuickActionStep(null, irreversible ? {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      } : {});
    }
    return finishBanrenmaCardGain(result.message, result);
  }

function closeChongCardGainDialog() {
    alienCardGainSessions.chongCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openChongCardGainDialog(options = {}) {
    if (!chong || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开虫族牌获取窗口" };
    }
    const state = chong.ensureChongState(alienGameState);
    if (state.displayedCardIndex == null) chong.drawDisplayedCardIndex(alienGameState);
    alienCardGainSessions.chongCardGain = {
      playerId: options.player?.id || getCurrentPlayer()?.id || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "虫族外星人牌",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "获得虫族牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "选择当前展示牌、盲抽虫族牌，或取消。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const cardIndex = alienGameState.chong?.displayedCardIndex;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "scan-target-option-button jiuzhe-card-option chong-card-option";
    confirm.dataset.chongCardGain = "displayed";
    confirm.innerHTML = cardIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${chong.getCardSrc(cardIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌 ${cardIndex}</small>`;
    confirm.disabled = cardIndex == null;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.chongCardGain = "blind";
    blind.innerHTML = "盲抽<small>从虫族牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.chongCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得虫族牌</small>";

    els.scanTargetActions.replaceChildren(confirm, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "虫族牌：请选择获取方式";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function finishChongCardGain(message, result = null) {
    const pending = alienCardGainSessions.chongCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeChongCardGainDialog();
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复虫族牌获取前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复虫族牌获取前玩家状态",
      ));
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        payload: result,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return getCurrentActionEffect()?.result || { ok: true, message };
    }
    if (irreversible && pending) {
      beginQuickActionStep("chong-card", pending.effectLabel || "虫族外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复虫族牌获取前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复虫族牌获取前玩家状态",
      ));
      completeQuickActionStep(message, {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      });
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerHand();
    renderPlayerStats();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return { ok: true, message, result };
  }

function handleChongCardGainChoice(choice) {
    if (!alienCardGainSessions.chongCardGain) return { ok: false, message: "没有虫族牌获取流程" };
    const pending = alienCardGainSessions.chongCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到虫族牌获取玩家" };
    if (choice === "cancel") {
      return finishChongCardGain("已取消虫族外星人牌");
    }
    const result = choice === "blind"
      ? chong.blindDrawCard(alienGameState)
      : chong.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      return finishChongCardGain(result.message || "虫族牌获取失败", result);
    }
    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    return finishChongCardGain(result.message, result);
  }

function getChongPlanetLabel(planetId) {
    const labels = {
      earth: "地球",
      mars: "火星",
      jupiter: "木星",
      saturn: "土星",
    };
    return planetRewards?.PLANET_NAMES?.[planetId] || labels[planetId] || planetId || "星球";
  }

function formatChongGain(gain = {}) {
    const parts = [];
    if (gain.score != null) parts.push(`${gain.score}分`);
    if (gain.credits != null) parts.push(`${gain.credits}信用点`);
    if (gain.energy != null) parts.push(`${gain.energy}能量`);
    if (gain.publicity != null) parts.push(`${gain.publicity}宣传`);
    if (gain.additionalPublicScan != null) parts.push(`${gain.additionalPublicScan}额外公共扫描`);
    if (gain.handSize != null) parts.push(`${gain.handSize}张牌`);
    if (gain.availableData != null) parts.push(`${gain.availableData}数据`);
    return parts.join(" + ");
  }

function formatChongFossilRewardSummary(fossilId) {
    const reward = chong?.getFossilReward?.(fossilId);
    if (!reward) return "未知奖励";
    const parts = [];
    if (Object.keys(reward.gain || {}).length) parts.push(formatChongGain(reward.gain));
    if (reward.dataCount) parts.push(`${reward.dataCount}数据`);
    if (reward.drawCards) parts.push(`${reward.drawCards}盲抽`);
    if (reward.pickCard) parts.push("精选1张牌");
    if (reward.pickAlienCard) parts.push("外星人牌");
    return parts.join(" + ") || "无奖励";
  }

function restoreMutableObject(target, snapshot) {
    if (!target || !snapshot) return;
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, structuredClone(snapshot));
  }

function closeChongFossilChoiceDialog() {
    alienChoiceSessions.chongFossilChoice = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function closeChongTaskCompletionDialog() {
    decisionSessions.clear("chong_task_completion");
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openChongFossilChoiceDialog(options = {}) {
    if (!chong) return { ok: false, message: "虫族规则模块未初始化" };
    const player = options.player || getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };

    const planetIds = options.planetIds?.length
      ? options.planetIds
      : options.planetId
        ? [options.planetId]
        : ["jupiter", "saturn"];
    for (const planetId of planetIds) {
      chong.revealPlanetFossilsToPlayer(alienGameState, planetId, player);
    }
    const fossils = Array.isArray(options.fossils)
      ? options.fossils.filter(Boolean)
      : planetIds.flatMap((planetId) => chong.getAvailablePlanetFossils(alienGameState, planetId));
    alienChoiceSessions.chongFossilChoice = {
      mode: options.mode || "reward",
      playerId: player.id,
      planetIds,
      planetId: options.planetId || null,
      task: options.task || null,
      card: options.card || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "虫族化石",
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforeCardState: options.beforeCardState || structuredClone(cardState),
      fossilIds: fossils.map((fossil) => fossil.fossilId),
    };

    rocketState.statusNote = "虫族化石：请选择 1 枚化石";
    if (!els.scanTargetOverlay || !els.scanTargetActions || typeof document === "undefined") {
      return { ok: true, awaitingChoice: true, fossils, message: rocketState.statusNote };
    }

    if (els.scanTargetTitle) els.scanTargetTitle.textContent = options.title || "选择虫族化石";
    if (els.scanTargetSubtitle) {
      const planetText = planetIds.map(getChongPlanetLabel).join(" / ");
      els.scanTargetSubtitle.textContent = options.subtitle || `${planetText} 的化石已查看。选择 1 枚继续。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const nodes = fossils.map((fossil) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button chong-fossil-choice-button";
      button.dataset.chongFossilChoice = fossil.fossilId;
      const fossilPlanetId = fossil.currentPlanetId || fossil.planetId || options.planetId || planetIds[0] || null;
      const planetLabel = getChongPlanetLabel(fossilPlanetId);
      const sourceLabel = fossil.rewardChoiceSource === "transport" || fossil.status === "transported"
        ? `${planetLabel} 搬运化石`
        : planetLabel;
      const summary = formatChongFossilRewardSummary(fossil.fossilId);
      button.setAttribute("aria-label", `${sourceLabel} ${fossil.fossilId}：${summary}`);
      button.title = `${sourceLabel} ${fossil.fossilId}：${summary}`;

      const image = document.createElement("img");
      image.className = "chong-fossil-choice-image";
      image.src = chong.getFossilSrc(fossil.fossilId);
      image.alt = `${sourceLabel} ${fossil.fossilId}`;
      image.width = 128;
      image.height = 128;
      image.decoding = "async";

      const meta = document.createElement("small");
      meta.textContent = summary;
      button.append(image, meta);
      return button;
    });
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.textContent = "没有可用化石。";
      nodes.push(empty);
    }
    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    renderAlienPanels();
    renderStateReadout();
    return { ok: true, awaitingChoice: true, fossils, message: rocketState.statusNote };
  }

function createChongTransportTokenForFossil(fossil, player) {
    const sector = getPlanetSectorCoordinate(fossil.planetId);
    const tokenResult = rocketActions.createMovableTokenAtSector(rocketState, sector, {
      kind: rocketActions.ROCKET_KIND.CHONG_FOSSIL,
      playerId: player.id,
      color: player.color,
      tokenSrc: chong.FOSSIL_BACK_SRC,
      fossilId: fossil.fossilId,
      label: fossil.fossilId,
      cargo: {
        alien: "chong",
        fossilId: fossil.fossilId,
      },
    });
    if (!tokenResult.ok) return tokenResult;
    chong.attachTransportRocket(alienGameState, fossil.fossilId, tokenResult.rocket.id);
    return tokenResult;
  }

function openChongPickCardFollowUp(player, fromEffectFlow, effectLabel) {
    return beginCardSelection({
      type: "chong_pick_card",
      player,
      allowBlindDraw: true,
      fromEffectFlow,
      effectLabel,
      beforePlayerState: structuredClone(playerState),
      beforeCardState: structuredClone(cardState),
      logBefore: createActionLogImpactSnapshot(),
    });
  }

function keepExistingMainActionPendingAfterChongTask() {
    if (actionHistory.hasSession()) {
      markActionPending();
    }
  }

function failChongTaskCompletion(message) {
    rocketState.statusNote = message || "虫族任务完成失败";
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return { ok: false, message: rocketState.statusNote };
  }

function finishChongFossilEffect(message, payload = {}, options = {}) {
    const currentEffect = getCurrentActionEffect();
    if (currentEffect && options.completeEffect !== false) {
      currentEffect.result = {
        ok: true,
        undoable: options.undoable !== false,
        message,
        payload,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderRockets();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCardsFromTaskState();
      completeCurrentActionEffect();
      renderStateReadout();
    } else {
      rocketState.statusNote = message;
      renderAlienPanels();
      renderRockets();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCardsFromTaskState();
      updateActionButtons();
      renderStateReadout();
    }
    return { ok: true, message, payload };
  }

function completeChongTraceTaskWithFossil(pending, fossilId, player) {
    const card = pending.card;
    const task = pending.task || card?.chongTask;
    const rewardResult = applyChongFossilRewardToPlayer(
      player,
      fossilId,
      `完成 ${cards.getCardLabel(card)}：${fossilId}`,
    );
    if (!rewardResult.ok) {
      closeChongFossilChoiceDialog();
      return failChongTaskCompletion(rewardResult.message || "虫族化石奖励结算失败");
    }
    card.chongTaskCompleted = true;
    removeReservedCardToDiscard(player, card);
    incrementCompletedTaskCount(player);

    beginQuickActionStep("chong-trace-task", `完成虫族任务：${cards.getCardLabel(card)}`);
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      pending.beforePlayerState,
      "恢复虫族任务前玩家状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      pending.beforeAlienState,
      "恢复虫族任务前外星人状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      cardState,
      pending.beforeCardState,
      "恢复虫族任务前牌区状态",
    ));

    const message = `${rewardResult.message || "虫族任务完成"}；${task?.traceType ? "按痕迹任务结算化石奖励" : ""}`;
    completeQuickActionStep(message, rewardResult.irreversible ? {
      irreversibleCode: rewardResult.irreversible.code,
      irreversibleReason: rewardResult.irreversible.reason,
    } : {});
    keepExistingMainActionPendingAfterChongTask();
    closeChongFossilChoiceDialog();
    let finalMessage = message;
    if (rewardResult.reward?.pickCard) {
      const pickResult = openChongPickCardFollowUp(player, false, `完成 ${cards.getCardLabel(card)}`);
      finalMessage = pickResult.ok
        ? `${message}；请选择公共牌或盲抽`
        : `${message}；${pickResult.message || "无法打开虫族奖励精选"}`;
    }
    rocketState.statusNote = finalMessage;
    renderAlienPanels();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: finalMessage };
  }

function completeChongTransportTask(pending, player) {
    const card = pending.card;
    const ready = getReadyChongTaskForReservedCard(card, player) || pending.ready;
    const delivered = ready?.deliveredTransport;
    const rocketId = delivered?.rocketId;
    if (!ready || !Number.isInteger(rocketId)) {
      closeChongTaskCompletionDialog();
      return failChongTaskCompletion("没有已送达的虫族化石任务");
    }

    const beforePlayerState = pending.beforePlayerState || structuredClone(playerState);
    const beforeAlienState = pending.beforeAlienState || structuredClone(alienGameState);
    const beforeRocketState = pending.beforeRocketState || structuredClone(rocketState);
    const beforeCardState = pending.beforeCardState || structuredClone(cardState);
    const result = chong.completeTransportedFossil(alienGameState, rocketId, {
      cardId: card?.id || null,
      destinationPlanetId: ready?.task?.destinationPlanetId || null,
      task: ready?.task || null,
    });
    if (!result.ok) {
      closeChongTaskCompletionDialog();
      return failChongTaskCompletion(result.message);
    }

    rocketActions.removeRocket(rocketState, rocketId);
    removeRocketElement(rocketId);
    card.chongTaskCompleted = true;
    removeReservedCardToDiscard(player, card);
    incrementCompletedTaskCount(player);

    beginQuickActionStep("chong-transport-task", `完成虫族任务：${cards.getCardLabel(card)}`);
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复虫族任务前玩家状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复虫族任务前外星人状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreRocketStateCommand(
      rocketState,
      beforeRocketState,
      "恢复虫族任务前棋子状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      cardState,
      beforeCardState,
      "恢复虫族任务前牌区状态",
    ));

    const messages = [result.message, `完成任务：${cards.getCardLabel(card)}`];
    let shouldOpenPickCard = Boolean(result.task?.pickCard);
    let irreversible = null;
    if (result.task?.fossilRewardRepeat) {
      const fossilReward = applyChongFossilRewardToPlayer(
        player,
        result.fossil.fossilId,
        `完成 ${cards.getCardLabel(card)}：${result.fossil.fossilId}`,
        result.task.fossilRewardRepeat,
      );
      if (fossilReward.message) messages.push(fossilReward.message);
      if (fossilReward.reward?.pickCard) shouldOpenPickCard = true;
      if (fossilReward.irreversible) irreversible = fossilReward.irreversible;
    }
    const taskReward = applyChongRewardToPlayer(player, result.task || {}, "虫族搬运任务");
    if (taskReward.message && !/无奖励$/.test(taskReward.message)) messages.push(taskReward.message);
    if (taskReward.irreversible) irreversible = taskReward.irreversible;
    const message = messages.join("；");
    completeQuickActionStep(message, irreversible ? {
      irreversibleCode: irreversible.code,
      irreversibleReason: irreversible.reason,
    } : {});
    keepExistingMainActionPendingAfterChongTask();
    closeChongTaskCompletionDialog();

    let finalMessage = message;
    if (shouldOpenPickCard) {
      const pickResult = openChongPickCardFollowUp(player, false, `完成 ${cards.getCardLabel(card)}`);
      finalMessage = pickResult.ok
        ? `${message}；请选择公共牌或盲抽`
        : `${message}；${pickResult.message || "无法打开虫族奖励精选"}`;
    }
    rocketState.statusNote = finalMessage;
    renderAlienPanels();
    renderRockets();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: finalMessage };
  }

function handleChongTaskCompletionChoice(choice) {
    const pending = getChongTaskCompletion();
    if (!pending) return failChongTaskCompletion("没有虫族任务完成流程");
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) {
      closeChongTaskCompletionDialog();
      return failChongTaskCompletion("找不到虫族任务玩家");
    }
    if (choice === "cancel") {
      closeChongTaskCompletionDialog();
      rocketState.statusNote = "已取消虫族任务完成";
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }
    return completeChongTransportTask(pending, player);
  }

function handleChongFossilChoice(choice) {
    const pending = alienChoiceSessions.chongFossilChoice;
    if (!pending) return failChongTaskCompletion("没有虫族化石选择流程");
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) {
      closeChongFossilChoiceDialog();
      return failChongTaskCompletion("找不到虫族化石玩家");
    }

    if (choice === "cancel") {
      closeChongFossilChoiceDialog();
      const message = "已取消虫族化石选择";
      if (pending.fromEffectFlow) {
        return finishChongFossilEffect(message, { cancelled: true });
      }
      rocketState.statusNote = message;
      renderStateReadout();
      return { ok: true, message };
    }

    const fossilId = String(choice || "");
    const beforeAlienState = pending.beforeAlienState;
    const beforePlayerState = pending.beforePlayerState;
    if (pending.fromEffectFlow && !uiRuntimeState.effectStepActive) {
      beginEffectHistoryStep(pending.effectLabel || "虫族化石");
    }
    if (pending.fromEffectFlow || pending.mode === "pickup" || pending.mode === "reward") {
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复虫族化石前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复虫族化石前玩家状态",
      ));
    }

    if (pending.mode === "pickup") {
      const pickup = chong.pickUpFossil(alienGameState, fossilId, player, pending.task || {}, {
        cardId: pending.card?.id || null,
        cardLabel: pending.card ? cards.getCardLabel(pending.card) : null,
      });
      if (!pickup.ok) {
        restoreMutableObject(alienGameState, beforeAlienState);
        rocketState.statusNote = pickup.message;
        renderStateReadout();
        return pickup;
      }
      const tokenResult = createChongTransportTokenForFossil(pickup.fossil, player);
      if (!tokenResult.ok) {
        restoreMutableObject(alienGameState, beforeAlienState);
        rocketState.statusNote = tokenResult.message;
        renderStateReadout();
        return tokenResult;
      }
      closeChongFossilChoiceDialog();
      const message = `${pickup.message}；${tokenResult.message}`;
      return finishChongFossilEffect(message, {
        fossilId,
        rocketId: tokenResult.rocket.id,
        task: pending.task || null,
      });
    }

    if (pending.mode === "trace-task") {
      return completeChongTraceTaskWithFossil(pending, fossilId, player);
    }

    const rewardResult = applyChongFossilRewardToPlayer(player, fossilId, `${pending.effectLabel} ${fossilId}`);
    closeChongFossilChoiceDialog();
    if (rewardResult.reward?.pickCard) {
      const pickResult = openChongPickCardFollowUp(player, pending.fromEffectFlow, pending.effectLabel);
      if (pickResult.ok) {
        rocketState.statusNote = `${rewardResult.message}；请选择公共牌`;
        renderPlayerStats();
        renderStateReadout();
        return { ok: true, message: rocketState.statusNote };
      }
    }
    if (pending.fromEffectFlow) {
      return finishChongFossilEffect(rewardResult.message, { fossilId, reward: rewardResult.reward || null });
    }
    rocketState.statusNote = rewardResult.message;
    renderPlayerStats();
    renderStateReadout();
    return rewardResult;
  }

function openChongTraceTaskCompletionPicker(card) {
    return openCardTaskCompletionPicker(card);
  }

function enqueueJiuzheOpportunity(player, opportunity) {
    if (!player || !opportunity) return;
    const exists = alienOpportunitySessions.jiuzheOpportunityQueue.some((item) => (
      item.playerId === player.id
      && item.playerColor === player.color
      && item.reason === opportunity.reason
    ));
    if (exists) return;
    alienOpportunitySessions.jiuzheOpportunityQueue.push({
      playerId: player.id,
      playerColor: player.color,
      reason: opportunity.reason,
      label: opportunity.label,
      cost: opportunity.cost || {},
    });
  }

function isJiuzheThresholdOpportunity(opportunity) {
    return opportunity?.reason === "freeThreshold" || opportunity?.reason === "paidThreshold";
  }

function createJiuzheThresholdCardEffect(player, opportunity) {
    const playerLabel = player?.colorLabel || player?.name || player?.color || "玩家";
    const reason = opportunity?.reason || "threshold";
    return {
      id: `jiuzhe-threshold-card-${player?.id || player?.color || "player"}-${reason}`,
      type: JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
      label: `九折碰线打牌：${playerLabel}`,
      icon: "jiuzhe_card_back",
      playerId: player?.id || null,
      playerColor: player?.color || null,
      options: {
        playerId: player?.id || null,
        playerColor: player?.color || null,
        reason,
        label: opportunity?.label || "九折碰线打牌",
        cost: opportunity?.cost || {},
        skippable: false,
      },
      required: true,
      status: "pending",
    };
  }

function hasJiuzheThresholdEffectQueued(player, reason) {
    if (!decisionState.actionEffectFlow || !player || !reason) return false;
    return (decisionState.actionEffectFlow.effects || []).some((effect) => (
      effect?.type === JIUZHE_THRESHOLD_CARD_EFFECT_TYPE
      && effect.status !== "completed"
      && effect.status !== "skipped"
      && effect.options?.reason === reason
      && (
        effect.options?.playerId === player.id
        || effect.options?.playerColor === player.color
        || effect.playerId === player.id
        || effect.playerColor === player.color
      )
    ));
  }

function queueJiuzheThresholdEffectForPlayer(player, opportunity) {
    if (!jiuzhe || !player || !isActionEffectFlowActive() || !isJiuzheThresholdOpportunity(opportunity)) return false;
    if (hasJiuzheThresholdEffectQueued(player, opportunity.reason)) return false;
    insertActionEffectsAfterCurrent([createJiuzheThresholdCardEffect(player, opportunity)]);
    renderActionEffectBar();
    return true;
  }

function queueJiuzheOpportunitiesForPlayer(player) {
    if (!jiuzhe || !player) return;
    const opportunity = jiuzhe.getPendingOpportunity(alienGameState, player);
    if (isActionEffectFlowActive() && isJiuzheThresholdOpportunity(opportunity)) {
      queueJiuzheThresholdEffectForPlayer(player, opportunity);
      return;
    }
    enqueueJiuzheOpportunity(player, opportunity);
  }

function buildJiuzheCardConditionContext() {
    const probeLocationData = buildProbeLocationIndex();
    return {
      alienGameState,
      planetStatsState,
      nebulaDataState,
      ...buildPlutoMarkerContext(),
      probeLocations: probeLocationData.index,
      probeLocationDetails: probeLocationData.details,
      getPlayerCompanyBaseIncome,
    };
  }

function getJiuzheCardConditionLabel(card, player) {
    const achieved = jiuzhe?.isCardConditionMet?.(card, player, buildJiuzheCardConditionContext());
    return {
      achieved,
      label: `${card.label || `九折牌 ${card.index}`} · ${card.score || 0}分 · 威胁${card.threat || 0}`,
    };
  }

function closeJiuzheCardDialog() {
    alienOpportunitySessions.jiuzheCardPlay = null;
    alienOpportunitySessions.jiuzheOpportunityOpen = false;
    setScanTargetActionLayout();
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function buildJiuzheOpportunitySubtitle(player, opportunity) {
    const remaining = Math.max(0, Math.round(Number(opportunity?.remaining) || 0));
    if (opportunity?.reason === "reveal" && remaining > 1) {
      return `${player.colorLabel}玩家拥有 ${remaining} 次免费打出机会，本次可选择 1 张未打出的九折牌，或放弃本次机会。`;
    }
    return `${player.colorLabel}玩家可以选择 1 张未打出的九折牌，或放弃本次机会。`;
  }

function openJiuzheCardDialog(player, opportunity = null) {
    if (!jiuzhe || !player || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开九折牌窗口" };
    }
    const cardsForPlayer = jiuzhe.getPlayerJiuzheCards(alienGameState, player);
    if (!cardsForPlayer.length) return { ok: false, message: "该玩家没有九折牌" };

    alienOpportunitySessions.jiuzheCardPlay = opportunity
      ? { playerId: player.id, playerColor: player.color, ...opportunity }
      : { playerId: player.id, playerColor: player.color, reason: "view", cost: {}, label: "查看九折牌" };
    alienOpportunitySessions.jiuzheOpportunityOpen = Boolean(opportunity);

    if (els.scanTargetTitle) els.scanTargetTitle.textContent = opportunity ? opportunity.label : "九折牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = opportunity
        ? buildJiuzheOpportunitySubtitle(player, opportunity)
        : `${player.colorLabel}玩家的九折牌。蓝框=已打出，金框=条件已达成。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = Boolean(opportunity);
    setScanTargetActionLayout("jiuzhe-card-grid");

    const isRevealOpportunity = opportunity?.reason === "reveal";
    const nodes = cardsForPlayer.map((card) => {
      const status = getJiuzheCardConditionLabel(card, player);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button jiuzhe-card-option";
      button.dataset.jiuzheCardChoice = String(card.index);
      button.disabled = !opportunity || card.played;
      button.classList.toggle("is-reveal-opportunity", Boolean(isRevealOpportunity));
      button.classList.toggle("is-played", Boolean(card.played));
      button.classList.toggle("is-achieved", Boolean(status.achieved));
      button.innerHTML = `
        <img class="jiuzhe-card-option-image" src="${card.src}" alt="" aria-hidden="true">
        <small>${status.label}${card.played ? " · 已打出" : ""}</small>
      `;
      return button;
    });

    if (opportunity) {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "scan-target-option-button";
      skip.dataset.jiuzheOpportunitySkip = "true";
      skip.innerHTML = "放弃本次机会<small>不会打出九折牌</small>";
      nodes.push(skip);
    }

    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    return { ok: true, message: "九折牌窗口已打开" };
  }

function handleJiuzheCardChoice(cardIndex, options = {}) {
    const pending = alienOpportunitySessions.jiuzheCardPlay;
    if (!jiuzhe || !pending) return { ok: false, message: "没有九折打出机会" };
    const blocked = blockManualAiPendingInputIfNeeded(pending, options, "九折牌");
    if (blocked) return blocked;
    const player = resolvePlayerReference(pending);
    if (!player) return { ok: false, message: "找不到九折牌玩家" };
    if (pending.reason === "view") return { ok: false, message: "当前只是查看九折牌" };

    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const cost = pending.cost || {};
    if (Object.keys(cost).length && !players.canAfford(player, cost)) {
      rocketState.statusNote = `资源不足，需要 ${players.formatResourceCost(cost)}`;
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    if (Object.keys(cost).length) {
      players.spendResources(player, cost);
    }
    const result = jiuzhe.playJiuzheCard(alienGameState, player, cardIndex, {
      reason: pending.reason,
    });
    if (!result.ok) {
      if (Object.keys(cost).length) players.gainResources(player, cost);
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    const fromEffectFlow = Boolean(pending.fromEffectFlow && getCurrentActionEffect());
    const effectLabel = pending.effectLabel || pending.label || getCurrentActionEffect()?.label || "九折打出";
    const effectResult = {
      ok: true,
      undoable: true,
      message: `${pending.label || effectLabel}：${result.message}`,
      payload: {
        reason: pending.reason,
        cardIndex: result.card?.index ?? Number(cardIndex),
        cost,
      },
    };

    if (fromEffectFlow) {
      beginEffectHistoryStep(effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复九折打出前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复九折打出前外星人状态",
      ));
      if (getCurrentActionEffect()) getCurrentActionEffect().result = effectResult;
    } else {
      beginQuickActionStep("jiuzhe-card", pending.label || "九折打出");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复九折打出前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复九折打出前外星人状态",
      ));
      completeQuickActionStep();
    }

    rocketState.statusNote = effectResult.message;
    closeJiuzheCardDialog();
    queueJiuzheOpportunitiesForPlayer(player);
    renderPlayerStats();
    renderAlienPanels();
    updateActionButtons();
    renderStateReadout();
    if (fromEffectFlow) {
      completeCurrentActionEffect();
    } else {
      maybeContinueAlienRevealQueuedOpportunities();
    }
    return { ...result, message: effectResult.message };
  }

function handleJiuzheOpportunitySkip(options = {}) {
    const pending = alienOpportunitySessions.jiuzheCardPlay;
    if (!jiuzhe || !pending) return { ok: false, message: "没有九折打出机会" };
    const blocked = blockManualAiPendingInputIfNeeded(pending, options, "九折牌");
    if (blocked) return blocked;
    const player = resolvePlayerReference(pending);
    if (!player) return { ok: false, message: "找不到九折牌玩家" };
    const beforeAlienState = structuredClone(alienGameState);
    const result = jiuzhe.declineOpportunity(alienGameState, player, pending.reason);
    if (result.ok) {
      const fromEffectFlow = Boolean(pending.fromEffectFlow && getCurrentActionEffect());
      const effectLabel = pending.effectLabel || pending.label || getCurrentActionEffect()?.label || "九折放弃";
      const effectResult = {
        ok: true,
        undoable: true,
        skipped: true,
        message: `${pending.label || effectLabel}：${result.message}`,
        payload: {
          reason: pending.reason,
          skipped: true,
        },
      };
      if (fromEffectFlow) {
        beginEffectHistoryStep(effectLabel);
        recordHistoryCommand(historyCommands.createRestoreObjectCommand(
          alienGameState,
          beforeAlienState,
          "恢复九折放弃前外星人状态",
        ));
        if (getCurrentActionEffect()) getCurrentActionEffect().result = effectResult;
      } else {
        beginQuickActionStep("jiuzhe-card-skip", pending.label || "九折放弃");
        recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
          alienGameState,
          beforeAlienState,
          "恢复九折放弃前外星人状态",
        ));
        completeQuickActionStep();
      }
      rocketState.statusNote = effectResult.message;
      closeJiuzheCardDialog();
      queueJiuzheOpportunitiesForPlayer(player);
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      if (fromEffectFlow) {
        completeCurrentActionEffect();
      } else {
        maybeContinueAlienRevealQueuedOpportunities();
      }
      return { ...result, message: effectResult.message };
    }
    rocketState.statusNote = result.message;
    renderStateReadout();
    return result;
  }

function maybeOpenQueuedJiuzheOpportunity() {
    if (alienOpportunitySessions.jiuzheOpportunityOpen || alienOpportunitySessions.jiuzheCardPlay) return null;
    if (isActionEffectFlowActive()) return null;
    if (hasActivePendingSubFlow()) return null;
    if (els.scanTargetOverlay && !els.scanTargetOverlay.hidden) return null;
    while (alienOpportunitySessions.jiuzheOpportunityQueue.length) {
      const next = alienOpportunitySessions.jiuzheOpportunityQueue.shift();
      const player = resolvePlayerReference(next);
      if (!player) continue;
      const latest = jiuzhe.getPendingOpportunity(alienGameState, player);
      if (!latest || latest.reason !== next.reason) continue;
      const openResult = openJiuzheCardDialog(player, latest);
      if (openResult?.ok) return openResult;
    }
    return null;
  }

function getActiveAlienSharedOverlayPendingForManualGuard() {
    const tracePickerMode = String(decisionState.alienTracePickerState?.mode || "");
    const tracePickerHasOwner = Boolean(
      decisionState.alienTracePickerState?.targetPlayerId
      || decisionState.alienTracePickerState?.targetPlayerColor
    );
    const tracePickerPending = tracePickerMode
      && tracePickerMode !== "debug-direct"
      && tracePickerMode !== "reveal-confirm"
      && tracePickerHasOwner
        ? decisionState.alienTracePickerState
        : null;
    const pendingEntries = [
      decisionState.alienTraceAction ? { pending: decisionState.alienTraceAction, label: "外星人痕迹" } : null,
      tracePickerPending ? { pending: tracePickerPending, label: "外星人痕迹" } : null,
      getCardTaskCompletion() ? { pending: getCardTaskCompletion(), label: "任务完成" } : null,
      alienOpportunitySessions.jiuzheCardPlay?.reason === "view"
        ? null
        : { pending: alienOpportunitySessions.jiuzheCardPlay, label: "九折牌" },
      alienCardGainSessions.yichangdianCardGain ? { pending: alienCardGainSessions.yichangdianCardGain, label: "异常点外星人牌" } : null,
      alienChoiceSessions.yichangdianCornerAction ? { pending: alienChoiceSessions.yichangdianCornerAction, label: "异常点角标" } : null,
      alienCardGainSessions.banrenmaCardGain ? { pending: alienCardGainSessions.banrenmaCardGain, label: "半人马外星人牌" } : null,
      alienOpportunitySessions.banrenmaOpportunity ? { pending: alienOpportunitySessions.banrenmaOpportunity, label: "半人马奖励" } : null,
      alienCardGainSessions.chongCardGain ? { pending: alienCardGainSessions.chongCardGain, label: "虫族外星人牌" } : null,
      alienChoiceSessions.chongFossilChoice ? { pending: alienChoiceSessions.chongFossilChoice, label: "虫族化石" } : null,
      getChongTaskCompletion() ? { pending: getChongTaskCompletion(), label: "虫族任务" } : null,
      alienCardGainSessions.amibaCardGain ? { pending: alienCardGainSessions.amibaCardGain, label: "阿米巴外星人牌" } : null,
      alienChoiceSessions.amibaSymbolChoice ? { pending: alienChoiceSessions.amibaSymbolChoice, label: "阿米巴 symbol" } : null,
      alienChoiceSessions.amibaTraceRemoval ? { pending: alienChoiceSessions.amibaTraceRemoval, label: "阿米巴痕迹移除" } : null,
      alienCardGainSessions.aomomoCardGain ? { pending: alienCardGainSessions.aomomoCardGain, label: "奥陌陌外星人牌" } : null,
      alienCardGainSessions.runezuCardGain ? { pending: alienCardGainSessions.runezuCardGain, label: "符文族外星人牌" } : null,
      alienChoiceSessions.runezuFaceSymbolPlacement ? { pending: alienChoiceSessions.runezuFaceSymbolPlacement, label: "符文族黑圈" } : null,
      alienChoiceSessions.runezuSymbolBranch ? { pending: alienChoiceSessions.runezuSymbolBranch, label: "符文族符文奖励" } : null,
    ];
    return pendingEntries.find((entry) => entry?.pending && isPendingLockedForAiAutomation(entry.pending)) || null;
  }

function blockManualAiSharedOverlayInputIfNeeded() {
    const entry = getActiveAlienSharedOverlayPendingForManualGuard();
    if (!entry) return null;
    return blockManualAiPendingInput(entry.pending, entry.label);
  }

function getReadyBanrenmaCards(player) {
    if (!banrenma || !player) return [];
    return getReadyBanrenmaCardsForOpportunity(player);
  }

function getReadyBanrenmaCardsForOpportunity(player, opportunity = {}) {
    if (!banrenma || !player) return [];
    return (player.reservedCards || [])
      .map((card, index) => {
        if (!banrenma.isBanrenmaCard(card)) return false;
        if (opportunity.cardId && card.id !== opportunity.cardId) return false;
        const mark = banrenma.getReadyScoreMarkForCard?.(
          alienGameState,
          player,
          card,
          opportunity.markId || null,
        );
        return mark ? { card, index, mark } : null;
      })
      .filter(Boolean);
  }

function getReadyBanrenmaCardForOpportunity(player, opportunity = {}) {
    return getReadyBanrenmaCardsForOpportunity(player, opportunity)[0] || null;
  }

function createBanrenmaPanelBonusEffect(player, mark) {
    const playerLabel = player?.colorLabel || player?.name || player?.color || "玩家";
    return {
      id: `banrenma-panel-bonus-${player?.id || player?.color || "player"}-${mark?.id || "mark"}`,
      type: BANRENMA_PANEL_BONUS_EFFECT_TYPE,
      label: `半人马顶部奖励：${playerLabel}`,
      icon: "banrenma_mark",
      playerId: player?.id || null,
      playerColor: player?.color || null,
      options: {
        playerId: player?.id || null,
        playerColor: player?.color || null,
        markId: mark?.id || null,
      },
      status: "pending",
    };
  }

function hasBanrenmaPanelBonusEffectQueued(player, markId) {
    if (!decisionState.actionEffectFlow || !markId) return false;
    return (decisionState.actionEffectFlow.effects || []).some((effect) => (
      effect?.type === BANRENMA_PANEL_BONUS_EFFECT_TYPE
      && effect.status !== "completed"
      && effect.status !== "skipped"
      && effect.options?.markId === markId
      && (
        effect.options?.playerId === player?.id
        || effect.options?.playerColor === player?.color
      )
    ));
  }

function queueBanrenmaPanelBonusEffectForPlayer(player) {
    if (!banrenma || !player || !isActionEffectFlowActive()) return false;
    const mark = banrenma.getPendingPanelMark(alienGameState, player);
    if (!mark || !banrenma.getAvailableBonusPositions(alienGameState).length) return false;
    if (hasBanrenmaPanelBonusEffectQueued(player, mark.id)) return false;
    insertActionEffectsAfterCurrent([createBanrenmaPanelBonusEffect(player, mark)]);
    renderActionEffectBar();
    return true;
  }

function enqueueBanrenmaOpportunity(player, opportunity) {
    if (!player || !opportunity) return;
    const key = `${opportunity.type}:${opportunity.markId || "any"}:${opportunity.cardId || "any"}`;
    const exists = alienOpportunitySessions.banrenmaOpportunityQueue.some((item) => (
      item.playerId === player.id
      && item.playerColor === player.color
      && `${item.type}:${item.markId || "any"}:${item.cardId || "any"}` === key
    ));
    if (exists) return;
    alienOpportunitySessions.banrenmaOpportunityQueue.push({
      playerId: player.id,
      playerColor: player.color,
      type: opportunity.type,
      markId: opportunity.markId || null,
      cardId: opportunity.cardId || null,
      label: opportunity.label,
    });
  }

function queueBanrenmaOpportunitiesForPlayer(player) {
    if (!banrenma || !player || !banrenma.isBanrenmaRevealedSlot?.(alienGameState, alienGameState.banrenma?.revealedSlotId)) return;
    if (isActionEffectFlowActive()) {
      queueBanrenmaPanelBonusEffectForPlayer(player);
      return;
    }
    const panelMark = banrenma.getPendingPanelMark(alienGameState, player);
    if (panelMark && banrenma.getAvailableBonusPositions(alienGameState).length) {
      enqueueBanrenmaOpportunity(player, {
        type: "panel",
        markId: panelMark.id,
        label: "半人马顶部奖励",
      });
    }
  }

function closeBanrenmaOpportunityDialog() {
    alienOpportunitySessions.banrenmaOpportunity = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function getBanrenmaCardConditionLabel(card) {
    const effects = banrenma?.buildConditionEffects?.(card) || [];
    return effects.map((effect) => effect.label).join("；") || "无条件效果";
  }

function openBanrenmaCardConditionCompletionPicker(card, options = {}) {
    const player = options.player
      || resolvePlayerReference({
        playerId: options.playerId,
        playerColor: options.playerColor,
      })
      || getCurrentPlayer();
    if (!banrenma || !player || !card || !banrenma.isBanrenmaCard(card)) {
      return { ok: false, message: "没有可结算的半人马牌" };
    }
    if (!els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开半人马条件确认窗口" };
    }
    const ready = getReadyBanrenmaCardForOpportunity(player, { cardId: card.id });
    if (!ready) {
      rocketState.statusNote = "这张半人马牌尚未达到阈值";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const mark = ready.mark;
    alienOpportunitySessions.banrenmaOpportunity = {
      playerId: player.id,
      playerColor: player.color,
      type: "card",
      cardId: card.id || null,
      markId: mark?.id || card.banrenmaScoreMarkId || null,
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "半人马条件效果";
    if (els.scanTargetSubtitle) {
      const threshold = mark?.threshold ?? card.banrenmaThreshold ?? "阈值";
      els.scanTargetSubtitle.textContent = `${cards.getCardLabel(card)} 已达到 ${threshold} 分，确认后弃掉该牌并结算条件效果。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "scan-target-option-button";
    confirmButton.dataset.banrenmaCardChoice = card.id;
    confirmButton.innerHTML = `确认结算条件<small>${getBanrenmaCardConditionLabel(card)}</small>`;
    els.scanTargetActions.replaceChildren(confirmButton);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "半人马条件已达成：点击确认结算";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function openBanrenmaOpportunityDialog(player, opportunity) {
    if (!banrenma || !player || !opportunity || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开半人马奖励窗口" };
    }
    alienOpportunitySessions.banrenmaOpportunity = {
      playerId: player.id,
      playerColor: player.color,
      type: opportunity.type,
      markId: opportunity.markId || null,
      cardId: opportunity.cardId || null,
      fromEffectFlow: Boolean(opportunity.fromEffectFlow),
      effectLabel: opportunity.label || null,
    };
    if (opportunity.type === "panel") {
      const mark = banrenma.getPlayerScoreMarks(alienGameState, player)
        .find((item) => item.id === opportunity.markId);
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = "半人马顶部奖励";
      if (els.scanTargetSubtitle) {
        els.scanTargetSubtitle.textContent = `${player.colorLabel}玩家达到 ${mark?.threshold ?? "阈值"} 分，选择一个未使用的顶部奖励位。`;
      }
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;
      const nodes = banrenma.BONUS_POSITIONS.map((position) => {
        const reward = banrenma.getBonusReward(position);
        const used = Boolean(alienGameState.banrenma?.bonusSlots?.[position]);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.banrenmaBonusChoice = String(position);
        button.disabled = used;
        button.innerHTML = `${position}号奖励<small>${reward?.label || ""}${used ? " · 已使用" : ""}</small>`;
        return button;
      });
      els.scanTargetActions.replaceChildren(...nodes);
    } else {
      const readyCards = getReadyBanrenmaCardsForOpportunity(player, opportunity);
      if (!readyCards.length) {
        alienOpportunitySessions.banrenmaOpportunity = null;
        return { ok: false, stale: true, message: "没有可结算的半人马牌" };
      }
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = "半人马条件效果";
      if (els.scanTargetSubtitle) {
        els.scanTargetSubtitle.textContent = readyCards.length === 1
          ? `${cards.getCardLabel(readyCards[0].card)} 已达到 ${readyCards[0].mark?.threshold ?? "阈值"} 分，确认后弃掉该牌并结算条件效果。`
          : `${player.colorLabel}玩家可选择 1 张已打出的半人马牌结算条件效果，之后弃掉该牌并清除一个阈值标记。`;
      }
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;
      const nodes = readyCards.map(({ card }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button jiuzhe-card-option banrenma-card-option";
        button.dataset.banrenmaCardChoice = card.id;
        button.innerHTML = `
          <img class="jiuzhe-card-option-image" src="${card.src || banrenma.getCardSrc(card.alienCardId)}" alt="" aria-hidden="true">
          <small>${cards.getCardLabel(card)} · ${getBanrenmaCardConditionLabel(card)}</small>
        `;
        return button;
      });
      els.scanTargetActions.replaceChildren(...nodes);
    }
    els.scanTargetOverlay.hidden = false;
    return { ok: true, message: "半人马奖励窗口已打开" };
  }

function maybeOpenQueuedBanrenmaOpportunity() {
    if (alienOpportunitySessions.banrenmaOpportunity || alienCardGainSessions.banrenmaCardGain) return null;
    if (isActionEffectFlowActive()) return null;
    if (hasActivePendingSubFlow()) return null;
    if (els.scanTargetOverlay && !els.scanTargetOverlay.hidden) return null;
    while (alienOpportunitySessions.banrenmaOpportunityQueue.length) {
      const next = alienOpportunitySessions.banrenmaOpportunityQueue.shift();
      const player = resolvePlayerReference(next);
      if (!player) continue;
      if (next.type === "panel") {
        const latest = banrenma.getPendingPanelMark(alienGameState, player);
        if (!latest || latest.id !== next.markId || !banrenma.getAvailableBonusPositions(alienGameState).length) continue;
        const openResult = openBanrenmaOpportunityDialog(player, next);
        if (openResult?.ok) return openResult;
      }
    }
    return null;
  }

function openBanrenmaReadyOpportunityForPlayer(player, options = {}) {
    if (!banrenma || !player) return null;
    if (alienOpportunitySessions.banrenmaOpportunity || alienCardGainSessions.banrenmaCardGain) return null;
    if (isActionEffectFlowActive() || hasActivePendingSubFlow()) return null;
    const panelMark = banrenma.getPendingPanelMark(alienGameState, player);
    if (panelMark && banrenma.getAvailableBonusPositions(alienGameState).length) {
      return openBanrenmaOpportunityDialog(player, {
        type: "panel",
        markId: panelMark.id,
        label: "半人马顶部奖励",
      });
    }
    if (options.includeCards === false) return null;
    const readyCard = getReadyBanrenmaCardForOpportunity(player);
    if (!readyCard?.card) return null;
    return openBanrenmaCardConditionCompletionPicker(readyCard.card, { player });
  }

function executeJiuzheThresholdCardEffect(effect) {
    const player = resolvePlayerReference(effect.options || effect) || getEffectOwnerPlayer(effect);
    if (!player) {
      return skipActionEffectWithMessage(effect, "九折碰线打牌：找不到玩家");
    }
    const expectedReason = effect.options?.reason || null;
    const latest = jiuzhe?.getPendingOpportunity?.(alienGameState, player) || null;
    if (!isJiuzheThresholdOpportunity(latest)) {
      return skipActionEffectWithMessage(effect, "九折碰线打牌：没有待处理的达分机会");
    }
    if (expectedReason && latest.reason !== expectedReason) {
      queueJiuzheThresholdEffectForPlayer(player, latest);
      return skipActionEffectWithMessage(effect, "九折碰线打牌：机会已更新，跳过旧提醒");
    }
    return openJiuzheCardDialog(player, {
      ...latest,
      fromEffectFlow: true,
      effectLabel: effect.label || latest.label || "九折碰线打牌",
    });
  }

function executeBanrenmaPanelBonusEffect(effect) {
    const player = resolvePlayerReference(effect.options || effect) || getEffectOwnerPlayer(effect);
    if (!player) {
      return skipActionEffectWithMessage(effect, "半人马顶部奖励：找不到玩家");
    }
    const mark = banrenma.getPendingPanelMark(alienGameState, player);
    const expectedMarkId = effect.options?.markId || null;
    if (!mark || (expectedMarkId && mark.id !== expectedMarkId)) {
      return skipActionEffectWithMessage(effect, "半人马顶部奖励：没有待结算的分数标记");
    }
    if (!banrenma.getAvailableBonusPositions(alienGameState).length) {
      return skipActionEffectWithMessage(effect, "半人马顶部奖励：没有可用奖励位");
    }
    return openBanrenmaOpportunityDialog(player, {
      type: "panel",
      markId: mark.id,
      label: effect.label || "半人马顶部奖励",
      fromEffectFlow: true,
    });
  }

function completeBanrenmaOpportunityStep(player, beforePlayerState, beforeAlienState, beforeCardState, label) {
    beginQuickActionStep("banrenma-opportunity", label || "半人马奖励");
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复半人马奖励前玩家状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复半人马奖励前外星人状态",
    ));
    if (beforeCardState) {
      recordQuickHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
    }
    completeQuickActionStep();
  }

function handleBanrenmaBonusChoice(position) {
    const pending = alienOpportunitySessions.banrenmaOpportunity;
    if (!pending || pending.type !== "panel") {
      return { ok: false, message: "没有半人马顶部奖励机会" };
    }
    const player = resolvePlayerReference(pending);
    if (!player) return { ok: false, message: "找不到半人马玩家" };
    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const markResult = banrenma.markBonusSlotUsed(
      alienGameState,
      player,
      Number(position),
      pending.markId,
    );
    if (!markResult.ok) {
      rocketState.statusNote = markResult.message;
      renderStateReadout();
      return markResult;
    }
    banrenma.resolveScoreMark(alienGameState, player, pending.markId);
    const rewardResult = applyBanrenmaRewardToPlayer(player, markResult.reward, markResult.message);
    const fromEffectFlow = Boolean(pending.fromEffectFlow && getCurrentActionEffect());
    const effectLabel = pending.effectLabel || getCurrentActionEffect()?.label || markResult.message;
    const baseResult = {
      ok: true,
      undoable: rewardResult.undoable !== false,
      message: rewardResult.message || markResult.message,
      payload: {
        banrenmaBonusPosition: Number(position),
        reward: markResult.reward || null,
        markId: pending.markId || null,
      },
    };
    if (fromEffectFlow) {
      beginEffectHistoryStep(effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复半人马顶部奖励前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复半人马顶部奖励前外星人状态",
      ));
      if (getCurrentActionEffect()) getCurrentActionEffect().result = baseResult;
    } else {
      completeBanrenmaOpportunityStep(player, beforePlayerState, beforeAlienState, null, markResult.message);
    }
    closeBanrenmaOpportunityDialog();
    rocketState.statusNote = baseResult.message;
    renderAlienPanels();
    renderPlayerStats();
    updateActionButtons();
    renderStateReadout();
    if (markResult.reward?.pickAlienCard) {
      const openResult = openBanrenmaCardGainDialog({
        player,
        fromEffectFlow,
        effectLabel: fromEffectFlow ? effectLabel : "半人马顶部奖励外星人牌",
        beforePlayerState,
        beforeAlienState,
        baseResult: fromEffectFlow ? baseResult : null,
      });
      if (!openResult.ok && fromEffectFlow) {
        completeCurrentActionEffect();
      }
    } else if (markResult.reward?.alienTrace) {
      decisionState.alienTraceAction = {
        type: fromEffectFlow ? "planet_reward_alien_trace" : "banrenma_bonus_alien_trace",
        beforeAlienState,
        beforePlayerState,
        effectLabel: fromEffectFlow ? effectLabel : "半人马顶部奖励外星人痕迹",
        targetPlayerId: player?.id || null,
        targetPlayerColor: player?.color || null,
      };
      const fangzhouChoice = openFangzhouTraceDestinationChoice({
        allowedTraceTypes: aliens.TRACE_TYPES,
        targetPlayerId: player?.id || null,
        targetPlayerColor: player?.color || null,
        label: fromEffectFlow ? effectLabel : "半人马顶部奖励外星人痕迹",
      });
      if (!fangzhouChoice) {
        const hasPanelTarget = hasAlienTracePanelPlacementTarget(
          null,
          aliens.TRACE_TYPES,
          player,
        );
        if (!hasPanelTarget) {
          const noTargetMessage = `${markResult.message}：无合法痕迹位置，奖励落空`;
          decisionState.alienTraceAction = null;
          decisionState.alienTracePickerState = null;
          closeAlienTracePicker();
          baseResult.message = noTargetMessage;
          baseResult.payload.alienTraceRewardLost = true;
          if (fromEffectFlow) {
            if (getCurrentActionEffect()) getCurrentActionEffect().result = baseResult;
            completeCurrentActionEffect();
          } else {
            queueBanrenmaOpportunitiesForPlayer(player);
            maybeContinueAlienRevealQueuedOpportunities();
          }
          rocketState.statusNote = noTargetMessage;
          renderAlienPanels();
          renderPlayerStats();
          updateActionButtons();
          renderStateReadout();
          return {
            ...markResult,
            message: noTargetMessage,
            alienTraceRewardLost: true,
          };
        }
        beginAlienTraceBoardPlacement({
          allowedTraceTypes: aliens.TRACE_TYPES,
          targetPlayerId: player?.id || null,
          targetPlayerColor: player?.color || null,
          label: fromEffectFlow ? effectLabel : "半人马顶部奖励外星人痕迹",
        });
      }
    } else if (fromEffectFlow) {
      completeCurrentActionEffect();
    } else {
      queueBanrenmaOpportunitiesForPlayer(player);
      maybeContinueAlienRevealQueuedOpportunities();
    }
    return markResult;
  }

function handleBanrenmaCardConditionChoice(cardId) {
    if (!alienOpportunitySessions.banrenmaOpportunity || alienOpportunitySessions.banrenmaOpportunity.type !== "card") {
      return { ok: false, message: "没有半人马条件效果机会" };
    }
    const player = resolvePlayerReference(alienOpportunitySessions.banrenmaOpportunity);
    if (!player) return { ok: false, message: "找不到半人马玩家" };
    if (cardId === "cancel" || cardId === "skip") {
      const beforeAlienState = structuredClone(alienGameState);
      if (alienOpportunitySessions.banrenmaOpportunity.markId) {
        banrenma.resolveScoreMark(alienGameState, player, alienOpportunitySessions.banrenmaOpportunity.markId);
      }
      completeBanrenmaOpportunityStep(
        player,
        structuredClone(playerState),
        beforeAlienState,
        null,
        "半人马条件：跳过过期机会",
      );
      closeBanrenmaOpportunityDialog();
      rocketState.statusNote = "半人马条件：没有可结算的半人马牌，已跳过";
      renderAlienPanels();
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      queueBanrenmaOpportunitiesForPlayer(player);
      maybeContinueAlienRevealQueuedOpportunities();
      return { ok: true, skipped: true, message: rocketState.statusNote };
    }
    if (alienOpportunitySessions.banrenmaOpportunity.cardId && alienOpportunitySessions.banrenmaOpportunity.cardId !== cardId) {
      rocketState.statusNote = "这次半人马条件机会不对应所选卡牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const cardIndex = player.reservedCards?.findIndex((card) => card.id === cardId) ?? -1;
    const card = cardIndex >= 0 ? player.reservedCards[cardIndex] : null;
    if (!card || !banrenma.isBanrenmaCard(card)) {
      rocketState.statusNote = "找不到可结算的半人马牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const beforeCardState = {
      publicCards: cardState.publicCards.slice(),
      discardPile: (cardState.discardPile || []).slice(),
    };
    const mark = banrenma.getReadyScoreMarkForCard?.(
      alienGameState,
      player,
      card,
      alienOpportunitySessions.banrenmaOpportunity.markId || null,
    );
    if (!mark || Number(player.resources?.score || 0) < Number(mark.threshold || 0)) {
      rocketState.statusNote = "这张半人马牌尚未达到阈值";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const [removedCard] = player.reservedCards.splice(cardIndex, 1);
    cards.addToDiscardPile(cardState, removedCard);
    banrenma.resolveScoreMark(alienGameState, player, mark.id);
    const effects = banrenma.buildConditionEffects(removedCard).map((effect) => ({
      ...effect,
      playerId: player.id || effect.playerId || null,
      playerColor: player.color || effect.playerColor || null,
      options: { ...(effect.options || {}) },
    }));
    completeBanrenmaOpportunityStep(
      player,
      beforePlayerState,
      beforeAlienState,
      beforeCardState,
      `半人马条件：${cards.getCardLabel(removedCard)}`,
    );
    closeBanrenmaOpportunityDialog();
    rocketState.statusNote = `半人马条件：弃掉 ${cards.getCardLabel(removedCard)}`;
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    renderAlienPanels();
    updateActionButtons();
    renderStateReadout();
    if (effects.length) {
      startCardEffectFlow("banrenma-condition-effects", `半人马条件：${cards.getCardLabel(removedCard)}`, effects, {
        actionType: "banrenmaCondition",
        card: removedCard,
        historySource: HISTORY_SOURCE_QUICK,
        consumesMainAction: false,
      });
    } else {
      queueBanrenmaOpportunitiesForPlayer(player);
      maybeContinueAlienRevealQueuedOpportunities();
    }
    return { ok: true, card: removedCard, effects, message: rocketState.statusNote };
  }

function appendRevealCardGrantMessage(message, grantResult) {
    if (!grantResult || grantResult.totalExpected <= 0) return message;
    return `${message || ""}${message ? "；" : ""}${grantResult.message}`;
  }

function getRevealIrreversible(revealReason, revealSideEffect) {
    const reasons = [];
    let code = null;
    if (revealReason) {
      reasons.push(revealReason);
      code = "alien_reveal_random_setup";
    }
    const cardGrantIrreversible = revealSideEffect?.cardGrant?.irreversible;
    if (cardGrantIrreversible?.reason && !reasons.includes(cardGrantIrreversible.reason)) {
      reasons.push(cardGrantIrreversible.reason);
    }
    if (!code && cardGrantIrreversible?.code) code = cardGrantIrreversible.code;
    return reasons.length
      ? { code: code || "irreversible_effect", reason: reasons.join("；") }
      : null;
  }

function openChongRewardFollowUps(result, currentPlayer, pending, beforeAlienState, beforePlayerState) {
    if (!result?.reward) return false;
    if (result.reward.pickAlienCard) {
      const openResult = openChongCardGainDialog({
        player: currentPlayer,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
        effectLabel: pending?.effectLabel || "虫族外星人牌",
        beforeAlienState,
        beforePlayerState,
      });
      return Boolean(openResult.ok);
    }
    if (result.reward.pickCard) {
      beginCardSelection({
        type: "amiba_pick_card",
        player: currentPlayer,
        allowBlindDraw: true,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
      });
      return true;
    }
    return false;
  }

function openAmibaRewardFollowUps(result, currentPlayer, pending, beforeAlienState, beforePlayerState) {
    if (!result?.reward) return false;
    if (result.reward.pickAlienCard) {
      const openResult = openAmibaCardGainDialog({
        player: currentPlayer,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
        effectLabel: pending?.effectLabel || "阿米巴外星人牌",
        beforeAlienState,
        beforePlayerState,
      });
      return Boolean(openResult.ok);
    }
    if (result.reward.pickCard) {
      beginCardSelection({
        type: "chong_pick_card",
        player: currentPlayer,
        allowBlindDraw: true,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
      });
      return true;
    }
    return false;
  }

function openRunezuRewardFollowUps(result, currentPlayer, pending, beforeAlienState, beforePlayerState) {
    if (!result?.reward) return false;
    if (result.reward.pickAlienCard) {
      const openResult = openRunezuCardGainDialog({
        player: currentPlayer,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
        effectLabel: pending?.effectLabel || "符文族外星人牌",
        beforeAlienState,
        beforePlayerState,
      });
      return Boolean(openResult.ok);
    }
    if (result.reward.pickCard) {
      beginCardSelection({
        type: "runezu_pick_card",
        player: currentPlayer,
        allowBlindDraw: true,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
      });
      return true;
    }
    return false;
  }

function closeRunezuFaceSymbolPlacement() {
    alienChoiceSessions.runezuFaceSymbolPlacement = null;
    setScanTargetActionLayout();
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openRunezuFaceSymbolPlacement(alienSlotId, position) {
    if (!runezu) {
      return { ok: false, message: "无法打开符文族 symbol 放置窗口" };
    }
    const currentPlayer = getCurrentPlayer();
    const check = runezu.canPlaceFaceSymbol(alienGameState, position, currentPlayer);
    if (!check.ok) {
      rocketState.statusNote = check.message;
      renderStateReadout();
      return check;
    }
    alienChoiceSessions.runezuFaceSymbolPlacement = {
      alienSlotId: Number(alienSlotId),
      position: check.position,
      playerId: currentPlayer.id,
      beforeAlienState: structuredClone(alienGameState),
      beforePlayerState: structuredClone(playerState),
      choices: structuredClone(check.choices || []),
    };
    if (!els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: true, awaitingChoice: true, message: "符文族黑圈：请选择要放置的 symbol" };
    }
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "符文族黑圈";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = `选择 1 个 symbol 放入${runezu.formatFaceSymbolSlotLabel(check.position)}并结算奖励。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    setScanTargetActionLayout("runezu-face-symbol-choice-grid");
    const nodes = check.choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button runezu-face-symbol-choice-button";
      button.dataset.runezuFaceSymbolChoice = choice.symbolId;
      button.title = `${choice.label} x${choice.count}`;
      button.setAttribute("aria-label", `${choice.label} x${choice.count}`);
      button.innerHTML = `<img class="runezu-face-symbol-choice-image" src="${runezu.getSymbolSrc(choice.symbolId)}" alt="" aria-hidden="true">`;
      return button;
    });
    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "符文族黑圈：请选择要放置的 symbol";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function handleRunezuFaceSymbolChoice(choice) {
    const pending = alienChoiceSessions.runezuFaceSymbolPlacement;
    if (!pending) return { ok: false, message: "没有符文族黑圈放置流程" };
    if (choice === "cancel") {
      closeRunezuFaceSymbolPlacement();
      rocketState.statusNote = "已取消符文族黑圈放置";
      renderStateReadout();
      return { ok: true, cancelled: true, message: rocketState.statusNote };
    }
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    const result = runezu.placePlayerSymbolOnFace(alienGameState, pending.position, player, choice);
    if (!result.ok) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }
    const rewardResult = applyRunezuRewardToPlayer(
      player,
      result.reward,
      `符文族${runezu.formatFaceSymbolSlotLabel(pending.position)}`,
    );
    closeRunezuFaceSymbolPlacement();
    beginQuickActionStep("runezu-face-symbol", result.message);
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      pending.beforeAlienState,
      "恢复符文族黑圈放置前外星人状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      pending.beforePlayerState,
      "恢复符文族黑圈放置前玩家状态",
    ));
    completeQuickActionStep(null, rewardResult.irreversible ? {
      irreversibleCode: rewardResult.irreversible.code,
      irreversibleReason: rewardResult.irreversible.reason,
    } : {});
    rocketState.statusNote = `${result.message}；${rewardResult.message}`;
    renderAlienPanels();
    renderPlayerStats();
    renderPlayerHand();
    updateActionButtons();
    renderStateReadout();
    return { ...result, rewardResult, message: rocketState.statusNote };
  }

function executeRunezuSymbolRewardEffect(effect) {
    const currentPlayer = getCurrentPlayer();
    const symbolId = effect.options?.symbolId;
    const beforeAlienState = structuredClone(alienGameState);
    const beforePlayerState = structuredClone(playerState);
    beginEffectHistoryStep(effect.label);
    const result = applyRunezuSymbolReward(currentPlayer, symbolId, effect.label);
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复符文族symbol奖励前外星人状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复符文族symbol奖励前玩家状态",
    ));
    if (result.irreversible) {
      markCurrentActionIrreversible(result.irreversible.reason, result.irreversible.code);
    }
    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: result.undoable !== false,
      irreversible: result.irreversible || null,
      message: result.message,
      payload: result,
    }, [renderAlienPanels, renderPlayerHand]);
  }

function closeRunezuSymbolBranchDialog() {
    alienChoiceSessions.runezuSymbolBranch = null;
    setScanTargetActionLayout();
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

function openRunezuSymbolBranchDialog(effect) {
    if (!runezu) {
      return { ok: false, message: "无法打开符文族分支选择" };
    }
    const branches = effect.options?.branches || [];
    alienChoiceSessions.runezuSymbolBranch = {
      ...getPendingOwnerFields(effect, getEffectOwnerPlayer(effect)),
      effect,
      branches,
      beforeAlienState: structuredClone(alienGameState),
      beforePlayerState: structuredClone(playerState),
    };
    if (!els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: true, awaitingChoice: true, message: "符文族：请选择一组 symbol 奖励" };
    }
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "符文族符文奖励";
    if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择一组 symbol，按黑圈映射依次结算奖励。";
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    setScanTargetActionLayout("runezu-symbol-branch-choice-grid");
    const nodes = branches.map((branch, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button runezu-symbol-branch-button";
      button.dataset.runezuSymbolBranch = String(index);
      button.title = branch.label || (branch.symbolIds || []).map(runezu.formatSymbolLabel).join("+");
      button.setAttribute("aria-label", button.title);
      const icons = (branch.symbolIds || []).map((symbolId) => (
        `<img class="runezu-face-symbol-choice-image runezu-symbol-branch-image" src="${runezu.getSymbolSrc(symbolId)}" alt="" aria-hidden="true">`
      )).join("");
      button.innerHTML = icons;
      return button;
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.runezuSymbolBranch = "cancel";
    cancel.innerHTML = "取消<small>不结算本次符文奖励</small>";
    nodes.push(cancel);
    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "符文族：请选择一组 symbol 奖励";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

function handleRunezuSymbolBranchChoice(choice) {
    const pending = alienChoiceSessions.runezuSymbolBranch;
    if (!pending) return { ok: false, message: "没有待选择的符文族分支" };
    const effect = pending.effect;
    if (choice === "cancel") {
      closeRunezuSymbolBranchDialog();
      if (effect) {
        effect.result = { ok: true, undoable: true, message: "已取消符文族分支奖励" };
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect();
      }
      renderStateReadout();
      return { ok: true, cancelled: true, message: rocketState.statusNote };
    }
    const branch = pending.branches[Number(choice)];
    if (!branch) return { ok: false, message: "无效的符文族分支" };
    const currentPlayer = getPendingOwnerPlayer(pending, effect);
    const messages = [];
    let irreversible = null;
    beginEffectHistoryStep(effect.label);
    for (const symbolId of branch.symbolIds || []) {
      const result = applyRunezuSymbolReward(currentPlayer, symbolId, effect.label);
      messages.push(result.message);
      if (result.irreversible) irreversible = result.irreversible;
    }
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      pending.beforeAlienState,
      "恢复符文族分支奖励前外星人状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      pending.beforePlayerState,
      "恢复符文族分支奖励前玩家状态",
    ));
    if (irreversible) markCurrentActionIrreversible(irreversible.reason, irreversible.code);
    closeRunezuSymbolBranchDialog();
    if (effect) {
      effect.result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message: `${effect.label}：${messages.join("；") || "无奖励"}`,
      };
      rocketState.statusNote = effect.result.message;
      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      completeCurrentActionEffect();
    }
    renderStateReadout();
    return effect?.result || { ok: true, message: rocketState.statusNote };
  }

function alignAlienPanelsToPlanets() {
    els.appWrap.style.removeProperty("--alien-panel-min-height");
    if (window.innerWidth <= 1180 || els.alienPanels.length < 2 || !els.planetsReferenceImage) return;

    const panels = [...els.alienPanels];
    const firstPanel = panels[0].getBoundingClientRect();
    const secondPanel = panels[1].getBoundingClientRect();
    const planets = els.planetsReferenceImage.getBoundingClientRect();
    const bottomGap = planets.bottom - secondPanel.bottom;

    if (bottomGap <= 0) return;

    const alignedPanelHeight = firstPanel.height + bottomGap / panels.length;
    const panelHeight = Math.ceil(Math.max(firstPanel.height, alignedPanelHeight * 0.75));
    els.appWrap.style.setProperty("--alien-panel-min-height", `${panelHeight}px`);
  }

    return {
      getAlienTraceLayer,
      getAlienJiuzheTraceLayer,
      getAlienYichangdianCardArea,
      getAlienBanrenmaCardArea,
      getAlienChongCardArea,
      getAlienAmibaCardArea,
      getAlienAomomoCardArea,
      getAlienRunezuCardArea,
      getAlienJiuzheThresholdElement,
      getAlienBanrenmaScoremarkElement,
      getAlienBackImage,
      createJiuzheThresholdNode,
      renderJiuzheThresholds,
      maybeRevealAlienAfterTrace,
      isDebugAlienTraceMode,
      setDebugAlienTraceModeActive,
      toggleDebugAlienTraceMode,
      enableDebugAlienTraceModeForReveal,
      renderYichangdianCardDisplays,
      renderBanrenmaScoremarks,
      renderBanrenmaCardDisplays,
      renderChongCardDisplays,
      renderAmibaCardDisplays,
      renderAomomoCardDisplays,
      renderRunezuCardDisplays,
      renderBanrenmaBonusMarkers,
      renderAlienPanels,
      randomizeAliens,
      applyFangzhouUnlockStateTraceReward,
      confirmFangzhouCard2Unlock,
      getAlienFangzhouCardArea,
      createFangzhouReservedButtons,
      buildFangzhouCard1EffectQueue,
      getFangzhouCard1RewardTargetOptions,
      enqueueFangzhouCard1RewardEffects,
      flipFangzhouCard1Rewards,
      applyFangzhouCard1Rewards,
      applyFangzhouCard1Reward,
      queueFangzhouBasicRewards,
      applyFangzhouTraceRewardToPlayer,
      renderFangzhouCardDisplays,
      openFangzhouCard1Dialog,
      findPlayerForJiuzheEntry,
      applyJiuzheRewardToPlayer,
      findPlayerForYichangdianEntry,
      applyYichangdianRewardToPlayer,
      getAvailableDataTokenCount,
      spendAvailableDataTokens,
      applyBanrenmaRewardToPlayer,
      applyAomomoRewardToPlayer,
      applyChongRewardToPlayer,
      applyAmibaRewardToPlayer,
      applyRunezuRewardToPlayer,
      applyRunezuSymbolReward,
      claimRunezuSourceSymbolWithHistory,
      closeRunezuCardGainDialog,
      openRunezuCardGainDialog,
      finishRunezuCardGain,
      handleRunezuCardGainChoice,
      closeAmibaCardGainDialog,
      openAmibaCardGainDialog,
      finishAmibaCardGain,
      handleAmibaCardGainChoice,
      closeAomomoCardGainDialog,
      openAomomoCardGainDialog,
      finishAomomoCardGain,
      handleAomomoCardGainChoice,
      closeAmibaSymbolChoiceDialog,
      openAmibaSymbolChoiceDialog,
      finishAmibaSymbolChoice,
      handleAmibaSymbolChoice,
      closeAmibaTraceRemovalDialog,
      openAmibaTraceRemovalDialog,
      handleAmibaTraceRemovalChoice,
      applyChongFossilRewardToPlayer,
      closeYichangdianCardGainDialog,
      openYichangdianCardGainDialog,
      finishYichangdianCardGain,
      handleYichangdianCardGainChoice,
      closeBanrenmaCardGainDialog,
      openBanrenmaCardGainDialog,
      finishBanrenmaCardGain,
      handleBanrenmaCardGainChoice,
      closeChongCardGainDialog,
      openChongCardGainDialog,
      finishChongCardGain,
      handleChongCardGainChoice,
      getChongPlanetLabel,
      formatChongGain,
      formatChongFossilRewardSummary,
      restoreMutableObject,
      closeChongFossilChoiceDialog,
      closeChongTaskCompletionDialog,
      openChongFossilChoiceDialog,
      createChongTransportTokenForFossil,
      openChongPickCardFollowUp,
      keepExistingMainActionPendingAfterChongTask,
      failChongTaskCompletion,
      finishChongFossilEffect,
      completeChongTraceTaskWithFossil,
      completeChongTransportTask,
      handleChongTaskCompletionChoice,
      handleChongFossilChoice,
      openChongTraceTaskCompletionPicker,
      enqueueJiuzheOpportunity,
      isJiuzheThresholdOpportunity,
      createJiuzheThresholdCardEffect,
      hasJiuzheThresholdEffectQueued,
      queueJiuzheThresholdEffectForPlayer,
      queueJiuzheOpportunitiesForPlayer,
      buildJiuzheCardConditionContext,
      getJiuzheCardConditionLabel,
      closeJiuzheCardDialog,
      buildJiuzheOpportunitySubtitle,
      openJiuzheCardDialog,
      handleJiuzheCardChoice,
      handleJiuzheOpportunitySkip,
      maybeOpenQueuedJiuzheOpportunity,
      getActiveAlienSharedOverlayPendingForManualGuard,
      blockManualAiSharedOverlayInputIfNeeded,
      getReadyBanrenmaCards,
      getReadyBanrenmaCardsForOpportunity,
      getReadyBanrenmaCardForOpportunity,
      createBanrenmaPanelBonusEffect,
      hasBanrenmaPanelBonusEffectQueued,
      queueBanrenmaPanelBonusEffectForPlayer,
      enqueueBanrenmaOpportunity,
      queueBanrenmaOpportunitiesForPlayer,
      closeBanrenmaOpportunityDialog,
      getBanrenmaCardConditionLabel,
      openBanrenmaCardConditionCompletionPicker,
      openBanrenmaOpportunityDialog,
      maybeOpenQueuedBanrenmaOpportunity,
      openBanrenmaReadyOpportunityForPlayer,
      executeJiuzheThresholdCardEffect,
      executeBanrenmaPanelBonusEffect,
      completeBanrenmaOpportunityStep,
      handleBanrenmaBonusChoice,
      handleBanrenmaCardConditionChoice,
      appendRevealCardGrantMessage,
      getRevealIrreversible,
      openChongRewardFollowUps,
      openAmibaRewardFollowUps,
      openRunezuRewardFollowUps,
      closeRunezuFaceSymbolPlacement,
      openRunezuFaceSymbolPlacement,
      handleRunezuFaceSymbolChoice,
      executeRunezuSymbolRewardEffect,
      closeRunezuSymbolBranchDialog,
      openRunezuSymbolBranchDialog,
      handleRunezuSymbolBranchChoice,
      alignAlienPanelsToPlanets,
    };
  }

  return Object.freeze({
    createAlienSpeciesRuntime,
  });
});
