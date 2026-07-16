(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppActionBriefing = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const ACTION_BRIEFING_MAX_ITEMS = 3;
  const ACTION_BRIEFING_MAX_CYCLES = 8;
  const ACTION_BRIEFING_MAIN_ACTION_TYPES = new Set([
    "launch",
    "orbit",
    "land",
    "scan",
    "analyze",
    "playCard",
    "researchTech",
    "pass",
  ]);

  function requireFunction(name, fn) {
    if (typeof fn !== "function") {
      throw new Error(`createActionBriefingHelpers requires function: ${name}`);
    }
    return fn;
  }

  function trimActionBriefingPunctuation(text, normalizeActionLogText) {
    return normalizeActionLogText(text).replace(/[。；，、\s]+$/g, "");
  }

  function getActionBriefingActionName(entry, options = {}) {
    const normalizeActionLogText = options.normalizeActionLogText || ((value) => String(value || "").trim());
    switch (entry?.actionType) {
      case "launch":
        return "发射";
      case "orbit":
        return "环绕";
      case "land":
        return "登陆";
      case "scan":
        return "扫描";
      case "analyze":
        return "分析";
      case "playCard":
        return "打牌";
      case "researchTech":
        return "科技行动";
      case "pass":
        return "PASS";
      default:
        return normalizeActionLogText(entry?.actionLabel || "主要行动");
    }
  }

  function getActionBriefingStepTexts(entry, options = {}) {
    const normalizeActionLogText = options.normalizeActionLogText || ((value) => String(value || "").trim());
    const historySourceMain = options.historySourceMain || "main";
    return (entry?.steps || [])
      .filter((step) => !step?.source || step.source === historySourceMain)
      .flatMap((step) => [step.text, step.label, step.detail])
      .map(normalizeActionLogText)
      .filter(Boolean);
  }

  function extractActionBriefingTravelTarget(entry, verb, options = {}) {
    const normalizeActionLogText = options.normalizeActionLogText || ((value) => String(value || "").trim());
    const pattern = new RegExp(`(?:^|[：:；])${verb}\\s*([^，；。:：]+)`);
    for (const text of getActionBriefingStepTexts(entry, options)) {
      const match = text.match(pattern);
      if (!match?.[1]) continue;
      const target = trimActionBriefingPunctuation(match[1], normalizeActionLogText);
      if (target && !target.includes("奖励") && !target.includes("行动")) return target;
    }
    return "";
  }

  function getActionBriefingNebulaLocations(options = {}) {
    const solar = options.solar || {};
    const data = options.data || {};
    const solarState = options.solarState || {};
    const aomomo = options.aomomo || null;
    const getAomomoCurrentX = options.getAomomoCurrentX || null;
    const locations = solar.getNebulaLocations?.(solarState.sectorBySlot) || [];
    const result = locations.map((location) => ({
      id: location.id || null,
      label: location.label || data.getNebulaLabel?.(location.id) || location.id || "星云",
      x: Number.isFinite(Number(location.x)) ? Number(location.x) : null,
    }));
    const aomomoLabel = data.getNebulaLabel?.(aomomo?.NEBULA_ID || "aomomo") || "奥陌陌";
    const aomomoX = typeof getAomomoCurrentX === "function" ? getAomomoCurrentX() : null;
    result.push({
      id: aomomo?.NEBULA_ID || "aomomo",
      label: aomomoLabel,
      x: Number.isFinite(Number(aomomoX)) ? Number(aomomoX) : null,
    });
    return result;
  }

  function createActionBriefingStepMetadata(result, options = {}) {
    const normalizeActionLogText = options.normalizeActionLogText || ((value) => String(value || "").trim());
    const solar = options.solar || {};
    const data = options.data || {};
    if (!result || typeof result !== "object") return null;
    const targets = [];
    const seen = new Set();
    const hasSignalMarkedEvent = Array.isArray(result.events)
      && result.events.some((event) => event?.type === "signalMarked");

    const addTarget = (target) => {
      if (!target || typeof target !== "object") return;
      const nebulaId = normalizeActionLogText(target.nebulaId);
      if (!nebulaId && !hasSignalMarkedEvent) return;
      const x = Number.isFinite(Number(target.x ?? target.sectorX))
        ? solar.mod8(Number(target.x ?? target.sectorX))
        : null;
      const label = normalizeActionLogText(target.label || (nebulaId ? data.getNebulaLabel?.(nebulaId) : ""));
      if (x == null && !nebulaId && !label) return;
      const key = `${x ?? "x"}:${nebulaId || label || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      targets.push({ x, nebulaId: nebulaId || null, label: label || null });
    };

    addTarget(result.payload);
    addTarget(result);
    for (const event of result.events || []) {
      if (event?.type === "signalMarked") addTarget(event);
    }

    return targets.length ? { scanTargets: targets } : null;
  }

  function addActionBriefingScanTarget(targets, seen, target, options = {}) {
    const normalizeActionLogText = options.normalizeActionLogText || ((value) => String(value || "").trim());
    if (!target) return;
    const x = Number.isFinite(Number(target.x)) ? Number(target.x) : null;
    const label = trimActionBriefingPunctuation(target.label || "", normalizeActionLogText);
    const key = `${x ?? "x"}:${label || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ x, label });
  }

  function listActionBriefingScanTargets(entry, options = {}) {
    const data = options.data || {};
    const targets = [];
    const seen = new Set();
    const historySourceMain = options.historySourceMain || "main";

    for (const step of entry?.steps || []) {
      if (step?.source && step.source !== historySourceMain) continue;
      for (const target of step?.briefing?.scanTargets || []) {
        addActionBriefingScanTarget(targets, seen, {
          x: target.x,
          label: target.label || (target.nebulaId ? data.getNebulaLabel?.(target.nebulaId) : ""),
        }, options);
      }
    }

    const haystack = getActionBriefingStepTexts(entry, options).join("；");
    if (!haystack) return targets;

    for (const location of getActionBriefingNebulaLocations(options)) {
      if ((location.label && haystack.includes(location.label)) || (location.id && haystack.includes(location.id))) {
        addActionBriefingScanTarget(targets, seen, location, options);
      }
    }

    for (const match of haystack.matchAll(/扇区\s*\[?([0-7])\]?/g)) {
      const x = Number(match[1]);
      if (!targets.some((target) => target.x === x)) {
        addActionBriefingScanTarget(targets, seen, { x, label: "" }, options);
      }
    }

    return targets;
  }

  function formatActionBriefingScanTargets(targets) {
    return targets
      .map((target) => (
        Number.isFinite(Number(target.x))
          ? `扇区[${Number(target.x)}]${target.label || ""}`
          : (target.label || "星云")
      ))
      .filter(Boolean)
      .join("、");
  }

  function getActionBriefingDetailText(entry, options = {}) {
    switch (entry?.actionType) {
      case "orbit": {
        const target = extractActionBriefingTravelTarget(entry, "环绕", options);
        return target ? `环绕了${target}` : "";
      }
      case "land": {
        const target = extractActionBriefingTravelTarget(entry, "登陆", options);
        return target ? `登陆了${target}` : "";
      }
      case "scan": {
        const targets = listActionBriefingScanTargets(entry, options);
        const targetText = formatActionBriefingScanTargets(targets);
        return targetText ? `扫描了${targetText}` : "";
      }
      case "playCard":
        return options.playedCard?.label ? `打出了${options.playedCard.label}` : "";
      default:
        return "";
    }
  }

  function getActionBriefingCycleKey(roundNumber, actionCycleNumber, turnNumber = null) {
    const cycleNumber = actionCycleNumber ?? (turnNumber != null ? `turn:${turnNumber}` : "");
    return `${roundNumber ?? ""}:${cycleNumber}`;
  }

  function getActionBriefingItemCycleKey(item) {
    return getActionBriefingCycleKey(item?.roundNumber, item?.actionCycleNumber, item?.turnNumber);
  }

  function getActionBriefingPlayerKey(item) {
    return item?.playerId || item?.playerColor || item?.playerLabel || "";
  }

  function pruneActionBriefingItems(items = [], maxCycles = ACTION_BRIEFING_MAX_CYCLES) {
    const cycleKeys = [];
    for (const item of items) {
      const cycleKey = getActionBriefingItemCycleKey(item);
      if (cycleKey && !cycleKeys.includes(cycleKey)) cycleKeys.push(cycleKey);
    }
    if (cycleKeys.length <= maxCycles) return [...items];
    const keepCycleKeys = new Set(cycleKeys.slice(-maxCycles));
    return items.filter((item) => keepCycleKeys.has(getActionBriefingItemCycleKey(item)));
  }

  function createActionBriefingItemFromEntry(entry, options = {}) {
    const isAiAutoBattlePlayer = options.isAiAutoBattlePlayer || (() => false);
    if (!entry?.playerId || !ACTION_BRIEFING_MAIN_ACTION_TYPES.has(entry.actionType) || !isAiAutoBattlePlayer(entry.playerId)) {
      return null;
    }
    const getPlayerById = options.getPlayerById || (() => null);
    const getPlayerLabelById = options.getPlayerLabelById || (() => "");
    const getPlayerColorDefinition = options.getPlayerColorDefinition || (() => null);
    const createActionLogPlayedCardSnapshot = options.createActionLogPlayedCardSnapshot || (() => null);
    const player = getPlayerById(entry.playerId);
    const color = getPlayerColorDefinition(player?.color);
    const playedCard = entry.actionType === "playCard"
      ? (entry?.steps || [])
        .map((step) => createActionLogPlayedCardSnapshot(step?.playedCard))
        .find((card) => card?.label) || null
      : null;

    return {
      entryId: entry.id,
      roundNumber: entry.roundNumber,
      turnNumber: entry.turnNumber,
      rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber,
      actionCycleNumber: entry.actionCycleNumber ?? null,
      playerId: entry.playerId,
      playerLabel: player?.colorLabel || entry.playerLabel || getPlayerLabelById(entry.playerId) || "电脑玩家",
      playerColor: player?.color || null,
      playerColorValue: color?.uiColor || "rgba(232, 244, 255, 0.78)",
      actionType: entry.actionType,
      actionName: getActionBriefingActionName(entry, options),
      detailText: getActionBriefingDetailText(entry, {
        ...options,
        playedCard,
      }),
      playedCard,
    };
  }

  function getActionBriefingItemsForCompletedCycle(items = [], advanceResult = {}, options = {}) {
    if (!advanceResult?.completedActionCycle) return [];
    const cycleKey = getActionBriefingCycleKey(
      advanceResult.completedActionCycleRoundNumber,
      advanceResult.completedActionCycleNumber,
      advanceResult.completedActionCycleTurnNumber,
    );
    const latestByPlayerKey = new Map();
    for (const item of items) {
      if (getActionBriefingItemCycleKey(item) !== cycleKey) continue;
      const playerKey = getActionBriefingPlayerKey(item);
      if (!playerKey) continue;
      latestByPlayerKey.set(playerKey, item);
    }

    const orderedItems = [];
    const getPlayerById = options.getPlayerById || (() => null);
    for (const playerId of advanceResult.completedActionCyclePlayerIds || []) {
      const player = getPlayerById(playerId);
      const playerKey = getActionBriefingPlayerKey({
        playerId,
        playerColor: player?.color || null,
        playerLabel: player?.colorLabel || null,
      });
      if (!playerKey || !latestByPlayerKey.has(playerKey)) continue;
      orderedItems.push(latestByPlayerKey.get(playerKey));
      latestByPlayerKey.delete(playerKey);
    }

    return [...orderedItems, ...latestByPlayerKey.values()]
      .slice(0, options.maxItems || ACTION_BRIEFING_MAX_ITEMS);
  }

  function createActionBriefingHelpers(context = {}) {
    const windowRef = context.window || root;
    const documentRef = context.document || root.document;
    const els = context.els || {};
    const actionBriefingState = context.actionBriefingState || {};
    const startScreenState = context.startScreenState || {};
    const turnState = context.turnState || {};

    const normalizeActionLogText = requireFunction("normalizeActionLogText", context.normalizeActionLogText);
    const createActionLogPlayedCardSnapshot = requireFunction(
      "createActionLogPlayedCardSnapshot",
      context.createActionLogPlayedCardSnapshot,
    );
    const attachCardHoverPreview = context.attachCardHoverPreview || (() => {});
    const appendActionLogTextWithPlayedCard = context.appendActionLogTextWithPlayedCard
      || ((container, text, playedCard) => {
        const card = createActionLogPlayedCardSnapshot(playedCard);
        if (!card?.label || !String(text).includes(card.label)) {
          container.append(documentRef.createTextNode(text));
          return;
        }
        const matchIndex = text.indexOf(card.label);
        if (matchIndex > 0) {
          container.append(documentRef.createTextNode(text.slice(0, matchIndex)));
        }
        const cardNode = documentRef.createElement("span");
        cardNode.className = "action-log-played-card";
        cardNode.tabIndex = 0;
        cardNode.setAttribute("role", "img");
        cardNode.setAttribute("aria-label", `打出卡牌：${card.label}`);
        const name = documentRef.createElement("span");
        name.className = "action-log-played-card-name";
        name.textContent = card.label;
        attachCardHoverPreview(cardNode, card.src || context.cardBackSrc || "", card.label);
        cardNode.append(name);
        container.append(cardNode);
        const endIndex = matchIndex + card.label.length;
        if (endIndex < text.length) {
          container.append(documentRef.createTextNode(text.slice(endIndex)));
        }
      });
    const hideCardHoverPreview = requireFunction("hideCardHoverPreview", context.hideCardHoverPreview);
    const scheduleAiAutoStepIfNeeded = requireFunction(
      "scheduleAiAutoStepIfNeeded",
      context.scheduleAiAutoStepIfNeeded,
    );
    const setReportTab = requireFunction("setReportTab", context.setReportTab);
    const setLogOpen = requireFunction("setLogOpen", context.setLogOpen);
    const isAiAutoBattlePlayer = requireFunction("isAiAutoBattlePlayer", context.isAiAutoBattlePlayer);
    const getPlayerById = requireFunction("getPlayerById", context.getPlayerById);
    const getPlayerLabelById = requireFunction("getPlayerLabelById", context.getPlayerLabelById);
    const getPlayerColorDefinition = requireFunction(
      "getPlayerColorDefinition",
      context.getPlayerColorDefinition,
    );
    const getDisplayedTurnNumber = requireFunction("getDisplayedTurnNumber", context.getDisplayedTurnNumber);
    const getActionCycleNumber = requireFunction("getActionCycleNumber", context.getActionCycleNumber);
    const isGameEnded = requireFunction("isGameEnded", context.isGameEnded);

    const helperOptions = {
      normalizeActionLogText,
      historySourceMain: context.HISTORY_SOURCE_MAIN || "main",
      solar: context.solar || {},
      solarState: context.solarState || {},
      data: context.data || {},
      aomomo: context.aomomo || null,
      getAomomoCurrentX: context.getAomomoCurrentX || null,
      isAiAutoBattlePlayer,
      getPlayerById,
      getPlayerLabelById,
      getPlayerColorDefinition,
      createActionLogPlayedCardSnapshot,
      maxItems: context.maxItems || ACTION_BRIEFING_MAX_ITEMS,
      maxCycles: context.maxCycles || ACTION_BRIEFING_MAX_CYCLES,
    };

    function resetActionBriefingState() {
      actionBriefingState.aiMainActions = [];
      actionBriefingState.lastShownTurnKey = null;
      actionBriefingState.pendingTurnKey = null;
      actionBriefingState.pendingAiResume = false;
      closeActionBriefing();
    }

    function rememberActionBriefingEntry(entry) {
      const item = createActionBriefingItemFromEntry(entry, helperOptions);
      if (!item) return null;
      const cycleKey = getActionBriefingItemCycleKey(item);
      const playerKey = getActionBriefingPlayerKey(item);
      actionBriefingState.aiMainActions = (actionBriefingState.aiMainActions || [])
        .filter((existing) => {
          if (existing.entryId === item.entryId) return false;
          return !(
            getActionBriefingItemCycleKey(existing) === cycleKey
            && getActionBriefingPlayerKey(existing) === playerKey
          );
        });
      actionBriefingState.aiMainActions.push(item);
      actionBriefingState.aiMainActions = pruneActionBriefingItems(
        actionBriefingState.aiMainActions,
        helperOptions.maxCycles,
      );
      return item;
    }

    function getActionBriefingTurnKey(advanceResult = null) {
      return [
        turnState.roundNumber,
        getDisplayedTurnNumber(),
        advanceResult?.completedActionCycleRoundNumber || "",
        advanceResult?.completedActionCycleNumber || "",
        advanceResult?.completedActionCycleTurnNumber || "",
      ].join(":");
    }

    function formatActionBriefingLead(item) {
      const playerLabel = item?.playerLabel || "电脑玩家";
      const actionName = item?.actionName || "主要行动";
      return actionName === "PASS"
        ? `${playerLabel}进行了 PASS`
        : `${playerLabel}进行了${actionName}`;
    }

    function createActionBriefingItemElement(item) {
      const row = documentRef.createElement("li");
      row.className = "action-briefing-item";

      const marker = documentRef.createElement("span");
      marker.className = "action-briefing-player-marker";
      marker.style.setProperty("--player-color", item.playerColorValue || "rgba(232, 244, 255, 0.78)");
      marker.setAttribute("aria-hidden", "true");

      const text = documentRef.createElement("span");
      text.className = "action-briefing-text";
      text.append(documentRef.createTextNode(formatActionBriefingLead(item)));
      if (item.detailText) {
        text.append(documentRef.createTextNode("，"));
        appendActionLogTextWithPlayedCard(text, item.detailText, item.playedCard);
      }
      text.append(documentRef.createTextNode("。"));

      row.append(marker, text);
      return row;
    }

    function openActionBriefing(items, turnKey, options = {}) {
      if (!els.actionBriefingOverlay || !els.actionBriefingList || !els.actionBriefingConfirm) return false;
      const visibleItems = (items || []).filter(Boolean);
      if (!visibleItems.length) return false;
      if (els.actionBriefingRoundLabel) {
        els.actionBriefingRoundLabel.textContent = options.roundLabel || "";
        els.actionBriefingRoundLabel.hidden = !options.roundLabel;
      }
      els.actionBriefingList.replaceChildren(...visibleItems.map(createActionBriefingItemElement));
      els.actionBriefingOverlay.hidden = false;
      els.actionBriefingOverlay.setAttribute("aria-hidden", "false");
      actionBriefingState.pendingTurnKey = turnKey || null;
      actionBriefingState.pendingAiResume = Boolean(options.resumeAiAfterClose);
      windowRef.setTimeout(() => els.actionBriefingConfirm?.focus?.(), 0);
      return true;
    }

    function closeActionBriefing() {
      const shouldResumeAi = Boolean(actionBriefingState.pendingAiResume);
      hideCardHoverPreview();
      if (els.actionBriefingOverlay) {
        els.actionBriefingOverlay.hidden = true;
        els.actionBriefingOverlay.setAttribute("aria-hidden", "true");
      }
      if (els.actionBriefingRoundLabel) {
        els.actionBriefingRoundLabel.textContent = "";
        els.actionBriefingRoundLabel.hidden = true;
      }
      els.actionBriefingList?.replaceChildren();
      actionBriefingState.pendingTurnKey = null;
      actionBriefingState.pendingAiResume = false;
      if (shouldResumeAi) scheduleAiAutoStepIfNeeded();
    }

    function openActionBriefingDetailLog() {
      setReportTab("action");
      setLogOpen(true);
      closeActionBriefing();
    }

    function isActionBriefingEnabled() {
      return startScreenState.actionBriefingEnabled !== false;
    }

    function isActionBriefingOpen() {
      return Boolean(els.actionBriefingOverlay && !els.actionBriefingOverlay.hidden);
    }

    function maybeOpenActionBriefingForCompletedCycle(advanceResult) {
      if (!isActionBriefingEnabled()) return false;
      if (!advanceResult?.completedActionCycle || isGameEnded()) return false;
      const items = getActionBriefingItemsForCompletedCycle(
        actionBriefingState.aiMainActions || [],
        advanceResult,
        helperOptions,
      );
      if (!items.length) return false;
      const turnKey = getActionBriefingTurnKey(advanceResult);
      if (actionBriefingState.lastShownTurnKey === turnKey) return false;
      const roundLabel = `第${getActionCycleNumber()}回合：`;
      if (!openActionBriefing(items, turnKey, {
        roundLabel,
        resumeAiAfterClose: true,
      })) return false;
      actionBriefingState.lastShownTurnKey = turnKey;
      return true;
    }

    return {
      resetActionBriefingState,
      rememberActionBriefingEntry,
      openActionBriefing,
      closeActionBriefing,
      openActionBriefingDetailLog,
      isActionBriefingEnabled,
      isActionBriefingOpen,
      maybeOpenActionBriefingForCompletedCycle,
      getActionBriefingTurnKey,
      formatActionBriefingLead,
    };
  }

  return {
    ACTION_BRIEFING_MAX_ITEMS,
    ACTION_BRIEFING_MAX_CYCLES,
    ACTION_BRIEFING_MAIN_ACTION_TYPES,
    getActionBriefingActionName,
    getActionBriefingStepTexts,
    extractActionBriefingTravelTarget,
    getActionBriefingNebulaLocations,
    createActionBriefingStepMetadata,
    listActionBriefingScanTargets,
    formatActionBriefingScanTargets,
    getActionBriefingDetailText,
    getActionBriefingCycleKey,
    getActionBriefingItemCycleKey,
    getActionBriefingPlayerKey,
    pruneActionBriefingItems,
    createActionBriefingItemFromEntry,
    getActionBriefingItemsForCompletedCycle,
    createActionBriefingHelpers,
  };
});
