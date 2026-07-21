"use strict";

const assert = require("node:assert/strict");
const { createEffectFlowHelpers } = require("./effect-flow");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store");
const { attachDecisionState } = require("./test-decision-state");

function createHistoryHarness() {
  let nextStepId = 1;
  return {
    session: null,
    currentStep: null,
    beginSession(type, label) {
      this.session = { type, label, steps: [] };
    },
    hasSession() {
      return Boolean(this.session);
    },
    commitSession() {
      this.session = null;
      this.currentStep = null;
    },
    rollbackSession() {
      this.session = null;
      this.currentStep = null;
      return { ok: true };
    },
    beginStep(step) {
      this.currentStep = { ...step, commands: [] };
    },
    record(command) {
      this.currentStep?.commands.push(command);
    },
    endStep() {
      if (!this.currentStep) return null;
      const step = {
        id: `step-${nextStepId += 1}`,
        undoable: true,
        ...this.currentStep,
      };
      this.session?.steps.push(step);
      this.currentStep = null;
      return step;
    },
    hasUndoableStep() {
      return Boolean(this.session?.steps?.some((step) => step.undoable !== false));
    },
  };
}

function createHarness() {
  const pendingState = {
    actionExecuted: false,
    futureSpanPlayBeforePlayer: null,
    actionEffectFlow: null,
  };
  const decisionSessions = createDecisionSessionStore();
  attachDecisionState(pendingState, decisionSessions);
  const uiRuntimeState = {
    effectStepActive: false,
  };
  const actionHistory = createHistoryHarness();
  const quickActionHistory = createHistoryHarness();
  const historyStepOrder = [];
  const calls = {
    renderBar: 0,
    updateButtons: 0,
    readout: 0,
    finish: 0,
    settled: [],
    appendLog: [],
    activeOwner: [],
    currentIrreversible: [],
    withOwner: [],
    executeOwner: [],
  };
  const abilities = {
    chain: {
      startAbilityChain(chainId, label, effects) {
        return {
          chainId,
          label,
          effects: effects.map((effect) => ({ ...effect })),
          currentIndex: -1,
          completed: false,
        };
      },
      getCurrentChainNode(flow) {
        return Number.isInteger(flow?.currentIndex) ? flow.effects[flow.currentIndex] || null : null;
      },
      activateNext(flow) {
        const nextIndex = flow.effects.findIndex((effect) => effect.status === "pending");
        if (nextIndex < 0) {
          flow.completed = true;
          return null;
        }
        flow.currentIndex = nextIndex;
        flow.effects[nextIndex].status = "active";
        return flow.effects[nextIndex];
      },
      activateNextIfIdle(flow) {
        const current = Number.isInteger(flow.currentIndex) ? flow.effects[flow.currentIndex] : null;
        if (current?.status === "active") return null;
        return this.activateNext(flow);
      },
      resolveCurrentChainNode(flow, result) {
        const current = flow.effects[flow.currentIndex];
        current.status = "completed";
        current.result = result;
        const nextIndex = flow.effects.findIndex((effect) => effect.status === "pending");
        if (nextIndex < 0) {
          flow.completed = true;
          return { next: null };
        }
        flow.currentIndex = nextIndex;
        flow.effects[nextIndex].status = "active";
        return { next: flow.effects[nextIndex] };
      },
      skipCurrentChainNode(flow) {
        const current = flow.effects[flow.currentIndex];
        current.status = "skipped";
        const nextIndex = flow.effects.findIndex((effect) => effect.status === "pending");
        if (nextIndex < 0) {
          flow.completed = true;
          return { next: null };
        }
        flow.currentIndex = nextIndex;
        flow.effects[nextIndex].status = "active";
        return { next: flow.effects[nextIndex] };
      },
    },
  };
  const helper = createEffectFlowHelpers({
    decisionSessions,
    pendingState,
    uiRuntimeState,
    actionHistory,
    quickActionHistory,
    historyStepOrder,
    els: { appWrap: { classList: { toggle() {} } } },
    rocketState: { statusNote: "" },
    abilities,
    historyCommands: {
      createRestoreTradeStateCommand: (player, cardState, beforeState) => ({
        type: "trade-restore",
        player,
        cardState,
        beforeState,
      }),
    },
    cardEffects: {
      consolidateCardMoveEffects: (effects) => effects,
    },
    quickTrades: {
      getTradeAction: (tradeId) => ({ label: `Trade ${tradeId}` }),
    },
    cardState: {},
    actionLogState: { draft: null },
    ACTION_LOG_DEFAULT_LABELS: { quick: "快速行动" },
    HISTORY_SOURCE_MAIN: "main",
    HISTORY_SOURCE_QUICK: "quick",
    getCurrentPlayer() {
      return { id: "p1" };
    },
    markCurrentActionIrreversible(reason, code) {
      calls.currentIrreversible.push({ reason, code });
      return { reason, code };
    },
    getIrreversibleReason(result, fallback) {
      return result?.irreversible?.reason || null || fallback && null;
    },
    recordTurnVisitPlanetEvents() {
      return null;
    },
    recordNeutralScoreTracesFromAbilityResult() {},
    recordScanScoreSourcesFromAbilityResult() {},
    startActionLogDraft() {},
    ensureActionLogDraft() {},
    appendActionLogStep(source, label, detail) {
      calls.appendLog.push({ source, label, detail });
    },
    removeActionLogStepsBySource() {},
    actionLogOptionsFromHistoryStep(step) {
      return { stepId: step.id };
    },
    createActionLogImpactSnapshot() {
      return { snapshot: true };
    },
    composeActionLogDetailWithImpact(detail) {
      return detail;
    },
    createActionBriefingStepMetadata() {
      return null;
    },
    markActionPending() {},
    clearCompletedEffectFlowForUndo() {},
    assignEffectFlowOwner(flow, playerId) {
      flow.ownerId = playerId;
    },
    setActiveEffectFlowOwner(effect) {
      calls.activeOwner.push(effect.id);
    },
    renderReservedCards() {},
    renderActionEffectBar() {
      calls.renderBar += 1;
    },
    updateActionButtons() {
      calls.updateButtons += 1;
    },
    renderStateReadout() {
      calls.readout += 1;
    },
    hasActiveCardTriggerResolution() {
      return false;
    },
    isCardTriggerRewardFlowBusy() {
      return false;
    },
    settleCardTasksAfterEffect(payload) {
      calls.settled.push(payload);
    },
    finishActionEffectFlow() {
      calls.finish += 1;
    },
    cancelActiveEffectSubFlows() {},
    maybeAutoExecuteAomomoRewardEffects() {},
    withEffectExecutionPlayer(effect, run) {
      calls.withOwner.push(effect.id);
      return run();
    },
    executeActionEffectForOwner(effect) {
      calls.executeOwner.push(effect.id);
      return { ok: true, effectId: effect.id };
    },
  });

  return {
    helper,
    pendingState,
    actionHistory,
    quickActionHistory,
    historyStepOrder,
    calls,
  };
}

