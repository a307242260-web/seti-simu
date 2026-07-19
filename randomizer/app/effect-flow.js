(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppEffectFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function requireFunction(name, fn) {
    if (typeof fn !== "function") {
      throw new Error(`createEffectFlowHelpers requires function: ${name}`);
    }
    return fn;
  }

  function createEffectFlowHelpers(context = {}) {
    const pendingState = context.pendingState || {};
    const uiRuntimeState = context.uiRuntimeState || {};
    const actionHistory = context.actionHistory || {};
    const quickActionHistory = context.quickActionHistory || {};
    const historyStepOrder = context.historyStepOrder || [];
    const els = context.els || {};
    const rocketState = context.rocketState || {};
    const abilities = context.abilities || {};
    const historyCommands = context.historyCommands || {};
    const cardEffects = context.cardEffects || {};

    const HISTORY_SOURCE_MAIN = context.HISTORY_SOURCE_MAIN || "main";
    const HISTORY_SOURCE_QUICK = context.HISTORY_SOURCE_QUICK || "quick";
    const ACTION_LOG_DEFAULT_LABELS = context.ACTION_LOG_DEFAULT_LABELS || { quick: "快速行动" };

    const getCurrentPlayer = requireFunction("getCurrentPlayer", context.getCurrentPlayer);
    const markCurrentActionIrreversible = requireFunction(
      "markCurrentActionIrreversible",
      context.markCurrentActionIrreversible,
    );
    const getIrreversibleReason = requireFunction("getIrreversibleReason", context.getIrreversibleReason);
    const recordTurnVisitPlanetEvents = requireFunction(
      "recordTurnVisitPlanetEvents",
      context.recordTurnVisitPlanetEvents,
    );
    const recordNeutralScoreTracesFromAbilityResult = requireFunction(
      "recordNeutralScoreTracesFromAbilityResult",
      context.recordNeutralScoreTracesFromAbilityResult,
    );
    const recordScanScoreSourcesFromAbilityResult = requireFunction(
      "recordScanScoreSourcesFromAbilityResult",
      context.recordScanScoreSourcesFromAbilityResult,
    );
    const startActionLogDraft = requireFunction("startActionLogDraft", context.startActionLogDraft);
    const ensureActionLogDraft = requireFunction("ensureActionLogDraft", context.ensureActionLogDraft);
    const appendActionLogStep = requireFunction("appendActionLogStep", context.appendActionLogStep);
    const removeActionLogStepsBySource = requireFunction(
      "removeActionLogStepsBySource",
      context.removeActionLogStepsBySource,
    );
    const actionLogOptionsFromHistoryStep = requireFunction(
      "actionLogOptionsFromHistoryStep",
      context.actionLogOptionsFromHistoryStep,
    );
    const createActionLogImpactSnapshot = requireFunction(
      "createActionLogImpactSnapshot",
      context.createActionLogImpactSnapshot,
    );
    const composeActionLogDetailWithImpact = requireFunction(
      "composeActionLogDetailWithImpact",
      context.composeActionLogDetailWithImpact,
    );
    const createActionBriefingStepMetadata = requireFunction(
      "createActionBriefingStepMetadata",
      context.createActionBriefingStepMetadata,
    );
    const markActionPending = requireFunction("markActionPending", context.markActionPending);
    const clearCompletedEffectFlowForUndo = requireFunction(
      "clearCompletedEffectFlowForUndo",
      context.clearCompletedEffectFlowForUndo,
    );
    const assignEffectFlowOwner = requireFunction("assignEffectFlowOwner", context.assignEffectFlowOwner);
    const setActiveEffectFlowOwner = requireFunction(
      "setActiveEffectFlowOwner",
      context.setActiveEffectFlowOwner,
    );
    const renderReservedCardsFromTaskState = requireFunction(
      "renderReservedCardsFromTaskState",
      context.renderReservedCardsFromTaskState,
    );
    const renderActionEffectBar = requireFunction("renderActionEffectBar", context.renderActionEffectBar);
    const updateActionButtons = requireFunction("updateActionButtons", context.updateActionButtons);
    const renderStateReadout = requireFunction("renderStateReadout", context.renderStateReadout);
    const hasActiveCardTriggerResolution = requireFunction(
      "hasActiveCardTriggerResolution",
      context.hasActiveCardTriggerResolution,
    );
    const isCardTriggerRewardFlowBusy = requireFunction(
      "isCardTriggerRewardFlowBusy",
      context.isCardTriggerRewardFlowBusy,
    );
    const settleCardTasksAfterEffect = requireFunction(
      "settleCardTasksAfterEffect",
      context.settleCardTasksAfterEffect,
    );
    const finishActionEffectFlow = requireFunction("finishActionEffectFlow", context.finishActionEffectFlow);
    const cancelActiveEffectSubFlows = requireFunction(
      "cancelActiveEffectSubFlows",
      context.cancelActiveEffectSubFlows,
    );
    const maybeAutoExecuteAomomoRewardEffects = requireFunction(
      "maybeAutoExecuteAomomoRewardEffects",
      context.maybeAutoExecuteAomomoRewardEffects,
    );
    const withEffectExecutionPlayer = requireFunction(
      "withEffectExecutionPlayer",
      context.withEffectExecutionPlayer,
    );
    const executeActionEffectForOwner = requireFunction(
      "executeActionEffectForOwner",
      context.executeActionEffectForOwner,
    );

    function getEffectHistorySource() {
      return pendingState.actionEffectFlow?.historySource || HISTORY_SOURCE_MAIN;
    }

    function shouldIrreversibleBlockCurrentMainAction(source) {
      if (source !== HISTORY_SOURCE_QUICK) return true;
      return Boolean(actionHistory.isActionComplete?.() || actionHistory.hasSession());
    }

    function markCurrentActionIrreversibleForSource(source, reason, code = "irreversible") {
      if (shouldIrreversibleBlockCurrentMainAction(source)) {
        return markCurrentActionIrreversible(reason, code);
      }
      return {
        code,
        reason: reason || "该步骤产生不可撤销影响",
      };
    }

    function getHistoryForSource(source) {
      return source === HISTORY_SOURCE_QUICK ? quickActionHistory : actionHistory;
    }

    function getActiveEffectHistory() {
      if (uiRuntimeState.effectStepActive) return getHistoryForSource(getEffectHistorySource());
      return actionHistory;
    }

    function ensureEffectHistorySession(source, actionType, label) {
      const history = getHistoryForSource(source);
      if (!history.hasSession()) {
        history.beginSession(source === HISTORY_SOURCE_QUICK ? "quick" : actionType, label || "效果");
      }
      return history;
    }

    function recordHistoryCommand(command) {
      const history = getActiveEffectHistory();
      if (!history.hasSession()) return;
      history.record(command);
    }

    function recordQuickHistoryCommand(command) {
      if (!quickActionHistory.hasSession()) return;
      quickActionHistory.record(command);
    }

    function recordAbilityCommands(result, history = actionHistory) {
      if (!result) return;
      const commands = [];
      const turnVisitCommand = recordTurnVisitPlanetEvents(result.events);
      if (turnVisitCommand) commands.push(turnVisitCommand);
      recordNeutralScoreTracesFromAbilityResult(result, history);
      commands.push(...(result.commands || []));
      if (commands.length) {
        for (const command of commands) {
          if (history === quickActionHistory) {
            recordQuickHistoryCommand(command);
          } else {
            recordHistoryCommand(command);
          }
        }
      }
      recordScanScoreSourcesFromAbilityResult(result, history);
    }

    function startPendingActionSession(actionType, label, options = {}) {
      if (actionHistory.hasSession()) {
        actionHistory.rollbackSession();
        clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
        removeActionLogStepsBySource(HISTORY_SOURCE_MAIN);
        uiRuntimeState.effectStepActive = false;
      }
      startActionLogDraft(actionType, label, { source: HISTORY_SOURCE_MAIN });
      actionHistory.beginSession(actionType, label);
      actionHistory.beginStep({
        source: HISTORY_SOURCE_MAIN,
        type: "action_start",
        label,
        effectIndex: -1,
        logBefore: options.logBefore || createActionLogImpactSnapshot(),
      });
      uiRuntimeState.effectStepActive = true;
    }

    function beginQuickActionStep(actionType, label, options = {}) {
      clearCompletedEffectFlowForUndo(HISTORY_SOURCE_QUICK);
      ensureActionLogDraft({
        source: HISTORY_SOURCE_QUICK,
        actionType: context.actionLogState?.draft?.actionType || "quick",
        label: context.actionLogState?.draft?.actionType
          ? context.actionLogState.draft.actionLabel
          : ACTION_LOG_DEFAULT_LABELS.quick,
      });
      if (!quickActionHistory.hasSession()) {
        quickActionHistory.beginSession("quick", "快速行动");
      }
      quickActionHistory.beginStep({
        source: HISTORY_SOURCE_QUICK,
        type: actionType,
        label,
        logBefore: options.logBefore || createActionLogImpactSnapshot(),
      });
    }

    function completePendingActionStep() {
      endEffectHistoryStep();
      markActionPending();
    }

    function completeQuickActionStep(detail = null, options = {}) {
      const step = quickActionHistory.endStep();
      if (step) {
        if (options.irreversibleReason || options.undoable === false) {
          step.undoable = false;
          step.irreversibleCode = options.irreversibleCode || "irreversible_quick_action";
          step.irreversibleReason = options.irreversibleReason || "该快速行动产生不可撤销影响";
          markCurrentActionIrreversibleForSource(
            HISTORY_SOURCE_QUICK,
            step.irreversibleReason,
            step.irreversibleCode,
          );
        }
        rememberHistoryStep(HISTORY_SOURCE_QUICK, step.id);
        appendActionLogStep(
          HISTORY_SOURCE_QUICK,
          step.label,
          composeActionLogDetailWithImpact(detail, step),
          actionLogOptionsFromHistoryStep(step),
        );
        if (step.undoable === false) {
          quickActionHistory.commitSession();
          clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
        }
      }
      return step || null;
    }

    function rememberHistoryStep(source, stepId = null) {
      historyStepOrder.push({ source, stepId });
    }

    function forgetLastHistoryStep(source, stepId = null) {
      for (let index = historyStepOrder.length - 1; index >= 0; index -= 1) {
        const entry = typeof historyStepOrder[index] === "string"
          ? { source: historyStepOrder[index], stepId: null }
          : historyStepOrder[index];
        if (entry.source === source && (!stepId || entry.stepId === stepId)) {
          historyStepOrder.splice(index, 1);
          return;
        }
      }
    }

    function clearHistoryStepOrderForSource(source) {
      for (let index = historyStepOrder.length - 1; index >= 0; index -= 1) {
        const entry = typeof historyStepOrder[index] === "string"
          ? { source: historyStepOrder[index], stepId: null }
          : historyStepOrder[index];
        if (entry.source === source) {
          historyStepOrder.splice(index, 1);
        }
      }
    }

    function getLatestUndoSource() {
      for (let index = historyStepOrder.length - 1; index >= 0; index -= 1) {
        const entry = typeof historyStepOrder[index] === "string"
          ? { source: historyStepOrder[index], stepId: null }
          : historyStepOrder[index];
        const source = entry.source;
        if (source === HISTORY_SOURCE_QUICK && quickActionHistory.hasSession()) {
          return quickActionHistory.hasUndoableStep() ? source : null;
        }
        if (source === HISTORY_SOURCE_MAIN && actionHistory.hasSession()) {
          return actionHistory.hasUndoableStep() ? source : null;
        }
      }
      if (quickActionHistory.hasUndoableStep()) return HISTORY_SOURCE_QUICK;
      if (actionHistory.hasUndoableStep()) return HISTORY_SOURCE_MAIN;
      return null;
    }

    function recordQuickTradeCompletion(tradeId, player, beforeState) {
      const trade = context.quickTrades?.getTradeAction?.(tradeId);
      if (!trade || !beforeState) return;
      beginQuickActionStep("quick-trade", `快速交易：${trade.label}`);
      recordQuickHistoryCommand(historyCommands.createRestoreTradeStateCommand(player, context.cardState, beforeState));
      completeQuickActionStep();
    }

    function recordAtomicActionHistory(actionType, label, result, options = {}) {
      startPendingActionSession(actionType, label, options);
      recordAbilityCommands(result);
      completePendingActionStep();
    }

    function startCardEffectFlow(chainId, label, effects, options = {}) {
      clearCompletedEffectFlowForUndo(options.historySource || HISTORY_SOURCE_MAIN);
      const deferredEndEffects = Array.isArray(options.deferredEndEffects)
        ? options.deferredEndEffects.filter(Boolean)
        : [];
      const initialEffects = effects?.length ? effects : deferredEndEffects;
      const remainingDeferredEndEffects = effects?.length ? deferredEndEffects : [];
      if (!initialEffects.length) return false;

      const normalizedEffects = cardEffects.consolidateCardMoveEffects?.(initialEffects) || initialEffects;
      pendingState.actionEffectFlow = abilities.chain.startAbilityChain(chainId, label, normalizedEffects);
      pendingState.actionEffectFlow.actionType = options.actionType || "playCard";
      pendingState.actionEffectFlow.playerId = getCurrentPlayer()?.id || null;
      assignEffectFlowOwner(pendingState.actionEffectFlow, pendingState.actionEffectFlow.playerId);
      pendingState.actionEffectFlow.scanRunId = options.scanRunId || null;
      pendingState.actionEffectFlow.card = options.card || null;
      pendingState.actionEffectFlow.cardTemporaryTasks = options.temporaryTasks || [];
      pendingState.actionEffectFlow.playCardEvent = options.playCardEvent || null;
      pendingState.actionEffectFlow.industryPlayedCard = options.industryPlayedCard || options.card || null;
      pendingState.actionEffectFlow.futureSpanPlayedCard = Boolean(
        options.futureSpanPlayedCard,
      );
      pendingState.actionEffectFlow.historySource = options.historySource || HISTORY_SOURCE_MAIN;
      pendingState.actionEffectFlow.consumesMainAction = options.consumesMainAction !== false;
      pendingState.actionEffectFlow.deferredEndEffects = remainingDeferredEndEffects.map((effect) => ({
        ...effect,
        options: { ...(effect.options || {}) },
        status: "pending",
      }));
      pendingState.actionEffectFlow.delayedPublicRefills = (options.delayedPublicRefills || [])
        .filter(Boolean)
        .map((item) => ({ ...item }));
      pendingState.actionEffectFlow.deferredEndEffectsFlushed = !pendingState.actionEffectFlow.deferredEndEffects.length;
      pendingState.actionEffectFlow.preHistoryCommands = Array.isArray(options.preHistoryCommands)
        ? options.preHistoryCommands
        : [];
      pendingState.actionEffectFlow.preHistoryCommandsApplied = false;
      pendingState.actionEffectFlow.resumePendingActionExecuted = Boolean(
        actionHistory.isActionComplete?.()
        || (
          pendingState.actionEffectFlow.historySource === HISTORY_SOURCE_QUICK
          && actionHistory.hasSession()
        ),
      );
      if (pendingState.actionEffectFlow.historySource === HISTORY_SOURCE_QUICK && !quickActionHistory.hasSession()) {
        quickActionHistory.beginSession("quick", "快速行动");
      }

      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      renderReservedCardsFromTaskState();
      rocketState.statusNote = `${label}：请依次点击效果`;
      if (options.activate !== false) {
        activateNextActionEffect();
      }
      return true;
    }

    function startPlayCardEffectFlow(chainId, label, effects, options = {}) {
      const immediatePlayCardEvent = options.immediatePlayCardEvent || null;
      const started = startCardEffectFlow(chainId, label, effects, {
        ...options,
        immediatePlayCardEvent: undefined,
        activate: false,
      });
      if (!started) return false;
      if (immediatePlayCardEvent) {
        settleCardTasksAfterEffect({ events: [immediatePlayCardEvent], render: false });
      }
      if (!hasActiveCardTriggerResolution() && !isCardTriggerRewardFlowBusy()) {
        activateNextActionEffectIfIdle();
      }
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
      return true;
    }

    function beginEffectHistoryStep(label, meta = {}) {
      const source = meta.source || getEffectHistorySource();
      const history = ensureEffectHistorySession(
        source,
        pendingState.actionEffectFlow?.actionType || "effect",
        pendingState.actionEffectFlow?.label || label || "效果",
      );
      if (!history.hasSession() || uiRuntimeState.effectStepActive) return;
      const current = getCurrentActionEffect();
      const hasEffectIndex = Object.prototype.hasOwnProperty.call(meta, "effectIndex");
      const hasEffectId = Object.prototype.hasOwnProperty.call(meta, "effectId");
      history.beginStep({
        source,
        type: "effect",
        label: label || current?.label || "效果",
        effectId: hasEffectId ? meta.effectId : current?.id || null,
        effectIndex: hasEffectIndex ? meta.effectIndex : pendingState.actionEffectFlow?.currentIndex ?? null,
        effectType: meta.effectType ?? current?.type ?? null,
        logBefore: meta.logBefore || createActionLogImpactSnapshot(),
        ...meta,
      });
      uiRuntimeState.effectStepActive = true;
      if (current && !current.preHistoryCommandsApplied && current.preHistoryCommands?.length) {
        for (const command of current.preHistoryCommands) {
          history.record(command);
        }
        current.preHistoryCommandsApplied = true;
      }
      if (
        pendingState.actionEffectFlow
        && !pendingState.actionEffectFlow.preHistoryCommandsApplied
        && pendingState.actionEffectFlow.preHistoryCommands?.length
      ) {
        for (const command of pendingState.actionEffectFlow.preHistoryCommands) {
          history.record(command);
        }
        pendingState.actionEffectFlow.preHistoryCommandsApplied = true;
      }
    }

    function endEffectHistoryStep(options = {}) {
      if (!uiRuntimeState.effectStepActive) return null;
      const currentEffect = options.effect || getCurrentActionEffect();
      const effectResult = options.result || currentEffect?.result || null;
      const source = getEffectHistorySource();
      const history = getHistoryForSource(source);
      const step = history.endStep();
      if (step) {
        const irreversibleReason = getIrreversibleReason(
          effectResult,
          currentEffect?.label || step.label,
        ) || (currentEffect?.undoable === false ? (currentEffect?.label || step.label) : null);
        if (irreversibleReason) {
          step.undoable = false;
          step.irreversibleCode = effectResult?.irreversible?.code || "irreversible_effect";
          step.irreversibleReason = irreversibleReason;
          markCurrentActionIrreversibleForSource(source, irreversibleReason, step.irreversibleCode);
        }
        rememberHistoryStep(source, step.id);
        const logOptions = actionLogOptionsFromHistoryStep(step);
        const briefing = createActionBriefingStepMetadata(effectResult);
        if (briefing) logOptions.briefing = briefing;
        appendActionLogStep(
          source,
          step.label,
          composeActionLogDetailWithImpact(effectResult?.message || null, step),
          logOptions,
        );
      }
      uiRuntimeState.effectStepActive = false;
      return step;
    }

    function recordIrreversibleEffectStep(effect, reason, code = "irreversible_effect") {
      const source = getEffectHistorySource();
      const history = ensureEffectHistorySession(
        source,
        pendingState.actionEffectFlow?.actionType || "effect",
        pendingState.actionEffectFlow?.label || effect?.label || "效果",
      );
      if (!history.hasSession()) {
        markCurrentActionIrreversibleForSource(source, reason, code);
        return null;
      }
      history.beginStep({
        source,
        type: "irreversible",
        label: effect?.label || "不可撤销效果",
        effectId: effect?.id || null,
        effectIndex: pendingState.actionEffectFlow?.currentIndex ?? null,
        effectType: effect?.type || null,
        undoable: false,
        irreversibleCode: code,
        irreversibleReason: reason || "该步骤产生不可撤销影响",
      });
      const step = history.endStep();
      if (step) {
        rememberHistoryStep(source, step.id);
        appendActionLogStep(
          source,
          step.label,
          effect?.result?.message || reason,
          actionLogOptionsFromHistoryStep(step),
        );
      }
      markCurrentActionIrreversibleForSource(source, reason, code);
      return step;
    }

    function getCurrentActionEffect() {
      return abilities.chain.getCurrentChainNode(pendingState.actionEffectFlow);
    }

    function activateNextActionEffect() {
      if (!pendingState.actionEffectFlow) return;

      const next = abilities.chain.activateNext
        ? abilities.chain.activateNext(pendingState.actionEffectFlow)
        : null;
      if (!next) {
        finishActionEffectFlow();
        return;
      }
      setActiveEffectFlowOwner(next);
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }

    function activateNextActionEffectIfIdle() {
      if (!pendingState.actionEffectFlow || pendingState.actionEffectFlow.completed) return false;
      const next = abilities.chain.activateNextIfIdle
        ? abilities.chain.activateNextIfIdle(pendingState.actionEffectFlow)
        : (() => {
          const current = getCurrentActionEffect();
          if (current?.status === "active") return null;
          return abilities.chain.activateNext ? abilities.chain.activateNext(pendingState.actionEffectFlow) : null;
        })();
      if (!next) return false;
      setActiveEffectFlowOwner(next);
      return true;
    }

    function completeCurrentActionEffect(status = "completed") {
      if (!pendingState.actionEffectFlow) return;

      const current = getCurrentActionEffect();
      if (!current || current.status !== "active") return;

      cancelActiveEffectSubFlows();
      const hadHistoryStep = uiRuntimeState.effectStepActive;
      const effectEvents = status !== "skipped" ? (current.result?.events || []) : [];
      const deferredType1Events = status !== "skipped" ? (current.result?.deferredType1Events || []) : [];
      const irreversibleReason = status !== "skipped"
        ? (
          getIrreversibleReason(current.result, current.label)
          || (current.undoable === false ? current.label : null)
        )
        : null;
      endEffectHistoryStep();
      if (!hadHistoryStep && irreversibleReason) {
        recordIrreversibleEffectStep(
          current,
          irreversibleReason,
          current.result?.irreversible?.code || "irreversible_effect",
        );
      } else if (!hadHistoryStep && status !== "skipped") {
        const briefing = createActionBriefingStepMetadata(current.result);
        appendActionLogStep(
          getEffectHistorySource(),
          current.label,
          current.result?.message || null,
          briefing ? { briefing } : {},
        );
      }
      let chainTransition = null;
      if (status === "skipped") {
        chainTransition = abilities.chain.skipCurrentChainNode(pendingState.actionEffectFlow);
      } else {
        if (irreversibleReason) {
          markCurrentActionIrreversible(
            irreversibleReason,
            current.result?.irreversible?.code || "irreversible_effect",
          );
        }
        chainTransition = abilities.chain.resolveCurrentChainNode(pendingState.actionEffectFlow, current.result || {});
      }
      if (chainTransition?.next) setActiveEffectFlowOwner(chainTransition.next);
      renderActionEffectBar();

      const flowCompleted = pendingState.actionEffectFlow?.completed;
      if (flowCompleted) {
        settleCardTasksAfterEffect({ events: effectEvents, render: false });
        if (deferredType1Events.length) {
          settleCardTasksAfterEffect({ events: deferredType1Events, type1Only: true, render: false });
        }
        if (!hasActiveCardTriggerResolution()) {
          activateNextActionEffectIfIdle();
        }
        if (
          (pendingState.actionEffectFlow && !pendingState.actionEffectFlow.completed)
          || hasActiveCardTriggerResolution()
        ) {
          renderActionEffectBar();
          updateActionButtons();
          renderStateReadout();
          return;
        }
        finishActionEffectFlow();
        return;
      }
      settleCardTasksAfterEffect({ events: effectEvents, render: true });
      if (deferredType1Events.length) {
        settleCardTasksAfterEffect({ events: deferredType1Events, type1Only: true, render: true });
      }
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
      maybeAutoExecuteAomomoRewardEffects();
    }

    function executeActionEffect(effect) {
      if (!effect || effect.status !== "active") return { ok: false, message: "当前效果不可执行" };
      return withEffectExecutionPlayer(effect, () => executeActionEffectForOwner(effect));
    }

    return {
      getEffectHistorySource,
      shouldIrreversibleBlockCurrentMainAction,
      markCurrentActionIrreversibleForSource,
      getHistoryForSource,
      getActiveEffectHistory,
      ensureEffectHistorySession,
      recordHistoryCommand,
      recordQuickHistoryCommand,
      recordAbilityCommands,
      startPendingActionSession,
      beginQuickActionStep,
      completePendingActionStep,
      completeQuickActionStep,
      rememberHistoryStep,
      forgetLastHistoryStep,
      clearHistoryStepOrderForSource,
      getLatestUndoSource,
      recordQuickTradeCompletion,
      recordAtomicActionHistory,
      startCardEffectFlow,
      startPlayCardEffectFlow,
      beginEffectHistoryStep,
      endEffectHistoryStep,
      recordIrreversibleEffectStep,
      getCurrentActionEffect,
      activateNextActionEffect,
      activateNextActionEffectIfIdle,
      completeCurrentActionEffect,
      executeActionEffect,
    };
  }

  return {
    createEffectFlowHelpers,
  };
});
