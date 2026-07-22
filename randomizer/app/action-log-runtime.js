(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppActionLogRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function normalizeText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(text) {
    return normalizeText(text).replace(/\s+/g, "");
  }

  function getDetailPartRedundantKey(part) {
    const segments = normalizeText(part)
      .split(/[：:]/)
      .map((segment) => compactText(segment).replace(/奖励/g, ""))
      .filter(Boolean);
    if (segments.length < 3) return "";
    const key = `${segments[0]}${segments[1]}`;
    return key.length >= 4 ? key : "";
  }

  function simplifyDetailForLabel(label, detail) {
    const cleanDetail = normalizeText(detail);
    if (!cleanDetail) return "";
    const compactLabel = compactText(label).replace(/奖励/g, "");
    if (!compactLabel) return cleanDetail;
    const parts = cleanDetail
      .split("；")
      .map(normalizeText)
      .filter(Boolean)
      .filter((part) => {
        const redundantKey = getDetailPartRedundantKey(part);
        return !redundantKey || !compactLabel.includes(redundantKey);
      });
    return parts.join("；");
  }

  function composeStepText(label, detail) {
    const cleanLabel = normalizeText(label);
    const cleanDetail = simplifyDetailForLabel(cleanLabel, detail);
    if (!cleanDetail || cleanDetail === cleanLabel) return cleanLabel || "行动效果";
    if (cleanDetail.startsWith(`${cleanLabel}：`) || cleanDetail.startsWith(`${cleanLabel}:`)) {
      return cleanDetail;
    }
    if (!cleanLabel) return cleanDetail;
    return `${cleanLabel}：${cleanDetail}`;
  }

  function createPlayedCardSnapshot(card, options = {}) {
    if (!card) return null;
    const label = normalizeText(card.label || options.getCardLabel?.(card));
    const src = card.src || null;
    if (!label && !src) return null;
    return {
      id: card.id || null,
      cardId: card.cardId || null,
      label,
      cardName: card.cardName || label,
      src,
    };
  }

  function optionsFromHistoryStep(step = {}) {
    return {
      stepId: step.id || null,
      undoable: step.undoable !== false,
      irreversibleCode: step.irreversibleCode || null,
      irreversibleReason: step.irreversibleReason || null,
      playedCard: step.playedCard || null,
      briefing: step.briefing || null,
    };
  }

  function pickNumericFields(source = {}, keys = []) {
    return Object.fromEntries(keys.map((key) => [key, Number(source?.[key]) || 0]));
  }

  function createImpactSnapshot(player, options = {}) {
    if (!player) return null;
    return {
      playerId: player.id || null,
      resources: pickNumericFields(player.resources || {}, options.resourceKeys),
      income: pickNumericFields(player.income || {}, options.incomeKeys),
      completedTaskCount: Number(player.completedTaskCount) || 0,
    };
  }

  function formatSignedDelta(value) {
    const rounded = Math.round(Number(value) * 100) / 100;
    return `${rounded > 0 ? "+" : ""}${rounded}`;
  }

  function createDeltaEntries(before = {}, after = {}, keys = [], labels = {}) {
    return keys.map((key) => {
      const delta = (Number(after?.[key]) || 0) - (Number(before?.[key]) || 0);
      const label = labels[key] || key;
      return delta ? { key, label, delta, text: `${label}${formatSignedDelta(delta)}` } : null;
    }).filter(Boolean);
  }

  function isDeltaRepresentedInDetail(detail, entry, units = {}) {
    const compactDetail = compactText(detail);
    if (!compactDetail || !entry?.delta) return false;
    const absDelta = Math.abs(entry.delta);
    const sign = entry.delta > 0 ? "+" : "-";
    const label = compactText(entry.label);
    const unit = compactText(units[entry.key] || entry.label);
    const candidates = [`${label}${sign}${absDelta}`, `${sign}${absDelta}${label}`];
    if (entry.delta > 0) {
      candidates.push(`${label}+${absDelta}`);
      if (unit) candidates.push(`${absDelta}${unit}`, `+${absDelta}${unit}`, `获得${absDelta}${unit}`);
    } else if (unit) {
      candidates.push(`-${absDelta}${unit}`, `支付${absDelta}${unit}`, `消耗${absDelta}${unit}`);
    }
    return candidates.some((candidate) => candidate && compactDetail.includes(candidate));
  }

  function formatImpact(before, after, options = {}) {
    if (!before || !after || (before.playerId && after.playerId && before.playerId !== after.playerId)) return "";
    const groups = [];
    const detailText = normalizeText(options.detailText);
    const appendGroup = (label, previous, next, keys) => {
      const parts = createDeltaEntries(previous, next, keys, options.labels)
        .filter((entry) => !isDeltaRepresentedInDetail(detailText, entry, options.units))
        .map((entry) => entry.text);
      if (parts.length) groups.push(`${label}：${parts.join("、")}`);
    };
    appendGroup("资源", before.resources, after.resources, options.resourceKeys);
    appendGroup("收入", before.income, after.income, options.incomeKeys);
    const taskDelta = (Number(after.completedTaskCount) || 0) - (Number(before.completedTaskCount) || 0);
    if (taskDelta && !compactText(detailText).includes(`完成任务${formatSignedDelta(taskDelta)}`)) {
      groups.push(`完成任务${formatSignedDelta(taskDelta)}`);
    }
    return groups.join("；");
  }

  function normalizeBriefingSnapshot(briefing, options = {}) {
    if (!briefing || typeof briefing !== "object") return null;
    const snapshot = {};
    if (Array.isArray(briefing.scanTargets)) {
      const scanTargets = briefing.scanTargets
        .map((target) => {
          if (!target || typeof target !== "object") return null;
          const rawX = target.x ?? target.sectorX;
          const x = Number.isFinite(Number(rawX))
            ? options.normalizeSectorX?.(Number(rawX)) ?? Number(rawX)
            : null;
          const nebulaId = normalizeText(target.nebulaId);
          const label = normalizeText(target.label || (nebulaId ? options.getNebulaLabel?.(nebulaId) : ""));
          if (x == null && !label && !nebulaId) return null;
          return { x, nebulaId: nebulaId || null, label: label || null };
        })
        .filter(Boolean);
      if (scanTargets.length) snapshot.scanTargets = scanTargets;
    }
    return Object.keys(snapshot).length ? snapshot : null;
  }

  function normalizeStep(source, label, detail = null, options = {}) {
    const text = composeStepText(label, detail);
    if (!text) return null;
    return {
      stepId: options.stepId || options.id || null,
      source,
      text,
      label: normalizeText(label),
      detail: normalizeText(detail),
      undoable: options.undoable !== false,
      irreversibleCode: options.irreversibleCode || null,
      irreversibleReason: normalizeText(options.irreversibleReason),
      playedCard: createPlayedCardSnapshot(options.playedCard, {
        getCardLabel: options.getCardLabel,
      }),
      briefing: normalizeBriefingSnapshot(options.briefing, {
        normalizeSectorX: options.normalizeSectorX,
        getNebulaLabel: options.getNebulaLabel,
      }),
    };
  }

  function ensureDraft(actionLogState, context = {}, options = {}) {
    const player = options.player || context.getCurrentPlayer?.();
    const playerId = options.playerId || player?.id || context.currentPlayerId || null;
    const actionCycleNumber = context.getActionCycleNumber?.();
    const isSameTurnDraft = actionLogState.draft
      && actionLogState.draft.roundNumber === context.roundNumber
      && actionLogState.draft.rawTurnNumber === context.turnNumber
      && actionLogState.draft.playerId === playerId;

    if (!isSameTurnDraft) {
      actionLogState.draft = {
        roundNumber: context.roundNumber,
        turnNumber: context.turnNumber,
        rawTurnNumber: context.turnNumber,
        actionCycleNumber,
        playerId,
        playerLabel: options.playerLabel || context.getPlayerLabelById?.(playerId),
        actionType: null,
        actionLabel: "本回合行动",
        steps: [],
      };
    }

    if (options.actionType) {
      const draft = actionLogState.draft;
      const shouldReplaceAction = options.source !== context.historySourceQuick
        || !draft.actionType
        || draft.actionType === "quick";
      if (shouldReplaceAction) {
        draft.actionType = options.actionType;
        draft.actionLabel = context.getActionLogActionLabel?.(options.actionType, options.label)
          || options.label
          || options.actionType
          || "本回合行动";
      }
    } else if (!actionLogState.draft.actionType && options.source === context.historySourceQuick) {
      actionLogState.draft.actionType = "quick";
      actionLogState.draft.actionLabel = context.defaultQuickLabel || "快速行动";
    }

    return actionLogState.draft;
  }

  function pruneEmptyDraft(actionLogState, context = {}) {
    const draft = actionLogState.draft;
    if (!draft) return;
    if (
      !draft.steps.length
      && !context.hasMainHistorySession?.()
      && !context.hasQuickHistorySession?.()
      && !context.actionExecuted
    ) {
      actionLogState.draft = null;
    }
  }

  function importEntries(actionLogState, entries, options = {}) {
    const normalizedEntries = (entries || [])
      .map((entry) => structuredClone(entry))
      .filter((entry) => entry && entry.id != null);
    if (options.truncateToEntryId != null) {
      const index = normalizedEntries.findIndex((entry) => (
        entry.id === options.truncateToEntryId || String(entry.id) === String(options.truncateToEntryId)
      ));
      actionLogState.entries = index >= 0
        ? normalizedEntries.slice(0, index + 1)
        : normalizedEntries;
    } else if (Number.isInteger(options.truncateToIndex)) {
      actionLogState.entries = normalizedEntries.slice(0, options.truncateToIndex + 1);
    } else {
      actionLogState.entries = normalizedEntries;
    }
    actionLogState.nextEntryId = actionLogState.entries.reduce(
      (max, entry) => Math.max(max, Math.round(Number(entry.id)) || 0),
      0,
    ) + 1;
    actionLogState.draft = null;
  }

  function createEntryFromDraft(actionLogState, context = {}, options = {}) {
    const draft = actionLogState.draft;
    if (!draft) return null;
    const hasSteps = draft.steps.length > 0;
    const shouldCommit = hasSteps || options.force;
    if (!shouldCommit) {
      actionLogState.draft = null;
      return null;
    }

    const rawTurnNumber = draft.rawTurnNumber ?? draft.turnNumber;
    return {
      id: actionLogState.nextEntryId,
      roundNumber: draft.roundNumber,
      turnNumber: context.getDisplayedTurnNumber?.(rawTurnNumber) ?? rawTurnNumber,
      rawTurnNumber,
      actionCycleNumber: draft.actionCycleNumber ?? context.getActionCycleNumber?.(),
      playerId: draft.playerId,
      playerLabel: draft.playerLabel,
      actionType: draft.actionType || options.actionType || "turn",
      actionLabel: draft.actionLabel || context.getActionLogActionLabel?.(options.actionType, options.actionLabel),
      passed: Boolean(options.passed),
      steps: draft.steps.map((step) => ({ ...step })),
    };
  }

  function createConfirmedEntry(actionLogState, entryInput, context = {}) {
    const player = entryInput.player || context.getCurrentPlayer?.();
    const playerId = entryInput.playerId || player?.id || null;
    const rawTurnNumber = entryInput.rawTurnNumber ?? entryInput.turnNumber ?? context.turnNumber;
    return {
      id: actionLogState.nextEntryId,
      roundNumber: entryInput.roundNumber ?? context.roundNumber,
      turnNumber: context.getDisplayedTurnNumber?.(rawTurnNumber) ?? rawTurnNumber,
      rawTurnNumber,
      actionCycleNumber: entryInput.actionCycleNumber ?? context.getActionCycleNumber?.(),
      title: entryInput.title || null,
      playerId,
      playerLabel: entryInput.playerLabel || context.getPlayerLabelById?.(playerId),
      actionType: entryInput.actionType || "turn",
      actionLabel: context.getActionLogActionLabel?.(entryInput.actionType, entryInput.actionLabel),
      passed: Boolean(entryInput.passed),
      steps: (entryInput.steps || []).map((step) => ({
        stepId: step.stepId || null,
        source: step.source || context.historySourceMain || "main",
        text: normalizeText(step.text || composeStepText(step.label, step.detail)),
        label: normalizeText(step.label),
        detail: normalizeText(step.detail),
        undoable: step.undoable !== false,
        irreversibleCode: step.irreversibleCode || null,
        irreversibleReason: normalizeText(step.irreversibleReason),
        playedCard: createPlayedCardSnapshot(step.playedCard, {
          getCardLabel: context.getCardLabel,
        }),
      })).filter((step) => step.text),
    };
  }

  function createActionLogController(context = {}) {
    const {
      actionLogState,
      actionHistory,
      quickActionHistory,
      historySourceMain,
      historySourceQuick,
      resourceKeys,
      incomeKeys,
      incomeLabels,
      deltaUnits,
    } = context;

    function getActionLogActionLabel(actionType, label) {
      return label || context.defaultLabels?.[actionType] || actionType || "本回合行动";
    }

    function normalizeActionLogStep(source, label, detail = null, options = {}) {
      return normalizeStep(source, label, detail, {
        ...options,
        getCardLabel: context.getCardLabel,
        normalizeSectorX: context.normalizeSectorX,
        getNebulaLabel: context.getNebulaLabel,
      });
    }

    function createActionLogImpactSnapshot(player = context.getCurrentPlayer()) {
      return createImpactSnapshot(player, { resourceKeys, incomeKeys });
    }

    function formatActionLogImpact(before, after = createActionLogImpactSnapshot(), options = {}) {
      return formatImpact(before, after, {
        ...options,
        resourceKeys,
        incomeKeys,
        labels: incomeLabels,
        units: deltaUnits,
      });
    }

    function composeActionLogDetailWithImpact(detail, step) {
      const cleanDetail = simplifyDetailForLabel(step?.label, detail);
      const impactContext = `${normalizeText(step?.label)}；${cleanDetail}`;
      const impact = formatActionLogImpact(step?.logBefore, undefined, { detailText: impactContext });
      if (!impact) return cleanDetail || null;
      if (cleanDetail && cleanDetail.includes(impact)) return cleanDetail;
      return cleanDetail ? `${cleanDetail}；${impact}` : impact;
    }

    function ensureActionLogDraft(options = {}) {
      const readoutRoot = context.createReadoutRoot();
      return ensureDraft(actionLogState, {
        getCurrentPlayer: context.getCurrentPlayer,
        currentPlayerId: readoutRoot.playerState.currentPlayerId,
        roundNumber: readoutRoot.turnState.roundNumber,
        turnNumber: readoutRoot.turnState.turnNumber,
        getPlayerLabelById: context.getPlayerLabelById,
        getActionCycleNumber: context.getActionCycleNumber,
        getActionLogActionLabel,
        historySourceQuick,
        defaultQuickLabel: context.defaultLabels?.quick,
      }, options);
    }

    function startActionLogDraft(actionType, label, options = {}) {
      if (options.source === historySourceMain) context.cancelHandCardContextActions({ silent: true });
      return ensureActionLogDraft({
        ...options,
        actionType,
        label: getActionLogActionLabel(actionType, label),
      });
    }

    function appendActionLogStep(source, label, detail = null, options = {}) {
      const draft = ensureActionLogDraft({
        source,
        actionType: options.actionType,
        label: options.actionLabel,
        player: options.player,
      });
      const step = normalizeActionLogStep(source, label, detail, options);
      if (!step) return null;
      draft.steps.push(step);
      context.renderActionLog();
      return step;
    }

    function pruneEmptyActionLogDraft() {
      pruneEmptyDraft(actionLogState, {
        hasMainHistorySession: () => actionHistory.hasSession(),
        hasQuickHistorySession: () => quickActionHistory.hasSession(),
        actionExecuted: context.isActionPending(),
      });
    }

    function removeLastActionLogStep(source, stepId = null) {
      const draft = actionLogState.draft;
      if (!draft?.steps?.length) return null;
      for (let index = draft.steps.length - 1; index >= 0; index -= 1) {
        const step = draft.steps[index];
        if ((!source || step.source === source) && (!stepId || step.stepId === stepId)) {
          const [removed] = draft.steps.splice(index, 1);
          pruneEmptyActionLogDraft();
          context.renderActionLog();
          return removed;
        }
      }
      return null;
    }

    function removeActionLogStepsBySource(source) {
      const draft = actionLogState.draft;
      if (draft?.steps?.length) draft.steps = draft.steps.filter((step) => step.source !== source);
      pruneEmptyActionLogDraft();
      context.renderActionLog();
    }

    function resetActionLog() {
      actionLogState.entries = [];
      actionLogState.draft = null;
      actionLogState.nextEntryId = 1;
      context.resetActionBriefingState();
      context.renderActionLog();
    }

    return Object.freeze({
      getActionLogActionLabel,
      normalizeActionLogText: normalizeText,
      createActionLogPlayedCardSnapshot: (card) => createPlayedCardSnapshot(card, { getCardLabel: context.getCardLabel }),
      simplifyActionLogDetailForLabel: simplifyDetailForLabel,
      normalizeActionLogStep,
      actionLogOptionsFromHistoryStep: optionsFromHistoryStep,
      createActionLogImpactSnapshot,
      formatActionLogImpact,
      composeActionLogDetailWithImpact,
      ensureActionLogDraft,
      startActionLogDraft,
      appendActionLogStep,
      removeLastActionLogStep,
      removeActionLogStepsBySource,
      pruneEmptyActionLogDraft,
      resetActionLog,
    });
  }

  function createActionLogViewRuntime(context = {}) {
    const {
      document,
      els,
      players,
      uiRuntimeState,
      actionLogState,
      historySourceMain,
      sourceLabels,
      attachCardHoverPreview,
    } = context;

    function getEntryTitle(entry) {
      return entry.title || `第${entry.roundNumber}轮 第${entry.turnNumber}回合`;
    }

    function formatIrreversibleSuffix(step) {
      const reason = normalizeText(step?.irreversibleReason);
      if (!reason) return "";
      const compactReason = compactText(reason);
      const targets = [step?.text, step?.detail, step?.label]
        .map(compactText)
        .filter(Boolean);
      const isDuplicate = targets.some((target) => (
        target === compactReason
        || target.endsWith(`：${compactReason}`)
        || target.endsWith(`:${compactReason}`)
      ));
      return isDuplicate ? "（不可撤销）" : `（不可撤销：${reason}）`;
    }

    function appendTextWithPlayedCard(container, text, playedCard) {
      const card = createPlayedCardSnapshot(playedCard, { getCardLabel: context.getCardLabel });
      if (!card?.label) {
        container.append(document.createTextNode(text));
        return;
      }
      const matchIndex = text.indexOf(card.label);
      if (matchIndex < 0) {
        container.append(document.createTextNode(text));
        return;
      }
      if (matchIndex > 0) container.append(document.createTextNode(text.slice(0, matchIndex)));

      const cardNode = document.createElement("span");
      cardNode.className = "action-log-played-card";
      cardNode.tabIndex = 0;
      cardNode.setAttribute("role", "img");
      cardNode.setAttribute("aria-label", `打出卡牌：${card.label}`);
      const name = document.createElement("span");
      name.className = "action-log-played-card-name";
      name.textContent = card.label;
      attachCardHoverPreview(cardNode, card.src || players.CARD_BACK_SRC, card.label);
      cardNode.append(name);
      container.append(cardNode);

      const endIndex = matchIndex + card.label.length;
      if (endIndex < text.length) container.append(document.createTextNode(text.slice(endIndex)));
    }

    function getEntryMetaText(entry) {
      const playerLabel = entry.playerLabel || "未知玩家";
      const actionLabel = entry.actionLabel || "本回合行动";
      if (entry.actionType === "quick") return `${playerLabel} · 快速行动`;
      if (entry.actionType === "initialSelection") return `${playerLabel} · ${actionLabel}`;
      return `${playerLabel} · 主要行动：${actionLabel}`;
    }

    function getStepPrefix(step, displayIndex = null) {
      if (step?.source === historySourceMain) return `效果${displayIndex || 1}`;
      return sourceLabels[step?.source] || "行动";
    }

    function createEffectTextNode(step, displayIndex = null) {
      const text = document.createElement("span");
      text.className = "action-log-effect-text";
      const line = `${getStepPrefix(step, displayIndex)}：${step.text}${formatIrreversibleSuffix(step)}`;
      appendTextWithPlayedCard(text, line, step.playedCard);
      return text;
    }

    function createEntryElement(entry) {
      const article = document.createElement("article");
      article.className = "action-log-entry";
      article.dataset.actionLogId = String(entry.id);
      const header = document.createElement("div");
      header.className = "action-log-entry-header";
      const title = document.createElement("div");
      title.className = "action-log-entry-title";
      title.textContent = getEntryTitle(entry);
      const sequence = document.createElement("div");
      sequence.className = "action-log-entry-sequence";
      sequence.textContent = `#${entry.id}`;
      const meta = document.createElement("div");
      meta.className = "action-log-entry-meta";
      meta.textContent = getEntryMetaText(entry);
      header.append(title, sequence, meta);

      const list = document.createElement("ol");
      list.className = "action-log-effects";
      let mainEffectIndex = 0;
      entry.steps.forEach((step, index) => {
        const item = document.createElement("li");
        item.className = `action-log-effect action-log-effect-${step.source || "main"}`;
        const displayIndex = step.source === historySourceMain ? (mainEffectIndex += 1) : index + 1;
        const indexNode = document.createElement("span");
        indexNode.className = "action-log-effect-index";
        indexNode.textContent = String(index + 1);
        item.append(indexNode, createEffectTextNode(step, displayIndex));
        list.append(item);
      });
      article.append(header, list);
      return article;
    }

    function renderActionLog() {
      if (uiRuntimeState.codexAiBatchSuppressReadoutRender || !els.actionLogReadout) return;
      const entries = actionLogState.entries;
      if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "action-log-empty";
        empty.textContent = "暂无已确认的行动。";
        els.actionLogReadout.replaceChildren(empty);
        return;
      }
      const list = document.createElement("div");
      list.className = "action-log-list";
      for (const entry of entries.slice().reverse()) list.append(createEntryElement(entry));
      els.actionLogReadout.replaceChildren(list);
    }

    function isDebugToolsEnabled() {
      return !els.appWrap?.classList.contains("debug-tools-disabled");
    }

    function isStateLogEnabled() {
      return !els.appWrap?.classList.contains("state-log-disabled");
    }

    function setReportTab(tab) {
      const stateLogEnabled = isStateLogEnabled();
      const nextTab = stateLogEnabled && tab !== "action" ? "state" : "action";
      actionLogState.activeReportTab = nextTab;
      const stateActive = nextTab === "state";
      if (els.stateLogTab) {
        els.stateLogTab.hidden = !stateLogEnabled;
        els.stateLogTab.setAttribute("aria-hidden", String(!stateLogEnabled));
      }
      els.stateLogTab?.classList.toggle("is-active", stateActive);
      els.actionLogTab?.classList.toggle("is-active", !stateActive);
      els.stateLogTab?.setAttribute("aria-selected", String(stateActive));
      els.actionLogTab?.setAttribute("aria-selected", String(!stateActive));
      if (els.stateReadout) els.stateReadout.hidden = !stateActive;
      if (els.actionLogReadout) els.actionLogReadout.hidden = stateActive;
      if (!stateActive) renderActionLog();
    }

    function setLogOpen(open) {
      if (open && !isStateLogEnabled()) setReportTab("action");
      els.appWrap.classList.toggle("log-collapsed", !open);
      els.logToggle?.setAttribute("aria-expanded", String(open));
      context.resize?.();
    }

    return { renderActionLog, setReportTab, setLogOpen, isDebugToolsEnabled, isStateLogEnabled };
  }

  return {
    normalizeText,
    compactText,
    simplifyDetailForLabel,
    composeStepText,
    createPlayedCardSnapshot,
    optionsFromHistoryStep,
    createImpactSnapshot,
    formatImpact,
    normalizeBriefingSnapshot,
    normalizeStep,
    ensureDraft,
    pruneEmptyDraft,
    importEntries,
    createEntryFromDraft,
    createConfirmedEntry,
    createActionLogController,
    createActionLogViewRuntime,
  };
});
