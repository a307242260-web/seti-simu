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
    const uiRuntimeState = context.uiRuntimeState || {};
    const actionHistory = context.actionHistory || {};
    const quickActionHistory = context.quickActionHistory || {};
    const historyStepOrder = context.historyStepOrder || [];
    const els = context.els || {};
    const abilities = context.abilities || {};
    const historyCommands = context.historyCommands || {};
    const cardEffects = context.cardEffects || {};

    const HISTORY_SOURCE_MAIN = context.HISTORY_SOURCE_MAIN || "main";
    const HISTORY_SOURCE_QUICK = context.HISTORY_SOURCE_QUICK || "quick";
    const ACTION_LOG_DEFAULT_LABELS = context.ACTION_LOG_DEFAULT_LABELS || { quick: "快速行动" };

    const getCurrentPlayer = requireFunction("getCurrentPlayer", context.getCurrentPlayer);
    const getCurrentPlayerForRoot = requireFunction(
      "getCurrentPlayerForRoot",
      context.getCurrentPlayerForRoot,
    );
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
    const renderReservedCards = requireFunction(
      "renderReservedCards",
      context.renderReservedCards,
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
      return decisionState.actionEffectFlow?.historySource || HISTORY_SOURCE_MAIN;
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

    function recordQuickTradeCompletion(tradeId, player, beforeState, options = {}) {
      const trade = context.quickTrades?.getTradeAction?.(tradeId);
      if (!trade || !beforeState) return;
      if (!options.workingRoot?.cardState) {
        throw new TypeError("recordQuickTradeCompletion 缺少 workingRoot");
      }
      beginQuickActionStep("quick-trade", `快速交易：${trade.label}`);
      recordQuickHistoryCommand(historyCommands.createRestoreTradeStateCommand(
        player,
        options.workingRoot.cardState,
        beforeState,
      ));
      completeQuickActionStep();
    }

    function recordAtomicActionHistory(actionType, label, result, options = {}) {
      startPendingActionSession(actionType, label, options);
      recordAbilityCommands(result);
      completePendingActionStep();
    }

    function startCardEffectFlow(chainId, label, effects, options = {}) {
      const workingRoot = options.workingRoot;
      if (!workingRoot?.playerState || !workingRoot?.rocketState) {
        throw new TypeError("startCardEffectFlow 缺少 workingRoot");
      }
      clearCompletedEffectFlowForUndo(options.historySource || HISTORY_SOURCE_MAIN);
      const deferredEndEffects = Array.isArray(options.deferredEndEffects)
        ? options.deferredEndEffects.filter(Boolean)
        : [];
      const initialEffects = effects?.length ? effects : deferredEndEffects;
      const remainingDeferredEndEffects = effects?.length ? deferredEndEffects : [];
      if (!initialEffects.length) return false;

      const normalizedEffects = cardEffects.consolidateCardMoveEffects?.(initialEffects) || initialEffects;
      decisionState.actionEffectFlow = abilities.chain.startAbilityChain(chainId, label, normalizedEffects);
      decisionState.actionEffectFlow.actionType = options.actionType || "playCard";
      decisionState.actionEffectFlow.playerId = getCurrentPlayerForRoot(workingRoot)?.id || null;
      assignEffectFlowOwner(decisionState.actionEffectFlow, decisionState.actionEffectFlow.playerId);
      decisionState.actionEffectFlow.scanRunId = options.scanRunId || null;
      decisionState.actionEffectFlow.card = options.card || null;
      decisionState.actionEffectFlow.cardTemporaryTasks = options.temporaryTasks || [];
      decisionState.actionEffectFlow.playCardEvent = options.playCardEvent || null;
      decisionState.actionEffectFlow.industryPlayedCard = options.industryPlayedCard || options.card || null;
      decisionState.actionEffectFlow.futureSpanPlayedCard = Boolean(
        options.futureSpanPlayedCard,
      );
      decisionState.actionEffectFlow.historySource = options.historySource || HISTORY_SOURCE_MAIN;
      decisionState.actionEffectFlow.consumesMainAction = options.consumesMainAction !== false;
      decisionState.actionEffectFlow.deferredEndEffects = remainingDeferredEndEffects.map((effect) => ({
        ...effect,
        options: { ...(effect.options || {}) },
        status: "pending",
      }));
      decisionState.actionEffectFlow.delayedPublicRefills = (options.delayedPublicRefills || [])
        .filter(Boolean)
        .map((item) => ({ ...item }));
      decisionState.actionEffectFlow.deferredEndEffectsFlushed = !decisionState.actionEffectFlow.deferredEndEffects.length;
      decisionState.actionEffectFlow.preHistoryCommands = Array.isArray(options.preHistoryCommands)
        ? options.preHistoryCommands
        : [];
      decisionState.actionEffectFlow.preHistoryCommandsApplied = false;
      decisionState.actionEffectFlow.resumePendingActionExecuted = Boolean(
        actionHistory.isActionComplete?.()
        || (
          decisionState.actionEffectFlow.historySource === HISTORY_SOURCE_QUICK
          && actionHistory.hasSession()
        ),
      );
      if (decisionState.actionEffectFlow.historySource === HISTORY_SOURCE_QUICK && !quickActionHistory.hasSession()) {
        quickActionHistory.beginSession("quick", "快速行动");
      }

      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      renderReservedCards();
      workingRoot.rocketState.statusNote = `${label}：请依次点击效果`;
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
        decisionState.actionEffectFlow?.actionType || "effect",
        decisionState.actionEffectFlow?.label || label || "效果",
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
        effectIndex: hasEffectIndex ? meta.effectIndex : decisionState.actionEffectFlow?.currentIndex ?? null,
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
        decisionState.actionEffectFlow
        && !decisionState.actionEffectFlow.preHistoryCommandsApplied
        && decisionState.actionEffectFlow.preHistoryCommands?.length
      ) {
        for (const command of decisionState.actionEffectFlow.preHistoryCommands) {
          history.record(command);
        }
        decisionState.actionEffectFlow.preHistoryCommandsApplied = true;
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
        decisionState.actionEffectFlow?.actionType || "effect",
        decisionState.actionEffectFlow?.label || effect?.label || "效果",
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
        effectIndex: decisionState.actionEffectFlow?.currentIndex ?? null,
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
      return abilities.chain.getCurrentChainNode(decisionState.actionEffectFlow);
    }

    function activateNextActionEffect() {
      if (!decisionState.actionEffectFlow) return;

      const next = abilities.chain.activateNext
        ? abilities.chain.activateNext(decisionState.actionEffectFlow)
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
      if (!decisionState.actionEffectFlow || decisionState.actionEffectFlow.completed) return false;
      const next = abilities.chain.activateNextIfIdle
        ? abilities.chain.activateNextIfIdle(decisionState.actionEffectFlow)
        : (() => {
          const current = getCurrentActionEffect();
          if (current?.status === "active") return null;
          return abilities.chain.activateNext ? abilities.chain.activateNext(decisionState.actionEffectFlow) : null;
        })();
      if (!next) return false;
      setActiveEffectFlowOwner(next);
      return true;
    }

    function completeCurrentActionEffect(status = "completed") {
      if (!decisionState.actionEffectFlow) return;

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
        chainTransition = abilities.chain.skipCurrentChainNode(decisionState.actionEffectFlow);
      } else {
        if (irreversibleReason) {
          markCurrentActionIrreversible(
            irreversibleReason,
            current.result?.irreversible?.code || "irreversible_effect",
          );
        }
        chainTransition = abilities.chain.resolveCurrentChainNode(decisionState.actionEffectFlow, current.result || {});
      }
      if (chainTransition?.next) setActiveEffectFlowOwner(chainTransition.next);
      renderActionEffectBar();

      const flowCompleted = decisionState.actionEffectFlow?.completed;
      if (flowCompleted) {
        settleCardTasksAfterEffect({ events: effectEvents, render: false });
        if (deferredType1Events.length) {
          settleCardTasksAfterEffect({ events: deferredType1Events, type1Only: true, render: false });
        }
        if (!hasActiveCardTriggerResolution()) {
          activateNextActionEffectIfIdle();
        }
        if (
          (decisionState.actionEffectFlow && !decisionState.actionEffectFlow.completed)
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
