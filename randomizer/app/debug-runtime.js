(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppDebugRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function createDebugRuntime(context = {}) {
    const windowRef = context.window || root;
    const documentRef = context.document !== undefined ? context.document : root.document;
    const {
      els,
      players,
      cards,
      tech,
      data,
      aliens,
      jiuzhe,
      yichangdian,
      fangzhou,
      banrenma,
      chong,
      amiba,
      aomomo,
      runezu,
      decisionSessions,
      uiRuntimeState,
      DEBUG_QUICK_SECTOR_SCAN_EXTRA_LIMIT = 10,
      getCurrentPlayer,
      getInterfacePlayer,
      getPlayerAgentLabel,
      getActivePlayers,
      getPlayerById,
      getPlayerByColor,
      getNormalTokenAssetForPlayer,
      getAlienJiuzheTraceLayer,
      getEarthSectorCoordinate,
      getRoundOrderPlayerIds,
      getDisplayedTurnNumber,
      getFirstEligiblePlayerId,
      isPlayerPassedThisRound,
      hasPlayerCompletedThisTurn,
      isAiAutoBattlePlayer,
      createAiControlSnapshot,
      restoreAiControlSnapshot,
      scheduleAiAutoStepIfNeeded,
      isGameEnded,
      resolvePlayerReference,
      getExplicitEffectOwnerPlayer,
      getCurrentActionEffect,
      isCardSelectionActive,
      isDiscardSelectionActive,
      isPlayCardSelectionActive,
      isTechTilePickingActive,
      closeTechBlueSlotPicker,
      closeDataPlacePicker,
      closeScanTargetPicker,
      closeScanAction4Picker,
      closeLandTargetPicker,
      clearActionEffectFlow,
      clearActionPending,
      syncPassReserveSelectionChrome,
      syncCardSelectionChrome,
      syncDiscardSelectionChrome,
      syncPlayCardSelectionChrome,
      syncTechSelectionChrome,
      setTokenAssetSizes,
      renderRoundStatus,
      renderPlayerStats,
      renderPlayerHand,
      renderPublicCards,
      renderReservedCards,
      renderAlienPanels,
      renderTechBoard,
      renderRockets,
      renderWheels,
      renderSectorNebulaDataBoard,
      renderStateReadout,
      updatePublicCardControls,
      updateActionButtons,
      schedulePersistentGameStateSave,
      clearMoveRocketHighlight,
      getMovableTokensForPlayer,
      resolveCompletedSectorSettlements,
      maybeStartFundamentalismRoundStartIncomeFlow,
      maybeOpenActionBriefingForCompletedCycle,
      maybeAutoOpenFinalResultDialog,
      clearTransientStateForRecovery,
      advanceTurnAfterPlayerAction,
      applyIndustryRoundStartBonuses,
      activateAomomoBoard,
    } = context;
    if (typeof context.getWorkingRoot !== "function") {
      throw new TypeError("createDebugRuntime requires getWorkingRoot()");
    }
    const rulePlayerState = () => context.getWorkingRoot().playerState;
    const ruleTurnState = () => context.getWorkingRoot().turnState;
    const ruleRocketState = () => context.getWorkingRoot().rocketState;
    const ruleTechGameState = () => context.getWorkingRoot().techGameState;
    const ruleNebulaDataState = () => context.getWorkingRoot().nebulaDataState;
    const ruleAlienGameState = () => context.getWorkingRoot().alienGameState;
    const ruleCardState = () => context.getWorkingRoot().cardState;
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

    function setDebugOpen(open) {
      const nextOpen = Boolean(open) && !els?.appWrap?.classList.contains("debug-tools-disabled");
      els?.appWrap?.classList.toggle("debug-collapsed", !nextOpen);
      els?.debugToggle?.setAttribute("aria-expanded", String(nextOpen));
      context.resize?.();
    }

    function createFocusDebugCalibrationHandler() {
      return function focusDebugCalibration(alienSlotId = 1) {
        setDebugOpen(false);
        windowRef.requestAnimationFrame(() => {
          const target = els?.alienPanels?.[alienSlotId - 1] || getAlienJiuzheTraceLayer?.(alienSlotId);
          target?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
        });
      };
    }

    function setDebugPlayerMenuOpen(open) {
      if (!els?.debugPlayerMenu || !els?.debugPlayerSwitchButton) return;
      els.debugPlayerMenu.hidden = !open;
      els.debugPlayerSwitchButton.setAttribute("aria-expanded", String(open));
    }

    function renderDebugPlayerSwitch() {
      const currentPlayer = getInterfacePlayer?.();
      if (els?.debugPlayerSwitchButton && currentPlayer) {
        els.debugPlayerSwitchButton.textContent = `玩家：${currentPlayer.colorLabel}（${getPlayerAgentLabel?.(currentPlayer.id)}）`;
      }
      if (!els?.debugPlayerMenu) return;

      const menuPlayers = getActivePlayers?.() || [];
      els.debugPlayerMenu.replaceChildren(...menuPlayers.map((player) => {
        const colorId = player.color;
        const color = players.getPlayerColorDefinition(colorId);
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "debug-player-option";
        button.dataset.playerColor = colorId;
        button.style.setProperty("--player-color", color?.uiColor || "#ffffff");
        button.textContent = `${color?.label || player.colorLabel || colorId}（${getPlayerAgentLabel?.(player.id)}）`;
        button.classList.toggle("is-current", currentPlayer?.color === colorId);
        button.setAttribute("aria-pressed", String(currentPlayer?.color === colorId));
        button.title = `切换到${player.name}（${getPlayerAgentLabel?.(player.id)}）`;
        return button;
      }));
    }

    function clearPlayerScopedSelectionsForSwitch() {
      decisionState.discardAction = null;
      decisionState.cardSelectionAction = null;
      decisionSessions?.clear?.("pass_reserve_selection");
      uiRuntimeState.passReserveSelectionDismissed = false;
      decisionState.handScanAction = null;
      decisionSessions?.clear?.("play_card_selection");
      cards.setSelectionActive(ruleCardState(), false);
      cards.setDiscardSelectionActive(ruleCardState(), false, 0);
      cards.setPlayCardSelectionActive(ruleCardState(), false);
      syncPassReserveSelectionChrome?.();
      tech.setTechSelectionActive(ruleTechGameState(), false);
      tech.cancelPendingTake(ruleTechGameState());
      closeTechBlueSlotPicker?.();
      closeDataPlacePicker?.();
      closeScanTargetPicker?.();
      closeScanAction4Picker?.();
      closeLandTargetPicker?.();
      clearActionEffectFlow?.();
      clearActionPending?.();
    }

    function selectDefaultRocketForCurrentPlayer() {
      const currentPlayer = getCurrentPlayer?.();
      const currentRocket = context.rocketActions?.getActiveRocket(ruleRocketState());
      if (
        currentRocket?.playerId === currentPlayer?.id
        && context.rocketActions?.isControllablePlayerRocket(currentRocket)
      ) {
        return currentRocket;
      }

      const rocketsForPlayer = getMovableTokensForPlayer?.(currentPlayer?.id) || [];
      const fallbackRocket = rocketsForPlayer[rocketsForPlayer.length - 1] || null;
      ruleRocketState().activeRocketId = fallbackRocket ? fallbackRocket.id : null;
      clearMoveRocketHighlight?.();
      return fallbackRocket;
    }

    function switchCurrentPlayerColor(color) {
      const targetPlayer = getPlayerByColor?.(color);
      if (!targetPlayer) {
        return { ok: false, message: "没有这名玩家" };
      }

      if (targetPlayer.id === rulePlayerState().currentPlayerId) {
        setDebugPlayerMenuOpen(false);
        return { ok: true, player: targetPlayer, message: `当前已是${targetPlayer.name}` };
      }

      clearPlayerScopedSelectionsForSwitch();
      rulePlayerState().currentPlayerId = targetPlayer.id;
      selectDefaultRocketForCurrentPlayer();
      ruleRocketState().statusNote = `已切换到${targetPlayer.name}`;
      setDebugPlayerMenuOpen(false);
      renderDebugPlayerSwitch();
      syncCardSelectionChrome?.();
      syncDiscardSelectionChrome?.();
      syncPlayCardSelectionChrome?.();
      syncTechSelectionChrome?.();
      setTokenAssetSizes?.();
      renderPlayerStats?.();
      renderAlienPanels?.();
      renderTechBoard?.();
      renderRockets?.();
      renderPublicCards?.();
      updatePublicCardControls?.();
      updateActionButtons?.();
      renderStateReadout?.();
      return { ok: true, player: targetPlayer, message: ruleRocketState().statusNote };
    }

    function getSectorOpenDataCount(sectorId) {
      return data.listNebulaTokens(ruleNebulaDataState(), sectorId)
        .filter((token) => !token.replacedByPlayerColor && !token.playerColor)
        .length;
    }

    function getSectorCapacity(sectorId) {
      return data.getNebulaCapacity(sectorId);
    }

    function getSectorExtraMarkCount(sectorId) {
      return typeof data.listSectorExtraMarks === "function"
        ? data.listSectorExtraMarks(ruleNebulaDataState(), sectorId).length
        : 0;
    }

    function getSectorNebulaLabelText(sectorId) {
      return data.getNebulaLabel(sectorId);
    }

    function setScanTargetPickerChrome(title, subtitle) {
      if (els?.scanTargetTitle) els.scanTargetTitle.textContent = title || "选择扫描目标";
      if (els?.scanTargetSubtitle) els.scanTargetSubtitle.textContent = subtitle || "";
      if (els?.scanTargetCancel) els.scanTargetCancel.hidden = false;
      if (els?.scanTargetOverlay) els.scanTargetOverlay.hidden = false;
    }

    function makeDebugQuickSectorScanButton(step, label, description, dataset = {}, disabled = false) {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button";
      button.dataset.debugSectorScanStep = step;
      for (const [key, value] of Object.entries(dataset)) {
        button.dataset[key] = String(value);
      }
      button.disabled = Boolean(disabled);
      button.innerHTML = `${label}<small>${description || ""}</small>`;
      return button;
    }

    function renderDebugQuickSectorScanPlayerStep() {
      setScanTargetPickerChrome("快速扫描扇区", "选择要放置标记的玩家颜色。");
      els.scanTargetActions.replaceChildren(...rulePlayerState().players.map((player) => {
        const definition = players.getPlayerColorDefinition(player.color);
        return makeDebugQuickSectorScanButton(
          "player",
          `${definition?.label || player.color}玩家`,
          `后续替换的数据会使用${definition?.label || player.color}普通 token`,
          { playerId: player.id },
        );
      }));
    }

    function renderDebugQuickSectorScanSectorStep(playerId) {
      const player = rulePlayerState().players.find((item) => item.id === playerId) || null;
      if (!player) {
        renderDebugQuickSectorScanPlayerStep();
        return;
      }

      setScanTargetPickerChrome(
        "快速扫描扇区",
        `当前玩家：${player.colorLabel}。选择要批量扫描的具名扇区。`,
      );
      els.scanTargetActions.replaceChildren(...data.NEBULA_IDS.map((sectorId) => {
        const openCount = getSectorOpenDataCount(sectorId);
        const capacity = getSectorCapacity(sectorId);
        const extraCount = getSectorExtraMarkCount(sectorId);
        return makeDebugQuickSectorScanButton(
          "sector",
          getSectorNebulaLabelText(sectorId),
          `${sectorId}，标记 ${capacity - openCount + extraCount}/${capacity}`
            + (extraCount ? `（额外${extraCount}）` : ""),
          { playerId, sectorId },
        );
      }));
    }

    function renderDebugQuickSectorScanCountStep(playerId, sectorId) {
      const player = rulePlayerState().players.find((item) => item.id === playerId) || null;
      const openCount = getSectorOpenDataCount(sectorId);
      if (!player) {
        renderDebugQuickSectorScanSectorStep(playerId);
        return;
      }

      setScanTargetPickerChrome(
        "快速扫描扇区",
        `${player.colorLabel}玩家 -> ${getSectorNebulaLabelText(sectorId)}。未替换数据 ${openCount} 个；超过后追加额外标记且不获得数据。`,
      );
      const maxCount = Math.max(openCount, 0) + DEBUG_QUICK_SECTOR_SCAN_EXTRA_LIMIT;
      const countButtons = Array.from({ length: maxCount }, (_item, index) => {
        const count = index + 1;
        const extraCount = Math.max(0, count - openCount);
        const description = extraCount
          ? `替换 ${Math.max(openCount, 0)} 个数据，并追加 ${extraCount} 个额外标记`
          : `替换 ${count} 个未替换数据`;
        return makeDebugQuickSectorScanButton(
          "count",
          count === openCount
            ? `${count}（填满）`
            : extraCount
              ? `${count}（填满+${extraCount}）`
              : String(count),
          description,
          { playerId, sectorId, count },
        );
      });
      els.scanTargetActions.replaceChildren(...countButtons);
    }

    function replaceNextSectorDataForDebugPlayer(sectorId, player) {
      const nextToken = data.getNextReplaceableNebulaToken(ruleNebulaDataState(), sectorId);
      if (nextToken) {
        return data.replaceNextNebulaDataToken(ruleNebulaDataState(), sectorId, player, {
          playerColor: player.color,
          playerLabel: player.colorLabel,
          playerTokenSrc: getNormalTokenAssetForPlayer?.(player),
          source: "debugQuickSectorScan",
        });
      }
      if (typeof data.addSectorExtraMark === "function") {
        return data.addSectorExtraMark(ruleNebulaDataState(), sectorId, player, {
          playerColor: player.color,
          playerLabel: player.colorLabel,
          playerTokenSrc: getNormalTokenAssetForPlayer?.(player),
          source: "debugQuickSectorScan",
        });
      }
      return { ok: false, message: `扇区${sectorId}没有可替换的数据` };
    }

    function runDebugQuickSectorScan(playerId, sectorId, count) {
      const player = rulePlayerState().players.find((item) => item.id === playerId) || null;
      const replaceCount = Math.max(0, Math.round(Number(count) || 0));
      if (!player || !data.getNebulaCapacity(sectorId) || replaceCount <= 0) {
        ruleRocketState().statusNote = "快速扫描扇区：参数无效";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }

      const results = [];
      for (let index = 0; index < replaceCount; index += 1) {
        const result = replaceNextSectorDataForDebugPlayer(sectorId, player);
        if (!result.ok) break;
        results.push(result);
      }

      const settleResult = resolveCompletedSectorSettlements?.("debugQuickSectorScan", {
        markMainActionIrreversible: false,
      });
      const extraCount = results.filter((result) => result.extra).length;
      const dataCount = results.length - extraCount;
      const replacedText = `快速扫描扇区：${player.colorLabel}玩家在${getSectorNebulaLabelText(sectorId)}`
        + `标记 ${results.length}/${replaceCount} 次（数据${dataCount}，额外${extraCount}）`;
      ruleRocketState().statusNote = settleResult?.ok
        ? `${replacedText}；${settleResult.message}；${settleResult.participantAwardMessage || "参与结算玩家各获得1宣传"}`
        : replacedText;
      renderSectorNebulaDataBoard?.();
      renderPlayerStats?.();
      updateActionButtons?.();
      renderStateReadout?.();
      return {
        ok: results.length > 0,
        results,
        settlement: settleResult,
        message: ruleRocketState().statusNote,
      };
    }

    function handleDebugQuickSectorScanChoice(button) {
      const step = button.dataset.debugSectorScanStep;
      const playerId = button.dataset.playerId;
      if (step === "player") {
        renderDebugQuickSectorScanSectorStep(playerId);
        return;
      }
      if (step === "sector") {
        renderDebugQuickSectorScanCountStep(playerId, button.dataset.sectorId);
        return;
      }
      if (step === "count") {
        closeScanTargetPicker?.();
        runDebugQuickSectorScan(playerId, button.dataset.sectorId, Number(button.dataset.count));
      }
    }

    function openDebugQuickSectorScanPicker() {
      if (
        isCardSelectionActive?.()
        || isDiscardSelectionActive?.()
        || isPlayCardSelectionActive?.()
        || isTechTilePickingActive?.()
      ) {
        ruleRocketState().statusNote = "请先完成当前选择";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }
      decisionState.scanTargetAction = { type: "debug_quick_sector_scan" };
      renderDebugQuickSectorScanPlayerStep();
      ruleRocketState().statusNote = "快速扫描扇区：请选择玩家颜色";
      renderStateReadout?.();
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function setDebugAlienTraceModeActive(active, message = null) {
      uiRuntimeState.debugAlienTraceModeActive = Boolean(active);
      if (uiRuntimeState.debugAlienTraceModeActive) {
        context.closeAlienTracePicker?.();
        decisionState.alienTracePickerState = {
          mode: "debug-direct",
          allowedTraceTypes: aliens.TRACE_TYPES,
        };
        ruleRocketState().statusNote = message
          || "调试：未揭示外星人请点击 state 面板痕迹位；已揭示请点击正面痕迹位或方舟保留牌解锁";
      } else {
        if (decisionState.alienTracePickerState?.mode === "debug-direct") {
          decisionState.alienTracePickerState = null;
        }
        ruleRocketState().statusNote = message || "已退出调试获取外星人痕迹模式";
      }
      els?.debugAlienTraceButton?.classList.toggle("is-active", uiRuntimeState.debugAlienTraceModeActive);
      if (els?.debugAlienTraceButton) {
        els.debugAlienTraceButton.setAttribute("aria-pressed", uiRuntimeState.debugAlienTraceModeActive ? "true" : "false");
      }
      renderAlienPanels?.();
      renderReservedCards?.();
      updateActionButtons?.();
      renderStateReadout?.();
      return { ok: true, active: uiRuntimeState.debugAlienTraceModeActive, message: ruleRocketState().statusNote };
    }

    function toggleDebugAlienTraceMode() {
      return setDebugAlienTraceModeActive(!uiRuntimeState.debugAlienTraceModeActive);
    }

    function enableDebugAlienTraceModeForReveal(message) {
      return setDebugAlienTraceModeActive(true, message);
    }

    function addDebugIncome() {
      const currentPlayer = getCurrentPlayer?.();
      players.gainResources(currentPlayer, {
        credits: 100,
        energy: 100,
        publicity: 10,
        additionalPublicScan: 2,
      });
      for (let index = 0; index < players.RESOURCE_LIMITS.availableData; index += 1) {
        data.gainData(currentPlayer, { source: "debug" });
      }
      ruleRocketState().statusNote = "调试收入 +100信用点 +100能量 +10宣传 +2额外公共扫描 +6数据";
      renderPlayerStats?.();
      updateActionButtons?.();
      renderStateReadout?.();
      return { ok: true, player: currentPlayer, message: ruleRocketState().statusNote };
    }

    function addDebugData() {
      const currentPlayer = getCurrentPlayer?.();
      const result = data.gainData(currentPlayer, { source: "debug" });
      ruleRocketState().statusNote = result.message;
      renderPlayerStats?.();
      updateActionButtons?.();
      renderStateReadout?.();
      return result;
    }

    function addDebugScore() {
      const currentPlayer = getCurrentPlayer?.();
      players.gainResources(currentPlayer, { score: 20 });
      ruleRocketState().statusNote = `${currentPlayer.colorLabel}玩家调试分数 +20`;
      renderPlayerStats?.();
      updateActionButtons?.();
      renderStateReadout?.();
      return { ok: true, player: currentPlayer, message: ruleRocketState().statusNote };
    }

    function addDebugCardByInput(input) {
      const currentPlayer = getCurrentPlayer?.();
      if (!currentPlayer) {
        ruleRocketState().statusNote = "没有当前玩家，无法获取卡牌";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }
      const entries = typeof cards.getCatalogEntriesByInputRange === "function"
        ? cards.getCatalogEntriesByInputRange(input, 5)
        : [cards.getCatalogEntryByInput?.(input) || cards.getBasicCatalogEntryByInput?.(input)].filter(Boolean);
      if (!entries.length) {
        ruleRocketState().statusNote = "请输入起始卡牌编号：普通牌 b_1 到 b_140（也可直接输入数字），或 DLC 牌 dlc_1 到 dlc_42";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }

      const gainedCards = entries.map((entry, index) => cards.createCardInstance(entry, `debug-${index + 1}`));
      for (const card of gainedCards) {
        cards.addCardToHand(currentPlayer, card);
      }
      ruleRocketState().statusNote = `调试获取卡牌：${gainedCards.map((card) => cards.getCardLabel(card)).join("、")} 已加入${currentPlayer.colorLabel}玩家手牌`;
      renderPlayerStats?.();
      renderPlayerHand?.();
      updateActionButtons?.();
      renderStateReadout?.();
      return { ok: true, player: currentPlayer, cards: gainedCards, message: ruleRocketState().statusNote };
    }

    function promptDebugGainCard() {
      const input = windowRef.prompt("输入起始卡牌编号，将获取连续最多 5 张。例如 25、b_25、b_25.webp、dlc_1 或 dlc_1.png");
      if (input == null) return { ok: false, cancelled: true };
      return addDebugCardByInput(input);
    }

    function ensureDebugPlayerCardZones(player) {
      if (!player) return;
      if (!player.resources || typeof player.resources !== "object") player.resources = {};
      if (!Array.isArray(player.hand)) player.hand = [];
      if (!Array.isArray(player.reservedCards)) player.reservedCards = [];
      player.resources.handSize = player.hand.length;
    }

    function getDebugAlienCardKey(card) {
      if (!card) return null;
      if (card.set && card.cardId) return `${card.set}:${card.cardId}`;
      if (card.cardId) return String(card.cardId);
      if (card.set && card.alienCardId != null) return `${card.set}:${card.alienCardId}`;
      return card.id ? String(card.id) : null;
    }

    function playerHasDebugAlienCard(player, card) {
      const key = getDebugAlienCardKey(card);
      if (!key) return false;
      return [...(player?.hand || []), ...(player?.reservedCards || [])]
        .some((existing) => getDebugAlienCardKey(existing) === key);
    }

    function createDebugAlienCardGrantSummary() {
      return { hand: 0, reserved: 0, specialReserved: 0, skipped: 0 };
    }

    function recordDebugAlienCardGrant(summary, result) {
      if (!summary || !result) return summary;
      if (result.duplicate) summary.skipped += 1;
      else if (result.location === "hand") summary.hand += 1;
      else if (result.location === "reserved") summary.reserved += 1;
      else if (result.location === "specialReserved") summary.specialReserved += 1;
      return summary;
    }

    function addDebugAlienCardToPlayer(player, card) {
      ensureDebugPlayerCardZones(player);
      if (!player || !card) return { added: false };
      if (playerHasDebugAlienCard(player, card)) {
        return { added: false, duplicate: true };
      }
      cards.addCardToHand(player, card);
      return { added: true, location: "hand" };
    }

    function getNextDebugAlienCardSequence(alienState, fallback) {
      if (!alienState || typeof alienState !== "object") return fallback;
      const sequence = Math.max(0, Math.round(Number(alienState.nextCardSequence) || 0));
      alienState.nextCardSequence = sequence + 1;
      return sequence;
    }

    function grantAllModuleAlienCardsForDebug(player, alienModule, alienState) {
      const summary = createDebugAlienCardGrantSummary();
      if (!alienModule?.CARD_DEFINITIONS?.length || !alienModule.createAlienCard) return summary;

      let fallbackSequence = 0;
      for (const definition of alienModule.CARD_DEFINITIONS) {
        const sequence = alienState
          ? getNextDebugAlienCardSequence(alienState, fallbackSequence)
          : fallbackSequence;
        fallbackSequence = sequence + 1;
        const card = alienModule.createAlienCard(definition.index, sequence);
        recordDebugAlienCardGrant(summary, addDebugAlienCardToPlayer(player, card));
      }
      return summary;
    }

    function createJiuzheDebugCard(definition) {
      return {
        index: definition.index,
        id: `jiuzhe-card-${definition.index}`,
        src: jiuzhe.getCardSrc(definition.index),
        threat: definition.threat || 0,
        score: definition.score || 0,
        condition: definition.condition || null,
        label: definition.label || `九折牌 ${definition.index}`,
        played: false,
      };
    }

    function grantAllJiuzheCardsForDebug(player) {
      const summary = createDebugAlienCardGrantSummary();
      if (!jiuzhe?.CARD_DEFINITIONS?.length || !player) return summary;

      const jiuzheState = jiuzhe.ensureJiuzheState(ruleAlienGameState());
      const playerJiuzheState = jiuzhe.getPlayerJiuzheState(ruleAlienGameState(), player, true);
      if (!playerJiuzheState) return summary;

      if (!Array.isArray(playerJiuzheState.cards)) playerJiuzheState.cards = [];
      const existing = new Set(playerJiuzheState.cards.map((card) => Number(card.index)));
      for (const definition of jiuzhe.CARD_DEFINITIONS) {
        if (existing.has(Number(definition.index))) {
          summary.skipped += 1;
          continue;
        }
        playerJiuzheState.cards.push(createJiuzheDebugCard(definition));
        existing.add(Number(definition.index));
        summary.specialReserved += 1;
      }
      playerJiuzheState.cards.sort((left, right) => Number(left.index) - Number(right.index));
      jiuzheState.cardsDealt = true;
      return summary;
    }

    function grantAllFangzhouCardsForDebug(player) {
      const summary = createDebugAlienCardGrantSummary();
      if (!fangzhou?.createCard2Definition || !player) return summary;

      const playerKey = player.id || player.color || "player";
      const traceTypes = fangzhou.TRACE_TYPES || aliens.TRACE_TYPES || ["pink", "yellow", "blue"];
      for (const traceType of traceTypes) {
        for (let variant = 1; variant <= 4; variant += 1) {
          const card = {
            ...fangzhou.createCard2Definition(traceType, variant),
            id: `fangzhou-card2-debug-${playerKey}-${traceType}-${variant}`,
            faceUp: true,
            fangzhouCard2: true,
            fangzhouTraceType: traceType,
          };
          recordDebugAlienCardGrant(summary, addDebugAlienCardToPlayer(player, card));
        }
      }
      return summary;
    }

    function formatDebugAlienCardGrantSummary(summary) {
      if (!summary) return "";
      const parts = [];
      if (summary.hand) parts.push(`手牌+${summary.hand}`);
      if (summary.reserved) parts.push(`保留牌+${summary.reserved}`);
      if (summary.specialReserved) parts.push(`专属保留+${summary.specialReserved}`);
      if (summary.skipped) parts.push(`已存在${summary.skipped}`);
      return parts.length ? `；调试发牌：${parts.join("，")}` : "；调试发牌：该外星人牌已齐";
    }

    function revealJiuzheForDebug() {
      if (!jiuzhe) return { ok: false, message: "九折模块未加载" };
      const currentPlayer = getCurrentPlayer?.();
      const alienSlotId = 1;
      const slot = aliens.getAlienSlot(ruleAlienGameState(), alienSlotId);
      if (!slot) return { ok: false, message: "找不到外星人 1" };

      slot.assignedAlienId = jiuzhe.ALIEN_ID;
      slot.alienId = jiuzhe.ALIEN_ID;
      slot.revealed = true;
      jiuzhe.ensureJiuzheState(ruleAlienGameState());
      ruleAlienGameState().jiuzhe.revealedSlotId = alienSlotId;
      ruleAlienGameState().jiuzhe.revealedByPlayerId = currentPlayer.id;
      ruleAlienGameState().jiuzhe.revealedByPlayerColor = currentPlayer.color;
      ruleAlienGameState().jiuzhe.freeScoreThreshold = (Number(currentPlayer.resources?.score) || 0) + 20;
      ruleAlienGameState().jiuzhe.paidScoreThreshold = (Number(currentPlayer.resources?.score) || 0) + 40;
      ruleAlienGameState().jiuzhe.revealInitialized = true;
      delete ruleAlienGameState().jiuzhe.traceSlotsByAlienSlotId[String(alienSlotId)];
      const grantSummary = grantAllJiuzheCardsForDebug(currentPlayer);

      enableDebugAlienTraceModeForReveal(`九折调试：已在外星人 1 揭示九折（未放置 token）；已开启获取外星人标记模式，点击正面痕迹位会按正式规则结算奖励${formatDebugAlienCardGrantSummary(grantSummary)}`);
      renderAlienPanels?.();
      renderPlayerHand?.();
      renderPlayerStats?.();
      renderReservedCards?.();
      renderStateReadout?.();
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function revealYichangdianForDebug() {
      if (!yichangdian) return { ok: false, message: "异常点模块未加载" };
      const currentPlayer = getCurrentPlayer?.();
      const alienSlotId = 1;
      const slot = aliens.getAlienSlot(ruleAlienGameState(), alienSlotId);
      if (!slot) return { ok: false, message: "找不到外星人 1" };

      slot.assignedAlienId = yichangdian.ALIEN_ID;
      slot.alienId = yichangdian.ALIEN_ID;
      slot.revealed = true;
      ruleAlienGameState().yichangdian = yichangdian.createYichangdianState();
      const earth = getEarthSectorCoordinate?.();
      yichangdian.initializeYichangdianReveal(ruleAlienGameState(), alienSlotId, currentPlayer, earth?.x);
      const grantSummary = grantAllModuleAlienCardsForDebug(currentPlayer, yichangdian, ruleAlienGameState().yichangdian);

      enableDebugAlienTraceModeForReveal(`异常点调试：已在外星人 1 揭示异常点并生成异常标记（未放置 token）；已开启获取外星人标记模式，点击正面痕迹位会按正式规则结算奖励${formatDebugAlienCardGrantSummary(grantSummary)}`);
      renderAlienPanels?.();
      renderRockets?.();
      renderPlayerHand?.();
      renderPlayerStats?.();
      renderReservedCards?.();
      renderStateReadout?.();
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function revealFangzhouForDebug() {
      if (!fangzhou) return { ok: false, message: "方舟模块未加载" };
      const currentPlayer = getCurrentPlayer?.();
      const alienSlotId = 1;
      const slot = aliens.getAlienSlot(ruleAlienGameState(), alienSlotId);
      if (!slot) return { ok: false, message: "找不到外星人 1" };

      slot.assignedAlienId = fangzhou.ALIEN_ID;
      slot.alienId = fangzhou.ALIEN_ID;
      slot.revealed = true;
      ruleAlienGameState().fangzhou = fangzhou.createFangzhouState();
      fangzhou.initializeFangzhouReveal(ruleAlienGameState(), alienSlotId, currentPlayer, getActivePlayers?.());
      const grantSummary = grantAllFangzhouCardsForDebug(currentPlayer);

      enableDebugAlienTraceModeForReveal(`方舟调试：已在外星人 1 揭示方舟（未放置 token）；已开启获取外星人标记模式，点击正面痕迹位或解锁牌会按正式规则结算奖励${formatDebugAlienCardGrantSummary(grantSummary)}`);
      renderAlienPanels?.();
      renderPlayerHand?.();
      renderPlayerStats?.();
      renderReservedCards?.();
      renderStateReadout?.();
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function revealBanrenmaForDebug() {
      if (!banrenma) return { ok: false, message: "半人马模块未加载" };
      const currentPlayer = getCurrentPlayer?.();
      const alienSlotId = 1;
      const slot = aliens.getAlienSlot(ruleAlienGameState(), alienSlotId);
      if (!slot) return { ok: false, message: "找不到外星人 1" };

      slot.assignedAlienId = banrenma.ALIEN_ID;
      slot.alienId = banrenma.ALIEN_ID;
      slot.revealed = true;
      ruleAlienGameState().banrenma = banrenma.createBanrenmaState();
      banrenma.initializeBanrenmaReveal(ruleAlienGameState(), alienSlotId, currentPlayer, getActivePlayers?.());
      const grantSummary = grantAllModuleAlienCardsForDebug(currentPlayer, banrenma, ruleAlienGameState().banrenma);

      enableDebugAlienTraceModeForReveal(`半人马调试：已在外星人 1 揭示半人马（未放置 token）；已开启获取外星人标记模式，点击正面痕迹位会按正式规则结算奖励${formatDebugAlienCardGrantSummary(grantSummary)}`);
      renderAlienPanels?.();
      renderPlayerHand?.();
      renderPlayerStats?.();
      renderReservedCards?.();
      renderStateReadout?.();
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function revealChongForDebug() {
      if (!chong) return { ok: false, message: "虫族模块未加载" };
      const currentPlayer = getCurrentPlayer?.();
      const alienSlotId = 1;
      const slot = aliens.getAlienSlot(ruleAlienGameState(), alienSlotId);
      if (!slot) return { ok: false, message: "找不到外星人 1" };

      slot.assignedAlienId = chong.ALIEN_ID;
      slot.alienId = chong.ALIEN_ID;
      slot.revealed = true;
      ruleAlienGameState().chong = chong.createChongState();
      chong.initializeChongReveal(ruleAlienGameState(), alienSlotId, currentPlayer);
      const grantSummary = grantAllModuleAlienCardsForDebug(currentPlayer, chong, ruleAlienGameState().chong);

      enableDebugAlienTraceModeForReveal(`虫族调试：已在外星人 1 揭示虫族，按揭示阶段放置化石（未放置 token）；已开启获取外星人标记模式，点击正面痕迹位会按正式规则结算奖励${formatDebugAlienCardGrantSummary(grantSummary)}`);
      renderAlienPanels?.();
      renderRockets?.();
      renderPlayerHand?.();
      renderPlayerStats?.();
      renderReservedCards?.();
      renderStateReadout?.();
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function revealAmibaForDebug() {
      if (!amiba) return { ok: false, message: "阿米巴模块未加载" };
      const currentPlayer = getCurrentPlayer?.();
      const alienSlotId = 1;
      const slot = aliens.getAlienSlot(ruleAlienGameState(), alienSlotId);
      if (!slot) return { ok: false, message: "找不到外星人 1" };

      slot.assignedAlienId = amiba.ALIEN_ID;
      slot.alienId = amiba.ALIEN_ID;
      slot.revealed = true;
      ruleAlienGameState().amiba = amiba.createAmibaState();
      amiba.initializeAmibaReveal(ruleAlienGameState(), alienSlotId, currentPlayer);
      const grantSummary = grantAllModuleAlienCardsForDebug(currentPlayer, amiba, ruleAlienGameState().amiba);

      const symbolCount = Object.keys(ruleAlienGameState().amiba?.symbolsById || {}).length;
      enableDebugAlienTraceModeForReveal(`阿米巴调试：已在外星人 1 揭示阿米巴并默认放置 ${symbolCount} 个 symbol（未放置 token）；已开启获取外星人标记模式，点击正面痕迹位会按正式规则结算奖励${formatDebugAlienCardGrantSummary(grantSummary)}`);
      renderAlienPanels?.();
      renderPlayerHand?.();
      renderPlayerStats?.();
      renderReservedCards?.();
      renderStateReadout?.();
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function logAomomoDebugCoordinates(alienSlotId = ruleAlienGameState().aomomo?.revealedSlotId || 1) {
      if (!aomomo) return;
      const lines = [];
      for (const token of data.listNebulaTokens(ruleNebulaDataState(), aomomo.NEBULA_ID)) {
        const layout = data.getEffectiveAomomoBoardSlotLayout?.(token.slotIndex, token, context.solarState, context.solar);
        if (!layout) continue;
        const boardX = layout.boardPercentX ?? layout.percentX;
        const boardY = layout.boardPercentY ?? layout.percentY;
        const radial = layout.radialFraction ?? "n/a";
        const angular = layout.angularFraction ?? "n/a";
        lines.push(`数据槽 ${token.slotIndex} = 盘面(${boardX}%, ${boardY}%) radial=${radial} angular=${angular}`);
      }
      for (const line of lines) {
        console.info("[奥陌陌调试坐标]", line);
      }
    }

    function revealAomomoForDebug() {
      if (!aomomo) return { ok: false, message: "奥陌陌模块未加载" };
      const currentPlayer = getCurrentPlayer?.();
      const alienSlotId = 1;
      const slot = aliens.getAlienSlot(ruleAlienGameState(), alienSlotId);
      if (!slot) return { ok: false, message: "找不到外星人 1" };

      slot.assignedAlienId = aomomo.ALIEN_ID;
      slot.alienId = aomomo.ALIEN_ID;
      slot.revealed = true;
      ruleAlienGameState().aomomo = aomomo.createAomomoState();
      aomomo.initializeAomomoReveal(ruleAlienGameState(), alienSlotId, currentPlayer);
      activateAomomoBoard?.({ source: "aomomo_debug", replaceData: true });
      const grantSummary = grantAllModuleAlienCardsForDebug(currentPlayer, aomomo, ruleAlienGameState().aomomo);

      enableDebugAlienTraceModeForReveal(
        `奥陌陌调试：已揭示奥陌陌、替换第3轮盘并启用奥陌陌星球；星球弧形槽位放入3个数据token，随wheel3旋转；外星人面板不预放痕迹/环绕/登陆token${formatDebugAlienCardGrantSummary(grantSummary)}`,
      );
      renderWheels?.();
      renderSectorNebulaDataBoard?.();
      renderAlienPanels?.();
      renderRockets?.();
      renderPlayerHand?.();
      renderPlayerStats?.();
      renderReservedCards?.();
      renderStateReadout?.();
      logAomomoDebugCoordinates(alienSlotId);
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function revealRunezuForDebug() {
      if (!runezu) return { ok: false, message: "符文族模块未加载" };
      const currentPlayer = getCurrentPlayer?.();
      const alienSlotId = 1;
      const slot = aliens.getAlienSlot(ruleAlienGameState(), alienSlotId);
      if (!slot) return { ok: false, message: "找不到外星人 1" };

      slot.assignedAlienId = runezu.ALIEN_ID;
      slot.alienId = runezu.ALIEN_ID;
      slot.revealed = true;
      ruleAlienGameState().runezu = runezu.createRunezuState();
      runezu.initializeRunezuReveal(ruleAlienGameState(), alienSlotId, currentPlayer, {
        techBoardState: ruleTechGameState().board,
      });
      const panelSymbols = runezu.listPanelSymbols(ruleAlienGameState());
      const grantSummary = grantAllModuleAlienCardsForDebug(currentPlayer, runezu, ruleAlienGameState().runezu);

      enableDebugAlienTraceModeForReveal(
        `符文族调试：已揭示符文族并按机制默认放置 ${panelSymbols.length} 个白框 symbol（未放置痕迹 token）；已开启获取外星人标记模式，点击正面痕迹位会按正式规则结算奖励${formatDebugAlienCardGrantSummary(grantSummary)}`,
      );
      renderAlienPanels?.();
      renderRockets?.();
      renderTechBoard?.();
      renderPlayerHand?.();
      renderPlayerStats?.();
      renderReservedCards?.();
      renderStateReadout?.();
      return { ok: true, message: ruleRocketState().statusNote };
    }

    function fillNebulaDataBoard(options = {}) {
      const { replace = false, source = "debug", log = false } = options;
      if (replace) {
        data.clearNebulaData(ruleNebulaDataState());
      }

      const result = data.fillAllNebulaData(ruleNebulaDataState(), { source });
      ruleRocketState().statusNote = result.message;
      renderSectorNebulaDataBoard?.();
      renderStateReadout?.();

      if (log) {
        if (result.ok) {
          for (const fillResult of result.results || []) {
            console.info("[星云数据填充]", fillResult.message);
            for (const { token, layout } of fillResult.added || []) {
              const label = data.getNebulaLabel(fillResult.nebulaId);
              console.info(
                `[星云坐标] ${label} 序号${token.index} 槽位${token.slotIndex}`
                + ` → 局部${layout.percentX}%,${layout.percentY}%`,
              );
            }
          }
        } else {
          console.info("[星云数据填充]", result.message);
        }
      }

      return result;
    }

    function fillDebugNebulaData() {
      return fillNebulaDataBoard({ source: "debug", log: true });
    }

    function toggleSectorWinDebug() {
      uiRuntimeState.sectorWinDebugActive = !uiRuntimeState.sectorWinDebugActive;
      els?.appWrap?.classList.toggle("sector-win-debug-active", uiRuntimeState.sectorWinDebugActive);
      els?.debugSectorWinButton?.setAttribute("aria-pressed", String(uiRuntimeState.sectorWinDebugActive));
      ruleRocketState().statusNote = uiRuntimeState.sectorWinDebugActive
        ? "赢得扇区调试：已显示校准占位 token，可拖动记录坐标"
        : "赢得扇区调试：已关闭";
      renderSectorNebulaDataBoard?.();
      renderStateReadout?.();
      return { ok: true, active: uiRuntimeState.sectorWinDebugActive, message: ruleRocketState().statusNote };
    }

    function getExplicitPendingOwnerPlayerForFailsafe(pending) {
      if (!pending) return null;
      const directOwner = resolvePlayerReference?.({
        playerId: pending.player?.id || pending.playerId || pending.targetPlayerId,
        playerColor: pending.player?.color || pending.playerColor || pending.targetPlayerColor,
      });
      if (directOwner) return directOwner;
      return getExplicitEffectOwnerPlayer?.(pending.effect) || null;
    }

    function getActionEffectOwnerPlayerForFailsafe() {
      if (!decisionState.actionEffectFlow) return null;
      const effect = getCurrentActionEffect?.();
      return getExplicitEffectOwnerPlayer?.(effect)
        || getPlayerById?.(decisionState.actionEffectFlow.activePlayerId)
        || getPlayerById?.(decisionState.actionEffectFlow.playerId)
        || getPlayerById?.(decisionState.actionEffectFlow.defaultPlayerId)
        || null;
    }

    function getFailsafePendingOwnerPlayer() {
      const effectOwner = getActionEffectOwnerPlayerForFailsafe();
      if (effectOwner) return effectOwner;

      const pendingEntries = [
        decisionSessions?.peek?.("move_payment"),
        decisionState.discardAction,
        decisionState.cardSelectionAction,
        decisionSessions?.peek?.("pass_reserve_selection"),
        decisionState.scanTargetAction,
        decisionSessions?.peek?.("probe_sector_scan"),
        decisionSessions?.peek?.("probe_location_reward"),
        decisionSessions?.peek?.("public_scan_queue"),
        decisionState.handScanAction,
        decisionState.alienTraceAction,
        decisionSessions?.peek?.("land_target"),
        decisionSessions?.peek?.("data_placement"),
        decisionSessions?.peek?.("card_trigger_action"),
        decisionSessions?.peek?.("card_trigger_free_move"),
        decisionSessions?.peek?.("card_task_completion"),
        decisionSessions?.peek?.("jiuzhe_card_play"),
        decisionSessions?.peek?.("yichangdian_card_gain"),
        decisionSessions?.peek?.("yichangdian_corner_action"),
        decisionSessions?.peek?.("banrenma_card_gain"),
        decisionSessions?.peek?.("banrenma_opportunity"),
        decisionSessions?.peek?.("chong_card_gain"),
        decisionSessions?.peek?.("chong_fossil_choice"),
        decisionSessions?.peek?.("chong_task_completion"),
        decisionSessions?.peek?.("amiba_card_gain"),
        decisionSessions?.peek?.("amiba_symbol_choice"),
        decisionSessions?.peek?.("amiba_trace_removal"),
        decisionSessions?.peek?.("aomomo_card_gain"),
        decisionSessions?.peek?.("runezu_card_gain"),
        decisionSessions?.peek?.("runezu_symbol_branch"),
        decisionSessions?.peek?.("runezu_face_symbol_placement"),
        decisionSessions?.peek?.("strategy_passive_slot"),
        decisionSessions?.peek?.("pirates_raid_placement"),
        uiRuntimeState.industryFreeMoveState,
      ];
      for (const pending of pendingEntries) {
        const owner = getExplicitPendingOwnerPlayerForFailsafe(pending);
        if (owner) return owner;
      }
      return null;
    }

    function getRecoverableTurnPlayerForFailsafe() {
      const activeIds = new Set(ruleTurnState().activePlayerIds || []);
      const currentPlayer = players.getCurrentPlayer(rulePlayerState());
      if (
        currentPlayer?.id
        && activeIds.has(currentPlayer.id)
        && !isPlayerPassedThisRound?.(currentPlayer.id)
        && !hasPlayerCompletedThisTurn?.(currentPlayer.id)
      ) {
        return currentPlayer;
      }

      const pendingTurnPlayerId = (getRoundOrderPlayerIds?.() || [])
        .find((playerId) => (
          activeIds.has(playerId)
          && !isPlayerPassedThisRound?.(playerId)
          && !hasPlayerCompletedThisTurn?.(playerId)
        ));
      if (pendingTurnPlayerId) return getPlayerById?.(pendingTurnPlayerId);

      const firstEligiblePlayerId = getFirstEligiblePlayerId?.();
      return firstEligiblePlayerId ? getPlayerById?.(firstEligiblePlayerId) : currentPlayer;
    }

    function getAiTakeoverTargetPlayer() {
      const pendingOwner = getFailsafePendingOwnerPlayer();
      if (pendingOwner?.id && isAiAutoBattlePlayer?.(pendingOwner.id)) return pendingOwner;

      const currentPlayer = players.getCurrentPlayer(rulePlayerState());
      if (currentPlayer?.id && isAiAutoBattlePlayer?.(currentPlayer.id)) return currentPlayer;

      const recoverableTurnPlayer = getRecoverableTurnPlayerForFailsafe();
      if (recoverableTurnPlayer?.id && isAiAutoBattlePlayer?.(recoverableTurnPlayer.id)) {
        return recoverableTurnPlayer;
      }

      return (getRoundOrderPlayerIds?.() || [])
        .map((playerId) => getPlayerById?.(playerId))
        .find((player) => (
          player?.id
          && isAiAutoBattlePlayer?.(player.id)
          && !isPlayerPassedThisRound?.(player.id)
          && !hasPlayerCompletedThisTurn?.(player.id)
        )) || null;
    }

    function renderAfterFailsafeControl(message, options = {}) {
      if (message) ruleRocketState().statusNote = message;
      selectDefaultRocketForCurrentPlayer();
      renderDebugPlayerSwitch();
      renderRoundStatus?.();
      syncCardSelectionChrome?.();
      syncDiscardSelectionChrome?.();
      syncPlayCardSelectionChrome?.();
      syncTechSelectionChrome?.();
      setTokenAssetSizes?.();
      renderPlayerStats?.();
      renderAlienPanels?.();
      renderTechBoard?.();
      renderRockets?.();
      renderPublicCards?.();
      renderReservedCards?.();
      updatePublicCardControls?.();
      updateActionButtons?.();
      renderStateReadout?.();
      schedulePersistentGameStateSave?.({ label: options.saveLabel || message || "兜底控制后状态" });
    }

    function resumeAiAutomationForFailsafe(targetPlayer) {
      const snapshot = createAiControlSnapshot?.();
      if (!snapshot?.enabled || !snapshot.playerIds?.length) {
        return { ok: false, message: "当前没有电脑玩家配置" };
      }
      if (!snapshot.playerIds.includes(targetPlayer?.id)) {
        return { ok: false, message: `${targetPlayer?.colorLabel || "该"}玩家不是电脑玩家` };
      }
      const restoreResult = restoreAiControlSnapshot?.(snapshot);
      scheduleAiAutoStepIfNeeded?.();
      return restoreResult;
    }

    function handleAiTakeoverFailsafe() {
      if (isGameEnded?.()) {
        ruleRocketState().statusNote = "游戏已结束，无法 AI 接管";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }

      const targetPlayer = getAiTakeoverTargetPlayer();
      if (!targetPlayer) {
        ruleRocketState().statusNote = "当前没有可接管的电脑玩家";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }

      rulePlayerState().currentPlayerId = targetPlayer.id;
      const resumeResult = resumeAiAutomationForFailsafe(targetPlayer);
      if (!resumeResult?.ok) {
        ruleRocketState().statusNote = resumeResult?.message || "AI 接管失败";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }

      const message = `${targetPlayer.colorLabel || "电脑"}玩家已交回 AI 接管`;
      renderAfterFailsafeControl(message, { saveLabel: "AI 接管后状态" });
      return { ok: true, player: targetPlayer, message };
    }

    function handleForceSkipTurnFailsafe() {
      if (isGameEnded?.()) {
        ruleRocketState().statusNote = "游戏已结束，无法强制跳过";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }

      const targetPlayer = getFailsafePendingOwnerPlayer()
        || getRecoverableTurnPlayerForFailsafe()
        || getCurrentPlayer?.();
      if (!targetPlayer) {
        ruleRocketState().statusNote = "没有可跳过的玩家";
        renderStateReadout?.();
        return { ok: false, message: ruleRocketState().statusNote };
      }

      clearTransientStateForRecovery?.();
      rulePlayerState().currentPlayerId = targetPlayer.id;
      const advanceResult = advanceTurnAfterPlayerAction?.(targetPlayer.id, { passed: false }) || {};
      const roundStartResult = advanceResult.roundAdvanced
        ? applyIndustryRoundStartBonuses?.(ruleTurnState().roundNumber, { appendLog: true })
        : null;
      const nextPlayer = getCurrentPlayer?.();
      const displayedTurnNumber = getDisplayedTurnNumber?.();
      const advanceMessage = advanceResult.gameEnded
        ? `游戏结束${advanceResult.finalScoreLines?.length ? `：${advanceResult.finalScoreLines.join("；")}` : ""}`
        : `进入第 ${ruleTurnState().roundNumber} 轮第 ${displayedTurnNumber} 回合，当前玩家：${nextPlayer?.colorLabel || ""}玩家`;
      const message = [
        `${targetPlayer.colorLabel || "当前"}玩家已强制跳过本回合（未 PASS）`,
        advanceMessage,
        roundStartResult?.message || null,
      ].filter(Boolean).join("；");
      renderAfterFailsafeControl(message, { saveLabel: "强制跳过后状态" });
      if (!advanceResult.gameEnded) {
        maybeStartFundamentalismRoundStartIncomeFlow?.(nextPlayer, ruleTurnState().roundNumber);
        if (!maybeOpenActionBriefingForCompletedCycle?.(advanceResult)) {
          scheduleAiAutoStepIfNeeded?.();
        }
      } else {
        maybeAutoOpenFinalResultDialog?.();
      }
      return { ok: true, player: targetPlayer, message };
    }

    return {
      setDebugOpen,
      setDebugPlayerMenuOpen,
      renderDebugPlayerSwitch,
      switchCurrentPlayerColor,
      selectDefaultRocketForCurrentPlayer,
      handleDebugQuickSectorScanChoice,
      openDebugQuickSectorScanPicker,
      runDebugQuickSectorScan,
      setDebugAlienTraceModeActive,
      toggleDebugAlienTraceMode,
      enableDebugAlienTraceModeForReveal,
      addDebugIncome,
      addDebugData,
      addDebugScore,
      addDebugCardByInput,
      promptDebugGainCard,
      revealJiuzheForDebug,
      revealYichangdianForDebug,
      revealFangzhouForDebug,
      revealBanrenmaForDebug,
      revealChongForDebug,
      revealAmibaForDebug,
      revealAomomoForDebug,
      revealRunezuForDebug,
      logAomomoDebugCoordinates,
      fillNebulaDataBoard,
      fillDebugNebulaData,
      toggleSectorWinDebug,
      handleAiTakeoverFailsafe,
      handleForceSkipTurnFailsafe,
      renderAfterFailsafeControl,
      getFailsafePendingOwnerPlayer,
      createFocusDebugCalibrationHandler,
    };
  }

  return {
    createDebugRuntime,
  };
});
