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

  return {
    normalizeText,
    compactText,
    simplifyDetailForLabel,
    composeStepText,
    createPlayedCardSnapshot,
    normalizeBriefingSnapshot,
    normalizeStep,
    ensureDraft,
    pruneEmptyDraft,
    importEntries,
    createEntryFromDraft,
    createConfirmedEntry,
  };
});