{
  const { helper, pendingState } = createHarness();
  const started = helper.startCardEffectFlow("flow-1", "测试效果", [
    { id: "effect-1", status: "pending", label: "效果1", type: "gain" },
    { id: "effect-2", status: "pending", label: "效果2", type: "scan" },
  ], {
    historySource: "quick",
  });
  assert.equal(started, true);
  assert.equal(pendingState.actionEffectFlow.historySource, "quick");
  assert.equal(helper.getCurrentActionEffect().id, "effect-1");
}

{
  const { helper, quickActionHistory, historyStepOrder } = createHarness();
  helper.startCardEffectFlow("flow-2", "快速效果", [
    { id: "effect-q1", status: "pending", label: "奖励一", type: "gain" },
  ], {
    historySource: "quick",
  });
  helper.beginEffectHistoryStep("奖励一");
  helper.endEffectHistoryStep({
    result: { ok: true, message: "done" },
  });
  assert.equal(quickActionHistory.session.steps.length, 1);
  assert.equal(historyStepOrder[0].source, "quick");
}

{
  const { helper, historyStepOrder, actionHistory, quickActionHistory } = createHarness();
  actionHistory.beginSession("main", "主行动");
  actionHistory.beginStep({ label: "主步骤" });
  const mainStep = actionHistory.endStep();
  quickActionHistory.beginSession("quick", "快速行动");
  quickActionHistory.beginStep({ label: "快速步骤" });
  const quickStep = quickActionHistory.endStep();
  historyStepOrder.push({ source: "main", stepId: mainStep.id });
  historyStepOrder.push({ source: "quick", stepId: quickStep.id });
  assert.equal(helper.getLatestUndoSource(), "quick");
  quickActionHistory.session.steps[0].undoable = false;
  assert.equal(helper.getLatestUndoSource(), null);
}

{
  const { helper } = createHarness();
  assert.deepEqual(helper.executeActionEffect(null), { ok: false, message: "当前效果不可执行" });
  assert.deepEqual(
    helper.executeActionEffect({ id: "effect-9", status: "active" }),
    { ok: true, effectId: "effect-9" },
  );
}

console.log("effect-flow tests passed");
