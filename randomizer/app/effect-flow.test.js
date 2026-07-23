"use strict";

const assert = require("node:assert/strict");
const {
  createEffectFlowHelpers,
  createEffectFlowUndoRuntime,
  createIrreversibleBarrierRuntime,
  createEffectSubFlowCancellationRuntime,
  createEffectFlowCompletionRuntime,
  createEffectFlowStateRuntime,
  createEffectSkipRuntime,
  getMarkedNebulaIdsFromEvents,
  resultHasSignalMarkedEvent,
  getFlowMarkedNebulaIds,
  effectFlowMarkedNebula,
  createPendingSubFlowRuntime,
} = require("./effect-flow");

{
  const calls = [];
  const history = {
    hasSession: () => true,
    beginStep: (step) => calls.push(step),
    endStep: () => ({ id: "s1", label: "不可撤销奖励", irreversibleReason: "已揭示信息" }),
  };
  const runtime = createIrreversibleBarrierRuntime({
    actionHistory: history,
    historySourceMain: "main",
    rememberHistoryStep: (...args) => calls.push(args),
    appendActionLogStep: (...args) => calls.push(args),
    actionLogOptionsFromHistoryStep: () => ({ undoable: false }),
    markCurrentActionIrreversible: (...args) => calls.push(args),
  });
  const step = runtime.recordMainActionIrreversibleBarrier("不可撤销奖励", "已揭示信息");
  assert.equal(step.id, "s1");
  assert.equal(calls[0].undoable, false);
  assert.deepEqual(calls.at(-1), ["已揭示信息", "irreversible_effect"]);
}

{
  const flow = { effects: [
    { result: { events: [{ type: "signalMarked", nebulaId: 2 }, { type: "other" }] } },
    { result: { events: [{ type: "signalMarked", nebulaId: "2" }, { type: "signalMarked", nebulaId: "3" }] } },
  ] };
  assert.deepEqual([...getMarkedNebulaIdsFromEvents(flow.effects[0].result.events)], ["2"]);
  assert.equal(resultHasSignalMarkedEvent(flow.effects[0].result), true);
  assert.deepEqual([...getFlowMarkedNebulaIds(flow)], ["2", "3"]);
  assert.equal(effectFlowMarkedNebula(flow), true);
}

{
  const fallback = () => null;
  const runtime = createPendingSubFlowRuntime(new Proxy({
    getPendingScanTargetDecision: () => ({ type: "scan" }),
    isCardSelectionActive: () => false,
    isCardTriggerPickSelectionActive: () => false,
    hasAlienDecision: () => false,
    isScanAction4Open: () => false,
    isLandTargetOpen: () => false,
    isAlienTraceOpen: () => false,
    isMovePaymentSelectionActive: () => false,
    isDataPlaceOpen: () => false,
    isIndustryHandSelectionActive: () => false,
  }, { get: (target, key) => target[key] || fallback }));
  assert.equal(runtime.hasActiveEffectSubFlow(), true);
  assert.equal(runtime.hasActivePendingSubFlow(), true);
}

{
  const calls = [];
  const current = { id: "e1", label: "可选奖励", status: "active", options: {} };
  const runtime = createEffectSkipRuntime({
    getActionEffectFlow: () => ({ effects: [current] }),
    getCurrentActionEffect: () => current,
    getPendingYichangdianCornerAction: () => null,
    yichangdianCornerEffectType: "corner",
    openYichangdianCornerPicker: () => calls.push("corner"),
    finishCurrentCardMoveEffectEarly: () => false,
    getPendingScanTargetDecision: () => null,
    handleDrawnHandScanSkip: () => calls.push("scan-skip"),
    cancelActiveEffectSubFlowsForRoot: () => calls.push("cancel"),
    getEffectOwnerPlayer: () => null,
    getCurrentPlayer: () => null,
    renderInitialSelectionArea: () => calls.push("initial"),
    beginEffectHistoryStep: (_root, label) => calls.push(label),
    endEffectHistoryStep: () => calls.push("history-end"),
    completeCurrentActionEffect: (_root, status) => calls.push(`complete:${status}`),
    renderStateReadout: () => calls.push("render"),
    setStatusNote: (message) => calls.push(`status:${message}`),
  });
  const root = { rocketState: { statusNote: "" } };
  runtime.skipCurrentForRoot(root);
  assert.equal(root.rocketState.statusNote, "已跳过：可选奖励");
  assert.deepEqual(calls, ["cancel", "跳过：可选奖励", "history-end", "complete:skipped"]);
  current.status = "active";
  calls.length = 0;
  const result = runtime.skipWithMessage(root, current, "无可用目标", { reason: "empty" });
  assert.equal(result.payload.skipped, true);
  assert.equal(current.result.message, "无可用目标");
  assert.deepEqual(calls, ["跳过：可选奖励", "status:无可用目标", "complete:skipped", "render"]);
}

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

