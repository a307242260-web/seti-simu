"use strict";

const assert = require("node:assert/strict");
const { createEffectFlowHelpers, createEffectFlowUndoRuntime } = require("./effect-flow");

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
  const workingRoot = {
    match: {},
    playerState: { currentPlayerId: "p1", players: [{ id: "p1" }] },
    rocketState: { statusNote: "" },
    cardState: {},
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
    pendingState,
    uiRuntimeState,
    actionHistory,
    quickActionHistory,
    historyStepOrder,
    els: { appWrap: { classList: { toggle() {} } } },
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
    actionLogState: { draft: null },
    ACTION_LOG_DEFAULT_LABELS: { quick: "快速行动" },
    HISTORY_SOURCE_MAIN: "main",
    HISTORY_SOURCE_QUICK: "quick",
    getCurrentPlayer() {
      return { id: "p1" };
    },
    getWorkingRoot() {
      return rootState;
    },
    getCurrentPlayerForRoot(rootState) {
      return rootState.playerState.players.find((player) => player.id === rootState.playerState.currentPlayerId);
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
    setActiveEffectFlowOwner(_workingRoot, effect) {
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
    settleCardTasksAfterEffect(_workingRoot, payload) {
      calls.settled.push(payload);
    },
    finishActionEffectFlow() {
      calls.finish += 1;
    },
    cancelActiveEffectSubFlows() {},
    maybeAutoExecuteAomomoRewardEffects() {},
    withEffectExecutionPlayer(_workingRoot, effect, run) {
      calls.withOwner.push(effect.id);
      return run();
    },
    executeActionEffectForOwner(_workingRoot, effect) {
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
    workingRoot,
  };
}

{
  const { helper, workingRoot } = createHarness();
  const started = helper.startCardEffectFlow("flow-1", "测试效果", [
    { id: "effect-1", status: "pending", label: "效果1", type: "gain" },
    { id: "effect-2", status: "pending", label: "效果2", type: "scan" },
  ], {
    workingRoot,
    historySource: "quick",
  });
  assert.equal(started, true);
  assert.equal(workingRoot.match.actionEffectFlow.historySource, "quick");
  assert.equal(helper.getCurrentActionEffect(workingRoot).id, "effect-1");
}

{
  const { helper, quickActionHistory, historyStepOrder, workingRoot } = createHarness();
  helper.startCardEffectFlow("flow-2", "快速效果", [
    { id: "effect-q1", status: "pending", label: "奖励一", type: "gain" },
  ], {
    workingRoot,
    historySource: "quick",
  });
  helper.beginEffectHistoryStep(workingRoot, "奖励一");
  helper.endEffectHistoryStep(workingRoot, {
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
  const { helper, workingRoot } = createHarness();
  assert.deepEqual(helper.executeActionEffect(workingRoot, null), { ok: false, message: "当前效果不可执行" });
  assert.deepEqual(
    helper.executeActionEffect(workingRoot, { id: "effect-9", status: "active" }),
    { ok: true, effectId: "effect-9" },
  );
}

{
  const workingRoot = { match: { actionEffectFlow: {
    chainId: "flow-undo", actionType: "researchTech", currentIndex: 1, completed: true,
    effects: [
      { id: "e0", type: "gain", status: "completed", preHistoryCommandsApplied: true },
      { id: "e1", type: "research_tech_select", status: "completed", result: { ok: true }, preHistoryCommandsApplied: true },
      { id: "inserted", type: "gain", status: "completed", preHistoryCommandsApplied: true },
    ],
  } } };
  const calls = { removed: null, cancel: 0, restore: 0, active: [] };
  const undoRuntime = createEffectFlowUndoRuntime({
    abilities: { chain: { removeInsertedNodesBySource(_flow, source) { calls.removed = source; } } },
    getActionEffectFlow: (root) => root.match.actionEffectFlow || null,
    isMainActionOpeningStep: (step) => step.effectIndex === -1,
    clearActionEffectFlow: (root) => { delete root.match.actionEffectFlow; },
    pruneEndOfFlowSettlementEffectsAfterUndo() {},
    cancelActiveEffectSubFlows() { calls.cancel += 1; },
    restoreResearchTechSelectionAfterUndo() { calls.restore += 1; },
    setActionEffectFlowActive(active) { calls.active.push(active); },
  });
  undoRuntime.revertEffectFlowAfterUndo(workingRoot, {
    effectIndex: 1, effectId: "e1", effectType: "research_tech_select",
  });
  const flow = workingRoot.match.actionEffectFlow;
  assert.equal(flow.completed, false);
  assert.equal(flow.currentIndex, 1);
  assert.equal(flow.effects[1].status, "active");
  assert.equal(flow.effects[1].result, null);
  assert.equal(flow.effects[2].status, "pending");
  assert.deepEqual(calls.removed, {
    chainId: "flow-undo", effectId: "e1", effectIndex: 1, effectType: "research_tech_select",
  });
  assert.equal(calls.cancel, 1);
  assert.equal(calls.restore, 1);
  assert.deepEqual(calls.active, [true]);
}

console.log("effect-flow tests passed");
