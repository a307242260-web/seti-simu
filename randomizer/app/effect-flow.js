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
    function getActionEffectFlow(workingRoot) {
      if (!workingRoot?.match) throw new TypeError("effect-flow operation requires explicit workingRoot.match");
      return workingRoot.match.actionEffectFlow || null;
    }

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

    function getEffectHistorySource(workingRoot) {
      return getActionEffectFlow(workingRoot)?.historySource || HISTORY_SOURCE_MAIN;
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

    function getActiveEffectHistory(workingRoot) {
      if (uiRuntimeState.effectStepActive) return getHistoryForSource(getEffectHistorySource(workingRoot));
      return actionHistory;
    }

    function ensureEffectHistorySession(source, actionType, label) {
      const history = getHistoryForSource(source);
      if (!history.hasSession()) {
        history.beginSession(source === HISTORY_SOURCE_QUICK ? "quick" : actionType, label || "效果");
      }
      return history;
    }

    function recordHistoryCommand(workingRoot, command) {
      const history = getActiveEffectHistory(workingRoot);
      if (!history.hasSession()) return;
      history.record(command);
    }

    function recordQuickHistoryCommand(command) {
      if (!quickActionHistory.hasSession()) return;
      quickActionHistory.record(command);
    }

    function recordAbilityCommands(workingRoot, result, history = actionHistory) {
      if (!workingRoot?.turnState) {
        throw new TypeError("recordAbilityCommands 缺少 workingRoot");
      }
      if (!result) return;
      const commands = [];
      const turnVisitCommand = recordTurnVisitPlanetEvents(workingRoot, result.events);
      if (turnVisitCommand) commands.push(turnVisitCommand);
      recordNeutralScoreTracesFromAbilityResult(workingRoot, result, history);
      commands.push(...(result.commands || []));
      if (commands.length) {
        for (const command of commands) {
          if (history === quickActionHistory) {
            recordQuickHistoryCommand(command);
          } else {
            recordHistoryCommand(workingRoot, command);
          }
        }
      }
      delete result.commands;
      recordScanScoreSourcesFromAbilityResult(workingRoot, result, history);
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

    function completePendingActionStep(workingRoot) {
      endEffectHistoryStep(workingRoot);
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
      recordAbilityCommands(options.workingRoot, result);
      completePendingActionStep(options.workingRoot);
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
      workingRoot.match.actionEffectFlow = abilities.chain.startAbilityChain(chainId, label, normalizedEffects);
      const flow = getActionEffectFlow(workingRoot);
      flow.actionType = options.actionType || "playCard";
      flow.playerId = getCurrentPlayerForRoot(workingRoot)?.id || null;
      assignEffectFlowOwner(flow, flow.playerId);
      getActionEffectFlow(workingRoot).scanRunId = options.scanRunId || null;
      getActionEffectFlow(workingRoot).card = options.card || null;
      getActionEffectFlow(workingRoot).cardTemporaryTasks = options.temporaryTasks || [];
      getActionEffectFlow(workingRoot).playCardEvent = options.playCardEvent || null;
      getActionEffectFlow(workingRoot).industryPlayedCard = options.industryPlayedCard || options.card || null;
      getActionEffectFlow(workingRoot).futureSpanPlayedCard = Boolean(
        options.futureSpanPlayedCard,
      );
      getActionEffectFlow(workingRoot).historySource = options.historySource || HISTORY_SOURCE_MAIN;
      getActionEffectFlow(workingRoot).consumesMainAction = options.consumesMainAction !== false;
      getActionEffectFlow(workingRoot).deferredEndEffects = remainingDeferredEndEffects.map((effect) => ({
        ...effect,
        options: { ...(effect.options || {}) },
        status: "pending",
      }));
      getActionEffectFlow(workingRoot).delayedPublicRefills = (options.delayedPublicRefills || [])
        .filter(Boolean)
        .map((item) => ({ ...item }));
      getActionEffectFlow(workingRoot).deferredEndEffectsFlushed = !getActionEffectFlow(workingRoot).deferredEndEffects.length;
      getActionEffectFlow(workingRoot).preHistoryCommands = Array.isArray(options.preHistoryCommands)
        ? options.preHistoryCommands
        : [];
      getActionEffectFlow(workingRoot).preHistoryCommandsApplied = false;
      getActionEffectFlow(workingRoot).resumePendingActionExecuted = Boolean(
        actionHistory.isActionComplete?.()
        || (
          getActionEffectFlow(workingRoot).historySource === HISTORY_SOURCE_QUICK
          && actionHistory.hasSession()
        ),
      );
      if (getActionEffectFlow(workingRoot).historySource === HISTORY_SOURCE_QUICK && !quickActionHistory.hasSession()) {
        quickActionHistory.beginSession("quick", "快速行动");
      }

      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      renderReservedCards();
      workingRoot.rocketState.statusNote = `${label}：请依次点击效果`;
      if (options.activate !== false) {
        activateNextActionEffect(workingRoot);
      }
      return true;
    }

    function startPlayCardEffectFlow(chainId, label, effects, options = {}) {
      const workingRoot = options.workingRoot;
      const immediatePlayCardEvent = options.immediatePlayCardEvent || null;
      const started = startCardEffectFlow(chainId, label, effects, {
        ...options,
        immediatePlayCardEvent: undefined,
        activate: false,
      });
      if (!started) return false;
      if (immediatePlayCardEvent) {
        settleCardTasksAfterEffect(workingRoot, { events: [immediatePlayCardEvent], render: false });
      }
      if (!hasActiveCardTriggerResolution(workingRoot) && !isCardTriggerRewardFlowBusy(workingRoot)) {
        activateNextActionEffectIfIdle(workingRoot);
      }
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
      return true;
    }

    function beginEffectHistoryStep(workingRoot, label, meta = {}) {
      const source = meta.source || getEffectHistorySource(workingRoot);
      const history = ensureEffectHistorySession(
        source,
        getActionEffectFlow(workingRoot)?.actionType || "effect",
        getActionEffectFlow(workingRoot)?.label || label || "效果",
      );
      if (!history.hasSession() || uiRuntimeState.effectStepActive) return;
      const current = getCurrentActionEffect(workingRoot);
      const hasEffectIndex = Object.prototype.hasOwnProperty.call(meta, "effectIndex");
      const hasEffectId = Object.prototype.hasOwnProperty.call(meta, "effectId");
      history.beginStep({
        source,
        type: "effect",
        label: label || current?.label || "效果",
        effectId: hasEffectId ? meta.effectId : current?.id || null,
        effectIndex: hasEffectIndex ? meta.effectIndex : getActionEffectFlow(workingRoot)?.currentIndex ?? null,
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
        getActionEffectFlow(workingRoot)
        && !getActionEffectFlow(workingRoot).preHistoryCommandsApplied
        && getActionEffectFlow(workingRoot).preHistoryCommands?.length
      ) {
        for (const command of getActionEffectFlow(workingRoot).preHistoryCommands) {
          history.record(command);
        }
        getActionEffectFlow(workingRoot).preHistoryCommandsApplied = true;
      }
    }

    function endEffectHistoryStep(workingRoot, options = {}) {
      if (!uiRuntimeState.effectStepActive) return null;
      const currentEffect = options.effect || getCurrentActionEffect(workingRoot);
      const effectResult = options.result || currentEffect?.result || null;
      const source = getEffectHistorySource(workingRoot);
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

    function recordIrreversibleEffectStep(workingRoot, effect, reason, code = "irreversible_effect") {
      const source = getEffectHistorySource(workingRoot);
      const history = ensureEffectHistorySession(
        source,
        getActionEffectFlow(workingRoot)?.actionType || "effect",
        getActionEffectFlow(workingRoot)?.label || effect?.label || "效果",
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
        effectIndex: getActionEffectFlow(workingRoot)?.currentIndex ?? null,
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

    function getCurrentActionEffect(workingRoot) {
      return abilities.chain.getCurrentChainNode(getActionEffectFlow(workingRoot));
    }

    function activateNextActionEffect(workingRoot) {
      if (!getActionEffectFlow(workingRoot)) return;

      const next = abilities.chain.activateNext
        ? abilities.chain.activateNext(getActionEffectFlow(workingRoot))
        : null;
      if (!next) {
        finishActionEffectFlow(workingRoot);
        return;
      }
      setActiveEffectFlowOwner(workingRoot, next);
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }

    function activateNextActionEffectIfIdle(workingRoot) {
      if (!getActionEffectFlow(workingRoot) || getActionEffectFlow(workingRoot).completed) return false;
      const next = abilities.chain.activateNextIfIdle
        ? abilities.chain.activateNextIfIdle(getActionEffectFlow(workingRoot))
        : (() => {
          const current = getCurrentActionEffect(workingRoot);
          if (current?.status === "active") return null;
          return abilities.chain.activateNext ? abilities.chain.activateNext(getActionEffectFlow(workingRoot)) : null;
        })();
      if (!next) return false;
      setActiveEffectFlowOwner(workingRoot, next);
      return true;
    }

    function completeCurrentActionEffect(workingRoot, status = "completed") {
      if (!getActionEffectFlow(workingRoot)) return;

      const current = getCurrentActionEffect(workingRoot);
      if (!current || current.status !== "active") return;

      cancelActiveEffectSubFlows(workingRoot);
      const hadHistoryStep = uiRuntimeState.effectStepActive;
      const effectEvents = status !== "skipped" ? (current.result?.events || []) : [];
      const deferredType1Events = status !== "skipped" ? (current.result?.deferredType1Events || []) : [];
      const irreversibleReason = status !== "skipped"
        ? (
          getIrreversibleReason(current.result, current.label)
          || (current.undoable === false ? current.label : null)
        )
        : null;
      endEffectHistoryStep(workingRoot);
      if (!hadHistoryStep && irreversibleReason) {
        recordIrreversibleEffectStep(
          workingRoot,
          current,
          irreversibleReason,
          current.result?.irreversible?.code || "irreversible_effect",
        );
      } else if (!hadHistoryStep && status !== "skipped") {
        const briefing = createActionBriefingStepMetadata(current.result);
        appendActionLogStep(
          getEffectHistorySource(workingRoot),
          current.label,
          current.result?.message || null,
          briefing ? { briefing } : {},
        );
      }
      let chainTransition = null;
      if (status === "skipped") {
        chainTransition = abilities.chain.skipCurrentChainNode(getActionEffectFlow(workingRoot));
      } else {
        if (irreversibleReason) {
          markCurrentActionIrreversible(
            irreversibleReason,
            current.result?.irreversible?.code || "irreversible_effect",
          );
        }
        chainTransition = abilities.chain.resolveCurrentChainNode(getActionEffectFlow(workingRoot), current.result || {});
      }
      if (chainTransition?.next) setActiveEffectFlowOwner(workingRoot, chainTransition.next);
      renderActionEffectBar();

      const flowCompleted = getActionEffectFlow(workingRoot)?.completed;
      if (flowCompleted) {
        settleCardTasksAfterEffect(workingRoot, { events: effectEvents, render: false });
        if (deferredType1Events.length) {
          settleCardTasksAfterEffect(workingRoot, { events: deferredType1Events, type1Only: true, render: false });
        }
        if (!hasActiveCardTriggerResolution(workingRoot)) {
          activateNextActionEffectIfIdle(workingRoot);
        }
        if (
          (getActionEffectFlow(workingRoot) && !getActionEffectFlow(workingRoot).completed)
          || hasActiveCardTriggerResolution(workingRoot)
        ) {
          renderActionEffectBar();
          updateActionButtons();
          renderStateReadout();
          return;
        }
        finishActionEffectFlow(workingRoot);
        return;
      }
      settleCardTasksAfterEffect(workingRoot, { events: effectEvents, render: true });
      if (deferredType1Events.length) {
        settleCardTasksAfterEffect(workingRoot, { events: deferredType1Events, type1Only: true, render: true });
      }
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
      maybeAutoExecuteAomomoRewardEffects(workingRoot);
    }

    function executeActionEffect(workingRoot, effect) {
      if (!effect || effect.status !== "active") return { ok: false, message: "当前效果不可执行" };
      return withEffectExecutionPlayer(
        workingRoot,
        effect,
        () => executeActionEffectForOwner(workingRoot, effect),
      );
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

  function createActionEffectOrchestrator(context = {}) {
    const {
      HISTORY_SOURCE_MAIN,
      abilities,
      actionHistory,
      aomomo,
      industry,
      interactionChrome,
      planetRewards,
      players,
      uiRuntimeState,
    } = context;
    const required = [
      "activateNextActionEffect", "addScoreSourceToEffects", "assignEffectFlowOwner",
      "claimRunezuSourceSymbolWithHistory", "endEffectHistoryStep", "executeActionEffect",
      "getActionEffectFlow", "getCurrentActionEffect", "getCurrentPlayer",
      "hasActiveEffectSubFlow", "recordAbilityCommands", "renderRunezuBoardSymbols",
      "setActionEffectFlow", "startActionLogDraft",
    ];
    for (const name of required) requireFunction(name, context[name]);

    function getActionResultOwnerPlayer(workingRoot, result, fallbackPlayer = null) {
      const ownerEvent = (result?.events || []).find((event) => event?.playerId || event?.playerColor) || null;
      const playerId = result?.playerId || result?.payload?.playerId || ownerEvent?.playerId || null;
      const playerColor = result?.playerColor || result?.payload?.playerColor || ownerEvent?.playerColor || null;
      return (workingRoot.playerState.players || []).find((player) => (
        (playerId && player.id === playerId) || (playerColor && player.color === playerColor)
      )) || fallbackPlayer || players.getCurrentPlayer(workingRoot.playerState);
    }

    function buildPlanetRewardEffectsWithIndustry(actionType, result, options = {}) {
      const planetEffects = planetRewards?.buildRewardEffectsForAction?.(actionType, result) || [];
      const scoredPlanetEffects = options.scoreSourceKey
        ? context.addScoreSourceToEffects(planetEffects, options.scoreSourceKey)
        : planetEffects;
      const player = options.player || context.getCurrentPlayer();
      return [
        ...scoredPlanetEffects,
        ...(industry?.buildPiratesRaidMarkerEffectNodes?.(player, result?.planetId, actionType, result) || []),
      ];
    }

    function claimRunezuPlanetSymbolForTravelResult(workingRoot, actionType, result, fallbackPlayer = null) {
      if (actionType !== "orbit" && actionType !== "land") return null;
      const planetId = result?.planetId || result?.payload?.planetId || null;
      if (!planetId) return null;
      const actionLabel = actionType === "orbit" ? "环绕" : "登陆";
      const claim = context.claimRunezuSourceSymbolWithHistory(
        "planet",
        planetId,
        getActionResultOwnerPlayer(workingRoot, result, fallbackPlayer),
        `${actionLabel}获得符文族symbol`,
      );
      if (claim?.ok) {
        result.message = `${result.message || actionLabel}；${claim.message}`;
        result.runezuSymbolClaim = claim;
        if (result.payload && typeof result.payload === "object") {
          result.payload.runezuSymbolClaim = {
            sourceType: claim.sourceType,
            sourceId: claim.sourceId,
            symbolId: claim.symbolId,
          };
        }
      }
      return claim;
    }

    function startPlanetRewardEffectFlow(workingRoot, actionType, result) {
      if (!workingRoot?.playerState || !workingRoot?.rocketState) {
        throw new TypeError("startPlanetRewardEffectFlow 缺少 workingRoot");
      }
      const actionOwner = getActionResultOwnerPlayer(workingRoot, result);
      const rewardEffects = buildPlanetRewardEffectsWithIndustry(actionType, result, { player: actionOwner });
      if (!rewardEffects.length) return false;

      const actionLabel = actionType === "orbit" ? "环绕" : "登陆";
      const isAomomoRewardFlow = result?.planetId === (aomomo?.PLANET_ID || "aomomo");
      context.startActionLogDraft(actionType, `${actionLabel}行动`, { source: HISTORY_SOURCE_MAIN });
      actionHistory.beginSession(actionType, `${actionLabel}行动`);
      actionHistory.beginStep({
        source: HISTORY_SOURCE_MAIN,
        type: "action_start",
        label: result.message || `${actionLabel}标记`,
        effectIndex: -1,
      });
      uiRuntimeState.effectStepActive = true;
      context.recordAbilityCommands(result, actionHistory, workingRoot);
      const runezuClaim = claimRunezuPlanetSymbolForTravelResult(workingRoot, actionType, result, actionOwner);
      if (runezuClaim?.ok) context.renderRunezuBoardSymbols();
      context.endEffectHistoryStep(workingRoot);

      context.setActionEffectFlow(workingRoot, abilities.chain.startAbilityChain(
        `${actionType}-rewards`,
        `${actionLabel}奖励`,
        rewardEffects,
      ));
      const flow = context.getActionEffectFlow(workingRoot);
      flow.actionType = actionType;
      flow.playerId = actionOwner?.id || null;
      context.assignEffectFlowOwner(flow, flow.playerId);
      flow.consumesMainAction = true;
      flow.autoExecuteAomomoRewards = isAomomoRewardFlow;

      interactionChrome.setActionEffectFlowActive(true);
      workingRoot.rocketState.statusNote = `${actionLabel}：请依次点击奖励效果`;
      context.activateNextActionEffect(workingRoot);
      return true;
    }

    function shouldAutoExecuteAomomoRewardEffect(workingRoot, effect) {
      return Boolean(
        context.getActionEffectFlow(workingRoot)?.autoExecuteAomomoRewards
        && effect?.status === "active"
        && context.autoRewardEffectTypes.has(effect.type)
        && !context.hasActiveEffectSubFlow()
      );
    }

    function maybeAutoExecuteAomomoRewardEffects(workingRoot) {
      if (uiRuntimeState.autoExecutingActionEffects || !context.getActionEffectFlow(workingRoot)?.autoExecuteAomomoRewards) return false;
      uiRuntimeState.autoExecutingActionEffects = true;
      let executed = false;
      try {
        for (let guard = 0; guard < 20; guard += 1) {
          const effect = context.getCurrentActionEffect(workingRoot);
          if (!shouldAutoExecuteAomomoRewardEffect(workingRoot, effect)) return executed;
          const result = context.executeActionEffect(workingRoot, effect);
          executed = true;
          if (result?.awaitingChoice || result?.pendingChoice || result?.ok === false) return executed;
          if (!context.getActionEffectFlow(workingRoot) || context.getActionEffectFlow(workingRoot).completed || context.hasActiveEffectSubFlow()) return executed;
          const current = context.getCurrentActionEffect(workingRoot);
          if (current === effect && current?.status === "active") return executed;
        }
        return executed;
      } finally {
        uiRuntimeState.autoExecutingActionEffects = false;
      }
    }

    function beginResearchTechActionSession(workingRoot, result, options = {}) {
      context.startActionLogDraft("researchTech", "科技行动", { source: HISTORY_SOURCE_MAIN });
      actionHistory.beginSession("researchTech", "科技行动");
      actionHistory.beginStep({
        source: HISTORY_SOURCE_MAIN,
        type: "action_start",
        label: "科技行动",
        effectIndex: -1,
        logBefore: options.logBefore || context.createActionLogImpactSnapshot(),
      });
      uiRuntimeState.effectStepActive = true;
      context.endEffectHistoryStep(workingRoot, {
        result: {
          ok: true,
          undoable: true,
          message: result?.message || "请选择要研究的科技板块",
        },
      });
    }

    function startResearchTechEffectFlow(workingRoot, result, options = {}) {
      if (!workingRoot?.rocketState) throw new TypeError("startResearchTechEffectFlow 缺少 workingRoot");
      if (!result?.ok || !result.awaitingTileSelection) return false;

      beginResearchTechActionSession(workingRoot, result, options);
      context.setActionEffectFlow(workingRoot, abilities.chain.startAbilityChain(
        "researchTech",
        "科技行动",
        [{
          id: "research-tech-select",
          type: "research_tech_select",
          abilityId: "researchTechSelect",
          icon: "research_tech",
          label: "选择科技片",
          options: {
            cost: result.cost || {},
            allowedTechTypes: result.allowedTechTypes || result.payload?.allowedTechTypes || null,
          },
          status: "pending",
          undoable: true,
        }],
      ));
      const flow = context.getActionEffectFlow(workingRoot);
      flow.actionType = "researchTech";
      flow.playerId = context.getCurrentPlayer()?.id || null;
      flow.historySource = HISTORY_SOURCE_MAIN;
      context.assignEffectFlowOwner(flow, flow.playerId);
      flow.consumesMainAction = true;

      interactionChrome.setActionEffectFlowActive(true);
      workingRoot.rocketState.statusNote = "科技：请选择要研究的科技片";
      context.activateNextActionEffect(workingRoot);
      return true;
    }

    return Object.freeze({
      buildPlanetRewardEffectsWithIndustry,
      getActionResultOwnerPlayer,
      claimRunezuPlanetSymbolForTravelResult,
      startPlanetRewardEffectFlow,
      maybeAutoExecuteAomomoRewardEffects,
      startResearchTechEffectFlow,
    });
  }

  function createEffectFlowUndoRuntime(context = {}) {
    const getActionEffectFlow = requireFunction("getActionEffectFlow", context.getActionEffectFlow);
    const isMainActionOpeningStep = requireFunction(
      "isMainActionOpeningStep", context.isMainActionOpeningStep,
    );
    const clearActionEffectFlow = requireFunction("clearActionEffectFlow", context.clearActionEffectFlow);
    const pruneEndOfFlowSettlementEffectsAfterUndo = requireFunction(
      "pruneEndOfFlowSettlementEffectsAfterUndo",
      context.pruneEndOfFlowSettlementEffectsAfterUndo,
    );
    const cancelActiveEffectSubFlows = requireFunction(
      "cancelActiveEffectSubFlows", context.cancelActiveEffectSubFlows,
    );

    function revertEffectFlowAfterUndo(workingRoot, step) {
      const flow = getActionEffectFlow(workingRoot);
      if (!flow || !step) return;

      if (isMainActionOpeningStep(step)) {
        if (flow.actionType === "researchTech") context.clearResearchTechSelectionState?.();
        clearActionEffectFlow(workingRoot);
        return;
      }
      if (!Number.isInteger(step.effectIndex)) return;

      const effect = flow.effects[step.effectIndex];
      if (!effect) return;
      pruneEndOfFlowSettlementEffectsAfterUndo(flow, step.effectIndex);
      context.abilities?.chain?.removeInsertedNodesBySource?.(flow, {
        chainId: flow.chainId || null,
        effectId: step.effectId || effect.id || null,
        effectIndex: step.effectIndex,
        effectType: step.effectType || effect.type || null,
      });
      flow.completed = false;
      effect.status = "active";
      effect.result = null;
      effect.preHistoryCommandsApplied = false;
      flow.currentIndex = step.effectIndex;
      for (let index = step.effectIndex + 1; index < flow.effects.length; index += 1) {
        if (flow.effects[index].status !== "pending") flow.effects[index].status = "pending";
        flow.effects[index].preHistoryCommandsApplied = false;
      }
      cancelActiveEffectSubFlows();
      if (flow.actionType === "researchTech" && effect.type === "research_tech_select") {
        context.restoreResearchTechSelectionAfterUndo?.(effect);
      }
      context.setActionEffectFlowActive?.(true);
    }

    return Object.freeze({ revertEffectFlowAfterUndo });
  }

  return {
    createActionEffectOrchestrator,
    createEffectFlowHelpers,
    createEffectFlowUndoRuntime,
  };
});