{
  const workingRoot = {
    match: {
      actionEffectFlow: { id: "flow" },
      cardSelectionContinuation: {
        type: "fundamentalism_exchange_pick", playerId: "p1",
        beforePlayerState: { resources: { credits: 3 } },
        beforeCardState: { selectionActive: false },
      },
      passReserveContinuation: {}, scanFreeMoveContinuation: {}, cardMoveContinuation: {},
      cardTriggerContinuation: {}, cardTaskCompletionContinuation: {}, cardTriggerFreeMoveContinuation: {},
      type1TriggerEvents: [], cardCornerFreeMoveContinuation: {}, strategySlotContinuation: {},
      piratesRaidContinuation: {},
    },
    playerState: { players: [{ id: "p1", resources: { credits: 0 } }] },
    cardState: { selectionActive: true },
  };
  const uiRuntimeState = { passReserveSelectionDismissed: true, passReserveSelectedCardId: "card" };
  const calls = { move: 0, alien: 0, tech: 0 };
  const runtime = createEffectSubFlowCancellationRuntime({
    uiRuntimeState,
    getPublicScanQueueSession: () => null,
    isCardSelectionActive: () => true,
    getActionEffectFlow: (root) => root.match.actionEffectFlow,
    isCardTriggerPickSelectionActive: () => false,
    getPendingCardSelectionDecision: (root) => root.match.cardSelectionContinuation,
    resolvePlayerReference: ({ playerId }) => workingRoot.playerState.players.find((p) => p.id === playerId),
    restoreObjectSnapshot(target, snapshot) { Object.keys(target).forEach((key) => delete target[key]); Object.assign(target, structuredClone(snapshot)); },
    setPendingCardSelectionDecision: (root, value) => { root.match.cardSelectionContinuation = value; },
    setCardSelectionActive: (state, active) => { state.selectionActive = active; },
    getPendingPassReserveSelection: (root) => root.match.passReserveContinuation,
    getPendingScanFreeMoveDecision: (root) => root.match.scanFreeMoveContinuation,
    getPendingCardMoveDecision: (root) => root.match.cardMoveContinuation,
    deactivateMoveMode: () => { calls.move += 1; },
    getPendingDataPlacementDecision: () => null,
    clearAlienDecisionDrafts: () => { calls.alien += 1; },
    getPendingPiratesRaidDecision: (root) => root.match.piratesRaidContinuation,
    renderTechBoard: () => { calls.tech += 1; },
  });
  runtime.cancelActiveEffectSubFlowsForRoot(workingRoot);
  assert.equal(workingRoot.playerState.players[0].resources.credits, 3);
  assert.equal(workingRoot.cardState.selectionActive, false);
  for (const key of [
    "passReserveContinuation", "scanFreeMoveContinuation", "cardMoveContinuation",
    "cardTriggerContinuation", "cardTaskCompletionContinuation", "cardTriggerFreeMoveContinuation",
    "type1TriggerEvents", "cardCornerFreeMoveContinuation", "strategySlotContinuation", "piratesRaidContinuation",
  ]) assert.equal(Object.hasOwn(workingRoot.match, key), false, key);
  assert.equal(uiRuntimeState.passReserveSelectionDismissed, false);
  assert.equal(uiRuntimeState.passReserveSelectedCardId, null);
  assert.equal(calls.move, 2);
  assert.equal(calls.alien, 1);
  assert.equal(calls.tech, 1);
}

