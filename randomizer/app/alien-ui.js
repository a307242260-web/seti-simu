(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAlienUi = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function requireFunction(name, fn) {
    if (typeof fn !== "function") {
      throw new Error(`createAlienUiHelpers requires function: ${name}`);
    }
    return fn;
  }

  function createAlienUiHelpers(context = {}) {
    const documentRef = context.document || root.document;
    const headless = Boolean(context.headless);
    const structuredClone = context.structuredClone || root.structuredClone;
    const alienTraceRewardFlow = context.alienTraceRewardFlow || {};
    const aliens = context.aliens || {};
    const jiuzhe = context.jiuzhe || null;
    const yichangdian = context.yichangdian || null;
    const fangzhou = context.fangzhou || null;
    const banrenma = context.banrenma || null;
    const chong = context.chong || null;
    const amiba = context.amiba || null;
    const aomomo = context.aomomo || null;
    const runezu = context.runezu || null;

    const pendingState = context.pendingState || {};
    const alienGameState = context.alienGameState || {};
    const playerState = context.playerState || {};
    const rocketState = context.rocketState || {};
    const els = context.els || {};

    const renderAlienPanels = requireFunction("renderAlienPanels", context.renderAlienPanels);
    const renderStateReadout = requireFunction("renderStateReadout", context.renderStateReadout);
    const getCurrentPlayer = requireFunction("getCurrentPlayer", context.getCurrentPlayer);
    const getAlienTraceActionPlayer = requireFunction("getAlienTraceActionPlayer", context.getAlienTraceActionPlayer);
    const getAvailableDataTokenCount = requireFunction("getAvailableDataTokenCount", context.getAvailableDataTokenCount);
    const resolvePlayerReference = requireFunction("resolvePlayerReference", context.resolvePlayerReference);
    const confirmFangzhouCard2Unlock = requireFunction("confirmFangzhouCard2Unlock", context.confirmFangzhouCard2Unlock);
    const confirmAlienTracePlacement = requireFunction("confirmAlienTracePlacement", context.confirmAlienTracePlacement);
    const confirmFangzhouTracePlacement = requireFunction("confirmFangzhouTracePlacement", context.confirmFangzhouTracePlacement);
    const isDebugAlienTraceMode = requireFunction("isDebugAlienTraceMode", context.isDebugAlienTraceMode);
    const isActionEffectFlowActive = requireFunction("isActionEffectFlowActive", context.isActionEffectFlowActive);
    const isCardSelectionActive = requireFunction("isCardSelectionActive", context.isCardSelectionActive);
    const isDiscardSelectionActive = requireFunction("isDiscardSelectionActive", context.isDiscardSelectionActive);
    const getPlayerColorDefinition = requireFunction("getPlayerColorDefinition", context.getPlayerColorDefinition);

    function isAlienTraceBoardPlacementMode() {
      return pendingState.alienTracePickerState?.mode === "trace-board";
    }

    function isAlienTracePickerSlotAllowed(alienSlotId) {
      const allowed = pendingState.alienTracePickerState?.allowedAlienSlotIds;
      return !allowed?.length || allowed.includes(Number(alienSlotId));
    }

    function isAlienTracePickerTraceAllowed(traceType) {
      const allowed = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      return allowed.includes(traceType);
    }

    function isAlienTracePickerChoiceAllowed(alienSlotId, traceType) {
      return isAlienTracePickerSlotAllowed(alienSlotId) && isAlienTracePickerTraceAllowed(traceType);
    }

    function isAlienTracePlacementMode(...modes) {
      return isDebugAlienTraceMode()
        || isAlienTraceBoardPlacementMode()
        || modes.includes(pendingState.alienTracePickerState?.mode);
    }

    function isAlienTracePlacementSlotAllowed(alienSlotId) {
      if (isDebugAlienTraceMode()) return true;
      if (isAlienTraceBoardPlacementMode()) return isAlienTracePickerSlotAllowed(alienSlotId);
      return Number(pendingState.alienTracePickerState?.selectedAlienSlotId) === Number(alienSlotId);
    }

    function clearAlienTracePlacementMode(...modes) {
      const mode = pendingState.alienTracePickerState?.mode || null;
      if (mode === "trace-board" || modes.includes(mode)) {
        pendingState.alienTracePickerState = null;
      }
    }

    function shouldShowStateTraceSlots() {
      const mode = pendingState.alienTracePickerState?.mode || "";
      return isDebugAlienTraceMode()
        || mode === "trace-board"
        || mode.endsWith("-grid");
    }

    function isJiuzheTracePlacementMode() {
      return isAlienTracePlacementMode("jiuzhe-grid");
    }

    function isYichangdianTracePlacementMode() {
      return isAlienTracePlacementMode("yichangdian-grid");
    }

    function isFangzhouTracePlacementMode() {
      return isAlienTracePlacementMode("fangzhou-grid", "fangzhou-use");
    }

    function isBanrenmaTracePlacementMode() {
      return isAlienTracePlacementMode("banrenma-grid");
    }

    function isChongTracePlacementMode() {
      return isAlienTracePlacementMode("chong-grid");
    }

    function isAmibaTracePlacementMode() {
      return isAlienTracePlacementMode("amiba-grid");
    }

    function isAomomoTracePlacementMode() {
      return isAlienTracePlacementMode("aomomo-grid");
    }

    function isRunezuTracePlacementMode() {
      return isAlienTracePlacementMode("runezu-grid");
    }

    function getAlienTracePickerPlayer() {
      return getAlienTraceActionPlayer(pendingState.alienTraceAction || pendingState.alienTracePickerState);
    }

    function canPlaceJiuzheTrace(alienSlotId, traceType, position) {
      if (!isJiuzheTracePlacementMode()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const grid = jiuzhe?.getTraceGrid?.(alienGameState, alienSlotId);
      return !grid?.[traceType]?.[position];
    }

    function canPlaceYichangdianTrace(alienSlotId, traceType, position) {
      if (!isYichangdianTracePlacementMode()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!yichangdian?.isYichangdianRevealedSlot?.(alienGameState, alienSlotId)) return false;
      return Boolean(yichangdian?.canPlaceYichangdianTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        getAlienTracePickerPlayer(),
      )?.ok);
    }

    function canPlaceFangzhouTrace(alienSlotId, traceType, position) {
      if (!isFangzhouTracePlacementMode()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const currentPlayer = getAlienTracePickerPlayer();
      return fangzhou?.canPlaceFangzhouTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      )?.ok;
    }

    function canPlaceBanrenmaTrace(alienSlotId, traceType, position) {
      if (!isBanrenmaTracePlacementMode()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const currentPlayer = getAlienTracePickerPlayer();
      return Boolean(banrenma?.canPlaceBanrenmaTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
        currentPlayer ? { availableDataCount: getAvailableDataTokenCount(currentPlayer) } : {},
      )?.ok);
    }

    function canPlaceChongTrace(alienSlotId, traceType, position) {
      if (!isChongTracePlacementMode()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!chong?.isChongRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const currentPlayer = getAlienTracePickerPlayer();
      return chong?.canPlaceChongTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      )?.ok;
    }

    function canPlaceAmibaTrace(alienSlotId, traceType, position) {
      if (!isAmibaTracePlacementMode()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!amiba?.isAmibaRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const currentPlayer = getAlienTracePickerPlayer();
      return amiba?.canPlaceAmibaTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      )?.ok;
    }

    function canPlaceAomomoTrace(alienSlotId, traceType, position) {
      if (!isAomomoTracePlacementMode()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!aomomo?.isAomomoRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const currentPlayer = getAlienTracePickerPlayer();
      return aomomo?.canPlaceAomomoTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      )?.ok;
    }

    function canPlaceRunezuTrace(alienSlotId, traceType, position) {
      if (!isRunezuTracePlacementMode()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const currentPlayer = getAlienTracePickerPlayer();
      return runezu?.canPlaceRunezuTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        position,
        currentPlayer,
      )?.ok;
    }

    function canPlaceRunezuFaceSymbol(alienSlotId, position) {
      if (!runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId)) return false;
      if (isActionEffectFlowActive() || isCardSelectionActive() || isDiscardSelectionActive()) return false;
      const currentPlayer = getCurrentPlayer();
      return runezu?.canPlaceFaceSymbol?.(alienGameState, position, currentPlayer)?.ok;
    }

    function canPlaceStateTrace(alienSlotId, traceType, kind) {
      if (!shouldShowStateTraceSlots()) return false;
      if (!isAlienTracePlacementSlotAllowed(alienSlotId)) return false;
      const alienSlot = aliens.getAlienSlot(alienGameState, alienSlotId);
      if (!alienSlot) return false;
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      if (!allowedTraceTypes.includes(traceType)) return false;
      if (!isAlienTracePickerChoiceAllowed(alienSlotId, traceType)) return false;
      const traceSlot = alienSlot.traces?.[traceType];
      if (!traceSlot) return false;
      if (kind === "first") return !alienSlot.revealed && !traceSlot.firstPlaced;
      if (kind === "extra") return Boolean(traceSlot.firstPlaced);
      return false;
    }

    function closeAlienTracePicker() {
      if (!els.alienTraceOverlay) return;
      els.alienTraceOverlay.hidden = true;
      pendingState.alienTracePickerState = null;
      pendingState.alienTraceAction = null;
      if (els.alienTraceTitle) els.alienTraceTitle.textContent = "获取外星人标记";
      if (els.alienTraceSubtitle) {
        els.alienTraceSubtitle.classList.remove("alien-reveal-confirmation-text");
      }
      if (els.alienTraceCancel) els.alienTraceCancel.hidden = false;
    }

    function findPlayerForFirstTrace(traceSlot) {
      if (!traceSlot?.firstPlaced) return null;
      return resolvePlayerReference({
        playerId: traceSlot.ownerPlayerId || traceSlot.playerId || null,
        playerColor: traceSlot.ownerPlayerColor || traceSlot.playerColor || null,
      });
    }

    function formatRevealTraceOwnerLabel(traceSlot) {
      const player = findPlayerForFirstTrace(traceSlot);
      if (player) return `玩家${player.colorLabel || player.name || player.id}`;
      const ownerColor = traceSlot?.ownerPlayerColor || traceSlot?.playerColor || null;
      const colorLabel = getPlayerColorDefinition(ownerColor)?.label || ownerColor;
      if (traceSlot?.neutral && colorLabel) return `中立${colorLabel}token`;
      if (colorLabel) return `玩家${colorLabel}`;
      const ownerId = traceSlot?.ownerPlayerId || traceSlot?.playerId || null;
      return ownerId ? `玩家${ownerId}` : "未知玩家";
    }

    function formatAlienRevealTitle(alienId) {
      const label = aliens.getAlienLabel?.(alienId) || alienId || "外星人";
      return `${label}${label.endsWith("外星人") ? "" : "外星人"}已被揭示！`;
    }

    function buildAlienRevealNoticeEntry(alienSlotId, revealResult) {
      const slot = aliens.getAlienSlot(alienGameState, alienSlotId);
      const alienId = revealResult?.alienId || slot?.alienId || slot?.assignedAlienId || null;
      const alienLabel = aliens.getAlienLabel?.(alienId) || alienId || "外星人";
      const traceTypes = ["pink", "yellow", "blue"];
      return {
        alienSlotId: Number(alienSlotId),
        alienId,
        alienLabel,
        title: formatAlienRevealTitle(alienId),
        lines: traceTypes.map((traceType) => {
          const traceLabel = aliens.getTraceTypeLabel?.(traceType) || `${traceType}痕迹`;
          const ownerLabel = formatRevealTraceOwnerLabel(slot?.traces?.[traceType]);
          return { traceType, traceLabel, ownerLabel };
        }),
      };
    }

    function renderAlienRevealTitleElement(container, entry) {
      if (!container || !entry) return;
      const strong = documentRef.createElement("strong");
      strong.className = "alien-reveal-name";
      strong.textContent = entry.alienLabel || "外星人";
      const suffix = String(entry.alienLabel || "").endsWith("外星人")
        ? "已被揭示！"
        : "外星人已被揭示！";
      container.replaceChildren(strong, documentRef.createTextNode(suffix));
    }

    function createAlienRevealTitleLine(entry) {
      const line = documentRef.createElement("div");
      line.className = "alien-reveal-title-line";
      renderAlienRevealTitleElement(line, entry);
      return line;
    }

    function createAlienRevealTraceLine(line) {
      const node = documentRef.createElement("div");
      node.className = `alien-reveal-trace-line alien-reveal-trace-${line.traceType || "unknown"}`;
      node.textContent = `${line.ownerLabel || "未知玩家"}拥有${line.traceLabel || "痕迹"}`;
      return node;
    }

    function buildAlienRevealNoticeNodes(entries) {
      return entries.flatMap((entry) => {
        const nodes = [];
        if (entries.length > 1) nodes.push(createAlienRevealTitleLine(entry));
        nodes.push(...(entry.lines || []).map(createAlienRevealTraceLine));
        return nodes;
      });
    }

    function closeAlienRevealConfirmationOverlay() {
      const pending = pendingState.alienRevealConfirmation;
      if (pending?.element?.parentNode) {
        pending.element.remove();
      }
      documentRef?.querySelectorAll(".alien-reveal-notice-overlay").forEach((node) => node.remove());
      pendingState.alienRevealConfirmation = null;

      if (pendingState.alienTracePickerState?.mode === "reveal-confirm") {
        if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = true;
        if (els.alienTraceTitle) els.alienTraceTitle.textContent = "获取外星人标记";
        if (els.alienTraceSubtitle) {
          els.alienTraceSubtitle.classList.remove("alien-reveal-confirmation-text");
        }
        if (els.alienTraceActions) els.alienTraceActions.replaceChildren();
        if (els.alienTraceCancel) els.alienTraceCancel.hidden = false;
        pendingState.alienTracePickerState = null;
      }
    }

    function confirmAlienRevealNotice() {
      const pending = pendingState.alienRevealConfirmation;
      if (!pending) return { ok: false, message: "没有待确认的外星人揭示" };
      closeAlienRevealConfirmationOverlay();
      return { ok: true, entries: pending.entries || [], message: "外星人揭示提示已确认" };
    }

    function openAlienRevealConfirmation(noticeEntries) {
      const entries = (noticeEntries || []).filter(Boolean);
      if (!entries.length) {
        return { ok: true, awaitingConfirmation: false, entries: [] };
      }

      closeAlienRevealConfirmationOverlay();

      if (headless) {
        pendingState.alienRevealConfirmation = { entries, element: null };
        return {
          ok: true,
          awaitingConfirmation: false,
          noticeVisible: false,
          entries,
          message: entries.map((entry) => entry.title).join("；"),
        };
      }

      const overlay = documentRef.createElement("div");
      overlay.className = "alien-reveal-notice-overlay";
      overlay.dataset.alienRevealNotice = "true";
      const dialog = documentRef.createElement("section");
      dialog.className = "scan-target-dialog alien-reveal-notice-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", "外星人揭示");
      const title = documentRef.createElement("h2");
      title.className = "scan-target-title alien-reveal-notice-title";
      if (entries.length === 1) {
        renderAlienRevealTitleElement(title, entries[0]);
      } else {
        title.textContent = "外星人已被揭示！";
      }
      const body = documentRef.createElement("div");
      body.className = "scan-target-subtitle alien-reveal-confirmation-text alien-reveal-notice-body";
      body.replaceChildren(...buildAlienRevealNoticeNodes(entries));
      const actions = documentRef.createElement("div");
      actions.className = "scan-target-actions alien-reveal-notice-actions";
      const confirmButton = documentRef.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "scan-target-option-button alien-reveal-confirm-button";
      confirmButton.dataset.alienRevealConfirm = "true";
      confirmButton.textContent = "确认";
      confirmButton.addEventListener("click", () => {
        confirmAlienRevealNotice();
      });
      actions.replaceChildren(confirmButton);
      dialog.append(title, body, actions);
      overlay.append(dialog);
      documentRef.body.append(overlay);
      pendingState.alienRevealConfirmation = { entries, element: overlay };
      return {
        ok: true,
        awaitingConfirmation: false,
        noticeVisible: true,
        entries,
        message: entries.map((entry) => entry.title).join("；"),
      };
    }

    function getAlienTracePlacementPreview(alienSlotId, traceType) {
      const alienSlot = aliens.getAlienSlot(alienGameState, alienSlotId);
      const traceSlot = alienSlot?.traces?.[traceType];
      const traceLabel = aliens.getTraceTypeLabel(traceType);

      if (!traceSlot?.firstPlaced) {
        if (alienSlot?.revealed) {
          return {
            canPlace: false,
            description: "已揭示，无法补首标记",
            title: "该外星人已揭示，无法再放置首标记",
          };
        }
        return {
          canPlace: true,
          description: `放置${traceLabel}首标记`,
          title: "",
        };
      }

      const extraCount = traceSlot.extraCount || 0;
      return {
        canPlace: true,
        description: extraCount > 0
          ? `追加${traceLabel}额外痕迹（已有 ${extraCount} 个）`
          : `追加${traceLabel}额外痕迹`,
        title: "",
      };
    }

    function getAlienTracePlayerKeys(player) {
      return new Set([player?.id, player?.playerId, player?.color, player?.playerColor].filter(Boolean));
    }

    function alienTraceMarkerBelongsToPlayer(marker, playerKeys) {
      return playerKeys.has(marker?.playerId)
        || playerKeys.has(marker?.ownerPlayerId)
        || playerKeys.has(marker?.playerColor)
        || playerKeys.has(marker?.ownerPlayerColor)
        || playerKeys.has(marker?.color);
    }

    function listAlienTraceEntriesForSlot(alienSlotId, traceType) {
      const slotId = Number(alienSlotId);
      const traceSlot = aliens.getAlienSlot(alienGameState, slotId)?.traces?.[traceType];
      const stateEntries = traceSlot?.firstPlaced ? [traceSlot] : [];
      if (jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, slotId)) {
        const grid = jiuzhe.getTraceGrid?.(alienGameState, slotId);
        return [
          ...stateEntries,
          ...(jiuzhe.TRACE_POSITIONS || [])
            .map((position) => grid?.[traceType]?.[position])
            .filter(Boolean),
        ];
      }
      if (yichangdian?.isYichangdianRevealedSlot?.(alienGameState, slotId)) {
        return [...stateEntries, ...(yichangdian.listTraceEntries?.(alienGameState, slotId, traceType) || [])];
      }
      if (fangzhou?.isFangzhouRevealedSlot?.(alienGameState, slotId)) {
        return [...stateEntries, ...(fangzhou.listTraceEntries?.(alienGameState, slotId, traceType) || [])];
      }
      if (banrenma?.isBanrenmaRevealedSlot?.(alienGameState, slotId)) {
        return [...stateEntries, ...(banrenma.listTraceEntries?.(alienGameState, slotId, traceType) || [])];
      }
      if (chong?.isChongRevealedSlot?.(alienGameState, slotId)) {
        return [...stateEntries, ...(chong.listTraceEntries?.(alienGameState, slotId, traceType) || [])];
      }
      if (amiba?.isAmibaRevealedSlot?.(alienGameState, slotId)) {
        return [...stateEntries, ...(amiba.listTraceEntries?.(alienGameState, slotId, traceType) || [])];
      }
      if (aomomo?.isAomomoRevealedSlot?.(alienGameState, slotId)) {
        return [...stateEntries, ...(aomomo.listTraceEntries?.(alienGameState, slotId, traceType) || [])];
      }
      if (runezu?.isRunezuRevealedSlot?.(alienGameState, slotId)) {
        return [...stateEntries, ...(runezu.listTraceEntries?.(alienGameState, slotId, traceType) || [])];
      }

      return stateEntries;
    }

    function alienSlotHasPlayerTrace(alienSlotId, traceType, player) {
      const playerKeys = getAlienTracePlayerKeys(player);
      if (countStateTraceMarkersForSlot(alienSlotId, traceType, playerKeys) > 0) return true;
      return listAlienTraceEntriesForSlot(alienSlotId, traceType)
        .some((entry) => alienTraceMarkerBelongsToPlayer(entry, playerKeys));
    }

    function alienSlotHasPlayerTraceSet(alienSlotId, traceTypes, player) {
      return (traceTypes || []).every((traceType) => alienSlotHasPlayerTrace(alienSlotId, traceType, player));
    }

    function countStateTraceMarkersForSlot(alienSlotId, traceType, playerKeys) {
      const traceSlot = aliens.getAlienSlot(alienGameState, Number(alienSlotId))?.traces?.[traceType];
      if (!traceSlot?.firstPlaced) return 0;
      let count = alienTraceMarkerBelongsToPlayer(traceSlot, playerKeys) ? 1 : 0;
      const extraCount = Math.max(0, Math.round(Number(traceSlot.extraCount) || 0));
      for (let index = 0; index < extraCount; index += 1) {
        const marker = aliens.getExtraTraceMarker?.(traceSlot, index)
          || { ownerPlayerColor: traceSlot.ownerPlayerColor || null };
        if (alienTraceMarkerBelongsToPlayer(marker, playerKeys)) count += 1;
      }
      return count;
    }

    function countAlienTraceMarkersForSlot(alienSlotId, player, traceTypes = null) {
      const playerKeys = getAlienTracePlayerKeys(player);
      const types = Array.isArray(traceTypes) && traceTypes.length
        ? traceTypes
        : aliens.TRACE_TYPES;
      let count = 0;
      for (const traceType of types) {
        const traceSlot = aliens.getAlienSlot(alienGameState, Number(alienSlotId))?.traces?.[traceType];
        count += countStateTraceMarkersForSlot(alienSlotId, traceType, playerKeys);
        count += listAlienTraceEntriesForSlot(alienSlotId, traceType)
          .filter((entry) => entry !== traceSlot)
          .filter((entry) => alienTraceMarkerBelongsToPlayer(entry, playerKeys))
          .length;
      }
      return count;
    }

    function getEligibleAlienSlotIdsForTraceEffect(effect, player, traceTypes) {
      const targetRule = effect?.options?.targetRule;
      if (!targetRule) return null;

      return aliens.ALIEN_SLOT_IDS.filter((alienSlotId) => {
        if (targetRule === "playerHasSameTrace") {
          return (traceTypes || []).some((traceType) => alienSlotHasPlayerTrace(alienSlotId, traceType, player));
        }
        if (targetRule === "singleAlienTraceSet") {
          const requiredTypes = effect.options?.traceTypes || ["yellow", "pink", "blue"];
          return alienSlotHasPlayerTraceSet(alienSlotId, requiredTypes, player);
        }
        if (targetRule === "singleAlienTraceCount") {
          const requiredCount = Math.max(1, Math.round(Number(effect.options?.requiredTraceCount || 3)));
          return countAlienTraceMarkersForSlot(alienSlotId, player, effect.options?.traceTypes || null) >= requiredCount;
        }
        return true;
      });
    }

    function describeAlienSlotPickerStatus(alienSlotId) {
      const alienSlot = aliens.getAlienSlot(alienGameState, alienSlotId);
      if (!alienSlot) return "无状态";
      if (alienSlot.revealed) {
        return alienSlot.alienId ? `已揭示（${alienSlot.alienId}）` : "已揭示";
      }
      const placedCount = aliens.countPlacedFirstTraces(alienSlot);
      return `未揭示，首标记 ${placedCount}/3`;
    }

    function renderAlienTracePickerButtons(choices, pickerStep) {
      els.alienTraceActions.replaceChildren(...choices.map((choice) => {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.alienPickerStep = pickerStep;
        button.dataset.alienSlot = String(choice.alienSlotId);
        if (choice.traceType) {
          button.dataset.traceType = choice.traceType;
        }
        button.disabled = Boolean(choice.disabled);
        button.title = choice.title || "";
        button.innerHTML = `${choice.label}<small>${choice.description}</small>`;
        return button;
      }));
    }

    function renderAlienTracePickerAlienStep() {
      const currentPlayer = getAlienTracePickerPlayer();
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      const allowedAlienSlotIds = pendingState.alienTracePickerState?.allowedAlienSlotIds || null;
      const singleTraceType = allowedTraceTypes.length === 1 ? allowedTraceTypes[0] : null;

      if (els.alienTraceSubtitle) {
        const traceHint = singleTraceType
          ? `获得${aliens.getTraceTypeLabel(singleTraceType)}，`
          : "";
        els.alienTraceSubtitle.textContent = (
          `当前玩家：${currentPlayer.colorLabel}。${traceHint}请选择要放置标记的外星人；`
          + "该颜色尚无首标记时自动放首标记，否则追加到额外痕迹位。"
        );
      }

      const choices = aliens.ALIEN_SLOT_IDS.map((alienSlotId) => {
        const slotLabel = aliens.getAlienSlotLabel(alienSlotId);
        const status = describeAlienSlotPickerStatus(alienSlotId);
        const targetAllowed = !allowedAlienSlotIds?.length || allowedAlienSlotIds.includes(Number(alienSlotId));
        const targetTitle = targetAllowed ? "" : "不符合本卡的外星人目标限制";
        if (singleTraceType) {
          const preview = getAlienTracePlacementPreview(alienSlotId, singleTraceType);
          return {
            alienSlotId,
            label: slotLabel,
            description: `${status} · ${preview.description}`,
            disabled: !targetAllowed || !preview.canPlace,
            title: targetTitle || preview.title,
          };
        }
        return {
          alienSlotId,
          label: slotLabel,
          description: status,
          disabled: !targetAllowed,
          title: targetTitle,
        };
      });

      renderAlienTracePickerButtons(choices, "alien");
    }

    function renderAlienTracePickerColorStep(alienSlotId) {
      const currentPlayer = getAlienTracePickerPlayer();
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      const slotLabel = aliens.getAlienSlotLabel(alienSlotId);

      if (els.alienTraceSubtitle) {
        els.alienTraceSubtitle.textContent = (
          `当前玩家：${currentPlayer.colorLabel}。${slotLabel}：请选择痕迹颜色；`
          + "尚无首标记时自动放首标记，否则追加到额外痕迹位。"
        );
      }

      const choices = allowedTraceTypes.map((traceType) => {
        const preview = getAlienTracePlacementPreview(alienSlotId, traceType);
        const targetAllowed = isAlienTracePickerSlotAllowed(alienSlotId);
        return {
          alienSlotId,
          traceType,
          label: aliens.getTraceTypeLabel(traceType),
          description: preview.description,
          disabled: !targetAllowed || !preview.canPlace,
          title: targetAllowed ? preview.title : "不符合本卡的外星人目标限制",
        };
      });

      renderAlienTracePickerButtons(choices, "color");
    }

    function openAlienTracePicker(options = {}) {
      if (!els.alienTraceOverlay || !els.alienTraceActions) {
        return { ok: false, message: "无法打开外星人标记选择" };
      }

      pendingState.alienTracePickerState = {
        allowedTraceTypes: options.allowedTraceTypes?.length
          ? options.allowedTraceTypes
          : aliens.TRACE_TYPES,
        allowedAlienSlotIds: options.allowedAlienSlotIds?.length
          ? options.allowedAlienSlotIds.map(Number)
          : null,
        allowedTraceTypesFromEffect: options.allowedTraceTypes?.length ? [...options.allowedTraceTypes] : null,
        targetPlayerId: options.targetPlayerId || null,
        targetPlayerColor: options.targetPlayerColor || null,
      };
      if (els.alienTraceTitle) els.alienTraceTitle.textContent = "获取外星人标记";
      if (els.alienTraceSubtitle) {
        els.alienTraceSubtitle.classList.remove("alien-reveal-confirmation-text");
      }
      if (els.alienTraceCancel) els.alienTraceCancel.hidden = false;
      renderAlienTracePickerAlienStep();
      els.alienTraceOverlay.hidden = false;
      return { ok: true, message: "请选择外星人" };
    }

    function beginAlienTraceBoardPlacement(options = {}) {
      const allowedTraceTypes = options.allowedTraceTypes?.length
        ? options.allowedTraceTypes
        : aliens.TRACE_TYPES;
      pendingState.alienTracePickerState = {
        mode: "trace-board",
        allowedTraceTypes,
        allowedAlienSlotIds: options.allowedAlienSlotIds?.length
          ? options.allowedAlienSlotIds.map(Number)
          : null,
        targetPlayerId: options.targetPlayerId || null,
        targetPlayerColor: options.targetPlayerColor || null,
        fangzhouDestinationResolved: Boolean(options.fangzhouDestinationResolved),
      };
      if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = true;
      const currentPlayer = getAlienTracePickerPlayer();
      const traceLabel = allowedTraceTypes.length === 1
        ? aliens.getTraceTypeLabel(allowedTraceTypes[0])
        : "对应颜色";
      const playerText = currentPlayer?.colorLabel ? `${currentPlayer.colorLabel}：` : "";
      rocketState.statusNote = `${playerText}${options.label || "外星人痕迹"}：请点击可放置的${traceLabel}痕迹位`;
      renderAlienPanels();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function beginPlacementMode(alienName, mode, alienSlotId, traceType = null) {
      const allowedTraceTypes = traceType
        ? [traceType]
        : (pendingState.alienTracePickerState?.allowedTraceTypes?.length
          ? pendingState.alienTracePickerState.allowedTraceTypes
          : aliens.TRACE_TYPES);
      pendingState.alienTracePickerState = {
        ...pendingState.alienTracePickerState,
        mode,
        selectedAlienSlotId: Number(alienSlotId),
        allowedTraceTypes,
        selectedTraceType: traceType || null,
      };
      if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = true;
      const traceLabel = allowedTraceTypes.length === 1
        ? aliens.getTraceTypeLabel(allowedTraceTypes[0])
        : "对应颜色";
      rocketState.statusNote = `${alienName}：请在正面牌图或 state 额外位点击可放置的${traceLabel}痕迹位`;
      renderAlienPanels();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function beginJiuzheTraceGridPlacement(alienSlotId) {
      return beginPlacementMode("九折", "jiuzhe-grid", alienSlotId);
    }

    function beginYichangdianTraceGridPlacement(alienSlotId) {
      return beginPlacementMode("异常点", "yichangdian-grid", alienSlotId);
    }

    function beginFangzhouTraceGridPlacement(alienSlotId, traceType = null) {
      return beginPlacementMode("方舟", "fangzhou-grid", alienSlotId, traceType);
    }

    function beginBanrenmaTraceGridPlacement(alienSlotId) {
      return beginPlacementMode("半人马", "banrenma-grid", alienSlotId);
    }

    function beginAomomoTraceGridPlacement(alienSlotId) {
      return beginPlacementMode("奥陌陌", "aomomo-grid", alienSlotId);
    }

    function beginChongTraceGridPlacement(alienSlotId) {
      return beginPlacementMode("虫族", "chong-grid", alienSlotId);
    }

    function beginAmibaTraceGridPlacement(alienSlotId) {
      return beginPlacementMode("阿米巴", "amiba-grid", alienSlotId);
    }

    function beginRunezuTraceGridPlacement(alienSlotId) {
      return beginPlacementMode("符文族", "runezu-grid", alienSlotId);
    }

    function canPlaceAnyStateExtraTrace(alienSlotId, traceType) {
      const traceSlot = aliens.getAlienSlot(alienGameState, alienSlotId)?.traces?.[traceType];
      if (!traceSlot?.firstPlaced) return false;
      return isAlienTracePickerChoiceAllowed(alienSlotId, traceType);
    }

    function getFangzhouTracePlacementAvailability(alienSlotId, traceType, placeTarget = null) {
      const currentPlayer = getAlienTracePickerPlayer();
      const choiceAllowed = isAlienTracePickerChoiceAllowed(alienSlotId, traceType);
      if (placeTarget?.kind === "state") {
        return {
          canPlace: canPlaceAnyStateExtraTrace(alienSlotId, traceType),
          canFacePlace: false,
          canStatePlace: canPlaceAnyStateExtraTrace(alienSlotId, traceType),
        };
      }
      if (placeTarget?.kind === "fangzhou-trace" && placeTarget.position != null) {
        const canFacePlace = Boolean(canPlaceFangzhouTrace(alienSlotId, traceType, Number(placeTarget.position)));
        return { canPlace: canFacePlace, canFacePlace, canStatePlace: false };
      }
      const canFacePlace = choiceAllowed && Boolean(fangzhou?.canPlaceAnyFangzhouTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        currentPlayer,
      ));
      const canStatePlace = canPlaceAnyStateExtraTrace(alienSlotId, traceType);
      return {
        canPlace: canFacePlace || canStatePlace,
        canFacePlace,
        canStatePlace,
      };
    }

    function getAlienTraceChoiceSlotIds(allowedAlienSlotIds = null) {
      return alienTraceRewardFlow.resolveAllowedAlienSlotIds(
        allowedAlienSlotIds,
        aliens.ALIEN_SLOT_IDS,
      );
    }

    function getFangzhouTraceChoiceSlotId(allowedAlienSlotIds = null) {
      return getAlienTraceChoiceSlotIds(allowedAlienSlotIds)
        .find((alienSlotId) => fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId)) || null;
    }

    function getFangzhouUnlockableTraceTypes(alienSlotId, allowedTraceTypes, player) {
      if (!alienSlotId) return [];
      const traceTypes = allowedTraceTypes?.length ? allowedTraceTypes : aliens.TRACE_TYPES;
      return traceTypes.filter((traceType) => (
        fangzhou?.canUnlockCard2ForTrace?.(alienGameState, player, traceType)
      ));
    }

    function canPlaceAlienTraceOnPanelWithoutMode(alienSlotId, traceType, player) {
      const alienSlot = aliens.getAlienSlot(alienGameState, alienSlotId);
      if (!alienSlot) return false;
      const statePreview = getAlienTracePlacementPreview(alienSlotId, traceType);
      if (!alienSlot.revealed) return statePreview.canPlace;
      if (statePreview.canPlace) return true;
      return Boolean(aliens.canPlaceAnyRevealedAlienTrace?.(
        alienGameState,
        alienSlotId,
        traceType,
        player,
        player ? { availableDataCount: getAvailableDataTokenCount(player) } : {},
      ));
    }

    function hasAlienTracePanelPlacementTarget(allowedAlienSlotIds, allowedTraceTypes, player) {
      const slotIds = getAlienTraceChoiceSlotIds(allowedAlienSlotIds);
      const traceTypes = allowedTraceTypes?.length ? allowedTraceTypes : aliens.TRACE_TYPES;
      return slotIds.some((alienSlotId) => traceTypes.some((traceType) => (
        canPlaceAlienTraceOnPanelWithoutMode(alienSlotId, traceType, player)
      )));
    }

    function renderFangzhouTraceDestinationChoice(alienSlotId, unlockableTraceTypes, options = {}) {
      const currentPlayer = getAlienTracePickerPlayer();
      const canPanelPlace = Boolean(options.canPanelPlace);
      if (els.alienTraceTitle) els.alienTraceTitle.textContent = "获取外星人标记";
      if (els.alienTraceSubtitle) {
        const playerText = currentPlayer?.colorLabel ? `${currentPlayer.colorLabel}玩家` : "当前玩家";
        els.alienTraceSubtitle.textContent = `${playerText}：请选择本次外星人痕迹的用途。`;
      }
      if (els.alienTraceCancel) els.alienTraceCancel.hidden = false;

      const choices = [];
      if (canPanelPlace) {
        choices.push({
          destination: "panel",
          label: "放到外星人面板",
          description: "随后点击 state 或正面牌图；state额外位会自动解锁同色方舟牌",
        });
      }
      if (unlockableTraceTypes.length === 1) {
        const traceType = unlockableTraceTypes[0];
        choices.push({
          destination: "unlock",
          traceType,
          label: `解锁${aliens.getTraceTypeLabel(traceType)}方舟牌`,
          description: "追加到 state 额外痕迹位，获得3分，并解锁卡牌加入手牌",
        });
      } else if (unlockableTraceTypes.length > 1) {
        choices.push({
          destination: "unlock",
          label: "解锁方舟牌",
          description: "下一步选择要追加并解锁的方舟牌颜色",
        });
      }

      els.alienTraceActions.replaceChildren(...choices.map((choice) => {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.alienPickerStep = "fangzhou-destination";
        button.dataset.alienSlot = String(alienSlotId);
        button.dataset.fangzhouDestination = choice.destination;
        if (choice.traceType) button.dataset.traceType = choice.traceType;
        button.innerHTML = `${choice.label}<small>${choice.description}</small>`;
        return button;
      }));
      if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = false;
    }

    function renderFangzhouUnlockTraceChoice(alienSlotId, traceTypes) {
      const currentPlayer = getAlienTracePickerPlayer();
      const unlockableTraceTypes = getFangzhouUnlockableTraceTypes(alienSlotId, traceTypes, currentPlayer);
      if (els.alienTraceTitle) els.alienTraceTitle.textContent = "解锁方舟牌";
      if (els.alienTraceSubtitle) {
        const playerText = currentPlayer?.colorLabel ? `${currentPlayer.colorLabel}玩家` : "当前玩家";
        els.alienTraceSubtitle.textContent = `${playerText}：选择本次痕迹要追加并解锁的方舟牌。`;
      }
      if (els.alienTraceCancel) els.alienTraceCancel.hidden = false;
      pendingState.alienTracePickerState = {
        ...pendingState.alienTracePickerState,
        mode: "fangzhou-unlock-color",
        selectedAlienSlotId: Number(alienSlotId),
        allowedTraceTypes: unlockableTraceTypes,
      };
      els.alienTraceActions.replaceChildren(...unlockableTraceTypes.map((traceType) => {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.alienPickerStep = "fangzhou-unlock-color";
        button.dataset.alienSlot = String(alienSlotId);
        button.dataset.traceType = traceType;
        button.dataset.fangzhouUse = "unlock";
        button.innerHTML = `解锁${aliens.getTraceTypeLabel(traceType)}方舟牌<small>追加 state 额外痕迹，获得3分，卡牌进入手牌</small>`;
        return button;
      }));
      if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = false;
      return { ok: true, message: "请选择要解锁的方舟牌" };
    }

    function openFangzhouTraceDestinationChoice(options = {}) {
      const allowedTraceTypes = options.allowedTraceTypes?.length
        ? options.allowedTraceTypes
        : (pendingState.alienTracePickerState?.allowedTraceTypes?.length
          ? pendingState.alienTracePickerState.allowedTraceTypes
          : aliens.TRACE_TYPES);
      const hasAllowedAlienSlotIdsOption = Object.prototype.hasOwnProperty.call(options, "allowedAlienSlotIds");
      const allowedAlienSlotIds = hasAllowedAlienSlotIdsOption
        ? alienTraceRewardFlow.resolveAllowedAlienSlotIds(options.allowedAlienSlotIds, null)
        : (pendingState.alienTracePickerState?.allowedAlienSlotIds || null);
      const alienSlotId = options.alienSlotId || getFangzhouTraceChoiceSlotId(allowedAlienSlotIds);
      if (!alienSlotId) return null;
      const currentPlayer = resolvePlayerReference({
        playerId: options.targetPlayerId || pendingState.alienTracePickerState?.targetPlayerId,
        playerColor: options.targetPlayerColor || pendingState.alienTracePickerState?.targetPlayerColor,
      }) || getAlienTracePickerPlayer();
      const unlockableTraceTypes = getFangzhouUnlockableTraceTypes(alienSlotId, allowedTraceTypes, currentPlayer);
      if (!unlockableTraceTypes.length) return null;

      const canPanelPlace = hasAlienTracePanelPlacementTarget(
        allowedAlienSlotIds,
        allowedTraceTypes,
        currentPlayer,
      );

      pendingState.alienTracePickerState = {
        ...pendingState.alienTracePickerState,
        mode: "fangzhou-destination",
        selectedAlienSlotId: Number(alienSlotId),
        allowedTraceTypes,
        allowedAlienSlotIds,
        targetPlayerId: currentPlayer?.id || options.targetPlayerId || pendingState.alienTracePickerState?.targetPlayerId || null,
        targetPlayerColor: currentPlayer?.color || options.targetPlayerColor || pendingState.alienTracePickerState?.targetPlayerColor || null,
        effectLabel: options.label || pendingState.alienTracePickerState?.effectLabel || null,
      };

      if (canPanelPlace) {
        renderFangzhouTraceDestinationChoice(alienSlotId, unlockableTraceTypes, { canPanelPlace });
        return { ok: true, message: "请选择方舟痕迹用途" };
      }
      if (unlockableTraceTypes.length === 1) {
        return confirmFangzhouCard2Unlock(alienSlotId, unlockableTraceTypes[0]);
      }
      return renderFangzhouUnlockTraceChoice(alienSlotId, unlockableTraceTypes);
    }

    function handleFangzhouTraceDestinationChoice(destination, traceType = null) {
      const alienSlotId = Number(pendingState.alienTracePickerState?.selectedAlienSlotId || alienGameState.fangzhou?.revealedSlotId || 0);
      if (!alienSlotId) return { ok: false, message: "没有可用的方舟槽位" };
      if (destination === "panel") {
        return beginAlienTraceBoardPlacement({
          allowedTraceTypes: pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES,
          allowedAlienSlotIds: pendingState.alienTracePickerState?.allowedAlienSlotIds || null,
          targetPlayerId: pendingState.alienTracePickerState?.targetPlayerId || null,
          targetPlayerColor: pendingState.alienTracePickerState?.targetPlayerColor || null,
          label: pendingState.alienTraceAction?.effectLabel || pendingState.alienTracePickerState?.effectLabel || "外星人痕迹",
          fangzhouDestinationResolved: true,
        });
      }
      if (destination === "unlock") {
        if (traceType) return confirmFangzhouCard2Unlock(alienSlotId, traceType);
        return renderFangzhouUnlockTraceChoice(
          alienSlotId,
          pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES,
        );
      }
      return { ok: false, message: "未知方舟痕迹用途" };
    }

    function handleFangzhouUnlockTraceChoice(traceType) {
      const alienSlotId = Number(pendingState.alienTracePickerState?.selectedAlienSlotId || alienGameState.fangzhou?.revealedSlotId || 0);
      return confirmFangzhouCard2Unlock(alienSlotId, traceType);
    }

    function placeFangzhouTraceTarget(alienSlotId, traceType, placeTarget = null) {
      if (placeTarget?.kind === "state") {
        return confirmAlienTracePlacement(alienSlotId, traceType);
      }
      if (placeTarget?.kind === "fangzhou-trace" && placeTarget.position != null) {
        return confirmFangzhouTracePlacement(alienSlotId, traceType, Number(placeTarget.position));
      }
      return beginFangzhouTraceGridPlacement(alienSlotId, traceType);
    }

    function renderFangzhouTraceColorStep(alienSlotId) {
      const currentPlayer = getAlienTracePickerPlayer();
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      const slotLabel = aliens.getAlienSlotLabel(alienSlotId);

      if (els.alienTraceSubtitle) {
        els.alienTraceSubtitle.textContent = (
          `当前玩家：${currentPlayer.colorLabel}。${slotLabel}：请选择痕迹颜色，`
          + "随后选择放置痕迹或解锁卡牌。"
        );
      }

      const choices = allowedTraceTypes.map((type) => {
        const placeAvailability = getFangzhouTracePlacementAvailability(alienSlotId, type);
        const canPlace = placeAvailability.canPlace;
        const canUnlock = fangzhou?.canUnlockCard2ForTrace?.(alienGameState, currentPlayer, type);
        const actions = [];
        if (placeAvailability.canFacePlace) actions.push("可放正面");
        if (placeAvailability.canStatePlace) actions.push("可放 state");
        if (canUnlock) actions.push("可解锁卡牌");
        return {
          alienSlotId,
          traceType: type,
          label: aliens.getTraceTypeLabel(type),
          description: actions.length ? actions.join(" / ") : "该颜色暂不可用",
          disabled: !canPlace && !canUnlock,
          title: "",
        };
      });

      renderAlienTracePickerButtons(choices, "fangzhou-color");
    }

    function renderFangzhouTraceUseChoice(alienSlotId, traceType, options = {}) {
      const currentPlayer = getAlienTracePickerPlayer();
      const traceLabel = aliens.getTraceTypeLabel(traceType);
      const placeTarget = options.placeTarget || null;
      const placeAvailability = getFangzhouTracePlacementAvailability(alienSlotId, traceType, placeTarget);
      const canPlace = placeAvailability.canPlace;
      const canUnlock = fangzhou?.canUnlockCard2ForTrace?.(alienGameState, currentPlayer, traceType);

      if (els.alienTraceSubtitle) {
        els.alienTraceSubtitle.textContent = (
          `当前玩家：${currentPlayer.colorLabel}。${traceLabel}外星人痕迹：`
          + "选择放置到方舟正面，或追加到 state 额外位并自动解锁对应卡牌。"
        );
      }

      const choices = [];
      if (canPlace) {
        const placeDescription = placeTarget?.kind === "state"
          ? "追加到 state 额外痕迹位，并自动解锁同色方舟牌"
          : placeTarget?.kind === "fangzhou-trace"
            ? "放置到已点击的方舟正面位置"
            : "在方舟正面或 state 额外位选择痕迹位；state额外位会自动解锁同色方舟牌";
        choices.push({
          alienSlotId,
          traceType,
          label: `放置${traceLabel}痕迹`,
          description: placeDescription,
          disabled: false,
          fangzhouUse: "place",
          placeTarget,
        });
      }
      if (canUnlock) {
        choices.push({
          alienSlotId,
          traceType,
          label: `解锁${traceLabel}方舟牌`,
          description: "追加到 state 额外痕迹位，获得3分，并解锁保留区卡牌加入手牌",
          disabled: false,
          fangzhouUse: "unlock",
        });
      }

      els.alienTraceActions.replaceChildren(...choices.map((choice) => {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.alienPickerStep = "fangzhou-use";
        button.dataset.alienSlot = String(choice.alienSlotId);
        button.dataset.traceType = choice.traceType;
        button.dataset.fangzhouUse = choice.fangzhouUse;
        if (choice.placeTarget?.kind) {
          button.dataset.fangzhouPlaceKind = choice.placeTarget.kind;
        }
        if (choice.placeTarget?.position != null) {
          button.dataset.fangzhouPosition = String(choice.placeTarget.position);
        }
        button.disabled = Boolean(choice.disabled);
        button.title = choice.title || "";
        button.innerHTML = `${choice.label}<small>${choice.description}</small>`;
        return button;
      }));
      if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = false;
    }

    function openFangzhouTraceUseChoice(alienSlotId, traceType, options = {}) {
      const currentPlayer = getAlienTracePickerPlayer();
      const placeTarget = options.placeTarget || null;
      const placeAvailability = getFangzhouTracePlacementAvailability(alienSlotId, traceType, placeTarget);
      const canPlace = placeAvailability.canPlace;
      const canUnlock = fangzhou?.canUnlockCard2ForTrace?.(alienGameState, currentPlayer, traceType);

      if (canPlace && canUnlock) {
        pendingState.alienTracePickerState = {
          ...pendingState.alienTracePickerState,
          mode: "fangzhou-use",
          selectedAlienSlotId: Number(alienSlotId),
          selectedTraceType: traceType,
        };
        renderFangzhouTraceUseChoice(alienSlotId, traceType, { placeTarget });
        return { ok: true, message: "请选择放置痕迹或解锁卡牌" };
      }
      if (canUnlock) {
        return confirmFangzhouCard2Unlock(alienSlotId, traceType);
      }
      if (canPlace) {
        return placeFangzhouTraceTarget(alienSlotId, traceType, placeTarget);
      }
      rocketState.statusNote = `${aliens.getTraceTypeLabel(traceType)}痕迹无法放置或解锁`;
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    function routeFangzhouAlienTraceGain(alienSlotId) {
      const allowedTraceTypes = pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES;
      const destinationChoice = openFangzhouTraceDestinationChoice({ alienSlotId, allowedTraceTypes });
      if (destinationChoice) return destinationChoice;
      if (allowedTraceTypes.length === 1) {
        return openFangzhouTraceUseChoice(alienSlotId, allowedTraceTypes[0]);
      }
      pendingState.alienTracePickerState = {
        ...pendingState.alienTracePickerState,
        mode: "fangzhou-color",
        selectedAlienSlotId: Number(alienSlotId),
      };
      renderFangzhouTraceColorStep(alienSlotId);
      if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = false;
      return { ok: true, message: "请选择方舟痕迹颜色" };
    }

    function handleStateTraceSlotPlacement(alienSlotId, traceType) {
      return confirmAlienTracePlacement(alienSlotId, traceType);
    }

    function handleFangzhouTraceSlotPlacement(alienSlotId, traceType, position) {
      return confirmFangzhouTracePlacement(alienSlotId, traceType, position);
    }

    return {
      buildAlienRevealNoticeEntry,
      openAlienRevealConfirmation,
      closeAlienRevealConfirmationOverlay,
      confirmAlienRevealNotice,
      isAlienTraceBoardPlacementMode,
      isAlienTracePlacementMode,
      isAlienTracePlacementSlotAllowed,
      clearAlienTracePlacementMode,
      shouldShowStateTraceSlots,
      isJiuzheTracePlacementMode,
      isYichangdianTracePlacementMode,
      isFangzhouTracePlacementMode,
      isBanrenmaTracePlacementMode,
      isChongTracePlacementMode,
      isAmibaTracePlacementMode,
      isAomomoTracePlacementMode,
      isRunezuTracePlacementMode,
      getAlienTracePickerPlayer,
      canPlaceJiuzheTrace,
      canPlaceYichangdianTrace,
      canPlaceFangzhouTrace,
      canPlaceBanrenmaTrace,
      canPlaceChongTrace,
      canPlaceAmibaTrace,
      canPlaceAomomoTrace,
      canPlaceRunezuTrace,
      canPlaceRunezuFaceSymbol,
      canPlaceStateTrace,
      canPlaceAnyStateExtraTrace,
      closeAlienTracePicker,
      openAlienTracePicker,
      beginAlienTraceBoardPlacement,
      beginJiuzheTraceGridPlacement,
      beginYichangdianTraceGridPlacement,
      beginFangzhouTraceGridPlacement,
      beginBanrenmaTraceGridPlacement,
      beginAomomoTraceGridPlacement,
      beginChongTraceGridPlacement,
      beginAmibaTraceGridPlacement,
      beginRunezuTraceGridPlacement,
      renderAlienTracePickerColorStep,
      openFangzhouTraceUseChoice,
      openFangzhouTraceDestinationChoice,
      handleFangzhouTraceDestinationChoice,
      handleFangzhouUnlockTraceChoice,
      routeFangzhouAlienTraceGain,
      handleStateTraceSlotPlacement,
      handleFangzhouTraceSlotPlacement,
      getEligibleAlienSlotIdsForTraceEffect,
      getAlienTraceChoiceSlotIds,
      hasAlienTracePanelPlacementTarget,
      isAlienTracePickerChoiceAllowed,
    };
  }

  return {
    createAlienUiHelpers,
  };
});