{
  const flow = {
    actionType: "scan", historySource: "main", consumesMainAction: true,
    cardTemporaryTasks: [], sectorSettlementResult: {
      ok: true, message: "扇区完成", participantAwardMessage: "参与奖励",
    },
  };
  const workingRoot = {
    match: { actionEffectFlow: flow },
    playerState: { currentPlayerId: "p1" }, turnState: {}, rocketState: {},
  };
  const calls = { remembered: null, cleared: 0, pending: 0, render: 0, resume: 0 };
  const runtime = createEffectFlowCompletionRuntime({
    getActionEffectFlow: (root) => root.match.actionEffectFlow || null,
    appendEndOfFlowSectorFinishEffects: () => false,
    appendDeferredEndOfFlowEffects: () => false,
    collectTemporaryTaskRewards: () => [],
    cloneDelayedPublicRefills: () => [],
    settleDelayedPublicRefillsAfterScanFlow: () => ({ message: "公共牌补齐" }),
    rememberCompletedEffectFlowForUndo: (value) => { calls.remembered = value; },
    clearActionEffectFlow: (root) => { delete root.match.actionEffectFlow; calls.cleared += 1; },
    startTemporaryCardTaskRewardFlow: () => false,
    applyType1TriggerMatchesForRoot: () => null,
    hasActiveCardTriggerResolution: () => false,
    isActionEffectFlowActive: () => false,
    markActionPending: () => { calls.pending += 1; },
    renderPlayerStats: () => { calls.render += 1; },
    renderAlienPanels: () => { calls.render += 1; },
    updateActionButtons: () => { calls.render += 1; },
    renderStateReadout: () => { calls.render += 1; },
    maybeResumeTurnEndAfterReveal: () => { calls.resume += 1; },
  });
  runtime.finishActionEffectFlowForRoot(workingRoot);
  assert.equal(calls.remembered, flow);
  assert.equal(calls.cleared, 1);
  assert.equal(calls.pending, 1);
  assert.equal(calls.render, 4);
  assert.equal(calls.resume, 1);
  assert.equal(
    workingRoot.rocketState.statusNote,
    "扫描效果已全部处理，可继续执行次要行动或回合结束；扇区完成；参与奖励；公共牌补齐",
  );
}

{
  const actionHistory = createHistoryHarness();
  actionHistory.beginSession("initialIncome", "初始收入");
  const workingRoot = {
    match: { actionEffectFlow: { actionType: "initialIncome", cardTemporaryTasks: [] } },
    playerState: { currentPlayerId: "p2" }, turnState: { startPlayerId: "p1" }, rocketState: {},
  };
  const uiRuntimeState = { effectStepActive: true };
  let finishedUi = 0;
  createEffectFlowCompletionRuntime({
    uiRuntimeState, actionHistory,
    getActionEffectFlow: (root) => root.match.actionEffectFlow,
    appendEndOfFlowSectorFinishEffects: () => false,
    appendDeferredEndOfFlowEffects: () => false,
    collectTemporaryTaskRewards: () => [], cloneDelayedPublicRefills: () => [],
    rememberCompletedEffectFlowForUndo() {}, clearActionEffectFlow() {},
    finishInitialIncomeUi: () => { finishedUi += 1; },
  }).finishActionEffectFlowForRoot(workingRoot);
  assert.equal(actionHistory.hasSession(), false);
  assert.equal(uiRuntimeState.effectStepActive, false);
  assert.equal(workingRoot.playerState.currentPlayerId, "p1");
  assert.equal(workingRoot.rocketState.statusNote, "初始收入增加完成，游戏开始。");
  assert.equal(finishedUi, 1);
}

{
  const uiRuntimeState = { completedEffectFlowsForUndo: {} };
  const root = { match: { actionEffectFlow: { id: "active" } } };
  const calls = [];
  const runtime = createEffectFlowStateRuntime({
    uiRuntimeState,
    actionHistory: { hasUndoableStep: () => true },
    setActionEffectFlow: (workingRoot, flow) => { workingRoot.match.actionEffectFlow = flow; },
    closeLandTargetPicker: () => calls.push("land"),
    closeScanAction4Picker: () => calls.push("scan"),
    renderActionEffectBar: () => calls.push("bar"),
    setActionEffectFlowActive: (active) => calls.push(`active:${active}`),
    renderReservedCards: () => calls.push("reserved"),
  });
  const completed = {
    historySource: "main",
    effects: [{ id: "e1", type: "gain", status: "completed" }],
  };
  runtime.rememberCompletedEffectFlowForUndo(completed);
  assert.equal(runtime.peekCompletedEffectFlowForUndo({ effectIndex: 0, effectType: "gain" }, "main"), completed);
  assert.equal(runtime.takeCompletedEffectFlowForUndo({ effectIndex: 0, effectType: "scan" }, "main"), null);
  assert.equal(runtime.takeCompletedEffectFlowForUndo({ effectIndex: 0, effectType: "gain" }, "main"), completed);
  assert.equal(uiRuntimeState.completedEffectFlowsForUndo.main, null);
  runtime.clearActionEffectFlow(root);
  assert.equal(root.match.actionEffectFlow, null);
  assert.deepEqual(calls, ["land", "scan", "bar", "active:false", "reserved"]);
}

console.log("effect-flow tests passed");
